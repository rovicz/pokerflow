import { EmailDeliveryError } from './email.ts';

export type RegisterResult =
  | { ok: true; status: 200; email: string; delivery: 'resend' | 'supabase' }
  | { ok: false; status: number; error: string };

export type RegisterDeps = {
  isUsernameTaken: (username: string) => Promise<boolean>;
  generateSignupLink: (input: {
    email: string;
    password: string;
    username: string;
  }) => Promise<{ userId?: string; hashedToken?: string; errorMessage?: string }>;
  deleteUser: (userId: string) => Promise<void>;
  sendConfirmationEmail: (to: string, username: string, confirmUrl: string) => Promise<void>;
  buildConfirmUrl: (tokenHash: string) => string;
  fallbackSignUp?: (input: {
    email: string;
    password: string;
    username: string;
  }) => Promise<{ errorMessage?: string }>;
};

function isFallbackEligible(err: unknown): boolean {
  return (
    err instanceof EmailDeliveryError &&
    (err.code === 'domain_unverified' || err.code === 'missing_config')
  );
}

/**
 * Fluxo seguro de cadastro com rollback garantido de conta órfã e fallback automático
 * para o mailer nativo do Supabase Auth quando o Resend estiver em modo sandbox/sem domínio.
 */
export async function registerAccountWithFallback(
  deps: RegisterDeps,
  input: { username: string; email: string; password: string },
): Promise<RegisterResult> {
  const { username, email, password } = input;

  if (await deps.isUsernameTaken(username)) {
    return { ok: false, status: 409, error: 'Este apelido já está em uso. Escolha outro.' };
  }

  const generated = await deps.generateSignupLink({ email, password, username });
  if (generated.errorMessage || !generated.hashedToken) {
    const msg = (generated.errorMessage || '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return {
        ok: false,
        status: 409,
        error: 'Este e-mail já está cadastrado. Tente entrar na sua conta.',
      };
    }
    return {
      ok: false,
      status: 400,
      error: 'Não foi possível criar a conta. Tente novamente.',
    };
  }

  const createdUserId = generated.userId;

  try {
    const confirmUrl = deps.buildConfirmUrl(generated.hashedToken);
    await deps.sendConfirmationEmail(email, username, confirmUrl);
    return { ok: true, status: 200, email, delivery: 'resend' };
  } catch (err) {
    // Rollback obrigatório para nunca deixar conta órfã bloqueando apelido/e-mail
    if (createdUserId) {
      await deps.deleteUser(createdUserId).catch((delErr) => {
        console.error('[auth:register] Falha ao reverter usuário órfão:', delErr);
      });
    }

    // Fallback automático para o mailer do Supabase Auth quando o Resend não puder entregar
    if (isFallbackEligible(err) && deps.fallbackSignUp) {
      const fb = await deps.fallbackSignUp({ email, password, username });
      if (!fb.errorMessage) {
        return { ok: true, status: 200, email, delivery: 'supabase' };
      }
      const fbLow = fb.errorMessage.toLowerCase();
      console.error('[auth:register] Fallback Supabase Auth falhou:', fb.errorMessage);
      if (fbLow.includes('rate limit') || fbLow.includes('too many')) {
        return {
          ok: false,
          status: 429,
          error:
            'Limite temporário de envio de e-mails atingido. Aguarde alguns minutos e tente novamente.',
        };
      }
      return {
        ok: false,
        status: 502,
        error:
          'Não foi possível enviar o e-mail de confirmação agora. Tente novamente em instantes.',
      };
    }

    if (err instanceof EmailDeliveryError) {
      return {
        ok: false,
        status: err.code === 'rate_limited' ? 429 : 502,
        error: err.message,
      };
    }

    return {
      ok: false,
      status: 502,
      error: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.',
    };
  }
}
