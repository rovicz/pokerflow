import { createAdminSupabase } from '../../../../src/server/supabase-admin.ts';
import { createServerSupabase } from '../../../../src/lib/supabase/server.ts';
import { allow } from '../../../../src/server/rate-limit.ts';
import { appOrigin, buildConfirmUrl, sendConfirmationEmail } from '../../../../src/server/email.ts';
import { registerAccountWithFallback } from '../../../../src/server/auth-registration.ts';
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

    const result = await registerAccountWithFallback(
      {
        isUsernameTaken: async (uname) => {
          const { data: existing } = await admin
            .from('profiles')
            .select('id')
            .ilike('username', uname)
            .limit(1);
          return !!(existing && existing.length > 0);
        },
        generateSignupLink: async ({ email: e, password: p, username: u }) => {
          const { data, error } = await admin.auth.admin.generateLink({
            type: 'signup',
            email: e,
            password: p,
            options: {
              data: {
                username: u,
                display_name: u,
              },
            },
          });
          return {
            userId: data?.user?.id,
            hashedToken: data?.properties?.hashed_token,
            errorMessage: error?.message,
          };
        },
        deleteUser: async (userId) => {
          await admin.auth.admin.deleteUser(userId);
        },
        buildConfirmUrl: (tokenHash) => buildConfirmUrl(tokenHash, 'signup'),
        sendConfirmationEmail,
        fallbackSignUp: async ({ email: e, password: p, username: u }) => {
          const supabase = await createServerSupabase();
          if (!supabase) return { errorMessage: 'Supabase anon client indisponível.' };
          const { error } = await supabase.auth.signUp({
            email: e,
            password: p,
            options: {
              data: {
                username: u,
                display_name: u,
              },
              emailRedirectTo: `${appOrigin()}/auth/confirm?next=/?auth=confirmed`,
            },
          });
          return { errorMessage: error?.message };
        },
      },
      { username, email, password },
    );

    if (!result.ok) {
      return reply({ error: result.error }, result.status);
    }

    return reply({ ok: true, email: result.email });
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : 'Erro ao processar cadastro.' }, 500);
  }
}
