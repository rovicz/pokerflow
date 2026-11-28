import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import {
  EMOTES,
  EMOTE_COOLDOWN_MS,
  EMOTE_MAX_QUEUE,
  EMOTE_TTL_MS,
  isEmoteId,
  notoLottieUrl,
  pushEmote,
} from '../src/poker/emotes.ts';

test('catálogo de emotes tem codepoints válidos e URLs oficiais do Google Noto', () => {
  assert.equal(EMOTES.length, 12);
  for (const e of EMOTES) {
    assert.ok(isEmoteId(e.id));
    assert.match(e.codepoint, /^[0-9a-f_]+$/);
    assert.equal(
      notoLottieUrl(e.codepoint),
      `https://fonts.gstatic.com/s/e/notoemoji/latest/${e.codepoint}/lottie.json`,
    );
  }
  assert.equal(isEmoteId('invalido'), false);
  assert.equal(isEmoteId(null), false);
  assert.equal(isEmoteId('__proto__'), false);
});

test('pushEmote aplica cooldown por assento, limpa expirados e respeita limite da fila', () => {
  const t0 = 1_000_000;
  const r1 = pushEmote([], 0, 'laugh', t0);
  assert.equal(r1.ok, true);
  assert.equal(r1.emotes.length, 1);
  assert.equal(r1.emotes[0].seq, 1);

  // Mesmo jogador dentro do cooldown é bloqueado
  const blocked = pushEmote(r1.emotes, 0, 'fire', t0 + EMOTE_COOLDOWN_MS - 100);
  assert.equal(blocked.ok, false);

  // Outro jogador pode enviar simultaneamente
  const r2 = pushEmote(r1.emotes, 1, 'clown', t0 + 200);
  assert.equal(r2.ok, true);
  assert.equal(r2.emotes.length, 2);
  assert.equal(r2.emotes[1].seq, 2);

  // Após cooldown + TTL, eventos expirados são removidos
  const r3 = pushEmote(r2.emotes, 0, 'party', t0 + EMOTE_TTL_MS + 500);
  assert.equal(r3.ok, true);
  assert.equal(r3.emotes.length, 1);
  assert.equal(r3.emotes[0].seq, 3);
  assert.equal(r3.emotes[0].emote, 'party');

  // Limite máximo da fila
  let list = r3.emotes;
  for (let i = 0; i < EMOTE_MAX_QUEUE + 4; i++) {
    const step = pushEmote(list, i % 8, 'clap', t0 + EMOTE_TTL_MS + 600 + i * 400);
    if (step.ok) list = step.emotes;
  }
  assert.ok(list.length <= EMOTE_MAX_QUEUE);
});
