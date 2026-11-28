import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import type { UserProfile, UserStats } from '../src/auth/validation.ts';
import {
  getOrHealProfile,
  mapProfileDbError,
  updateUserProfile,
  type ProfileStore,
} from '../src/server/profile-service.ts';

function makeMemoryProfileStore(initial: UserProfile[] = []): {
  store: ProfileStore;
  profiles: Map<string, UserProfile>;
  stats: Map<string, UserStats>;
  calls: { updates: number; inserts: number };
} {
  const profiles = new Map<string, UserProfile>(initial.map((p) => [p.id, { ...p }]));
  const stats = new Map<string, UserStats>();
  const calls = { updates: 0, inserts: 0 };

  const store: ProfileStore = {
    async findProfile(userId) {
      return profiles.get(userId) ?? null;
    },
    async findStats(userId) {
      return stats.get(userId) ?? null;
    },
    async isUsernameTaken(username, excludeUserId) {
      const lower = username.toLowerCase();
      for (const p of profiles.values()) {
        if (p.id !== excludeUserId && p.username.toLowerCase() === lower) return true;
      }
      return false;
    },
    async updateProfile(userId, fields) {
      calls.updates++;
      const prev = profiles.get(userId);
      if (!prev) return { data: null, error: 'not found', code: 'PGRST116' };
      const saved: UserProfile = {
        ...prev,
        ...fields,
      };
      profiles.set(userId, saved);
      return { data: saved, error: null, code: null };
    },
    async insertProfile(row) {
      calls.inserts++;
      const saved: UserProfile = {
        id: row.id,
        username: row.username,
        display_name: row.display_name,
        avatar_style: row.avatar_style,
        avatar_seed: row.avatar_seed,
        role: 'player',
      };
      profiles.set(row.id, saved);
      return { data: saved, error: null, code: null };
    },
    async ensureStats(userId) {
      if (!stats.has(userId)) {
        stats.set(userId, {
          hands_played: 0,
          hands_won: 0,
          matches_played: 0,
          matches_won: 0,
          biggest_pot: 0,
          total_chips_won: 0,
        });
      }
    },
  };
  return { store, profiles, stats, calls };
}

test('updateUserProfile usa UPDATE direto para perfil existente e preserva role', async () => {
  const userId = '890eaad1-f7ec-4dff-9d28-84ef140c64f1';
  const { store, calls } = makeMemoryProfileStore([
    {
      id: userId,
      username: 'rovicz',
      display_name: 'rovicz',
      avatar_style: 'lorelei',
      avatar_seed: 'rovicz',
      role: 'player',
    },
  ]);

  const res = await updateUserProfile(
    store,
    { id: userId, email: 'rovicz@example.com' },
    {
      display_name: 'victor',
      username: 'rovicz',
      avatar: { style: 'adventurer', seed: 'owucrp' },
      role: 'admin',
    },
  );

  assert.equal(res.ok, true);
  assert.equal(calls.updates, 1);
  assert.equal(calls.inserts, 0);
  if (res.ok) {
    assert.equal(res.profile.display_name, 'victor');
    assert.equal(res.profile.username, 'rovicz');
    assert.equal(res.profile.avatar_style, 'adventurer');
    assert.equal(res.profile.avatar_seed, 'owucrp');
    assert.equal(res.profile.role, 'player');
  }
});

test('updateUserProfile e getOrHealProfile usam INSERT quando a linha ainda não existe', async () => {
  const userId = '11111111-2222-3333-4444-555555555555';
  const { store, profiles, stats, calls } = makeMemoryProfileStore([]);

  const res = await updateUserProfile(
    store,
    { id: userId, email: 'novo@example.com', user_metadata: { username: 'rovicz' } },
    {
      display_name: 'victor',
      username: 'rovicz',
      avatar: { style: 'adventurer', seed: 'z5rwg6' },
    },
  );
  assert.equal(res.ok, true);
  assert.equal(calls.inserts, 1);
  assert.equal(calls.updates, 0);
  assert.ok(profiles.has(userId));
  assert.ok(stats.has(userId));

  const user2 = '99999999-2222-3333-4444-555555555555';
  const healed = await getOrHealProfile(store, {
    id: user2,
    email: 'maria@example.com',
    user_metadata: { username: 'maria_pk', display_name: 'Maria' },
  });
  assert.equal(healed.profile?.username, 'maria_pk');
  assert.equal(healed.profile?.display_name, 'Maria');
  assert.ok(healed.stats);
});

test('updateUserProfile bloqueia username duplicado de outro usuário (409) e mapProfileDbError mapeia códigos Postgres/PostgREST', async () => {
  const { store } = makeMemoryProfileStore([
    {
      id: 'user-a',
      username: 'rovicz',
      display_name: 'Victor',
      avatar_style: 'lorelei',
      avatar_seed: 'rovicz',
      role: 'admin',
    },
    {
      id: 'user-b',
      username: 'outro',
      display_name: 'Outro',
      avatar_style: 'lorelei',
      avatar_seed: 'outro',
      role: 'player',
    },
  ]);

  const conflict = await updateUserProfile(
    store,
    { id: 'user-b' },
    { username: 'ROVICZ', display_name: 'Outro' },
  );
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.status, 409);

  assert.equal(mapProfileDbError('42P01', 'relation does not exist').status, 503);
  assert.equal(mapProfileDbError('PGRST205', 'table not found').status, 503);
  assert.equal(mapProfileDbError('PGRST204', 'column not found').status, 503);
  assert.equal(mapProfileDbError('42501', 'rls violation').status, 403);
  assert.equal(mapProfileDbError('23505', 'duplicate key').status, 409);
  assert.equal(mapProfileDbError('23514', 'check violation').status, 400);
});
