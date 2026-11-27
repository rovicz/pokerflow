import type { GameState, Player, PublicState, Room } from '../../../src/poker/game-types.ts';

import { openRoomStore } from '../../../src/server/room-store.ts';
import { notifyRoom, roomChannel } from '../../../src/server/room-notify.ts';
import { allow } from '../../../src/server/rate-limit.ts';
import { randomBytes } from 'node:crypto';
import {
  start,
  act,
  view,
  betweenHands,
  showCards,
  rematch,
  leaveTable,
  setSitOut,
} from '../../../src/poker/engine.ts';
import { resolveDue } from '../../../src/poker/timeouts.ts';
import { cleanAvatar } from '../../../src/poker/avatars.ts';
import { isEmoteId, pushEmote } from '../../../src/poker/emotes.ts';
import { createBotPlayer, isBotDifficulty } from '../../../src/poker/bot-ai.ts';
import { castBanVote, projectBanVote, publicPlayerUid } from '../../../src/poker/moderation.ts';
import { createBlindSchedule } from '../../../src/poker/blinds.ts';
export const runtime = 'nodejs';

const MAX_SPECTATORS = 30;
const reply = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { 'Cache-Control': 'no-store' } });
const ok = (code: string, s: GameState, id: string, version: number): Room => ({
  code,
  state: project(s, id),
  version,
  now: Date.now(),
  channel: roomChannel(code),
});

type Store = ReturnType<typeof openRoomStore>;
type Row = { code: string; state: GameState; version: number };

// Aplica prazos vencidos (jogada automática, próxima mão) antes de qualquer operação.
async function settleDue(store: Store, code: string, data: Row): Promise<Row> {
  if (!resolveDue(data.state)) return data;
  data.state.touched = Date.now();
  if (await store.update(code, data.version, data.state)) {
    await notifyRoom(code, data.version + 1);
    return { ...data, version: data.version + 1 };
  }
  return (await store.read(code)) ?? data; // outra requisição resolveu primeiro
}

