import { createAdminSupabase } from '../../../../src/server/supabase-admin.ts';
import { allow } from '../../../../src/server/rate-limit.ts';
import { buildConfirmUrl, sendConfirmationEmail } from '../../../../src/server/email.ts';
import { validateRegistrationInput } from '../../../../src/auth/validation.ts';

export const runtime = 'nodejs';

const reply = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
    if (!allow('auth:reg:' + ip, 8, 10 * 60_000)) {
      return reply({ error: 'Muitas tentativas de cadastro. Aguarde alguns minutos.' }, 429);
    }

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return reply({ error: 'Dados inválidos.' }, 400);
    const parsed = validateRegistrationInput(body as Record<string, unknown>);
    if (!parsed.ok) return reply({ error: parsed.error }, 400);

    const { username, email, password } = parsed;
    if (!allow('auth:reg-email:' + email, 3, 10 * 60_000)) {
      return reply({ error: 'Aguarde alguns minutos antes de tentar novamente.' }, 429);
    }

    const admin = createAdminSupabase();
    if (!admin) {
      return reply({ error: 'Autenticação indisponível neste ambiente.' }, 503);
    }

    // Verifica disponibilidade do apelido (case-insensitive)
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .limit(1);
    if (existing && existing.length > 0) {
      return reply({ error: 'Este apelido já está em uso. Escolha outro.' }, 409);
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: {
          username,
          display_name: username,
        },
      },
    });

    if (error || !data?.properties?.hashed_token) {
      const msg = error?.message?.toLowerCase() ?? '';
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return reply({ error: 'Este e-mail já está cadastrado. Tente entrar na sua conta.' }, 409);
      }
      return reply({ error: 'Não foi possível criar a conta. Tente novamente.' }, 400);
    }

    const confirmUrl = buildConfirmUrl(data.properties.hashed_token, 'signup');
    await sendConfirmationEmail(email, username, confirmUrl);

    return reply({ ok: true, email });
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : 'Erro ao processar cadastro.' }, 500);
  }
}
