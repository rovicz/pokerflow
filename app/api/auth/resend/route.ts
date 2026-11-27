import { createAdminSupabase } from '../../../../src/server/supabase-admin.ts';
import { allow } from '../../../../src/server/rate-limit.ts';
import { buildConfirmUrl, sendConfirmationEmail } from '../../../../src/server/email.ts';
import { EMAIL_RE, normalizeEmail } from '../../../../src/auth/validation.ts';

export const runtime = 'nodejs';

const reply = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const email = normalizeEmail((body as Record<string, unknown> | null)?.email);
    if (!EMAIL_RE.test(email)) return reply({ error: 'Informe um e-mail válido.' }, 400);

    if (!allow('auth:resend:' + email, 1, 60_000)) {
      return reply({ error: 'Aguarde 60 segundos antes de reenviar o e-mail.' }, 429);
    }

    const admin = createAdminSupabase();
    if (!admin) return reply({ error: 'Autenticação indisponível neste ambiente.' }, 503);

    // generateLink('magiclink') também confirma e-mail de conta ainda não confirmada,
    // mas para evitar enumeração respondemos sempre de forma segura.
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (!error && data?.properties?.hashed_token) {
      const displayName =
        (data.user?.user_metadata?.display_name as string | undefined) ||
        (data.user?.user_metadata?.username as string | undefined) ||
        'jogador';
      const confirmUrl = buildConfirmUrl(data.properties.hashed_token, 'signup');
      await sendConfirmationEmail(email, displayName, confirmUrl);
    }

    return reply({ ok: true });
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : 'Erro ao reenviar e-mail.' }, 500);
  }
}