export async function POST(req: Request) {
  try {
    const store = openRoomStore();
    const input: unknown = await req.json();
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw Error('Comando inválido');
    const b = input as Record<string, unknown>;
    const id = b.token;
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw Error('Sessão inválida');
    if (!allow('t:' + id, 40, 10_000))
      return reply({ error: 'Muitas requisições. Aguarde alguns segundos.' }, 429);
    let code = String(b.code || '').toUpperCase();
    const name = String(b.name || '')
      .trim()
      .slice(0, 24);
    if (b.op === 'create') {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
      if (!allow('c:' + ip, 8, 10 * 60_000))
        return reply(
          { error: 'Você criou muitas mesas em pouco tempo. Tente novamente mais tarde.' },
          429,
        );
      if (!name) throw Error('Informe seu nome');
      code = randomBytes(6).toString('hex').toUpperCase();
      const stack = Number(b.stack || 2000),
        bb = Number(b.bb || 20),
        seconds = Number(b.seconds || 30),
        bots = b.bots == null ? 0 : Number(b.bots),
        botDifficulty = isBotDifficulty(b.botDifficulty) ? b.botDifficulty : 'medium',
        blindsMode = b.blindsMode === 'hands' || b.blindsMode === 'time' ? b.blindsMode : 'fixed',
        blindsEvery = Number(b.blindsEvery || (blindsMode === 'time' ? 300 : 8));
      if (
        ![1000, 2000, 5000, 10000].includes(stack) ||
        ![10, 20, 50, 100].includes(bb) ||
        ![15, 30, 45, 60].includes(seconds) ||
        !Number.isInteger(bots) ||
        bots < 0 ||
        bots > 7
      )
        throw Error('Configuração inválida');
      const blinds =
        blindsMode === 'fixed' ? null : createBlindSchedule(blindsMode, blindsEvery, bb);
      const players: Player[] = [
        { id, name, stack, cards: [], bet: 0, total: 0, avatar: cleanAvatar(b.avatar, name) },
      ];
      for (let i = 0; i < bots; i++) {
        players.push(createBotPlayer(players, stack, botDifficulty));
      }
      const s: GameState = {
        host: id,
        players,
        initial: stack,
        sb: bb / 2,
        bb,
        blinds,
        seconds,
        botDifficulty,
        phase: 'waiting',
        dealer: -1,
        turn: -1,
        hand: 0,
        board: [],
        result: [],
        touched: Date.now(),
      };
      if (!(await store.create(code, s))) throw Error('Falha ao criar sala');
      return reply(ok(code, s, id, 0));
    }
    if (!/^[A-F0-9]{12}$/.test(code)) throw Error('Código inválido');
    let data = await store.read(code);
    if (!data) return reply({ error: 'Sala não encontrada' }, 404);
    data = await settleDue(store, code, data);
    const s: GameState = data.state;
    if (s.removed?.includes(id)) {
      const banned = !!s.banned?.includes(id);
      return reply(
        {
          error: banned
            ? 'Você foi expulso desta sala por votação.'
            : 'Você foi removido desta sala pelo anfitrião.',
          removed: true,
          ...(banned ? { banned: true } : {}),
        },
        403,
      );
    }
    const member = s.players.find((p) => p.id === id && !p.left);
    const watcher = s.spectators?.find((p) => p.id === id);
    if (b.op === 'join' && !member && !watcher) {
      if (!name) throw Error('Informe seu nome');
      const avatar = cleanAvatar(b.avatar, name);
      if (s.phase === 'waiting' && s.players.length < 8)
        s.players.push({ id, name, stack: s.initial, cards: [], bet: 0, total: 0, avatar });
      else {
        // Sala cheia ou partida em andamento: entra como espectador.
        if ((s.spectators?.length ?? 0) >= MAX_SPECTATORS) throw Error('A sala está lotada.');
        (s.spectators ??= []).push({ id, name, avatar });
      }
    } else {
      if (!member && !watcher) return reply({ error: 'Entre na sala' }, 403);
      if (b.op === 'state' || b.op === 'join') return reply(ok(code, s, id, data.version));
      if (watcher) {
        if (b.op !== 'leave' && b.op !== 'sit')
          return reply({ error: 'Espectadores só acompanham a partida.' }, 403);
        if (b.version !== data.version)
          return reply({ error: 'Estado atualizado; tente novamente' }, 409);
        if (b.op === 'leave') s.spectators = s.spectators!.filter((p) => p.id !== id);
        else {
          if (s.phase !== 'waiting' || s.players.length >= 8)
            throw Error('Não há lugar livre agora.');
          s.spectators = s.spectators!.filter((p) => p.id !== id);
          s.players.push({
            id,
            name: watcher.name,
            stack: s.initial,
            cards: [],
            bet: 0,
            total: 0,
            avatar: watcher.avatar,
          });
        }
      } else if (b.op === 'sit') throw Error('Comando inválido');
      else if (b.op === 'leave') {
        let cur: Row = data;
        for (let attempt = 0; attempt < 2; attempt++) {
          leaveTable(cur.state, id);
          cur.state.touched = Date.now();
          if (await store.update(code, cur.version, cur.state)) {
            await notifyRoom(code, cur.version + 1);
            return reply({ left: true });
          }
          const fresh = await store.read(code);
          if (!fresh) return reply({ left: true });
          cur = await settleDue(store, code, fresh);
        }
        return reply({ left: true });
      } else if (b.op === 'emote') {
        if (s.phase === 'waiting') throw Error('As reações ficam disponíveis durante a partida');
        if (!isEmoteId(b.emote)) throw Error('Reação inválida');
        let cur: Row = data;
        for (let attempt = 0; attempt < 2; attempt++) {
          const seatIdx = cur.state.players.findIndex((p) => p.id === id);
          if (seatIdx < 0) return reply({ error: 'Entre na sala' }, 403);
          const res = pushEmote(cur.state.emotes, seatIdx, b.emote);
          if (!res.ok) return reply(ok(code, cur.state, id, cur.version));
          cur.state.emotes = res.emotes;
          if (await store.update(code, cur.version, cur.state)) {
            await notifyRoom(code, cur.version + 1);
            return reply(ok(code, cur.state, id, cur.version + 1));
          }
          const fresh = await store.read(code);
          if (!fresh) return reply({ error: 'Sala não encontrada' }, 404);
          cur = fresh;
        }
        return reply(ok(code, cur.state, id, cur.version));
      } else if (b.op === 'vote_kick') {
        const targetUid = typeof b.targetUid === 'string' ? b.targetUid : '';
        const vote = b.vote === 'no' ? 'no' : b.vote === 'yes' ? 'yes' : null;
        if (!targetUid || !vote) throw Error('Voto inválido');
        let cur: Row = data;
        for (let attempt = 0; attempt < 2; attempt++) {
          castBanVote(cur.state, id, targetUid, vote);
          cur.state.touched = Date.now();
          if (await store.update(code, cur.version, cur.state)) {
            await notifyRoom(code, cur.version + 1);
            return reply(ok(code, cur.state, id, cur.version + 1));
          }
          const fresh = await store.read(code);
          if (!fresh) return reply({ error: 'Sala não encontrada' }, 404);
          cur = await settleDue(store, code, fresh);
          if (cur.state.removed?.includes(id)) {
            const banned = !!cur.state.banned?.includes(id);
            return reply(
              {
                error: banned
                  ? 'Você foi expulso desta sala por votação.'
                  : 'Você foi removido desta sala pelo anfitrião.',
                removed: true,
                ...(banned ? { banned: true } : {}),
              },
              403,
            );
          }
        }
        return reply({ error: 'Conflito; tente novamente' }, 409);
      } else {
        if (b.version !== data.version)
          return reply({ error: 'Estado atualizado; tente novamente' }, 409);
        if (b.op === 'start') {
          if (s.host !== id) throw Error('Somente anfitrião');
          if (s.phase !== 'waiting') throw Error('A próxima mão começa automaticamente');
          start(s);
        } else if (b.op === 'interval') betweenHands(s, id, b.type);
        else if (b.op === 'add_bot') {
          if (s.host !== id || s.phase !== 'waiting')
            throw Error('Somente o anfitrião pode adicionar bots antes da partida');
          if (s.players.length >= 8) throw Error('A mesa já está cheia (8 jogadores)');
          const diff = isBotDifficulty(b.botDifficulty)
            ? b.botDifficulty
            : (s.botDifficulty ?? 'medium');
          s.botDifficulty = diff;
          s.players.push(createBotPlayer(s.players, s.initial, diff));
        } else if (b.op === 'remove') {
          if (s.host !== id || s.phase !== 'waiting')
            throw Error('Somente o anfitrião pode remover jogadores antes da partida');
          if (
            typeof b.seat !== 'number' ||
            !Number.isInteger(b.seat) ||
            !s.players[b.seat] ||
            s.players[b.seat].id === id
          )
            throw Error('Jogador inválido');
          const [gone] = s.players.splice(b.seat, 1);
          if (!gone.bot) (s.removed ??= []).push(gone.id);
          if (s.banVote?.targetId === gone.id) s.banVote = null;
        } else if (b.op === 'avatar') {
          if (s.phase !== 'waiting') throw Error('O avatar só pode ser trocado na sala de espera');
          member!.avatar = cleanAvatar(b.avatar, member!.name);
        } else if (b.op === 'show_cards') {
          showCards(s, id, b.indices);
        } else if (b.op === 'rematch') {
          rematch(s, id, b.mode);
        } else if (b.op === 'sit_out') {
          setSitOut(s, id, !!b.active);
        } else if (b.op === 'blinds') {
          if (s.host !== id || s.phase !== 'waiting') {
            throw Error('Somente o anfitrião pode configurar os blinds na sala de espera');
          }
          const mode = b.blindsMode === 'hands' || b.blindsMode === 'time' ? b.blindsMode : 'fixed';
          const baseBb = s.blinds?.baseBb ?? s.bb;
          if (mode === 'fixed') {
            s.blinds = null;
          } else {
            const every = Number(b.blindsEvery || (mode === 'time' ? 300 : 8));
            s.blinds = createBlindSchedule(mode, every, baseBb);
          }
          s.bb = baseBb;
          s.sb = baseBb / 2;
        } else if (b.op === 'action') act(s, id, b.type, b.amount);
        else throw Error('Comando inválido');
      }
    }
    s.touched = Date.now();
    if (!(await store.update(code, data.version, s)))
      return reply({ error: 'Conflito; tente novamente' }, 409);
    await notifyRoom(code, data.version + 1);
    return reply(ok(code, s, id, data.version + 1));
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : 'Erro' }, 400);
  }
}
function project(s: GameState, id: string): PublicState {
  const v = view(s, id);
  return {
    ...v,
    host: s.host === id,
    role: s.players.some((p) => p.id === id) ? 'player' : 'spectator',
    players: v.players.map((p) => {
      const { id: pid, ...rest } = p;
      return {
        ...rest,
        uid: publicPlayerUid(pid),
        self: pid === id,
        ...(pid === s.host ? { isHost: true } : {}),
      };
    }),
    spectators: (s.spectators ?? []).map((p) => ({
      name: p.name,
      avatar: p.avatar,
      self: p.id === id,
    })),
    banVote: projectBanVote(s, id),
  };
}
