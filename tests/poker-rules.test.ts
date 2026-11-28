import { describe, expect, test } from '@jest/globals';
import { act, bestHand, score, start } from '../src/poker/engine.ts';
import type { Action, GameState } from '../src/poker/game-types.ts';

function table(...stacks: number[]): GameState {
  const game: GameState = {
    host: 'p0',
    initial: stacks[0],
    phase: 'waiting',
    hand: 0,
    dealer: -1,
    turn: -1,
    board: [],
    result: [],
    sb: 10,
    bb: 20,
    seconds: 60,
    players: stacks.map((stack, seat) => ({
      id: `p${seat}`,
      name: `Jogador ${seat + 1}`,
      cards: [],
      bet: 0,
      total: 0,
      stack,
    })),
  };
  return start(game);
}

function cards(text: string) {
  return text
    .split(' ')
    .map(([rank, suit]) => 'shdc'.indexOf(suit) * 13 + '23456789TJQKA'.indexOf(rank));
}

function deal(game: GameState, pockets: string[], community: string) {
  for (const [seat, pocket] of pockets.entries()) game.players[seat].cards = cards(pocket);
  const [flop1, flop2, flop3, turn, river] = cards(community);
  const used = new Set([...game.players.flatMap((p) => p.cards), flop1, flop2, flop3, turn, river]);
  const unused = Array.from({ length: 52 }, (_, card) => card).filter((card) => !used.has(card));
  const burn1 = unused.pop()!;
  const burn2 = unused.pop()!;
  const burn3 = unused.pop()!;
  // O motor retira as cartas com pop: uma queimada antes de cada abertura.
  game.deck = [...unused, river, burn3, turn, burn2, flop3, flop2, flop1, burn1];
}

function play(game: GameState, seat: number, action: Action, amount?: number) {
  expect(game.turn).toBe(seat);
  act(game, game.players[seat].id, action, amount);
}

