import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import { bestHand } from '../src/poker/engine.ts';
import { analyzeShowdown, describeHand, explainVictory, rankLabel } from '../src/poker/hands.ts';

test('classifica a melhor combinação de cinco cartas', () => {
  assert.equal(bestHand([8, 9, 10, 11, 12, 13, 14])?.rank, 1);
  assert.equal(bestHand([0, 1, 2, 3, 4, 25, 38])?.rank, 2);
  assert.equal(bestHand([12, 25, 38, 51, 0, 1, 2])?.rank, 3);
  assert.equal(bestHand([0, 14, 28, 42, 5, 19, 33])?.rank, 10);
  assert.equal(bestHand([0, 1, 2, 3]), null);
});

test('ordena as 5 cartas da mão e define coreCount corretamente', () => {
  // Royal Flush (embaralhado): 10 J Q K A de ♠
  const royal = bestHand([12, 8, 11, 9, 10, 2, 3]);
  assert.ok(royal);
  assert.equal(royal.rank, 1);
  assert.equal(royal.coreCount, 5);
  assert.deepEqual(royal.cards.map(rankLabel), ['10', 'J', 'Q', 'K', 'A']);

  // Roda baixa (A-2-3-4-5) de naipes mistos
  const wheel = bestHand([12, 13, 27, 41, 3, 10, 24]);
  assert.ok(wheel);
  assert.equal(wheel.rank, 6);
  assert.equal(wheel.coreCount, 5);
  assert.deepEqual(wheel.cards.map(rankLabel), ['A', '2', '3', '4', '5']);
  assert.equal(describeHand(wheel), 'Sequência');

  // Full House (K K K 10 10)
  const fh = bestHand([8, 21, 11, 24, 37, 0, 14]);
  assert.ok(fh);
  assert.equal(fh.rank, 4);
  assert.equal(fh.coreCount, 5);
  assert.deepEqual(fh.cards.map(rankLabel), ['K', 'K', 'K', '10', '10']);
  assert.equal(describeHand(fh), 'Full House');

  // Quadra (A A A A + kicker 8)
  const quad = bestHand([6, 12, 25, 38, 51, 0, 1]);
  assert.ok(quad);
  assert.equal(quad.rank, 3);
  assert.equal(quad.coreCount, 4);
  assert.deepEqual(quad.cards.map(rankLabel), ['A', 'A', 'A', 'A', '8']);
  assert.equal(describeHand(quad), 'Quadra de A');

  // Par de 7 com kickers A, 10, 5 (fora de ordem na entrada)
  const pair = bestHand([38, 18, 31, 3, 21, 26, 2]);
  assert.ok(pair);
  assert.equal(pair.rank, 9);
  assert.equal(pair.coreCount, 2);
  assert.deepEqual(pair.cards.map(rankLabel), ['7', '7', 'A', '10', '5']);
  assert.equal(describeHand(pair), 'Par de 7');
});

test('explica vitória por categoria, desempate com carta decisiva e empate', () => {
  const fh = bestHand([8, 21, 11, 24, 37, 0, 14]);
  assert.ok(fh);
  const pairA = bestHand([38, 18, 31, 3, 21, 26, 1]); // Par de 7, kicker A♦
  const pair4 = bestHand([15, 18, 31, 3, 21, 26, 1]); // Par de 7, kicker 10♥

  const byCat = analyzeShowdown([{ name: 'Victor', hand: fh }], { name: 'Davi', hand: pairA });
  assert.equal(byCat.decisiveIndex, null);
  assert.equal(byCat.headline, 'Full House venceu Par de 7');

  const tiebreak = analyzeShowdown([{ name: 'Victor', hand: pairA }], {
    name: 'Totuguita',
    hand: pair4,
  });
  assert.equal(tiebreak.decisiveIndex, 2);
  assert.equal(tiebreak.headline, 'Desempate: A♦ bateu 10♥');

  assert.equal(
    explainVictory(
      [
        { name: 'Victor', hand: fh },
        { name: 'Davi', hand: fh },
      ],
      null,
    ),
    'Empate com Full House — pote dividido',
  );
});
