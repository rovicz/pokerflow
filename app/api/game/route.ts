import type { GameState, PublicState } from '../../../src/poker/game-types.ts';

import { openRoomStore } from '../../../src/server/room-store.ts';
import { notifyRoom } from '../../../src/server/room-notify.ts';
import { randomBytes } from 'node:crypto';
import { start, act, view, betweenHands } from '../../../src/poker/engine.ts';
import { cleanAvatar } from '../../../src/poker/avatars.ts';
export const runtime = 'nodejs';
const reply = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(req: Request) {
  try {
    const store = openRoomStore();
    const input: unknown = await req.json();
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw Error('Comando inválido');
    const b = input as Record<string, unknown>;
    const id = b.token;
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw Error('Sessão inválida');
    let code = String(b.code || '').toUpperCase();
    const name = String(b.name || '')
      .trim()
      .slice(0, 24);
    if (b.op === 'create') {
      if (!name) throw Error('Informe seu nome');
      code = randomBytes(6).toString('hex').toUpperCase();
      const stack = Number(b.stack || 2000),
        bb = Number(b.bb || 20),
        seconds = Number(b.seconds || 30);
      if (
        ![1000, 2000, 5000, 10000].includes(stack) ||
        ![10, 20, 50, 100].includes(bb) ||
        ![15, 30, 45, 60].includes(seconds)
      )
        throw Error('Configuração inválida');
      const s: GameState = {
        host: id,
        players: [
          { id, name, stack, cards: [], bet: 0, total: 0, avatar: cleanAvatar(b.avatar, name) },
        ],
        initial: stack,
        sb: bb / 2,
        bb,
        seconds,
        phase: 'waiting',
        dealer: -1,
        turn: -1,
        hand: 0,
        board: [],
        result: [],
      };
      if (!(await store.create(code, s))) throw Error('Falha ao criar sala');
      return reply({ code, state: project(s, id), version: 0 });
    }
    if (!/^[A-F0-9]{12}$/.test(code)) throw Error('Código inválido');
    const data = await store.read(code);
    if (!data) return reply({ error: 'Sala não encontrada' }, 404);
    const s: GameState = data.state;
    const member = s.players.find((p) => p.id === id);
    if (b.op === 'join' && !member) {
      if (!name || s.phase !== 'waiting' || s.players.length >= 8) throw Error('Sala indisponível');
      s.players.push({
        id,
        name,
        stack: s.initial,
        cards: [],
        bet: 0,
        total: 0,
        avatar: cleanAvatar(b.avatar, name),
      });
    } else {
      if (!member) return reply({ error: 'Entre na sala' }, 403);
      if (b.op === 'state' || b.op === 'join')
        return reply({ code, state: project(s, id), version: data.version });
      if (b.version !== data.version)
        return reply({ error: 'Estado atualizado; tente novamente' }, 409);
      if (b.op === 'start') {
        if (s.host !== id) throw Error('Somente anfitrião');
        if (s.phase !== 'waiting') throw Error('A próxima mão começa automaticamente');
        start(s);
      } else if (b.op === 'interval') betweenHands(s, id, b.type);
      else if (b.op === 'remove') {
        if (s.host !== id || s.phase !== 'waiting')
          throw Error('Somente o anfitrião pode remover jogadores antes da partida');
        if (
          typeof b.seat !== 'number' ||
          !Number.isInteger(b.seat) ||
          !s.players[b.seat] ||
          s.players[b.seat].id === id
        )
          throw Error('Jogador inválido');
        s.players.splice(b.seat, 1);
      } else if (b.op === 'avatar') {
        if (s.phase !== 'waiting') throw Error('O avatar só pode ser trocado na sala de espera');
        member.avatar = cleanAvatar(b.avatar, member.name);
      } else if (b.op === 'action') act(s, id, b.type, b.amount);
      else throw Error('Comando inválido');
    }
    if (!(await store.update(code, data.version, s)))
      return reply({ error: 'Conflito; tente novamente' }, 409);
    await notifyRoom(code, data.version + 1);
    return reply({ code, state: project(s, id), version: data.version + 1 });
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : 'Erro' }, 400);
  }
}
function project(s: GameState, id: string): PublicState {
  const v = view(s, id);
  return {
    ...v,
    host: s.host === id,
    players: v.players.map((p) => {
      const { id: pid, ...rest } = p;
      return { ...rest, self: pid === id };
    }),
  };
}
