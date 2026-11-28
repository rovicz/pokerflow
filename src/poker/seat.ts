import { createHash } from 'node:crypto';
import type { GameState } from './game-types.ts';

// Identificador público estável, independente da credencial atual do assento.
export function publicPlayerUid(id: string): string {
  return createHash('sha256').update(`pokerflow:uid:${id}`).digest('hex').slice(0, 10);
}

export const PRESENCE_WRITE_MS = 15_000;
export const PRESENCE_TIMEOUT_MS = 45_000;

export function turnKey(s: GameState): string | undefined {
  if (s.turn < 0 || s.phase === 'waiting' || s.phase === 'settled') return;
  return [s.turnSeq ?? 0, s.hand, s.phase, s.turn, s.deadline ?? ''].join('/');
}
