import type { Hand } from './game-types.ts';

type ShowdownRow = { name: string; hand: Hand | null };
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['♠', '♥', '♦', '♣'];

export const HAND_RANKINGS = [
  {
    rank: 1,
    ordinal: '1º',
    name: 'Royal Flush',
    shortName: 'Royal',
    hint: '10, J, Q, K e A do mesmo naipe.',
  },
  {
    rank: 2,
    ordinal: '2º',
    name: 'Straight Flush',
    shortName: 'St. Flush',
    hint: 'Cinco cartas em sequência do mesmo naipe.',
  },
  {
    rank: 3,
    ordinal: '3º',
    name: 'Quadra',
    shortName: 'Quadra',
    hint: 'Quatro cartas do mesmo valor.',
  },
  {
    rank: 4,
    ordinal: '4º',
    name: 'Full House',
    shortName: 'Full House',
    hint: 'Uma trinca combinada com um par.',
  },
  {
    rank: 5,
    ordinal: '5º',
    name: 'Flush',
    shortName: 'Flush',
    hint: 'Cinco cartas do mesmo naipe, fora de sequência.',
  },
  {
    rank: 6,
    ordinal: '6º',
    name: 'Sequência',
    shortName: 'Sequência',
    hint: 'Cinco cartas em ordem consecutiva de naipes mistos.',
  },
  {
    rank: 7,
    ordinal: '7º',
    name: 'Trinca',
    shortName: 'Trinca',
    hint: 'Três cartas do mesmo valor.',
  },
  {
    rank: 8,
    ordinal: '8º',
    name: 'Dois Pares',
    shortName: '2 Pares',
    hint: 'Dois pares de valores diferentes.',
  },
  {
    rank: 9,
    ordinal: '9º',
    name: 'Um Par',
    shortName: 'Um Par',
    hint: 'Duas cartas do mesmo valor.',
  },
  {
    rank: 10,
    ordinal: '10º',
    name: 'Carta Alta',
    shortName: 'Carta Alta',
    hint: 'A carta mais alta decide quando não há combinação.',
  },
];

export const rankLabel = (c: number) => RANKS[c % 13];
export const suitLabel = (c: number) => SUITS[Math.floor(c / 13)];
export const cardLabel = (c: number) => rankLabel(c) + suitLabel(c);

export function describeHand(hand: Hand | null) {
  if (!hand?.cards?.length) return '';
  const r = (i: number) => rankLabel(hand.cards[i]);
  switch (hand.rank) {
    case 1:
      return 'Royal Flush';
    case 2:
      return 'Straight Flush';
    case 3:
      return `Quadra de ${r(0)}`;
    case 4:
      return 'Full House';
    case 5:
      return 'Flush';
    case 6:
      return 'Sequência';
    case 7:
      return `Trinca de ${r(0)}`;
    case 8:
      return 'Dois Pares';
    case 9:
      return `Par de ${r(0)}`;
    default:
      return 'Carta Alta';
  }
}

export function analyzeShowdown(winnerRows: ShowdownRow[], runnerUpRow?: ShowdownRow | null) {
  if (!winnerRows?.length || !winnerRows[0]?.hand) {
    return { headline: '', decisiveIndex: null };
  }
  const { hand } = winnerRows[0];
  const wDesc = describeHand(hand);

  if (winnerRows.length > 1) {
    return {
      headline: `Empate com ${wDesc} — pote dividido`,
      decisiveIndex: null,
    };
  }

  if (runnerUpRow?.hand) {
    const r = runnerUpRow.hand;
    const rDesc = describeHand(r);
    if (hand.rank < r.rank) {
      return {
        headline: `${wDesc} venceu ${rDesc}`,
        decisiveIndex: null,
      };
    }
    if (hand.rank === r.rank) {
      if (wDesc !== rDesc) {
        return {
          headline: `${wDesc} venceu ${rDesc}`,
          decisiveIndex: null,
        };
      }
      for (let i = 0; i < 5; i++) {
        const wc = hand.cards[i],
          rc = r.cards[i];
        if (wc != null && rc != null && wc % 13 !== rc % 13) {
          return {
            headline: `Desempate: ${cardLabel(wc)} bateu ${cardLabel(rc)}`,
            decisiveIndex: i,
          };
        }
      }
    }
  }

  return {
    headline: `Venceu com ${wDesc}`,
    decisiveIndex: null,
  };
}

export function explainVictory(winnerRows: ShowdownRow[], runnerUpRow?: ShowdownRow | null) {
  return analyzeShowdown(winnerRows, runnerUpRow).headline;
}
