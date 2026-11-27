import { createServerSupabase } from '../../../../src/lib/supabase/server.ts';
import { allow } from '../../../../src/server/rate-limit.ts';
import { validatePasswordChange } from '../../../../src/auth/validation.ts';

export const runtime = 'nodejs';

const reply = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  if (!supabase) return reply({ error: 'Autenticação indisponível.' }, 503);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return reply({ error: 'Faça login para alterar sua senha.' }, 401);

  if (!allow('auth:chpw:' + user.id, 5, 10 * 60_000)) {
    return reply({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return reply({ error: 'Dados inválidos.' }, 400);
  const parsed = validatePasswordChange(body as Record<string, unknown>);
  if (!parsed.ok) return reply({ error: parsed.error }, 400);

  // Reautentica com a senha atual antes de permitir a troca
  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.currentPassword,
  });
  if (verifyErr) {
    return reply({ error: 'Senha atual incorreta.' }, 400);
  }

  const { error: updateErr } = await supabase.auth.updateUser({ password: parsed.newPassword });
  if (updateErr) {
    return reply({ error: 'Não foi possível atualizar sua senha agora.' }, 400);
  }

  return reply({ ok: true });
}
