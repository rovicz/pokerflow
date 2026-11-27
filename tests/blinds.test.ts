import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameState, Player } from '../src/poker/game-types.ts';
import {
  MAX_BLIND_LEVEL,
  blindsForLevel,
  createBlindSchedule,
  handsUntilNextLevel,
} from '../src/poker/blinds.ts';
import { start, act, rematch } from '../src/poker/engine.ts';

function makeRoom(
  mode: 'fixed' | 'hands' | 'time',
  every = 5,
  baseBb = 20,
  stack = 5000,
): GameState {
  const players: Player[] = Array.from({ length: 2 }, (_, i) => ({
    id: (i + 1).toString(16).repeat(64).slice(0, 64),
    name: `P${i + 1}`,
    stack,
    cards: [],
    bet: 0,
    total: 0,
  }));
  return {
    host: players[0].id,
    initial: stack,
    phase: 'waiting',
    players,
    board: [],
    result: [],
    hand: 0,
    dealer: -1,
    turn: -1,
    sb: baseBb / 2,
    bb: baseBb,
    blinds: mode === 'fixed' ? null : createBlindSchedule(mode, every, baseBb),
    seconds: 30,
  };
}

test('blindsForLevel gera pares SB/BB inteiros, pares e crescentes até o nível máximo', () => {
  for (const baseBb of [10, 20, 50, 100]) {
    let prevBb = 0;
    for (let lv = 1; lv <= MAX_BLIND_LEVEL; lv++) {
      const { sb, bb } = blindsForLevel(baseBb, lv);
      assert.equal(bb % 2, 0);
      assert.equal(sb * 2, bb);
      assert.ok(bb > prevBb);
      prevBb = bb;
    }
  }
  assert.deepEqual(blindsForLevel(20, 1), { sb: 10, bb: 20 });
  assert.deepEqual(blindsForLevel(20, 2), { sb: 15, bb: 30 });
  assert.deepEqual(blindsForLevel(20, 3), { sb: 20, bb: 40 });
});

test('modo por mãos sobe de nível a cada N mãos, emite aviso e conserva 100% das fichas', () => {
  const s = makeRoom('hands', 5, 20, 5000);
  // Mãos 1 a 5 permanecem no Nível 1 (10/20)
  for (let h = 1; h <= 5; h++) {
    start(s);
    assert.equal(s.blinds?.level, 1);
    assert.equal(s.sb, 10);
    assert.equal(s.bb, 20);
    if (h === 5) assert.equal(handsUntilNextLevel(s.blinds!, s.hand), 1);
    act(s, s.players[s.turn].id, 'fold');
  }
  // Mão 6 sobe para Nível 2 (15/30)
  start(s);
  assert.equal(s.blinds?.level, 2);
  assert.equal(s.sb, 15);
  assert.equal(s.bb, 30);
  assert.ok(s.roomNotice?.text.includes('15/30'));
  assert.equal(
    s.players.reduce((sum, p) => sum + p.stack + p.total, 0),
    10_000,
  );
  act(s, s.players[s.turn].id, 'fold');

  // Mãos 7..10 ficam no Nível 2; mão 11 sobe para Nível 3 (20/40)
  for (let h = 7; h <= 10; h++) {
    start(s);
    assert.equal(s.blinds?.level, 2);
    act(s, s.players[s.turn].id, 'fold');
  }
  start(s);
  assert.equal(s.blinds?.level, 3);
  assert.equal(s.sb, 20);
  assert.equal(s.bb, 40);
});

test('modo por tempo sobe de nível somente na próxima mão após o relógio vencer e reseta na revanche', () => {
  const s = makeRoom('time', 180, 20, 2000);
  const t0 = 1_000_000;

  start(s, t0);
  assert.equal(s.blinds?.level, 1);
  assert.equal(s.blinds?.nextAt, t0 + 180_000);
  act(s, s.players[s.turn].id, 'fold');

  // Ainda dentro dos 180s -> mantém Nível 1
  start(s, t0 + 100_000);
  assert.equal(s.blinds?.level, 1);
  act(s, s.players[s.turn].id, 'fold');

  // Passou de 180s -> próxima mão sobe para Nível 2 (15/30)
  start(s, t0 + 185_000);
  assert.equal(s.blinds?.level, 2);
  assert.equal(s.sb, 15);
  assert.equal(s.bb, 30);
  act(s, s.players[s.turn].id, 'fold');

  // Simula fim de partida e revanche -> volta ao Nível 1 (10/20) mantendo modo torneio
  s.players[0].stack = 4000;
  s.players[1].stack = 0;
  rematch(s, s.host, 'start');
  assert.equal(s.blinds?.mode, 'time');
  assert.equal(s.blinds?.every, 180);
  assert.equal(s.blinds?.level, 1);
  assert.equal(s.sb, 10);
  assert.equal(s.bb, 20);
});
