import type { GameState } from '../src/poker/game-types.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { deck, score, start, act, view, betweenHands } from '../src/poker/engine.ts';
test('deck is unique', () => {
  assert.equal(new Set(deck()).size, 52);
});
test('royal flush beats four of a kind', () => {
  assert.ok(score([8, 9, 10, 11, 12]) > score([12, 25, 38, 51, 0]));
});
test('2–8 players: privacy, termination and chip conservation', () => {
  for (let n = 2; n <= 8; n++)
    for (let round = 0; round < 30; round++) {
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
        seconds: 60,
        players: Array.from({ length: n }, (_, i) => ({
          id: String(i),
          name: 'P' + i,
          stack: 2000,
          cards: [],
          bet: 0,
          total: 0,
        })),
      };
      start(s);
      const v = view(s, '0');
      assert.equal('deck' in v, false);
      for (const p of v.players.filter((p) => p.id !== '0')) assert.deepEqual(p.cards, [-1, -1]);
      let steps = 0;
      while (s.phase !== 'settled') {
        assert.ok(++steps < 100);
        const p = s.players[s.turn];
        act(s, p.id, p.bet < (s.current ?? 0) ? 'call' : 'check');
      }
      assert.equal(
        s.players.reduce((a, p) => a + p.stack, 0),
        2000 * n,
      );
    }
});
test('last action is recorded for table sounds', () => {
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
    seconds: 60,
    players: [
      { id: 'a', name: 'A', stack: 500, cards: [], bet: 0, total: 0 },
      { id: 'b', name: 'B', stack: 500, cards: [], bet: 0, total: 0 },
    ],
  };
  start(s);
  const seat = s.turn;
  act(s, s.players[seat].id, 'call');
  assert.deepEqual(s.last, { seat, type: 'call', seq: 1 });
  act(s, s.players[s.turn].id, 'check');
  assert.equal(s.last?.type, 'check');
  assert.equal(s.last?.seq, 2);
});
import { cleanAvatar } from '../src/poker/avatars.ts';
test('avatar: aceita só estilo da lista e seed simples', () => {
  assert.deepEqual(cleanAvatar({ style: 'bottts', seed: 'abc-1' }, 'Ana'), {
    style: 'bottts',
    seed: 'abc-1',
  });
  assert.deepEqual(cleanAvatar({ style: '../x', seed: 'a' }, 'Ana B'), {
    style: 'lorelei',
    seed: 'Ana_B',
  });
  assert.equal(cleanAvatar({ style: 'bottts', seed: '<script>' }, '').seed, 'zake');
});

test('next hand starts after 15 seconds of unpaused time', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 });
  const s: GameState = {
    host: 'a',
    initial: 2000,
    board: [],
    result: [],
    turn: -1,
    phase: 'waiting',
    dealer: -1,
    hand: 0,
    sb: 10,
    bb: 20,
    seconds: 30,
    players: [
      { id: 'a', name: 'A', stack: 500, cards: [], bet: 0, total: 0 },
      { id: 'b', name: 'B', stack: 500, cards: [], bet: 0, total: 0 },
    ],
  };
  start(s);
  act(s, s.players[s.turn].id, 'fold');
  assert.equal(s.nextHandAt, 16000);
  assert.throws(() => betweenHands(s, 'b', 'tick'));
  assert.throws(() => betweenHands(s, 'b', 'pause'));
  t.mock.timers.setTime(6000);
  betweenHands(s, 'a', 'pause');
  assert.equal(s.pausedFor, 10000);
  t.mock.timers.setTime(24000);
  assert.throws(() => betweenHands(s, 'b', 'tick'));
  betweenHands(s, 'a', 'resume');
  assert.equal(s.nextHandAt, 34000);
  t.mock.timers.setTime(34000);
  betweenHands(s, 'b', 'tick');
  assert.equal(s.hand, 2);
  assert.equal(s.nextHandAt, undefined);
  assert.equal(
    s.players.reduce((total, p) => total + p.stack + p.total, 0),
    1000,
  );
});

test('expõe sbSeat e bbSeat corretamente em 2 e 3 jogadores e rotaciona entre mãos', () => {
  const mk = (n: number): GameState => ({
    host: 'p0',
    initial: 500,
    sb: 10,
    bb: 20,
    seconds: 30,
    phase: 'waiting',
    dealer: -1,
    turn: -1,
    hand: 0,
    board: [],
    result: [],
    players: Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      stack: 500,
      cards: [],
      bet: 0,
      total: 0,
    })),
  });

  // 2 jogadores (heads-up): mão 1 -> SB=0, BB=1; mão 2 -> SB=1, BB=0
  const s2 = mk(2);
  start(s2);
  assert.equal(s2.sbSeat, 0);
  assert.equal(s2.bbSeat, 1);
  act(s2, s2.players[s2.turn].id, 'fold');
  start(s2);
  assert.equal(s2.sbSeat, 1);
  assert.equal(s2.bbSeat, 0);

  // 3 jogadores: mão 1 -> SB=1, BB=2; mão 2 -> SB=2, BB=0
  const s3 = mk(3);
  start(s3);
  assert.equal(s3.sbSeat, 1);
  assert.equal(s3.bbSeat, 2);
  act(s3, s3.players[s3.turn].id, 'fold');
  act(s3, s3.players[s3.turn].id, 'fold');
  start(s3);
  assert.equal(s3.sbSeat, 2);
  assert.equal(s3.bbSeat, 0);
});

test('pular o intervalo: só o anfitrião, e só sem outros humanos na mesa', () => {
  const base = (): GameState => ({
    host: 'a',
    initial: 500,
    board: [],
    result: [],
    turn: -1,
    phase: 'waiting',
    dealer: -1,
    hand: 0,
    sb: 10,
    bb: 20,
    seconds: 30,
    players: [
      { id: 'a', name: 'A', stack: 500, cards: [], bet: 0, total: 0 },
      {
        id: 'bot1',
        name: 'Bot',
        stack: 500,
        cards: [],
        bet: 0,
        total: 0,
        bot: { style: 'balanced', difficulty: 'medium' },
      },
    ],
  });
  const s = base();
  start(s);
  act(s, s.players[s.turn].id, 'fold');
  assert.equal(s.phase, 'settled');
  assert.throws(() => betweenHands(s, 'bot1', 'skip'), /anfitrião/);
  const hand = s.hand;
  betweenHands(s, 'a', 'skip');
  assert.equal(s.hand, hand + 1);
  assert.notEqual(s.phase, 'settled');

  const h = base();
  h.players.push({ id: 'c', name: 'C', stack: 500, cards: [], bet: 0, total: 0 });
  start(h);
  while (h.phase !== 'settled') act(h, h.players[h.turn].id, 'fold');
  assert.throws(() => betweenHands(h, 'a', 'skip'), /bots/);
});
