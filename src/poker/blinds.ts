import type { BlindSchedule, GameState } from './game-types.ts';

export const BLIND_MULTIPLIERS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 50] as const;
export const MAX_BLIND_LEVEL = BLIND_MULTIPLIERS.length;
export const BLIND_HAND_INTERVALS = [5, 8, 12] as const;
export const BLIND_TIME_INTERVALS = [180, 300, 480] as const; // 3, 5, 8 minutos

// Calcula SB/BB sempre inteiros e redondos (BB par, SB = BB / 2).
export function blindsForLevel(baseBb: number, level: number): { sb: number; bb: number } {
  const idx = Math.max(0, Math.min(MAX_BLIND_LEVEL - 1, Math.floor(level) - 1));
  const rawBb = Math.round(baseBb * BLIND_MULTIPLIERS[idx]);
  const bb = Math.max(2, rawBb % 2 === 0 ? rawBb : rawBb + 1);
  return { sb: bb / 2, bb };
}

export function createBlindSchedule(
  mode: 'hands' | 'time',
  every: number,
  baseBb: number,
): BlindSchedule {
  const allowed = mode === 'hands' ? BLIND_HAND_INTERVALS : BLIND_TIME_INTERVALS;
  if (!(allowed as readonly number[]).includes(every)) {
    throw Error('Intervalo de blinds progressivos inválido');
  }
  return {
    mode,
    every,
    baseBb,
    level: 1,
    nextAt: null,
  };
}

// Avança o nível de blinds somente no início de uma nova mão (nunca no meio da mão).
export function advanceBlindsIfDue(
  s: GameState,
  now = Date.now(),
): { leveledUp: boolean; level: number; sb: number; bb: number } {
  const b = s.blinds;
  if (!b) return { leveledUp: false, level: 1, sb: s.sb, bb: s.bb };

  let nextLevel = b.level;
  if (b.mode === 'hands') {
    const computed = Math.min(MAX_BLIND_LEVEL, 1 + Math.floor(Math.max(0, s.hand - 1) / b.every));
    if (computed > nextLevel) nextLevel = computed;
  } else {
    if (b.nextAt == null) {
      b.nextAt = now + b.every * 1000;
    } else {
      while (now >= b.nextAt && nextLevel < MAX_BLIND_LEVEL) {
        nextLevel++;
        b.nextAt += b.every * 1000;
      }
      if (nextLevel >= MAX_BLIND_LEVEL) b.nextAt = null;
    }
  }

  const leveledUp = nextLevel > b.level;
  b.level = nextLevel;
  const { sb, bb } = blindsForLevel(b.baseBb, nextLevel);
  s.sb = sb;
  s.bb = bb;
  return { leveledUp, level: nextLevel, sb, bb };
}

export function handsUntilNextLevel(b: BlindSchedule, currentHand: number): number | null {
  if (b.mode !== 'hands' || b.level >= MAX_BLIND_LEVEL) return null;
  if (currentHand <= 0) return b.every;
  const mod = currentHand % b.every;
  return mod === 0 ? 1 : b.every - mod + 1;
}

export function previewBlindLevels(baseBb: number, count = 4): { sb: number; bb: number }[] {
  return Array.from({ length: Math.min(count, MAX_BLIND_LEVEL) }, (_, i) =>
    blindsForLevel(baseBb, i + 1),
  );
}
