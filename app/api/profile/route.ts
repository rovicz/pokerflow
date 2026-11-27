import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from '../../../src/lib/supabase/server.ts';
import { createAdminSupabase } from '../../../src/server/supabase-admin.ts';
import { allow } from '../../../src/server/rate-limit.ts';
import {
  DELETE_CONFIRM_WORD,
  type UserProfile,
  type UserStats,
} from '../../../src/auth/validation.ts';
import {
  getOrHealProfile,
  updateUserProfile,
  type ProfileStore,
} from '../../../src/server/profile-service.ts';

export const runtime = 'nodejs';

const reply = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { 'Cache-Control': 'no-store' } });

function makeSupabaseProfileStore(db: SupabaseClient): ProfileStore {
  return {
    async findProfile(userId) {
      const { data } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
      return (data as UserProfile | null) ?? null;
    },
    async findStats(userId) {
      const { data } = await db
        .from('player_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      return (data as UserStats | null) ?? null;
    },
    async isUsernameTaken(username, excludeUserId) {
      const { data } = await db
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .neq('id', excludeUserId)
        .limit(1);
      return !!data && data.length > 0;
    },
    async upsertProfile(row) {
      const { data, error } = await db
        .from('profiles')
        .upsert(row, { onConflict: 'id' })
        .select('*')
        .single();
      if (error) {
        console.error('[api/profile] upsertProfile error:', error.code, error.message);
        return { data: null, error: error.message };
      }
      return { data: data as UserProfile, error: null };
    },
    async ensureStats(userId) {
      await db
        .from('player_stats')
        .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
    },
  };
}

export async function GET() {
  const supabase = await createServerSupabase();
  if (!supabase) return reply({ user: null, profile: null, stats: null });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply({ user: null, profile: null, stats: null });

  const db = createAdminSupabase() ?? supabase;
  const store = makeSupabaseProfileStore(db);
  const { profile, stats } = await getOrHealProfile(store, {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
  });

  return reply({
    user: { id: user.id, email: user.email },
    profile,
    stats,
  });
}

export async function PATCH(req: Request) {
  const supabase = await createServerSupabase();
  if (!supabase) return reply({ error: 'Autenticação indisponível.' }, 503);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply({ error: 'Faça login para editar seu perfil.' }, 401);

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reply({ error: 'Dados inválidos.' }, 400);
  }

  const db = createAdminSupabase() ?? supabase;
  const store = makeSupabaseProfileStore(db);
  const res = await updateUserProfile(
    store,
    { id: user.id, email: user.email, user_metadata: user.user_metadata },
    body as Record<string, unknown>,
  );

  if (!res.ok) return reply({ error: res.error }, res.status);
  return reply({ profile: res.profile });
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabase();
  if (!supabase) return reply({ error: 'Autenticação indisponível.' }, 503);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply({ error: 'Faça login para excluir sua conta.' }, 401);

  if (!allow('auth:del:' + user.id, 3, 10 * 60_000)) {
    return reply({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
  }

  const body: unknown = await req.json().catch(() => null);
  const confirm =
    body &&
    typeof body === 'object' &&
    typeof (body as Record<string, unknown>).confirm === 'string'
      ? ((body as Record<string, unknown>).confirm as string).trim().toUpperCase()
      : '';
  if (confirm !== DELETE_CONFIRM_WORD) {
    return reply({ error: `Digite ${DELETE_CONFIRM_WORD} para confirmar a exclusão.` }, 400);
  }

  const admin = createAdminSupabase();
  if (!admin) return reply({ error: 'Serviço administrativo indisponível.' }, 503);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return reply({ error: 'Não foi possível excluir sua conta agora.' }, 500);

  await supabase.auth.signOut();
  return reply({ deleted: true });
}
