import { createAdminSupabase } from './supabase-admin.ts';
import type { StatDelta } from '../poker/leaderboard.ts';

// Persiste incrementos de estatísticas de forma atômica no Postgres (melhor esforço, não bloqueia jogadas).
export async function persistHandStats(deltas: StatDelta[]): Promise<void> {
  if (!deltas.length) return;
  const admin = createAdminSupabase();
  if (!admin) return;
  try {
    const { error } = await admin.rpc('record_hand_stats', { p_entries: deltas });
    if (error) {
      console.error('[stats-recorder] record_hand_stats error:', error.code, error.message);
    }
  } catch (e) {
    console.error('[stats-recorder] unexpected error:', e);
  }
}
