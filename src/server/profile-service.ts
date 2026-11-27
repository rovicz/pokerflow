import { cleanAvatar } from '../poker/avatars.ts';
import { validateProfileUpdate, type UserProfile, type UserStats } from '../auth/validation.ts';

export type AuthUserInfo = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type StoreWriteResult = {
  data: UserProfile | null;
  error: string | null;
  code?: string | null;
};

export type ProfileWriteFields = {
  username: string;
  display_name: string;
  avatar_style: string;
  avatar_seed: string;
};

export type ProfileStore = {
  findProfile(userId: string): Promise<UserProfile | null>;
  findStats(userId: string): Promise<UserStats | null>;
  isUsernameTaken(username: string, excludeUserId: string): Promise<boolean>;
  updateProfile(userId: string, fields: ProfileWriteFields): Promise<StoreWriteResult>;
  insertProfile(row: { id: string } & ProfileWriteFields): Promise<StoreWriteResult>;
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

export function mapProfileDbError(
  code: string | null | undefined,
  message: string | null | undefined,
): { status: number; error: string; code?: string } {
  const c = (code ?? '').toUpperCase();
  const msg = (message ?? '').toLowerCase();

  if (c === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
    return { status: 409, error: 'Este apelido único já está em uso.', code: c || '23505' };
  }
  if (c === '42P01' || c === 'PGRST205') {
    return {
      status: 503,
      error: 'Tabela de perfis não encontrada no banco. Execute a migration SQL no Supabase.',
      code: c,
    };
  }
  if (c === '42703' || c === 'PGRST204') {
    return {
      status: 503,
      error: 'Estrutura da tabela de perfis desatualizada. Execute a migration 002 no Supabase.',
      code: c,
    };
  }
  if (c === '42501') {
    return {
      status: 403,
      error: 'Permissão negada ao salvar perfil (verifique RLS e SUPABASE_SERVICE_ROLE_KEY).',
      code: c,
    };
  }
  if (c === '23514' || c === '23502') {
    return {
      status: 400,
      error: 'Dados de perfil inválidos para as restrições do banco.',
      code: c,
    };
  }
  return {
    status: 400,
    error: 'Não foi possível salvar seu perfil.',
    ...(c ? { code: c } : {}),
  };
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
    const { data } = await store.insertProfile({
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
): Promise<
  { ok: true; profile: UserProfile } | { ok: false; status: number; error: string; code?: string }
> {
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
    return { ok: false, status: 409, error: 'Este apelido único já está em uso.', code: '23505' };
  }

  const nextAvatar = hasAvatar
    ? cleanAvatar(body.avatar, nextDisplayName)
    : cleanAvatar(
        current ? { style: current.avatar_style, seed: current.avatar_seed } : undefined,
        nextDisplayName,
      );

  const fields: ProfileWriteFields = {
    username: nextUsername,
    display_name: nextDisplayName,
    avatar_style: nextAvatar.style,
    avatar_seed: nextAvatar.seed,
  };

  // Usa UPDATE direto quando o perfil já existe (evita exigir política INSERT de RLS);
  // usa INSERT apenas quando o registro ainda não existe (auto-cura).
  const write = current
    ? await store.updateProfile(user.id, fields)
    : await store.insertProfile({ id: user.id, ...fields });

  if (write.error || !write.data) {
    const mapped = mapProfileDbError(write.code, write.error);
    return { ok: false, ...mapped };
  }

  await store.ensureStats(user.id);
  return { ok: true, profile: write.data };
}