describe('Regras do Texas Hold’em sem limite', () => {
  test('no heads-up, o botão paga o small blind, age primeiro pré-flop e por último depois', () => {
    const game = table(200, 200);
    deal(game, ['Ah Kd', 'Qc Jd'], '2s 5d 7c 9h Ts');
    expect([game.dealer, game.sbSeat, game.bbSeat]).toEqual([0, 0, 1]);
    expect(game.players.map((p) => p.bet)).toEqual([10, 20]);

    play(game, 0, 'call');
    expect(game.board).toEqual([]);
    play(game, 1, 'check');
    expect(game.phase).toBe('flop');
    expect(game.board).toEqual(cards('2s 5d 7c'));

    play(game, 1, 'check');
    play(game, 0, 'check');
    expect(game.phase).toBe('turn');
    expect(game.board).toEqual(cards('2s 5d 7c 9h'));

    play(game, 1, 'check');
    play(game, 0, 'check');
    expect(game.phase).toBe('river');
    expect(game.board).toEqual(cards('2s 5d 7c 9h Ts'));

    play(game, 1, 'check');
    play(game, 0, 'check');
    expect(game.phase).toBe('settled');
  });

  test('com mais jogadores o pré-flop começa depois do big blind', () => {
    const game = table(400, 400, 400, 400);
    expect([game.dealer, game.sbSeat, game.bbSeat]).toEqual([0, 1, 2]);
    for (const seat of [3, 0, 1]) play(game, seat, 'call');
    expect(game.phase).toBe('preflop');
    play(game, 2, 'check');
    expect(game.phase).toBe('flop');
    expect(game.turn).toBe(1);
  });

  test('o big blind com poucas fichas não reduz o valor a pagar no pré-flop', () => {
    const game = table(400, 400, 8);
    expect(game.players[2].stack).toBe(0);
    expect(game.players[2].bet).toBe(8);
    expect(game.current).toBe(20);
    play(game, 0, 'call');
    play(game, 1, 'call');
    expect(game.phase).toBe('flop');
    expect(game.players.map((p) => p.total)).toEqual([20, 20, 8]);
  });

  test('ações fora de turno e apostas inválidas preservam a mesa', () => {
    const game = table(400, 400);
    const original = structuredClone(game);
    expect(() => act(game, 'p1', 'raise', 40)).toThrow('Não é sua vez');
    expect(() => act(game, 'p0', 'check')).toThrow('Existe aposta pendente');
    expect(() => act(game, 'p0', 'raise', 39)).toThrow('Raise abaixo do mínimo');
    expect(() => act(game, 'p0', 'raise', 401)).toThrow('Valor inválido');
    expect(() => act(game, 'p0', 'raise', 42.5)).toThrow('Valor inválido');
    expect(game).toEqual(original);

    play(game, 0, 'call');
    expect(() => act(game, 'p1', 'call')).toThrow('Use check');
    play(game, 1, 'check');
  });

  test('o aumento mínimo acompanha o último aumento completo e reinicia no flop', () => {
    const game = table(400, 400, 400, 400);
    play(game, 3, 'raise', 70);
    expect(game.minRaise).toBe(50);
    expect(() => act(game, 'p0', 'raise', 119)).toThrow('Raise abaixo do mínimo');
    play(game, 0, 'raise', 120);
    for (const seat of [1, 2, 3]) play(game, seat, 'call');
    expect(game.phase).toBe('flop');
    expect(game.players.map((p) => p.bet)).toEqual([0, 0, 0, 0]);
    expect(game.players.map((p) => p.total)).toEqual([120, 120, 120, 120]);
    expect(() => act(game, 'p1', 'raise', 19)).toThrow('Raise abaixo do mínimo');
    play(game, 1, 'raise', 20);
  });

  test('um all-in curto permite aumento a quem ainda vai agir e não reabre para quem já pagou', () => {
    const game = table(35, 300, 300, 300);
    play(game, 3, 'call');
    play(game, 0, 'raise', 35);

    const unopened = structuredClone(game);
    play(unopened, 1, 'raise', 55);
    expect(unopened.minRaise).toBe(20);

    play(game, 1, 'call');
    play(game, 2, 'call');
    expect(game.turn).toBe(3);
    expect(() => act(game, 'p3', 'raise', 55)).toThrow('Aposta não reaberta');
    expect(() => act(game, 'p3', 'raise', 300)).toThrow('Aposta não reaberta');
    play(game, 3, 'call');
    expect(game.phase).toBe('flop');
  });

  test('o acumulado de all-ins curtos reabre a aposta quando atinge um aumento completo', () => {
    const game = table(30, 40, 300, 300);
    play(game, 3, 'call');
    play(game, 0, 'raise', 30);
    play(game, 1, 'raise', 40);
    play(game, 2, 'call');
    expect(() => act(game, 'p3', 'raise', 59)).toThrow('Raise abaixo do mínimo');
    play(game, 3, 'raise', 60);
    play(game, 2, 'call');
    expect(game.phase).toBe('flop');
    expect(game.players.map((p) => p.total)).toEqual([30, 40, 60, 60]);
  });

  test('all-ins desiguais abrem o board, separam os potes e devolvem a aposta sem cobertura', () => {
    const game = table(200, 300, 100);
    deal(game, ['Ks Kh', 'Qs Qh', 'As Ah'], '2c 5h 7d 9s Jc');
    play(game, 0, 'raise', 200);
    play(game, 1, 'raise', 300);
    play(game, 2, 'call');

    expect(game.phase).toBe('settled');
    expect(game.board).toEqual(cards('2c 5h 7d 9s Jc'));
    expect(
      game.pots?.map((pot) => ({
        amount: pot.amount,
        eligible: pot.eligible.map((p) => p.seat),
        awards: pot.awards.map((p) => [p.seat, p.amount]),
      })),
    ).toEqual([
      { amount: 300, eligible: [0, 1, 2], awards: [[2, 300]] },
      { amount: 200, eligible: [0, 1], awards: [[0, 200]] },
    ]);
    expect(game.refunds).toMatchObject([{ seat: 1, amount: 100 }]);
    expect(game.players.map((p) => p.stack)).toEqual([200, 100, 300]);
  });

  test('o melhor jogo pode estar todo no board e a ficha ímpar vai ao primeiro vencedor após o botão', () => {
    const game = table(200, 200, 200);
    deal(game, ['2h 5d', '9h 9d', '3c 6h'], 'Ts Js Qs Ks As');
    play(game, 0, 'call');
    play(game, 1, 'call');
    play(game, 2, 'check');
    play(game, 1, 'check');
    play(game, 2, 'raise', 21);
    play(game, 0, 'call');
    play(game, 1, 'call');
    play(game, 1, 'check');
    play(game, 2, 'check');
    play(game, 0, 'raise', 20);
    play(game, 1, 'fold');
    play(game, 2, 'call');
    play(game, 2, 'check');
    play(game, 0, 'check');

    expect(game.pots).toHaveLength(1);
    expect(game.pots?.[0]).toMatchObject({
      amount: 163,
      eligible: [{ seat: 0 }, { seat: 2 }],
      awards: [
        { seat: 2, amount: 82 },
        { seat: 0, amount: 81 },
      ],
    });
    expect(game.players.map((p) => p.stack)).toEqual([220, 159, 221]);
  });

  test('as categorias respeitam a ordem e o ás baixo perde de uma sequência até seis', () => {
    const weakestToStrongest = [
      '2s 5h 7d 9c Js',
      '2s 2h 7d 9c Js',
      '2s 2h 7d 7c Js',
      '2s 2h 2d 9c Js',
      'As 2h 3d 4c 5s',
      '2s 5s 7s 9s Js',
      '2s 2h 2d 9c 9s',
      '2s 2h 2d 2c Js',
      '2s 3s 4s 5s 6s',
      'Ts Js Qs Ks As',
    ].map((hand) => bestHand(cards(hand))?.rank);
    expect(weakestToStrongest).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(score(cards('2s 3h 4d 5c 6s'))).toBeGreaterThan(score(cards('As 2h 3d 4c 5s')));
    expect(bestHand(cards('As 2h 3d 4c 5s 9s Jh'))?.cards).toEqual(cards('As 2h 3d 4c 5s'));
  });

  test('kickers desempatam pares iguais e naipes não dão vantagem em um empate', () => {
    const board = cards('As Ah 8d 5c 2s');
    expect(score([...board, ...cards('Kd Qh')])).toBeGreaterThan(
      score([...board, ...cards('Kc Jd')]),
    );
    expect(score([...board, ...cards('Kd Qh')])).toBe(score([...board, ...cards('Kc Qd')]));
  });
});
