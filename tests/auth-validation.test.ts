import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import type { GameState } from '../src/poker/game-types.ts';
import {
  escapeHtml,
  validatePasswordChange,
  validateProfileUpdate,
  validateRegistrationInput,
} from '../src/auth/validation.ts';
import {
  buildConfirmUrl,
  classifyResendError,
  EmailDeliveryError,
  renderEmailHtml,
} from '../src/server/email.ts';
import { registerAccountWithFallback } from '../src/server/auth-registration.ts';
import { view } from '../src/poker/engine.ts';

test('validateRegistrationInput valida username, e-mail e senha corretamente', () => {
  const ok = validateRegistrationInput({
    username: '  victor_99 ',
    email: '  Victor@Exemplo.COM ',
    password: 'super-secret-password',
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.username, 'victor_99');
    assert.equal(ok.email, 'victor@exemplo.com');
  }

  assert.equal(
    validateRegistrationInput({ username: 'ab', email: 'a@b.co', password: 'password123' }).ok,
    false,
  );
  assert.equal(
    validateRegistrationInput({ username: 'bad name!', email: 'a@b.co', password: 'password123' })
      .ok,
    false,
  );
  assert.equal(
    validateRegistrationInput({ username: 'valid_user', email: 'invalid', password: 'password123' })
      .ok,
    false,
  );
  assert.equal(
    validateRegistrationInput({ username: 'valid_user', email: 'a@b.co', password: '123' }).ok,
    false,
  );
});

test('renderEmailHtml escapa HTML para prevenir XSS e buildConfirmUrl monta rota segura', () => {
  assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
  const url = buildConfirmUrl('hash123', 'signup');
  assert.ok(url.includes('/auth/confirm?'));
  assert.ok(url.includes('token_hash=hash123'));
  assert.ok(url.includes('type=signup'));

  const html = renderEmailHtml({
    eyebrow: 'TESTE',
    title: 'Confirme',
    greeting: 'Olá, <script>alert(1)</script>!',
    body: 'Corpo do e-mail',
    ctaLabel: 'Confirmar',
    ctaUrl: url,
    footnote: 'Rodapé',
  });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('view() nunca vaza player.userId no estado público e expõe apenas verified: true', () => {
  const s: GameState = {
    host: 'a'.repeat(64),
    initial: 2000,
    phase: 'waiting',
    players: [
      {
        id: 'a'.repeat(64),
        userId: '11111111-2222-3333-4444-555555555555',
        name: 'Victor',
        stack: 2000,
        cards: [],
        bet: 0,
        total: 0,
      },
      {
        id: 'b'.repeat(64),
        name: 'Convidado',
        stack: 2000,
        cards: [],
        bet: 0,
        total: 0,
      },
    ],
    board: [],
    result: [],
    hand: 0,
    dealer: -1,
    turn: -1,
    sb: 10,
    bb: 20,
    seconds: 30,
  };

  const pub = view(s, 'b'.repeat(64));
  const serialized = JSON.stringify(pub);
  assert.ok(!serialized.includes('11111111-2222-3333-4444-555555555555'));
  assert.equal((pub.players[0] as Record<string, unknown>).userId, undefined);
  assert.equal(pub.players[0].verified, true);
  assert.equal(pub.players[1].verified, undefined);
});

test('validateProfileUpdate e validatePasswordChange validam campos de perfil e troca de senha', () => {
  const pOk = validateProfileUpdate({ display_name: '  Victor Silva ', username: 'victor_sp' });
  assert.equal(pOk.ok, true);
  if (pOk.ok) {
    assert.equal(pOk.display_name, 'Victor Silva');
    assert.equal(pOk.username, 'victor_sp');
  }
  assert.equal(validateProfileUpdate({ display_name: 'A' }).ok, false);
  assert.equal(validateProfileUpdate({ username: 'invalido com espaço' }).ok, false);

  assert.equal(
    validatePasswordChange({ currentPassword: '', newPassword: 'nova-senha-123' }).ok,
    false,
  );
  assert.equal(
    validatePasswordChange({ currentPassword: 'senha-atual', newPassword: '123' }).ok,
    false,
  );
  assert.equal(
    validatePasswordChange({ currentPassword: 'mesma-senha', newPassword: 'mesma-senha' }).ok,
    false,
  );
  assert.equal(
    validatePasswordChange({ currentPassword: 'senha-atual', newPassword: 'nova-senha-123' }).ok,
    true,
  );
});

test('classifyResendError distingue sandbox/domínio não verificado, rate limit e erro genérico', () => {
  const sandbox = classifyResendError({
    statusCode: 403,
    name: 'validation_error',
    message:
      'You can only send testing emails to your own email address. To send emails to other recipients, please verify a domain at resend.com/domains.',
  });
  assert.equal(sandbox.code, 'domain_unverified');

  const rate = classifyResendError({ statusCode: 429, message: 'Too many requests' });
  assert.equal(rate.code, 'rate_limited');

  const other = classifyResendError({ statusCode: 500, message: 'Internal server error' });
  assert.equal(other.code, 'provider_error');
});

test('registerAccountWithFallback faz rollback de usuário órfão e aciona fallback Supabase quando Resend está em sandbox', async () => {
  const deleted: string[] = [];
  let fallbackCalled = false;

  const res = await registerAccountWithFallback(
    {
      isUsernameTaken: async () => false,
      generateSignupLink: async () => ({ userId: 'usr-orphan-1', hashedToken: 'tok-1' }),
      deleteUser: async (id) => {
        deleted.push(id);
      },
      buildConfirmUrl: (t) => `https://pokerflow.app/auth/confirm?token_hash=${t}&type=signup`,
      sendConfirmationEmail: async () => {
        throw new EmailDeliveryError('domain_unverified', 'Domínio não verificado', {
          statusCode: 403,
        });
      },
      fallbackSignUp: async () => {
        fallbackCalled = true;
        return {};
      },
    },
    { username: 'galaxy', email: 'davimachadocruz@gmail.com', password: 'password123' },
  );

  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.delivery, 'supabase');
  assert.deepEqual(deleted, ['usr-orphan-1']);
  assert.equal(fallbackCalled, true);
});

test('registerAccountWithFallback remove usuário órfão mesmo quando o envio falha sem fallback disponível', async () => {
  const deleted: string[] = [];

  const res = await registerAccountWithFallback(
    {
      isUsernameTaken: async () => false,
      generateSignupLink: async () => ({ userId: 'usr-orphan-2', hashedToken: 'tok-2' }),
      deleteUser: async (id) => {
        deleted.push(id);
      },
      buildConfirmUrl: (t) => `https://pokerflow.app/auth/confirm?token_hash=${t}&type=signup`,
      sendConfirmationEmail: async () => {
        throw new EmailDeliveryError('provider_error', 'Falha temporária no provedor');
      },
    },
    { username: 'galaxy', email: 'davimachadocruz@gmail.com', password: 'password123' },
  );

  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 502);
  assert.deepEqual(deleted, ['usr-orphan-2']);
});
