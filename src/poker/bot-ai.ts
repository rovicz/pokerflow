import { randomBytes, randomInt } from 'node:crypto';
import type { Action, BotDifficulty, BotStyle, GameState, Player } from './game-types.ts';
import type { AvatarStyle } from './avatars.ts';
import type { EmoteId } from './emotes.ts';
import { bestHand } from './engine.ts';

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ['easy', 'medium', 'hard'];
export const BOT_DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  easy: 'Iniciante',
  medium: 'Equilibrado',
  hard: 'Desafiador',
};

const BOT_ROSTER: readonly {
  name: string;
  style: BotStyle;
  avatarStyle: AvatarStyle;
  seed: string;
}[] = [
  { name: 'Léo', style: 'balanced', avatarStyle: 'bottts', seed: 'pf-leo-01' },
  { name: 'Maya', style: 'aggressive', avatarStyle: 'bottts', seed: 'pf-maya-02' },
  { name: 'Rafa', style: 'tight', avatarStyle: 'bottts', seed: 'pf-rafa-03' },
  { name: 'Bia', style: 'wild', avatarStyle: 'bottts', seed: 'pf-bia-04' },
  { name: 'Caio', style: 'balanced', avatarStyle: 'bottts', seed: 'pf-caio-05' },
  { name: 'Luna', style: 'tight', avatarStyle: 'bottts', seed: 'pf-luna-06' },
  { name: 'Téo', style: 'aggressive', avatarStyle: 'bottts', seed: 'pf-teo-07' },
  { name: 'Nina', style: 'wild', avatarStyle: 'bottts', seed: 'pf-nina-08' },
];

export function isBotDifficulty(v: unknown): v is BotDifficulty {
  return v === 'easy' || v === 'medium' || v === 'hard';
}

export function createBotPlayer(
  existing: Player[],
  stack: number,
  difficulty: BotDifficulty = 'medium',
): Player {
  const usedNames = new Set(existing.map((p) => p.name.toLowerCase()));
  const pick =
    BOT_ROSTER.find((r) => !usedNames.has(r.name.toLowerCase())) ??
    BOT_ROSTER[existing.length % BOT_ROSTER.length];
  let name = pick.name;
  let suffix = 2;
  while (usedNames.has(name.toLowerCase())) {
    name = `${pick.name} ${suffix++}`;
  }
  return {
    id: 'bot:' + randomBytes(8).toString('hex'),
    name,
    stack,
    cards: [],
    bet: 0,
    total: 0,
    avatar: { style: pick.avatarStyle, seed: pick.seed },
    bot: { style: pick.style, difficulty },
  };
}

export function botThinkMs(difficulty: BotDifficulty = 'medium'): number {
  if (difficulty === 'easy') return randomInt(850, 1750);
  if (difficulty === 'hard') return randomInt(1050, 2250);
  return randomInt(900, 2000);
}

const cardRank = (c: number) => (c % 13) + 2; // 2..14
const cardSuit = (c: number) => Math.floor(c / 13);

// Fórmula Chen simplificada para força de mão pré-flop, normalizada para [0, 1].
export function evaluatePreflopStrength(cards: number[]): number {
  if (cards.length < 2) return 0.3;
  const r1 = cardRank(cards[0]);
  const r2 = cardRank(cards[1]);
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const suited = cardSuit(cards[0]) === cardSuit(cards[1]);
  const pair = high === low;

  const baseMap: Record<number, number> = {
    14: 10,
    13: 8,
    12: 7,
    11: 6,
    10: 5,
  };
  let pts = baseMap[high] ?? high / 2;

  if (pair) {
    pts = Math.max(5, pts * 2);
  } else {
    if (suited) pts += 2;
    const gap = high - low - 1;
    if (gap === 1) pts -= 1;
    else if (gap === 2) pts -= 2;
    else if (gap === 3) pts -= 4;
    else if (gap >= 4) pts -= 5;
    if (gap <= 1 && high < 12) pts += 1;
  }

  return Math.max(0.05, Math.min(0.99, (pts + 2) / 22));
}

function hasFlushDraw(allCards: number[]): boolean {
  const counts = [0, 0, 0, 0];
  for (const c of allCards) counts[cardSuit(c)]++;
  return counts.some((n) => n === 4);
}

