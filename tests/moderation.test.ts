import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameState, Player } from '../src/poker/game-types.ts';
import { start, act, view } from '../src/poker/engine.ts';
import { createBotPlayer } from '../src/poker/bot-ai.ts';
import {
  VOTE_COOLDOWN_MS,
  VOTE_DURATION_MS,
  castBanVote,
  projectBanVote,
  publicPlayerUid,
  requiredVotes,
} from '../src/poker/moderation.ts';
import { resolveDue } from '../src/poker/timeouts.ts';

function makeRoom(humanCount: number, bots = 0, stack = 2000): GameState {
  const players: Player[] = Array.from({ length: humanCount }, (_, i) => ({
    id: (i + 1).toString(16).repeat(64).slice(0, 64),
    name: `Jogador ${i + 1}`,
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

test('publicPlayerUid é determinístico e nunca vaza o token original', () => {
  const token = 'a'.repeat(64);
  const uid1 = publicPlayerUid(token);
  const uid2 = publicPlayerUid(token);
  assert.equal(uid1, uid2);
  assert.equal(uid1.length, 10);
  assert.notEqual(uid1, token.slice(0, 10));
  assert.ok(!token.includes(uid1));
});

test('requiredVotes aplica maioria absoluta (> 50%) e bloqueia com menos de 3 humanos', () => {
  assert.equal(requiredVotes(2), 2); // 3 humanos -> 2 elegíveis -> 2/2
  assert.equal(requiredVotes(3), 2); // 4 humanos -> 3 elegíveis -> 2/3
  assert.equal(requiredVotes(4), 3); // 5 humanos -> 4 elegíveis -> 3/4
  assert.equal(requiredVotes(5), 3); // 6 humanos -> 5 elegíveis -> 3/5

  const s = makeRoom(2, 2);
  const targetUid = publicPlayerUid(s.players[1].id);
  assert.throws(() => castBanVote(s, s.players[0].id, targetUid, 'yes', 1000), /pelo menos 3/);
});

test('anfitrião é imune, bots não podem ser votados e voto duplo é rejeitado', () => {
  const s = makeRoom(3, 1);
  const hostUid = publicPlayerUid(s.players[0].id);
  const guestUid = publicPlayerUid(s.players[1].id);
  const botUid = publicPlayerUid(s.players[3].id);

  assert.throws(() => castBanVote(s, s.players[1].id, hostUid, 'yes', 1000), /anfitrião/);
  assert.throws(
    () => castBanVote(s, s.players[0].id, botUid, 'yes', 1000),
    /Apenas jogadores humanos/,
  );
  assert.throws(() => castBanVote(s, s.players[1].id, guestUid, 'yes', 1000), /si mesmo/);

  castBanVote(s, s.players[0].id, guestUid, 'yes', 1000);
  assert.throws(() => castBanVote(s, s.players[0].id, guestUid, 'yes', 1100), /já registrou/);
});

test('aprovação no lobby remove imediatamente, registra em removed/banned e não vaza IDs', () => {
  const s = makeRoom(4);
  const target = s.players[2];
  const targetUid = publicPlayerUid(target.id);

  castBanVote(s, s.players[0].id, targetUid, 'yes', 1000);
  const projected = projectBanVote(s, s.players[1].id);
  assert.ok(projected);
  assert.equal(projected.yesCount, 1);
  assert.equal(projected.required, 2);
  assert.equal(projected.canVote, true);
  assert.ok(!JSON.stringify(projected).includes(s.players[0].id));

  // 2º voto atinge maioria absoluta (2/3 elegíveis)
  castBanVote(s, s.players[1].id, targetUid, 'yes', 1500);
  assert.equal(s.banVote, null);
  assert.equal(s.players.length, 3);
  assert.ok(s.removed?.includes(target.id));
  assert.ok(s.banned?.includes(target.id));
  assert.equal(s.voteNotice?.kind, 'banned');
  assert.equal(s.voteNotice?.targetName, target.name);

  // view() não vaza campos internos de moderação
  const v = view(s, s.players[0].id) as Record<string, unknown>;
  assert.equal('banned' in v, false);
  assert.equal('banVote' in v, false);
  assert.equal('voteCooldowns' in v, false);
});

test('expulsão no meio de uma mão ativa dá fold, avança turno, conserva 100% das fichas e purga na próxima mão', () => {
  const s = makeRoom(3, 0, 2000);
  start(s);
  const totalChipsBefore = s.players.reduce((sum, p) => sum + p.stack + p.total, 0);
  assert.equal(totalChipsBefore, 6000);

  // Escolhe um convidado (não-host) e garante que ele já tenha colocado fichas no pote se possível
  const targetIdx = s.turn !== 0 ? s.turn : 1;
  const target = s.players[targetIdx];
  const targetUid = publicPlayerUid(target.id);
  const voters = s.players.filter((p) => p.id !== target.id);

  // Se for a vez de outro jogador antes, faz um call para movimentar o pote
  if (s.turn !== targetIdx) {
    const actor = s.players[s.turn];
    act(s, actor.id, (s.current ?? 0) > actor.bet ? 'call' : 'check');
  }

  // Votação aprovada (2/2 elegíveis) com a mão ativa
  castBanVote(s, voters[0].id, targetUid, 'yes', 5000);
  castBanVote(s, voters[1].id, targetUid, 'yes', 5500);

  assert.ok(s.removed?.includes(target.id));
  assert.ok(s.banned?.includes(target.id));
  assert.equal(target.kicked, true);
  assert.equal(target.fold, true);
  assert.notEqual(s.turn, targetIdx);

  // Finaliza a mão normalmente até settled
  let guard = 0;
  while (s.phase !== 'settled' && guard++ < 30) {
    const actor = s.players[s.turn];
    act(s, actor.id, (s.current ?? 0) > actor.bet ? 'call' : 'check');
  }
  assert.equal(s.phase, 'settled');

  // Conservação total de fichas: soma de todos os stacks (incluindo o stack restante do expulso) === 6000
  const totalChipsAfter = s.players.reduce((sum, p) => sum + p.stack + p.total, 0);
  assert.equal(totalChipsAfter, 6000);

  // Na próxima mão, o jogador expulso é purgado automaticamente dos assentos
  start(s);
  assert.equal(s.players.length, 2);
  assert.ok(s.players.every((p) => p.id !== target.id));
});

test('rejeição antecipada e expiração via resolveDue encerram votação e aplicam cooldown de 60s', () => {
  const s = makeRoom(4);
  const targetUid = publicPlayerUid(s.players[3].id);

  // 4 humanos -> 3 elegíveis -> precisa de 2 Sim; 2 Não torna impossível atingir 2 Sim
  castBanVote(s, s.players[0].id, targetUid, 'yes', 10_000);
  castBanVote(s, s.players[1].id, targetUid, 'no', 11_000);
  assert.ok(s.banVote); // 1 Sim, 1 Não, 1 pendente -> ainda possível
  castBanVote(s, s.players[2].id, targetUid, 'no', 12_000);
  assert.equal(s.banVote, null);
  assert.equal(s.voteNotice?.kind, 'rejected');

  // Cooldown ativo por 60s
  assert.throws(() => castBanVote(s, s.players[0].id, targetUid, 'yes', 12_000 + 5_000), /Aguarde/);

  // Após cooldown, abre nova votação e deixa expirar via resolveDue
  const t2 = 12_000 + VOTE_COOLDOWN_MS + 100;
  castBanVote(s, s.players[0].id, targetUid, 'yes', t2);
  assert.ok(s.banVote);
  const changed = resolveDue(s, t2 + VOTE_DURATION_MS + 50);
  assert.equal(changed, true);
  assert.equal(s.banVote, null);
  assert.equal(s.voteNotice?.kind, 'expired');
});
