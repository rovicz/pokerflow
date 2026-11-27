export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['♠', '♥', '♦', '♣'];

export const HAND_RANKINGS = [
  {rank: 1, ordinal: '1º', name: 'Royal Flush', shortName: 'Royal', hint: '10, J, Q, K e A do mesmo naipe.'},
  {rank: 2, ordinal: '2º', name: 'Straight Flush', shortName: 'St. Flush', hint: 'Cinco cartas em sequência do mesmo naipe.'},
  {rank: 3, ordinal: '3º', name: 'Quadra', shortName: 'Quadra', hint: 'Quatro cartas do mesmo valor.'},
  {rank: 4, ordinal: '4º', name: 'Full House', shortName: 'Full House', hint: 'Uma trinca combinada com um par.'},
  {rank: 5, ordinal: '5º', name: 'Flush', shortName: 'Flush', hint: 'Cinco cartas do mesmo naipe, fora de sequência.'},
  {rank: 6, ordinal: '6º', name: 'Sequência', shortName: 'Sequência', hint: 'Cinco cartas em ordem consecutiva de naipes mistos.'},
  {rank: 7, ordinal: '7º', name: 'Trinca', shortName: 'Trinca', hint: 'Três cartas do mesmo valor.'},
  {rank: 8, ordinal: '8º', name: 'Dois Pares', shortName: '2 Pares', hint: 'Dois pares de valores diferentes.'},
  {rank: 9, ordinal: '9º', name: 'Um Par', shortName: 'Um Par', hint: 'Duas cartas do mesmo valor.'},
  {rank: 10, ordinal: '10º', name: 'Carta Alta', shortName: 'Carta Alta', hint: 'A carta mais alta decide quando não há combinação.'},
];

export const rankLabel = c => RANKS[c % 13];
export const suitLabel = c => SUITS[Math.floor(c / 13)];
export const cardLabel = c => rankLabel(c) + suitLabel(c);

export function describeHand(hand) {
  if (!hand?.cards?.length) return '';
  const r = i => rankLabel(hand.cards[i]);
  switch (hand.rank) {
    case 1: return 'Royal Flush';
    case 2: return `Straight Flush (${r(0)} a ${r(4)})`;
    case 3: return `Quadra de ${r(0)}`;
    case 4: return `Full House (${r(0)} com ${r(3)})`;
    case 5: return `Flush (${r(0)} alta)`;
    case 6: return `Sequência (${r(0)} a ${r(4)})`;
    case 7: return `Trinca de ${r(0)}`;
    case 8: return `Dois Pares (${r(0)} e ${r(2)})`;
    case 9: return `Um Par de ${r(0)}`;
    default: return `Carta Alta (${r(0)})`;
  }
}

export function analyzeShowdown(winnerRows, runnerUpRow) {
  if (!winnerRows?.length || !winnerRows[0]?.hand) {
    return {headline: '', decisiveIndex: null};
  }
  const w = winnerRows[0];
  const wRank = HAND_RANKINGS[w.hand.rank - 1];
  const wDesc = describeHand(w.hand);

  if (winnerRows.length > 1) {
    return {
      headline: `Empate com ${wDesc} (${wRank.ordinal}/10) — pote dividido`,
      decisiveIndex: null,
    };
  }

  if (runnerUpRow?.hand) {
    const r = runnerUpRow;
    const rRank = HAND_RANKINGS[r.hand.rank - 1];
    if (w.hand.rank < r.hand.rank) {
      return {
        headline: `${wDesc} (${wRank.ordinal}/10) venceu ${describeHand(r.hand)} (${rRank.ordinal}/10)`,
        decisiveIndex: null,
      };
    }
    if (w.hand.rank === r.hand.rank) {
      for (let i = 0; i < 5; i++) {
        const wc = w.hand.cards[i], rc = r.hand.cards[i];
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
    headline: `${wDesc} (${wRank.ordinal}/10)`,
    decisiveIndex: null,
  };
}

export function explainVictory(winnerRows, runnerUpRow) {
  return analyzeShowdown(winnerRows, runnerUpRow).headline;
}
