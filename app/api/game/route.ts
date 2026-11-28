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
import { castBanVote, projectBanVote } from '../../../src/poker/moderation.ts';
import { PRESENCE_WRITE_MS, publicPlayerUid, turnKey } from '../../../src/poker/seat.ts';
import { createBlindSchedule } from '../../../src/poker/blinds.ts';
import { computeHandStatDeltas } from '../../../src/poker/hand-stats.ts';
import { persistHandStats } from '../../../src/server/stats-recorder.ts';
import { createServerSupabase } from '../../../src/lib/supabase/server.ts';
export const runtime = 'nodejs';

async function readAuthProfile(): Promise<{
  userId?: string;
  avatar?: { style: string; seed: string };
}> {
  try {
    const sb = await createServerSupabase();
    if (!sb) return {};
    const { data } = await sb.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return {};
    const { data: prof } = await sb
      .from('profiles')
      .select('avatar_style, avatar_seed')
      .eq('id', userId)
      .single();
    return {
      userId,
      ...(prof?.avatar_style
        ? { avatar: { style: prof.avatar_style, seed: prof.avatar_seed || '' } }
        : {}),
    };
  } catch {
    return {};
  }
}

const MAX_SPECTATORS = 30;
const reply = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { 'Cache-Control': 'no-store' } });
const ok = (code: string, s: GameState, id: string, version: number): Room => ({
  code,
  state: project(s, id),
  version,
  now: Date.now(),
  channel: roomChannel(code),
  turnKey: turnKey(s),
  myActionReceipts: s.players.find((p) => p.id === id && !p.left && !p.kicked)?.actionReceipts,
});

type Store = ReturnType<typeof openRoomStore>;
type Row = { code: string; state: GameState; version: number };

function sessionSeat(s: GameState, token: string) {
  return s.players.find((p) => !p.left && !p.kicked && (p.sessionToken ?? p.id) === token);
}

async function updatePresence(store: Store, data: Row, member: Player) {
  const now = Date.now();
  if (now - (member.lastSeenAt ?? 0) < PRESENCE_WRITE_MS) return data.version;
  member.lastSeenAt = now;
  data.state.touched = now;
  return (await store.update(data.code, data.version, data.state))
    ? data.version + 1
    : data.version;
}

