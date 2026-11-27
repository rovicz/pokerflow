import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameState, Player } from '../src/poker/game-types.ts';
import {
  start,
  act,
  view,
  showCards,
  rematch,
  leaveTable,
  setSitOut,
} from '../src/poker/engine.ts';

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

test('Fase 1 (Show/Muck): vencedor pode revelar 1 ou 2 cartas após vitória por fold; cartas voltam a ocultar na próxima mão', () => {
  const s = makeRoom(2);
  start(s);
  const loser = s.players[s.turn];
  const winner = s.players.find((p) => p.id !== loser.id)!;

  // Não pode mostrar durante mão ativa
  assert.throws(() => showCards(s, winner.id, [0, 1]), /vitória por desistência/);

  act(s, loser.id, 'fold');
  assert.equal(s.phase, 'settled');
  assert.equal(s.reveal, false);

  // Por padrão (muck), perdedor vê [-1, -1]
  const before = view(s, loser.id);
  const winnerBefore = before.players.find((p) => p.name === winner.name)!;
  assert.deepEqual(winnerBefore.cards, [-1, -1]);

  // Perdedor não pode chamar showCards
  assert.throws(() => showCards(s, loser.id, [0, 1]), /Apenas o vencedor/);

  // Vencedor revela apenas a carta 0
  showCards(s, winner.id, [0]);
  const afterOne = view(s, loser.id);
  const winnerOne = afterOne.players.find((p) => p.name === winner.name)!;
  assert.equal(winnerOne.cards[0], winner.cards[0]);
  assert.equal(winnerOne.cards[1], -1);
  assert.deepEqual(s.history?.[0].shown?.cards, [winner.cards[0], -1]);

  // Vencedor revela ambas
  showCards(s, winner.id, [0, 1]);
  const afterBoth = view(s, loser.id);
  const winnerBoth = afterBoth.players.find((p) => p.name === winner.name)!;
  assert.deepEqual(winnerBoth.cards, winner.cards);

  // Próxima mão limpa shown
  start(s);
  assert.equal(winner.shown, undefined);
});

test('Fase 2 (Revanche): anfitrião reinicia partida encerrada direto ou voltando ao lobby, preservando banidos', () => {
  const s = makeRoom(2, 1000);
  s.removed = ['f'.repeat(64)];
  start(s);

  // Não pode revanche com partida em andamento
  assert.throws(() => rematch(s, s.host, 'start'), /ainda está em andamento/);

  // Simula fim de partida com campeão único
  const p0 = s.players[0];
  const p1 = s.players[1];
  act(s, s.players[s.turn].id, 'fold');
  p0.stack = 2000;
  p1.stack = 0;

  // Convidado não pode iniciar revanche
  assert.throws(() => rematch(s, p1.id, 'start'), /Somente o anfitrião/);

  // Revanche direta ('start')
  rematch(s, s.host, 'start');
  assert.equal(s.phase, 'preflop');
  assert.equal(s.hand, 1);
  assert.equal(s.history?.length, 0);
  assert.deepEqual(s.removed, ['f'.repeat(64)]);
  assert.equal(
    s.players.reduce((sum, p) => sum + p.stack + p.total, 0),
    2000,
  );

  // Encerra novamente e volta ao Lobby ('lobby')
  act(s, s.players[s.turn].id, 'fold');
  s.players[0].stack = 2000;
  s.players[1].stack = 0;
  rematch(s, s.host, 'lobby');
  assert.equal(s.phase, 'waiting');
  assert.equal(s.hand, 0);
  assert.equal(s.players[0].stack, 1000);
  assert.equal(s.players[1].stack, 1000);
});

test('Fase 3 (Leave & Host Transfer): saída do anfitrião transfere cargo, conserva fichas e não bane o jogador', () => {
  const s = makeRoom(3, 2000);
  const oldHost = s.players[0];
  const nextHost = s.players[1];

  // No lobby: remove imediatamente e transfere anfitrião
  leaveTable(s, oldHost.id);
  assert.equal(s.host, nextHost.id);
  assert.equal(s.players.length, 2);
  assert.ok(!s.removed?.includes(oldHost.id));
  assert.ok(s.roomNotice?.text.includes(nextHost.name));

  // Em mão ativa com 3 jogadores: anfitrião sai durante a mão
  const s2 = makeRoom(3, 2000);
  start(s2);
  const hostInHand = s2.players[0];
  const expectedNewHost = s2.players[1];
  leaveTable(s2, hostInHand.id);
  assert.equal(s2.host, expectedNewHost.id);
  assert.equal(hostInHand.left, true);
  assert.equal(hostInHand.fold, true);
  assert.ok(!s2.removed?.includes(hostInHand.id));

  let guard = 0;
  while (s2.phase !== 'settled' && guard++ < 30) {
    const actor = s2.players[s2.turn];
    act(s2, actor.id, (s2.current ?? 0) > actor.bet ? 'call' : 'check');
  }
  assert.equal(s2.phase, 'settled');
  assert.equal(
    s2.players.reduce((sum, p) => sum + p.stack + p.total, 0),
    6000,
  );

  // Próxima mão purga o jogador que saiu
  start(s2);
  assert.equal(s2.players.length, 2);
  assert.ok(s2.players.every((p) => p.id !== hostInHand.id));
});

test('Fase 3 (Sit Out): jogador ausente age imediatamente na vez, pula mãos seguintes e retorna com fichas intactas', () => {
  const s = makeRoom(3, 2000);
  start(s);
  const activeSeat = s.players[s.turn];
  const stackBefore = activeSeat.stack;

  // Ficar ausente na própria vez dá fold/check na hora e passa o turno
  setSitOut(s, activeSeat.id, true);
  assert.equal(activeSeat.sittingOut, true);
  assert.notEqual(s.players[s.turn]?.id, activeSeat.id);

  // Encerra a mão
  let guard = 0;
  while (s.phase !== 'settled' && guard++ < 30) {
    const actor = s.players[s.turn];
    act(s, actor.id, (s.current ?? 0) > actor.bet ? 'call' : 'check');
  }
  assert.equal(s.phase, 'settled');
  const stackAtRest = activeSeat.stack;
  assert.equal(stackAtRest, stackBefore);

  // Na próxima mão, jogador ausente não recebe cartas nem paga blinds
  start(s);
  assert.equal(activeSeat.cards.length, 0);
  assert.equal(activeSeat.bet, 0);
  assert.equal(activeSeat.stack, stackAtRest);

  // Ao voltar do Sit Out, entra normalmente na mão seguinte
  setSitOut(s, activeSeat.id, false);
  assert.equal(activeSeat.sittingOut, false);
  act(s, s.players[s.turn].id, 'fold');
  start(s);
  assert.equal(activeSeat.cards.length, 2);
});
