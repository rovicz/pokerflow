import { createServerSupabase } from '../../../src/lib/supabase/server.ts';
import { createAdminSupabase } from '../../../src/server/supabase-admin.ts';
import { allow } from '../../../src/server/rate-limit.ts';
import { cleanAvatar } from '../../../src/poker/avatars.ts';
import { DELETE_CONFIRM_WORD, validateProfileUpdate } from '../../../src/auth/validation.ts';

export const runtime = 'nodejs';

const reply = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const supabase = await createServerSupabase();
  if (!supabase) return reply({ user: null, profile: null, stats: null });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return reply({ user: null, profile: null, stats: null });

  const [{ data: profile }, { data: stats }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('player_stats').select('*').eq('user_id', user.id).single(),
  ]);

  return reply({
    user: { id: user.id, email: user.email },
    profile: profile ?? null,
    stats: stats ?? null,
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
  if (!body || typeof body !== 'object') return reply({ error: 'Dados inválidos.' }, 400);
  const b = body as Record<string, unknown>;

  const validated = validateProfileUpdate({
    username: b.username,
    display_name: b.display_name,
  });
  if (!validated.ok) return reply({ error: validated.error }, 400);

  const updates: Record<string, string> = {};
  if (validated.display_name) updates.display_name = validated.display_name;
  if (validated.username) {
    const admin = createAdminSupabase();
    if (admin) {
      const { data: taken } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', validated.username)
        .neq('id', user.id)
        .limit(1);
      if (taken && taken.length > 0) {
        return reply({ error: 'Este apelido único já está em uso.' }, 409);
      }
    }
    updates.username = validated.username;
  }
  if (b.avatar) {
    const av = cleanAvatar(b.avatar, updates.display_name || user.email || 'player');
    updates.avatar_style = av.style;
    updates.avatar_seed = av.seed;
  }
  if (!Object.keys(updates).length) return reply({ error: 'Nada para atualizar.' }, 400);

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return reply({ error: 'Este apelido único já está em uso.' }, 409);
    }
    return reply({ error: 'Não foi possível salvar seu perfil.' }, 400);
  }
  return reply({ profile: data });
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
