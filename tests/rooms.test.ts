import type { GameState } from '../src/poker/game-types.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { start, act, view, rematch } from '../src/poker/engine.ts';
import { resolveDue } from '../src/poker/timeouts.ts';

function room(n: number, seconds = 30, guided = false): GameState {
  const s: GameState = {
    host: '0',
    initial: 2000,
    board: [],
    result: [],
    turn: -1,
    phase: 'waiting',
    dealer: -1,
    hand: 0,
    sb: 10,
    bb: 20,
    seconds,
    players: Array.from({ length: n }, (_, i) => ({
      id: String(i),
      name: 'P' + i,
      stack: 2000,
      cards: [],
      bet: 0,
      total: 0,
    })),
  };
  if (guided) {
    s.guided = true;
    s.players[1].bot = { style: 'balanced', difficulty: 'easy' };
  }
  start(s);
  return s;
}

test('quem estoura o tempo perde a vez na hora: desiste se há aposta, passa se não há', () => {
  const s = room(3);
  const seat = s.turn;
  s.deadline = Date.now() - 1;
  assert.equal(resolveDue(s), true);
  assert.equal(s.players[seat].fold, true);
  assert.deepEqual(s.last && { seat: s.last.seat, type: s.last.type, auto: s.last.auto }, {
    seat,
    type: 'fold',
    auto: true,
  });
  assert.notEqual(s.turn, seat);
  assert.ok((s.deadline ?? 0) > Date.now(), 'o próximo jogador ganha um prazo novo e cheio');
});

test('sem aposta pendente o tempo esgotado vira check, não fold', () => {
  const s = room(2);
  act(s, s.players[s.turn].id, 'call');
  const bbSeat = s.turn; // big blind pode passar
  s.deadline = Date.now() - 1;
  resolveDue(s);
  assert.ok(!s.players[bbSeat].fold);
  assert.equal(s.last?.type, 'check');
  assert.equal(s.last?.auto, true);
});

test('prazo ainda aberto não muda nada', () => {
  const s = room(3);
  const before = JSON.stringify(s);
  assert.equal(resolveDue(s), false);
  assert.equal(JSON.stringify(s), before);
});

test('vários vencimentos acumulados são resolvidos sem travar e a mão termina com as fichas conservadas', () => {
  const s = room(4);
  for (let i = 0; i < 12 && s.phase !== 'settled'; i++) {
    s.deadline = Date.now() - 1;
    resolveDue(s);
  }
  assert.equal(s.phase, 'settled');
  assert.equal(
    s.players.reduce((a, p) => a + p.stack, 0),
    8000,
  );
});

test('a próxima mão começa sozinha quando o intervalo vence', () => {
  const s = room(3);
  while (s.phase !== 'settled') {
    s.deadline = Date.now() - 1;
    resolveDue(s);
  }
  const hand = s.hand;
  s.nextHandAt = Date.now() - 1;
  assert.equal(resolveDue(s), true);
  assert.equal(s.hand, hand + 1);
  assert.notEqual(s.phase, 'settled');
});

test('intervalo pausado pelo anfitrião não começa a mão', () => {
  const s = room(3);
  while (s.phase !== 'settled') {
    s.deadline = Date.now() - 1;
    resolveDue(s);
  }
  s.pausedFor = 5000;
  s.nextHandAt = null;
  assert.equal(resolveDue(s), false);
  assert.equal(s.phase, 'settled');
});

test('espectador vê as cartas de todos viradas e nunca recebe tokens, remoções ou baralho', () => {
  const s = room(3);
  s.spectators = [{ id: 'w1', name: 'Plateia' }];
  s.removed = ['segredo'];
  const v = view(s, 'w1');
  for (const p of v.players) assert.deepEqual(p.cards, [-1, -1]);
  const json = JSON.stringify(v);
  assert.equal('deck' in v, false);
  assert.equal('removed' in v, false);
  assert.equal('spectators' in v, false);
  assert.ok(!json.includes('segredo') && !json.includes('w1'));
});

test('espectador vê as mãos no showdown só de quem não desistiu', () => {
  const s = room(3);
  s.spectators = [{ id: 'w1', name: 'Plateia' }];
  // todos pagam até o showdown
  while (s.phase !== 'settled') {
    const p = s.players[s.turn];
    act(s, p.id, p.bet < (s.current ?? 0) ? 'call' : 'check');
  }
  const v = view(s, 'w1');
  if (s.reveal) for (const p of v.players) assert.ok(p.fold || p.cards.every((c) => c >= 0));
});

test('bot com o prazo já vencido (aba parada) joga em vez de travar a mesa', () => {
  const s = room(2);
  const bot = s.players[s.turn];
  bot.bot = { style: 'balanced', difficulty: 'medium' };
  s.botActAt = Date.now() - 1;
  s.deadline = Date.now() - 1;
  const before = s.last?.seq ?? 0;
  assert.equal(resolveDue(s), true);
  assert.ok((s.last?.seq ?? 0) > before || s.phase !== 'preflop', 'o bot precisa ter agido');
});

test('treino guiado deixa o humano agir sem prazo e encerra após uma mão', () => {
  const s = room(2, 30, true);
  const human = s.players[0];
  assert.equal(s.players[s.turn], human);
  assert.equal(s.deadline, null);
  assert.equal(resolveDue(s, Date.now() + 120_000), false);
  act(s, human.id, 'call');
  assert.equal(s.players[s.turn].bot?.difficulty, 'easy');
  assert.ok(s.botActAt);
  assert.equal(resolveDue(s, s.botActAt), true);
  assert.equal(s.phase, 'flop');
  assert.equal(resolveDue(s, s.botActAt!), true);
  act(s, human.id, 'fold');
  assert.equal(s.phase, 'settled');
  assert.equal(s.nextHandAt, undefined);
  rematch(s, human.id, 'start');
  assert.equal(s.phase, 'preflop');
  assert.equal(s.hand, 1);
  assert.equal(s.deadline, null);
});
