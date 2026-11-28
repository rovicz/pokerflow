import { createServerSupabase } from '../lib/supabase/server.ts';
import { createAdminSupabase } from './supabase-admin.ts';
import {
  rankEntries,
  type LeaderboardCategory,
  type LeaderboardRow,
} from '../poker/leaderboard.ts';

type RawStatsRow = {
  user_id: string;
  hands_played: number;
  hands_won: number;
  matches_played: number;
  matches_won: number;
  biggest_pot: number;
  total_chips_won: number;
  profiles:
    | {
        username: string;
        display_name: string;
        avatar_style: string;
        avatar_seed: string;
      }
    | {
        username: string;
        display_name: string;
        avatar_style: string;
        avatar_seed: string;
      }[]
    | null;
};

export type LeaderboardPayload = {
  category: LeaderboardCategory;
  totalPlayers: number;
  rows: LeaderboardRow[];
  me: { rank: number; entry: LeaderboardRow } | null;
};

// Classificação do clube. Usada pela API e pela página inicial (renderizada no servidor, sem piscar).
export async function loadLeaderboard(category: LeaderboardCategory): Promise<LeaderboardPayload> {
  const supabase = await createServerSupabase();
  const db = createAdminSupabase() ?? supabase;
  if (!db) {
    return { category, rows: [], totalPlayers: 0, me: null };
  }

  let currentUserId: string | null = null;
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    currentUserId = data.user?.id ?? null;
  }

  const { data, error } = await db
    .from('player_stats')
    .select(
      'user_id, hands_played, hands_won, matches_played, matches_won, biggest_pot, total_chips_won, profiles!inner(username, display_name, avatar_style, avatar_seed)',
    )
    .limit(200);

  if (error || !data) {
    if (error) console.error('[api/leaderboard] query error:', error.code, error.message);
    return { category, rows: [], totalPlayers: 0, me: null };
  }

  const mapped: (LeaderboardRow & { _uid: string })[] = [];
  for (const r of data as RawStatsRow[]) {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    if (!prof) continue;
    mapped.push({
      _uid: r.user_id,
      username: prof.username,
      displayName: prof.display_name || prof.username,
      avatarStyle: prof.avatar_style || 'lorelei',
      avatarSeed: prof.avatar_seed || prof.username,
      handsPlayed: Number(r.hands_played) || 0,
      handsWon: Number(r.hands_won) || 0,
      matchesPlayed: Number(r.matches_played) || 0,
      matchesWon: Number(r.matches_won) || 0,
      biggestPot: Number(r.biggest_pot) || 0,
      totalChipsWon: Number(r.total_chips_won) || 0,
      ...(currentUserId && r.user_id === currentUserId ? { isMe: true } : {}),
    });
  }

  const ranked = rankEntries(mapped, category) as (LeaderboardRow & { _uid: string })[];
  const myIndex = currentUserId ? ranked.findIndex((r) => r._uid === currentUserId) : -1;

  const stripUid = (r: LeaderboardRow & { _uid: string }): LeaderboardRow => {
    const { _uid, ...clean } = r;
    void _uid;
    return clean;
  };

  return {
    category,
    totalPlayers: ranked.length,
    rows: ranked.slice(0, 50).map(stripUid),
    me:
      myIndex >= 0
        ? {
            rank: myIndex + 1,
            entry: stripUid(ranked[myIndex]),
          }
        : null,
  };
}
