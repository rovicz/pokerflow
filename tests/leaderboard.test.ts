import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameState, Player } from '../src/poker/game-types.ts';
import { start, act, view, rematch } from '../src/poker/engine.ts';
import { createBotPlayer } from '../src/poker/bot-ai.ts';
import {
  computeHandStatDeltas,
  rankEntries,
  type LeaderboardRow,
} from '../src/poker/leaderboard.ts';

function makeRoom(humans: { name: string; userId?: string }[], bots = 0, stack = 2000): GameState {
  const players: Player[] = humans.map((h, i) => ({
    id: (i + 1).toString(16).repeat(64).slice(0, 64),
    ...(h.userId ? { userId: h.userId } : {}),
    name: h.name,
    stack,
    cards: [],
    bet: 0,
    total: 0,
  }));
  for (let i = 0; i < bots; i++) {
    players.push(createBotPlayer(players, stack, 'medium'));
  }
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

test('computeHandStatDeltas pontua apenas contas autenticadas, é idempotente e registra campeão no fim da partida', () => {
  const s = makeRoom(
    [{ name: 'Victor', userId: 'u1' }, { name: 'Ana', userId: 'u2' }, { name: 'Convidado' }],
    0,
    2000,
  );
  start(s);
  act(s, s.players[s.turn].id, 'fold');
  act(s, s.players[s.turn].id, 'fold');
  assert.equal(s.phase, 'settled');

  const deltas = computeHandStatDeltas(s);
  assert.equal(deltas.length, 2); // Convidado sem userId não pontua
  const totalWon = deltas.reduce((sum, d) => sum + d.handsWon, 0);
  const totalChips = deltas.reduce((sum, d) => sum + d.chipsWon, 0);
  assert.ok(totalWon <= 1);
  assert.ok(totalChips <= 30);

  // Idempotência: segunda chamada na mesma mão retorna []
  assert.deepEqual(computeHandStatDeltas(s), []);

  // view() nunca vaza campos internos statsRecordedHand / statsRecordedMatch
  const pub = view(s, s.players[0].id) as Record<string, unknown>;
  assert.equal('statsRecordedHand' in pub, false);
  assert.equal('statsRecordedMatch' in pub, false);

  // Simula fim de partida (campeão único) na mão 2
  start(s);
  act(s, s.players[s.turn].id, 'fold');
  act(s, s.players[s.turn].id, 'fold');
  s.players[0].stack = 6000;
  s.players[1].stack = 0;
  s.players[2].stack = 0;
  const endDeltas = computeHandStatDeltas(s);
  const vDelta = endDeltas.find((d) => d.userId === 'u1')!;
  const aDelta = endDeltas.find((d) => d.userId === 'u2')!;
  assert.equal(vDelta.matchesPlayed, 1);
  assert.equal(vDelta.matchesWon, 1);
  assert.equal(aDelta.matchesPlayed, 1);
  assert.equal(aDelta.matchesWon, 0);

  // Rematch limpa flags de stats para nova partida
  rematch(s, s.host, 'lobby');
  assert.equal(s.statsRecordedHand, undefined);
  assert.equal(s.statsRecordedMatch, undefined);
});

test('anti-farm: mesa com apenas 1 humano contra bots não pontua no ranking oficial', () => {
  const s = makeRoom([{ name: 'Solo', userId: 'u-solo' }], 3, 2000);
  start(s);
  // Encerra a mão
  let guard = 0;
  while (s.phase !== 'settled' && guard++ < 20) {
    act(s, s.players[s.turn].id, 'fold');
  }
  assert.equal(s.phase, 'settled');
  const deltas = computeHandStatDeltas(s);
  assert.deepEqual(deltas, []);
});

test('rankEntries ordena corretamente nas 4 categorias com desempates determinísticos', () => {
  const rows: LeaderboardRow[] = [
    {
      username: 'alice',
      displayName: 'Alice',
      avatarStyle: 'lorelei',
      avatarSeed: 'a',
      handsPlayed: 20,
      handsWon: 12,
      matchesPlayed: 4,
      matchesWon: 2,
      biggestPot: 800,
      totalChipsWon: 4500,
    },
    {
      username: 'bob',
      displayName: 'Bob',
      avatarStyle: 'lorelei',
      avatarSeed: 'b',
      handsPlayed: 30,
      handsWon: 15,
      matchesPlayed: 10,
      matchesWon: 2,
      biggestPot: 2200,
      totalChipsWon: 9000,
    },
    {
      username: 'carol',
      displayName: 'Carol',
      avatarStyle: 'lorelei',
      avatarSeed: 'c',
      handsPlayed: 10,
      handsWon: 4,
      matchesPlayed: 3,
      matchesWon: 3,
      biggestPot: 600,
      totalChipsWon: 3000,
    },
  ];

  // Campeões: Carol (3), Alice (2, 50% win rate), Bob (2, 20% win rate)
  assert.deepEqual(
    rankEntries(rows, 'matches_won').map((r) => r.username),
    ['carol', 'alice', 'bob'],
  );
  // Banco Acumulado: Bob (9000), Alice (4500), Carol (3000)
  assert.deepEqual(
    rankEntries(rows, 'total_chips_won').map((r) => r.username),
    ['bob', 'alice', 'carol'],
  );
  // Reis da Rodada: Bob (15), Alice (12), Carol (4)
  assert.deepEqual(
    rankEntries(rows, 'hands_won').map((r) => r.username),
    ['bob', 'alice', 'carol'],
  );
  // Maior Pote: Bob (2200), Alice (800), Carol (600)
  assert.deepEqual(
    rankEntries(rows, 'biggest_pot').map((r) => r.username),
    ['bob', 'alice', 'carol'],
  );
});