function hasOpenStraightDraw(allCards: number[]): boolean {
  const uniq = [...new Set(allCards.map(cardRank))].sort((a, b) => a - b);
  if (uniq.includes(14)) uniq.unshift(1);
  let run = 1;
  for (let i = 1; i < uniq.length; i++) {
    if (uniq[i] === uniq[i - 1] + 1) {
      run++;
      if (run >= 4) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

// Força pós-flop [0, 1] combinando mão feita (bestHand) + draws no Flop/Turn.
export function evaluatePostflopStrength(cards: number[], board: number[]): number {
  const all = [...cards, ...board];
  const h = bestHand(all);
  if (!h) return evaluatePreflopStrength(cards);

  // Base por categoria (rank 1 = Royal Flush .. 10 = Carta Alta)
  const baseByRank: Record<number, number> = {
    1: 0.99,
    2: 0.98,
    3: 0.95,
    4: 0.91,
    5: 0.84,
    6: 0.79,
    7: 0.73,
    8: 0.65,
    9: 0.44,
    10: 0.2,
  };
  let strength = baseByRank[h.rank] ?? 0.25;

  // Ajuste fino para Um Par e Carta Alta conforme altura da carta
  if (h.rank === 9) {
    const pairRank = cardRank(h.cards[0]);
    const topBoard = Math.max(...board.map(cardRank));
    if (pairRank >= topBoard)
      strength += 0.14; // Top pair ou Overpair
    else if (pairRank >= 9) strength += 0.06;
  } else if (h.rank === 10) {
    const myHigh = Math.max(...cards.map(cardRank));
    if (myHigh >= 13) strength += 0.06;
  }

  // Bônus de projetos (draws) quando ainda há cartas por vir
  if (board.length < 5 && h.rank > 5) {
    const mult = board.length === 3 ? 1 : 0.6;
    if (hasFlushDraw(all)) strength += 0.17 * mult;
    if (hasOpenStraightDraw(all)) strength += 0.12 * mult;
  }

  return Math.max(0.05, Math.min(0.99, strength));
}

export type BotDecision = { type: Action; amount?: number };

const STYLE_MODS: Record<BotStyle, { loose: number; aggr: number; bluff: number }> = {
  tight: { loose: -0.07, aggr: -0.06, bluff: 0.03 },
  balanced: { loose: 0, aggr: 0.02, bluff: 0.07 },
  aggressive: { loose: 0.05, aggr: 0.1, bluff: 0.14 },
  wild: { loose: 0.11, aggr: 0.08, bluff: 0.18 },
};

const DIFF_MODS: Record<
  BotDifficulty,
  { noise: number; bluffMult: number; potOddsWeight: number }
> = {
  easy: { noise: 0.12, bluffMult: 0.35, potOddsWeight: 0.55 },
  medium: { noise: 0.06, bluffMult: 0.85, potOddsWeight: 0.9 },
  hard: { noise: 0.03, bluffMult: 1.25, potOddsWeight: 1.15 },
};

function roundToStep(value: number, step: number, min: number, max: number): number {
  const safeStep = Math.max(1, step);
  const rounded = Math.round(value / safeStep) * safeStep;
  return Math.max(min, Math.min(max, rounded));
}

export function decideBotAction(s: GameState, seat: number): BotDecision {
  const p = s.players[seat];
  if (!p) return { type: 'fold' };

  const current = s.current ?? 0;
  const minRaise = s.minRaise ?? s.bb;
  const due = Math.max(0, current - p.bet);
  const max = p.bet + p.stack;
  const min = Math.min(max, current + minRaise);
  const pot = s.players.reduce((a, q) => a + q.total, 0);

  const hasAbleOpponent = s.players.some(
    (q) => q !== p && !q.fold && q.cards.length > 0 && q.stack > 0,
  );
  const canRaise =
    max > current && (p.actedAt == null || current - p.actedAt >= minRaise) && hasAbleOpponent;

  const profile = p.bot ?? { style: 'balanced' as BotStyle, difficulty: 'medium' as BotDifficulty };
  const sm = STYLE_MODS[profile.style];
  const dm = DIFF_MODS[profile.difficulty];

  const rawStrength =
    s.phase === 'preflop'
      ? evaluatePreflopStrength(p.cards)
      : evaluatePostflopStrength(p.cards, s.board);

  // Ruído controlado para decisões naturais e nunca mecânicas
  const jitter = ((randomInt(0, 2001) - 1000) / 1000) * dm.noise;
  const effective = Math.max(0.02, Math.min(0.99, rawStrength + sm.loose + jitter));

  const potOdds = due > 0 ? due / Math.max(1, pot + due) : 0;
  const stackPressure = due / Math.max(1, p.stack);
  const roll = randomInt(0, 1000) / 1000;
  const wantsBluff = roll < sm.bluff * dm.bluffMult && stackPressure < 0.45;

  // Caso 1: Não há aposta pendente (pode dar check ou apostar)
  if (due === 0) {
    const betThreshold = 0.62 - sm.aggr;
    if (canRaise && (effective >= betThreshold || (wantsBluff && s.phase !== 'preflop'))) {
      const potFrac = effective >= 0.84 ? 0.78 : effective >= 0.72 ? 0.55 : 0.4;
      const target =
        s.phase === 'preflop'
          ? current + Math.round(s.bb * (effective >= 0.82 ? 3 : 2))
          : p.bet + Math.max(s.bb, Math.round(pot * potFrac));
      const amount = roundToStep(target, s.sb, min, max);
      if (amount > current && amount <= max) {
        return { type: 'raise', amount };
      }
    }
    return { type: 'check' };
  }

  // Caso 2: Existe aposta pendente (fold, call ou raise)
  const raiseThreshold = 0.76 - sm.aggr;
  if (canRaise && (effective >= raiseThreshold || (wantsBluff && roll < 0.06))) {
    const mult = effective >= 0.9 ? 1.0 : effective >= 0.82 ? 0.7 : 0.45;
    const target =
      effective >= 0.93 && stackPressure >= 0.35
        ? max
        : current + Math.max(minRaise, Math.round((pot + due) * mult));
    const amount = roundToStep(target, s.sb, min, max);
    if (amount > current && amount <= max) {
      return { type: 'raise', amount };
    }
  }

  // Decisão entre call e fold baseada em força efetiva vs pot odds + risco do stack
  const required = potOdds * dm.potOddsWeight + stackPressure * 0.18 + 0.14;
  if (effective >= required || (due <= s.bb && effective >= 0.24)) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}

export function maybeBotEmote(s: GameState, seat: number, decision: BotDecision): EmoteId | null {
  const roll = randomInt(0, 100);
  const p = s.players[seat];
  if (!p) return null;

  // All-in do bot: chance moderada de reação marcante
  if (decision.type === 'raise' && decision.amount === p.bet + p.stack && roll < 32) {
    return roll < 16 ? 'fire' : 'cool';
  }
  // Raise normal
  if (decision.type === 'raise' && roll < 10) {
    return roll < 5 ? 'cool' : 'eyes';
  }
  // Fold diante de aposta alta
  if (decision.type === 'fold' && (s.current ?? 0) >= s.bb * 4 && roll < 12) {
    return roll < 6 ? 'scream' : 'think';
  }
  return null;
}
