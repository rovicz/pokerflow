import { publicPlayerUid } from './seat.ts';
import type { GameState } from './game-types.ts';

import type { StatDelta } from './leaderboard.ts';

// Computa deltas de estatísticas de forma idempotente quando uma mão encerra (`settled`).
// Anti-farm padrão: exige `minHumans = 2` jogadores humanos na mesa para pontuar no ranking oficial.
export function computeHandStatDeltas(
  s: GameState,
  opts: { minHumans?: number } = {},
): StatDelta[] {
  const minHumans = opts.minHumans ?? 2;
  if (s.phase !== 'settled' || s.hand <= 0) return [];
  if ((s.statsRecordedHand ?? 0) >= s.hand) return [];

  const humanCount = s.players.filter((p) => !p.bot).length;
  if (humanCount < minHumans) {
    s.statsRecordedHand = s.hand;
    return [];
  }

  const awards = new Map<string, { chips: number; biggestPot: number }>();
  const legacyPotTotal = s.result.reduce((sum, result) => sum + result.amount, 0);
  for (const pot of s.pots ?? [{ amount: legacyPotTotal, awards: s.result }]) {
    for (const award of pot.awards) {
      const key = award.uid ?? award.name;
      const player = awards.get(key) ?? { chips: 0, biggestPot: 0 };
      player.chips += award.amount;
      player.biggestPot = Math.max(player.biggestPot, pot.amount);
      awards.set(key, player);
    }
  }

  const remainingWithChips = s.players.filter((p) => !p.kicked && !p.left && p.stack > 0);
  const matchEnded = remainingWithChips.length === 1 && !s.statsRecordedMatch;
  const championId = matchEnded ? remainingWithChips[0].id : null;

  const deltas: StatDelta[] = [];
  for (const p of s.players) {
    if (p.bot || !p.userId) continue;
    const award =
      awards.get(publicPlayerUid(p.id)) ??
      (s.players.filter((q) => q.name === p.name).length === 1 ? awards.get(p.name) : undefined);
    const chipsWon = award?.chips ?? 0;
    const playedThisHand = p.cards.length > 0 || chipsWon > 0;
    const handsWon = chipsWon > 0 ? 1 : 0;
    const matchesPlayed = matchEnded ? 1 : 0;
    const matchesWon = matchEnded && p.id === championId ? 1 : 0;

    if (!playedThisHand && !matchEnded) continue;
    deltas.push({
      userId: p.userId,
      handsPlayed: playedThisHand ? 1 : 0,
      handsWon,
      matchesPlayed,
      matchesWon,
      biggestPot: award?.biggestPot ?? 0,
      chipsWon,
    });
  }

  s.statsRecordedHand = s.hand;
  if (matchEnded) s.statsRecordedMatch = true;
  return deltas;
}
