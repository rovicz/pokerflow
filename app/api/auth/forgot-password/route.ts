import { createAdminSupabase } from '../../../../src/server/supabase-admin.ts';
import { allow } from '../../../../src/server/rate-limit.ts';
import { buildConfirmUrl, sendPasswordResetEmail } from '../../../../src/server/email.ts';
import { EMAIL_RE, normalizeEmail } from '../../../../src/auth/validation.ts';

export const runtime = 'nodejs';

const reply = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
    if (!allow('auth:forgot:' + ip, 6, 10 * 60_000)) {
      return reply({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
    }

    const body: unknown = await req.json().catch(() => null);
    const email = normalizeEmail((body as Record<string, unknown> | null)?.email);
    if (!EMAIL_RE.test(email)) return reply({ error: 'Informe um e-mail válido.' }, 400);

    const admin = createAdminSupabase();
    if (!admin) return reply({ error: 'Autenticação indisponível neste ambiente.' }, 503);

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (!error && data?.properties?.hashed_token) {
      const displayName =
        (data.user?.user_metadata?.display_name as string | undefined) ||
        (data.user?.user_metadata?.username as string | undefined) ||
        'jogador';
      const resetUrl = buildConfirmUrl(data.properties.hashed_token, 'recovery');
      await sendPasswordResetEmail(email, displayName, resetUrl);
    }

    // Sempre responde 200 para evitar enumeração de contas.
    return reply({ ok: true });
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : 'Erro ao enviar e-mail de recuperação.' },
      500,
    );
  }
}
