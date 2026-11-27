import test from 'node:test';
import assert from 'node:assert/strict';
import type { BotDifficulty, GameState, Player } from '../src/poker/game-types.ts';
import {
  createBotPlayer,
  decideBotAction,
  evaluatePostflopStrength,
  evaluatePreflopStrength,
} from '../src/poker/bot-ai.ts';
import { act, start, view } from '../src/poker/engine.ts';
import { resolveDue } from '../src/poker/timeouts.ts';

function makeBotRoom(botCount: number, difficulty: BotDifficulty, stack = 1000): GameState {
  const players: Player[] = [{ id: 'human-0', name: 'Victor', stack, cards: [], bet: 0, total: 0 }];
  for (let i = 0; i < botCount; i++) {
    players.push(createBotPlayer(players, stack, difficulty));
  }
  return {
    host: 'human-0',
    initial: stack,
    sb: 10,
    bb: 20,
    seconds: 30,
    botDifficulty: difficulty,
    phase: 'waiting',
    dealer: -1,
    turn: -1,
    hand: 0,
    board: [],
    result: [],
    players,
  };
}

test('createBotPlayer gera bots com nomes distintos, prefixo bot: e perfil válido', () => {
  const s = makeBotRoom(7, 'hard');
  assert.equal(s.players.length, 8);
  const bots = s.players.slice(1);
  const names = new Set(bots.map((b) => b.name));
  assert.equal(names.size, 7);
  for (const b of bots) {
    assert.ok(b.id.startsWith('bot:'));
    assert.equal(b.bot?.difficulty, 'hard');
  }
});

test('avaliação pré-flop e pós-flop distingue mãos fortes de fracas', () => {
  // AA vs 72o
  const aa = evaluatePreflopStrength([12, 25]);
  const sevenTwo = evaluatePreflopStrength([5, 13]);
  assert.ok(aa > 0.85);
  assert.ok(sevenTwo < 0.35);
  assert.ok(aa > sevenTwo);

  // Flush pronto vs Carta Alta no Flop
  const flush = evaluatePostflopStrength([12, 10], [8, 4, 1]);
  const highCard = evaluatePostflopStrength([12, 24], [2, 17, 34]);
  assert.ok(flush > highCard + 0.3);
});

test('resolveDue executa 1 jogada de bot por vez, preserva privacidade e conserva fichas em 2–8 jogadores', () => {
  const cases: [number, BotDifficulty][] = [
    [1, 'easy'],
    [4, 'medium'],
    [7, 'hard'],
  ];

  for (const [botCount, diff] of cases) {
    const s = makeBotRoom(botCount, diff, 1000);
    const totalChips = s.players.length * 1000;
    start(s);

    // Cartas privadas dos bots nunca vazam para o jogador humano antes do showdown
    const pub = view(s, 'human-0');
    for (const p of pub.players.slice(1)) {
      assert.deepEqual(p.cards, [-1, -1]);
    }

    // Simula 3 mãos completas com humano dando check/call e bots decidindo via resolveDue
    let safety = 0;
    while (s.hand <= 3 && safety++ < 400) {
      if (s.phase === 'settled') {
        if (s.players.filter((p) => p.stack > 0).length < 2) break;
        const tNext = (s.nextHandAt ?? Date.now()) + 10;
        resolveDue(s, tNext);
        continue;
      }
      const cur = s.players[s.turn];
      if (!cur) break;
      if (cur.bot) {
        assert.ok(s.botActAt != null);
        // Antes de botActAt vencer, o bot ainda não age
        const beforeSeq = s.last?.seq ?? 0;
        assert.equal(resolveDue(s, s.botActAt - 50), false);
        assert.equal(s.last?.seq ?? 0, beforeSeq);

        // Quando botActAt vence, executa exatamente 1 jogada de bot
        const decision = decideBotAction(s, s.turn);
        assert.ok(['fold', 'check', 'call', 'raise'].includes(decision.type));
        assert.equal(resolveDue(s, s.botActAt + 10), true);
        assert.equal(s.last?.seq, beforeSeq + 1);
      } else {
        const due = Math.max(0, (s.current ?? 0) - cur.bet);
        act(s, cur.id, due > 0 ? 'call' : 'check');
      }

      const sum = s.players.reduce((acc, p) => acc + p.stack + p.total, 0);
      assert.equal(sum, totalChips);
    }
  }
});
