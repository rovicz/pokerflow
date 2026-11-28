import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameState, Player } from '../src/poker/game-types.ts';
import { start, act } from '../src/poker/engine.ts';

function makeRoom(n = 3, stack = 2000): GameState {
  const players: Player[] = Array.from({ length: n }, (_, i) => ({
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
    sb: 10,
    bb: 20,
    seconds: 30,
  };
}

test('handLog registra blinds, ações e abertura de streets e reseta na próxima mão', () => {
  const s = makeRoom(2);
  start(s);
  assert.ok(s.handLog && s.handLog.length >= 2);
  assert.equal(s.handLog[0].kind, 'sb');
  assert.equal(s.handLog[1].kind, 'bb');

  // Call no pré-flop + check do BB abre o flop
  act(s, s.players[s.turn].id, 'call');
  act(s, s.players[s.turn].id, 'check');
  assert.equal(s.phase, 'flop');
  const flopEntry = s.handLog.find((e) => e.kind === 'street' && e.street === 'flop');
  assert.ok(flopEntry);
  assert.equal(flopEntry.cards?.length, 3);

  // Encerra por fold e inicia nova mão: handLog reseta
  act(s, s.players[s.turn].id, 'fold');
  assert.equal(s.phase, 'settled');
  start(s);
  assert.equal(s.handLog.length, 2);
});

test('vitória por desistência grava resumo no history sem vazar nenhuma carta privada', () => {
  const s = makeRoom(3);
  start(s);
  act(s, s.players[s.turn].id, 'fold');
  act(s, s.players[s.turn].id, 'fold');
  assert.equal(s.phase, 'settled');
  assert.equal(s.reveal, false);
  assert.equal(s.history?.length, 1);

  const rec = s.history![0];
  assert.equal(rec.hand, 1);
  assert.equal(rec.pot, 20);
  assert.equal(rec.refunds?.[0].amount, 10);
  assert.equal(rec.refunds?.[0].uid, rec.winners[0].uid);
  assert.deepEqual(
    rec.log?.map((entry) => entry.kind),
    ['sb', 'bb', 'fold', 'fold'],
  );
  assert.equal(rec.reveal, false);
  assert.equal(rec.board.length, 0);
  assert.equal(rec.winners.length, 1);
  assert.equal(rec.showdown, undefined);
});

test('showdown grava no history apenas cartas de quem não desistiu', () => {
  const s = makeRoom(3);
  start(s);
  // 1º jogador desiste; outros 2 vão até o showdown
  const foldedPlayer = s.players[s.turn];
  act(s, foldedPlayer.id, 'fold');

  let guard = 0;
  while (s.phase !== 'settled' && guard++ < 30) {
    const actor = s.players[s.turn];
    act(s, actor.id, (s.current ?? 0) > actor.bet ? 'call' : 'check');
  }
  assert.equal(s.phase, 'settled');
  assert.equal(s.reveal, true);
  const rec = s.history![0];
  assert.equal(rec.reveal, true);
  assert.equal(rec.board.length, 5);
  assert.ok(rec.showdown && rec.showdown.length === 2);
  assert.ok(rec.showdown.every((row) => row.name !== foldedPlayer.name));
  assert.ok(rec.winners[0].handName && rec.winners[0].handName.length > 0);
});

test('history mantém no máximo as últimas 12 mãos concluídas', () => {
  const s = makeRoom(2, 5000);
  for (let i = 0; i < 15; i++) {
    start(s);
    act(s, s.players[s.turn].id, 'fold');
  }
  assert.equal(s.history?.length, 12);
  assert.equal(s.history![0].hand, 4);
  assert.equal(s.history![11].hand, 15);
});
