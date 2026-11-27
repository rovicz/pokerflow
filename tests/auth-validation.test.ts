import test from 'node:test';
import assert from 'node:assert/strict';
import type { GameState } from '../src/poker/game-types.ts';
import { escapeHtml, validateRegistrationInput } from '../src/auth/validation.ts';
import { buildConfirmUrl, renderEmailHtml } from '../src/server/email.ts';
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
