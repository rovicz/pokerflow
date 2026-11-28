import { isLeaderboardCategory, type LeaderboardCategory } from '../../../src/poker/leaderboard.ts';
import { loadLeaderboard } from '../../../src/server/leaderboard.ts';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawCat = searchParams.get('category');
  const category: LeaderboardCategory = isLeaderboardCategory(rawCat) ? rawCat : 'matches_won';
  return Response.json(await loadLeaderboard(category), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
