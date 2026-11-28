import { expect, test } from '@jest/globals';
import { dealerReactions } from '../src/features/poker-room/dealer-reactions.ts';
import { bestHand } from '../src/poker/engine.ts';
import type { PublicPlayer, PublicState } from '../src/poker/game-types.ts';

function player(name: string, extra: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    uid: name,
    name,
    self: false,
    cards: [-1, -1],
    hand: null,
    stack: 2000,
    bet: 0,
    total: 0,
    ...extra,
  };
}

function state(extra: Partial<PublicState> = {}): PublicState {
  return {
    host: false,
    role: 'player',
    players: [player('Ana'), player('Bia')],
    spectators: [],
    initial: 2000,
    hand: 1,
    dealer: 0,
    turn: 0,
    phase: 'preflop',
    board: [],
    result: [],
    sb: 10,
    bb: 20,
    seconds: 30,
    turnSeq: 1,
    ...extra,
  };
}

const lines = (previous: PublicState | null, current: PublicState) =>
  dealerReactions(previous, current).flatMap((reaction) => reaction.text ?? []);

test('anuncia a abertura do mano a mano e a revanche, sem repetir no polling', () => {
  const first = state();
  expect(lines(null, first)).toEqual(['Cartas na mesa!', 'Agora é mano a mano.']);
  expect(lines(first, { ...first, touched: 1000 })).toEqual([]);
  expect(lines(state({ phase: 'settled' }), first)).toEqual([
    'Bora de novo?',
    'Agora é mano a mano.',
  ]);
  expect(lines(null, state({ turnSeq: 12 }))[0]).toBe('Bora de novo?');
});

test.each([
  ['flop', [0, 1, 2], 'Primeiras três!'],
  ['turn', [0, 1, 2, 3], 'Mais uma carta.'],
  ['river', [0, 1, 2, 3, 4], 'Última carta da mesa.'],
] as const)('anuncia %s olhando para o board', (phase, cards, text) => {
  expect(dealerReactions(state(), state({ phase, board: [...cards] }))).toEqual([
    expect.objectContaining({ mood: 'nod', text, lookAtBoard: true }),
  ]);
});

test('distingue uma aposta grande, um all-in e o fim do tempo', () => {
  const previous = state();
  const last = { seat: 0, seq: 1, type: 'raise' as const };
  const bet = { seq: 1, street: 'preflop' as const, kind: 'raise' as const };
  expect(lines(previous, state({ last, handLog: [{ ...bet, paid: 40 }] }))).toEqual([]);
  expect(lines(previous, state({ last, handLog: [{ ...bet, paid: 100 }] }))).toEqual([
    'A aposta subiu.',
  ]);
  expect(
    lines(previous, state({ last, players: [player('Ana', { stack: 0 }), player('Bia')] })),
  ).toEqual(['Tudo no meio!']);
  expect(lines(previous, state({ last: { ...last, type: 'fold', auto: true } }))).toEqual([
    'Tempo esgotado.',
  ]);
  expect(
    lines(
      previous,
      state({
        last: { ...last, type: 'fold', auto: true },
        players: [player('Ana', { left: true }), player('Bia')],
      }),
    ),
  ).toEqual([]);
});

test('prioriza o resultado quando a última aposta abre todas as cartas e usa só mãos reveladas', () => {
  const board = [12, 25, 32, 29, 39];
  const players = [
    player('Ana', { cards: [11, 1], hand: bestHand([...board, 11, 1]) }),
    player('Bia', { cards: [36, 28], hand: bestHand([...board, 36, 28]) }),
  ];
  expect(
    lines(
      state(),
      state({
        phase: 'settled',
        board,
        reveal: true,
        players,
        result: [{ name: 'Ana', uid: 'Ana', amount: 200 }],
        last: { seat: 0, seq: 1, type: 'raise' },
      }),
    ),
  ).toEqual(['Vamos às cartas.', 'O K decidiu!']);
  const privateResult = state({ phase: 'settled', players, reveal: false });
  expect(lines(state(), privateResult)).toEqual(['Levou sem mostrar!']);
  expect(lines(privateResult, privateResult)).toEqual([]);
});

test('empate e vencedores de potes diferentes têm falas próprias', () => {
  const eligible = [
    { uid: 'Ana', name: 'Ana' },
    { uid: 'Bia', name: 'Bia' },
  ];
  const awards = eligible.map((seat) => ({ ...seat, amount: 50 }));
  const tie = state({ phase: 'settled', reveal: true, pots: [{ amount: 100, eligible, awards }] });
  expect(lines(state(), tie)).toEqual(['Vamos às cartas.', 'Pote dividido!']);
  const split = state({
    phase: 'settled',
    reveal: true,
    pots: awards.map((award) => ({ amount: 50, eligible, awards: [award] })),
  });
  expect(lines(state(), split)).toEqual(['Vamos às cartas.', 'Dois potes, dois vencedores!']);
});

test('anuncia os blinds no início da mão e o campeão quando o torneio termina', () => {
  const blinds = { baseBb: 20, level: 2, every: 5, mode: 'hands' as const };
  expect(lines(state({ phase: 'settled' }), state({ hand: 2, blinds }))).toEqual([
    'Os blinds subiram!',
    'Cartas na mesa!',
  ]);
  const winner = [player('Ana'), player('Bia', { stack: 0 })];
  expect(lines(state(), state({ phase: 'settled', players: winner }))).toEqual([
    'Levou sem mostrar!',
    'Temos campeão!',
  ]);
  expect(lines(state(), state({ phase: 'settled', players: winner, guided: true }))).toEqual([
    'Levou sem mostrar!',
  ]);
});
