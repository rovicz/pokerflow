import { Resend } from 'resend';
import { escapeHtml } from '../auth/validation.ts';

function appOrigin(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/+$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function buildConfirmUrl(tokenHash: string, type: 'signup' | 'recovery'): string {
  const next = type === 'recovery' ? '/redefinir-senha' : '/?auth=confirmed';
  const params = new URLSearchParams({ token_hash: tokenHash, type, next });
  return `${appOrigin()}/auth/confirm?${params.toString()}`;
}

export function renderEmailHtml(opts: {
  eyebrow: string;
  title: string;
  greeting: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  footnote: string;
}): string {
  const eyebrow = escapeHtml(opts.eyebrow);
  const title = escapeHtml(opts.title);
  const greeting = escapeHtml(opts.greeting);
  const body = escapeHtml(opts.body);
  const ctaLabel = escapeHtml(opts.ctaLabel);
  const ctaUrl = escapeHtml(opts.ctaUrl);
  const footnote = escapeHtml(opts.footnote);

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#0b0c10;color:#f6f6f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#14161e;border:1px solid rgba(246,246,243,0.12);border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:28px 28px 18px;border-bottom:1px solid rgba(246,246,243,0.08);">
        <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#f6f6f3;">PokerFlow</div>
        <div style="margin-top:6px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#66a1ff;">${eyebrow}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#f6f6f3;">${title}</h1>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:rgba(246,246,243,0.86);">${greeting}</p>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:rgba(246,246,243,0.72);">${body}</p>
        <a href="${ctaUrl}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#0a64ff;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${ctaLabel}</a>
        <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:rgba(246,246,243,0.48);">${footnote}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendViaResend(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw Error('Serviço de e-mail não configurado (RESEND_API_KEY ausente).');
  }
  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'PokerFlow <onboarding@resend.dev>';
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    throw Error('Não foi possível enviar o e-mail agora. Tente novamente em instantes.');
  }
}

export async function sendConfirmationEmail(to: string, displayName: string, confirmUrl: string) {
  const html = renderEmailHtml({
    eyebrow: 'CONFIRMAÇÃO DE CADASTRO',
    title: 'Confirme seu e-mail no PokerFlow',
    greeting: `Olá, ${displayName}!`,
    body: 'Sua conta no PokerFlow está quase pronta. Clique no botão abaixo para confirmar seu e-mail, salvar seu avatar e participar das mesas com seu perfil verificado.',
    ctaLabel: 'Confirmar meu e-mail',
    ctaUrl: confirmUrl,
    footnote: 'Se você não criou uma conta no PokerFlow, pode ignorar este e-mail com segurança.',
  });
  await sendViaResend(to, 'Confirme seu e-mail — PokerFlow', html);
}

export async function sendPasswordResetEmail(to: string, displayName: string, resetUrl: string) {
  const html = renderEmailHtml({
    eyebrow: 'RECUPERAÇÃO DE SENHA',
    title: 'Redefina sua senha no PokerFlow',
    greeting: `Olá, ${displayName}!`,
    body: 'Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha.',
    ctaLabel: 'Redefinir minha senha',
    ctaUrl: resetUrl,
    footnote: 'Se você não pediu essa alteração, ignore este e-mail — sua senha continua a mesma.',
  });
  await sendViaResend(to, 'Redefinir senha — PokerFlow', html);
}
