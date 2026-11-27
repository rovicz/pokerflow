import { cleanAvatar } from '../poker/avatars.ts';
import { validateProfileUpdate, type UserProfile, type UserStats } from '../auth/validation.ts';

export type AuthUserInfo = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type ProfileStore = {
  findProfile(userId: string): Promise<UserProfile | null>;
  findStats(userId: string): Promise<UserStats | null>;
  isUsernameTaken(username: string, excludeUserId: string): Promise<boolean>;
  upsertProfile(row: {
    id: string;
    username: string;
    display_name: string;
    avatar_style: string;
    avatar_seed: string;
  }): Promise<{ data: UserProfile | null; error: string | null }>;
  ensureStats(userId: string): Promise<void>;
};

function fallbackUsername(user: AuthUserInfo): string {
  const meta =
    (typeof user.user_metadata?.username === 'string' && user.user_metadata.username) ||
    (user.email ? user.email.split('@')[0] : '');
  const clean = meta.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
  if (clean.length >= 3) return clean;
  return 'player_' + user.id.replace(/-/g, '').slice(0, 8);
}

export async function getOrHealProfile(
  store: ProfileStore,
  user: AuthUserInfo,
): Promise<{ profile: UserProfile | null; stats: UserStats | null }> {
  let profile = await store.findProfile(user.id);
  if (!profile) {
    const uname = fallbackUsername(user);
    const dname =
      (typeof user.user_metadata?.display_name === 'string' &&
        user.user_metadata.display_name.trim().slice(0, 24)) ||
      uname;
    const { data } = await store.upsertProfile({
      id: user.id,
      username: uname,
      display_name: dname,
      avatar_style: 'lorelei',
      avatar_seed: uname,
    });
    profile = data;
  }
  await store.ensureStats(user.id);
  const stats = await store.findStats(user.id);
  return { profile, stats };
}

export async function updateUserProfile(
  store: ProfileStore,
  user: AuthUserInfo,
  body: Record<string, unknown>,
): Promise<{ ok: true; profile: UserProfile } | { ok: false; status: number; error: string }> {
  const validated = validateProfileUpdate({
    username: body.username,
    display_name: body.display_name,
  });
  if (!validated.ok) return { ok: false, status: 400, error: validated.error };

  const current = await store.findProfile(user.id);
  const hasAvatar = body.avatar != null;
  if (!validated.display_name && !validated.username && !hasAvatar) {
    return { ok: false, status: 400, error: 'Nada para atualizar.' };
  }

  const nextUsername = validated.username ?? current?.username ?? fallbackUsername(user);
  const nextDisplayName =
    (validated.display_name ??
      current?.display_name ??
      (typeof user.user_metadata?.display_name === 'string' &&
        user.user_metadata.display_name.trim().slice(0, 24))) ||
    nextUsername;

  if (await store.isUsernameTaken(nextUsername, user.id)) {
    return { ok: false, status: 409, error: 'Este apelido único já está em uso.' };
  }

  const nextAvatar = hasAvatar
    ? cleanAvatar(body.avatar, nextDisplayName)
    : cleanAvatar(
        current ? { style: current.avatar_style, seed: current.avatar_seed } : undefined,
        nextDisplayName,
      );

  const { data, error } = await store.upsertProfile({
    id: user.id,
    username: nextUsername,
    display_name: nextDisplayName,
    avatar_style: nextAvatar.style,
    avatar_seed: nextAvatar.seed,
  });

  if (error || !data) {
    const msg = (error ?? '').toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { ok: false, status: 409, error: 'Este apelido único já está em uso.' };
    }
    return { ok: false, status: 400, error: 'Não foi possível salvar seu perfil.' };
  }

  await store.ensureStats(user.id);
  return { ok: true, profile: data };
}
