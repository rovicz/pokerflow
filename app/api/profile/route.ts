import { createServerSupabase } from '../../../src/lib/supabase/server.ts';
import { cleanAvatar } from '../../../src/poker/avatars.ts';

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

  const updates: Record<string, string> = {};
  if (typeof b.display_name === 'string') {
    const clean = b.display_name.trim().slice(0, 24);
    if (clean.length >= 2) updates.display_name = clean;
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

  if (error) return reply({ error: 'Não foi possível salvar seu perfil.' }, 400);
  return reply({ profile: data });
}
