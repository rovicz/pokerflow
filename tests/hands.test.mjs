import test from 'node:test';
import assert from 'node:assert/strict';
import {bestHand} from '../lib/engine.mjs';

test('classifica a melhor combinação de cinco cartas',()=>{
  assert.equal(bestHand([8,9,10,11,12,13,14]).rank,1);
  assert.equal(bestHand([0,1,2,3,4,25,38]).rank,2);
  assert.equal(bestHand([12,25,38,51,0,1,2]).rank,3);
  assert.equal(bestHand([0,14,28,42,5,19,33]).rank,10);
  assert.equal(bestHand([0,1,2,3]),null);
});