// Aplica prazos vencidos (jogada automática, próxima mão) antes de qualquer operação.
async function settleDue(store: Store, code: string, data: Row): Promise<Row> {
  if (!resolveDue(data.state)) return data;
  const deltas = computeHandStatDeltas(data.state);
  data.state.touched = Date.now();
  if (await store.update(code, data.version, data.state)) {
    if (deltas.length) await persistHandStats(deltas);
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
    const token = b.token;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw Error('Sessão inválida');
    if (!allow('t:' + token, 40, 10_000))
      return reply({ error: 'Muitas requisições. Aguarde alguns segundos.' }, 429);
    let code = String(b.code || '')
      .trim()
      .toUpperCase();
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
      const guided = b.guided === true;
      if (!name && !guided) throw Error('Informe seu nome');
      const playerName = name || 'Você';
      code = randomBytes(6).toString('hex').toUpperCase();
      const stack = guided ? 1000 : Number(b.stack || 2000),
        bb = guided ? 20 : Number(b.bb || 20),
        seconds = guided ? 30 : Number(b.seconds || 30),
        bots = guided ? 1 : b.bots == null ? 0 : Number(b.bots),
        botDifficulty = guided
          ? 'easy'
          : isBotDifficulty(b.botDifficulty)
            ? b.botDifficulty
            : 'medium',
        blindsMode =
          !guided && (b.blindsMode === 'hands' || b.blindsMode === 'time') ? b.blindsMode : 'fixed',
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
      const auth = await readAuthProfile();
      const players: Player[] = [
        {
          id: token,
          ...(!guided && auth.userId ? { userId: auth.userId } : {}),
          name: playerName,
          lastSeenAt: Date.now(),
          stack,
          cards: [],
          bet: 0,
          total: 0,
          avatar: cleanAvatar(b.avatar ?? auth.avatar, playerName),
        },
      ];
      for (let i = 0; i < bots; i++) {
        players.push(createBotPlayer(players, stack, botDifficulty));
      }
      const s: GameState = {
        host: token,
        ...(guided ? { guided: true } : {}),
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
      if (guided) start(s);
      if (!(await store.create(code, s))) throw Error('Falha ao criar sala');
      return reply(ok(code, s, token, 0));
    }
    if (!/^[A-F0-9]{12}$/.test(code)) throw Error('Código inválido');
    let data = await store.read(code);
    if (!data) return reply({ error: 'Sala não encontrada' }, 404);
    data = await settleDue(store, code, data);
    const s: GameState = data.state;
    const member = sessionSeat(s, token);
    const watcher = s.spectators?.find((p) => p.id === token);
    const id = member?.id ?? token;
    if (s.removed?.includes(id) || s.removed?.includes(token)) {
      const banned = !!s.banned?.includes(id) || !!s.banned?.includes(token);
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

    if (b.op === 'recover') {
      const { userId } = await readAuthProfile();
      if (!userId) return reply({ error: 'Entre na sua conta para recuperar o assento.' }, 401);
      const seat = s.players.find((p) => p.userId === userId && !p.left && !p.kicked);
      if (!seat) return reply({ error: 'Sua conta não tem um assento nesta mesa.' }, 403);
      if ((member && member !== seat) || s.players.some((p) => p !== seat && p.id === token)) {
        return reply(
          { error: 'Este navegador já está vinculado a outro assento nesta mesa.' },
          409,
        );
      }
      if (member === seat)
        return reply(ok(code, s, seat.id, await updatePresence(store, data, seat)));
      seat.sessionToken = token;
      seat.lastSeenAt = Date.now();
      s.touched = seat.lastSeenAt;
      if (watcher) s.spectators = s.spectators?.filter((p) => p !== watcher);
      if (!(await store.update(code, data.version, s))) {
        return reply({ error: 'A sala mudou. Tente recuperar o assento novamente.' }, 409);
      }
      await notifyRoom(code, data.version + 1);
      return reply(ok(code, s, seat.id, data.version + 1));
    }
    if (!member && s.players.some((p) => !p.left && p.id === token)) {
      return reply({ error: 'Seu assento está em uso em outro dispositivo.', moved: true }, 403);
    }
    if (s.guided && !member) return reply({ error: 'Esta mesa é um treino individual.' }, 403);
    if (b.op === 'join' && !member && !watcher) {
      if (!name) throw Error('Informe seu nome');
      const auth = await readAuthProfile();
      if (auth.userId && s.players.some((p) => p.userId === auth.userId && !p.left && !p.kicked)) {
        return reply(
          { error: 'Sua conta já tem um lugar nesta mesa. Use Recuperar meu assento.' },
          409,
        );
      }
      const avatar = cleanAvatar(b.avatar ?? auth.avatar, name);
      if (s.phase === 'waiting' && s.players.length < 8 && !s.players.some((p) => p.id === id)) {
        s.players.push({
          id,
          ...(auth.userId ? { userId: auth.userId } : {}),
          name,
          stack: s.initial,
          cards: [],
          bet: 0,
          total: 0,
          avatar,
          lastSeenAt: Date.now(),
        });
      } else {
        // Sala cheia ou partida em andamento: entra como espectador.
        if ((s.spectators?.length ?? 0) >= MAX_SPECTATORS) throw Error('A sala está lotada.');
        (s.spectators ??= []).push({ id, name, avatar });
      }
    } else {
      if (!member && !watcher) return reply({ error: 'Entre na sala' }, 403);
      if (b.op === 'state' || b.op === 'join') {
        const version = member ? await updatePresence(store, data, member) : data.version;
        return reply(ok(code, s, id, version));
      }
      if (watcher && !member) {
        if (b.op !== 'leave' && b.op !== 'sit' && b.op !== 'want_to_play')
          return reply({ error: 'Espectadores só acompanham a partida.' }, 403);
        if (b.version !== data.version)
          return reply({ error: 'Estado atualizado; tente novamente' }, 409);
        if (b.op === 'leave') {
          s.spectators = s.spectators!.filter((p) => p.id !== id);
        } else if (b.op === 'want_to_play') {
          watcher.wantsToPlay = b.active === true;
        } else {
          if (s.phase !== 'waiting' || s.players.length >= 8 || s.players.some((p) => p.id === id))
            throw Error('Não há lugar livre agora.');
          s.spectators = s.spectators!.filter((p) => p.id !== id);
          const auth = await readAuthProfile();
          if (
            auth.userId &&
            s.players.some((p) => p.userId === auth.userId && !p.left && !p.kicked)
          ) {
            throw Error('Sua conta já tem um assento. Abra o convite para recuperá-lo.');
          }
          s.players.push({
            id,
            ...(auth.userId ? { userId: auth.userId } : {}),
            name: watcher.name,
            lastSeenAt: Date.now(),
            stack: s.initial,
            cards: [],
            bet: 0,
            total: 0,
            avatar: watcher.avatar ?? cleanAvatar(auth.avatar, watcher.name),
          });
        }
      } else if (b.op === 'sit') throw Error('Comando inválido');
      else if (b.op === 'leave') {
        let cur: Row = data;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (sessionSeat(cur.state, token)?.id !== id) return reply({ left: true });
          leaveTable(cur.state, id);
          const deltas = computeHandStatDeltas(cur.state);
          cur.state.touched = Date.now();
          if (await store.update(code, cur.version, cur.state)) {
            if (deltas.length) await persistHandStats(deltas);
            await notifyRoom(code, cur.version + 1);
            return reply({ left: true });
          }
          const fresh = await store.read(code);
          if (!fresh) return reply({ left: true });
          cur = await settleDue(store, code, fresh);
        }
        return reply({ error: 'A sala mudou. Tente sair novamente.' }, 409);
      } else if (b.op === 'emote') {
        if (s.phase === 'waiting') throw Error('As reações ficam disponíveis durante a partida');
        if (!isEmoteId(b.emote)) throw Error('Reação inválida');
        let cur: Row = data;
        for (let attempt = 0; attempt < 2; attempt++) {
          const seatIdx = cur.state.players.findIndex((p) => p.id === id);
          if (seatIdx < 0 || sessionSeat(cur.state, token)?.id !== id)
            return reply({ error: 'Entre na sala' }, 403);
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
          if (sessionSeat(cur.state, token)?.id !== id)
            return reply({ error: 'Entre na sala' }, 403);
          castBanVote(cur.state, id, targetUid, vote);
          const deltas = computeHandStatDeltas(cur.state);
          cur.state.touched = Date.now();
          if (await store.update(code, cur.version, cur.state)) {
            if (deltas.length) await persistHandStats(deltas);
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
        const actionId = b.op === 'action' && typeof b.actionId === 'string' ? b.actionId : null;
        if (actionId !== null) {
          if (!/^[a-f0-9-]{36}$/.test(actionId) || typeof b.turnKey !== 'string')
            throw Error('Identificador de jogada inválido');
          if (member?.actionReceipts?.includes(actionId))
            return reply(ok(code, s, id, data.version));
          if (b.turnKey !== turnKey(s)) return reply({ error: 'Esta vez já terminou.' }, 409);
        } else if (b.version !== data.version) {
          return reply({ error: 'Estado atualizado; tente novamente' }, 409);
        }
        if (b.op === 'ready') {
          if (s.phase !== 'waiting' || !member) throw Error('Confirme sua presença no lobby');
          member.ready = b.active === true;
        } else if (b.op === 'start') {
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
          if (!gone.bot)
            (s.removed ??= []).push(gone.id, ...(gone.sessionToken ? [gone.sessionToken] : []));
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
        } else if (b.op === 'action') {
          if (!member || !['fold', 'check', 'call', 'raise'].includes(String(b.type))) {
            throw Error('Ação inválida');
          }
          act(s, id, b.type, b.amount);
          if (actionId)
            member.actionReceipts = [...(member.actionReceipts ?? []), actionId].slice(-32);
        } else throw Error('Comando inválido');
      }
    }
    const deltas = computeHandStatDeltas(s);
    s.touched = Date.now();
    if (member) member.lastSeenAt = s.touched;
    if (!(await store.update(code, data.version, s)))
      return reply({ error: 'Conflito; tente novamente' }, 409);
    if (deltas.length) await persistHandStats(deltas);
    await notifyRoom(code, data.version + 1);
    return reply(ok(code, s, id, data.version + 1));
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : 'Erro' }, 400);
  }
}
function project(s: GameState, id: string): PublicState {
  const isPlayer = s.players.some((p) => p.id === id && !p.left && !p.kicked);
  const v = view(s, isPlayer ? id : '');
  return {
    ...v,
    host: isPlayer && s.host === id,
    role: isPlayer ? 'player' : 'spectator',
    players: v.players.map((p) => {
      const { id: pid, ...rest } = p;
      return {
        ...rest,
        uid: publicPlayerUid(pid),
        self: isPlayer && pid === id,
        ...(pid === s.host ? { isHost: true } : {}),
      };
    }),
    spectators: (s.spectators ?? []).map((p) => ({
      name: p.name,
      avatar: p.avatar,
      self: !isPlayer && p.id === id,
      wantsToPlay: p.wantsToPlay,
    })),
    banVote: projectBanVote(s, id),
  };
}
