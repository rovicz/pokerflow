export const EMOTE_COOLDOWN_MS = 2500;
export const EMOTE_TTL_MS = 10000;
export const EMOTE_MAX_QUEUE = 8;

export const EMOTES = [
  { id: 'laugh', glyph: '😂', codepoint: '1f602', label: 'Rindo muito' },
  { id: 'cool', glyph: '😎', codepoint: '1f60e', label: 'Confiança' },
  { id: 'mindblown', glyph: '🤯', codepoint: '1f92f', label: 'Mente explodindo' },
  { id: 'scream', glyph: '😱', codepoint: '1f631', label: 'Susto' },
  { id: 'cry', glyph: '😭', codepoint: '1f62d', label: 'Chorando' },
  { id: 'angry', glyph: '😡', codepoint: '1f621', label: 'Bravo' },
  { id: 'think', glyph: '🤔', codepoint: '1f914', label: 'Pensando' },
  { id: 'fire', glyph: '🔥', codepoint: '1f525', label: 'Pegando fogo' },
  { id: 'clap', glyph: '👏', codepoint: '1f44f', label: 'Palmas' },
  { id: 'clown', glyph: '🤡', codepoint: '1f921', label: 'Palhaço' },
  { id: 'eyes', glyph: '👀', codepoint: '1f440', label: 'De olho' },
  { id: 'party', glyph: '🎉', codepoint: '1f389', label: 'Festa' },
] as const;

export type EmoteDef = (typeof EMOTES)[number];
export type EmoteId = EmoteDef['id'];
export type EmoteEvent = { seq: number; seat: number; emote: EmoteId; at: number };

export const EMOTE_MAP: Record<EmoteId, EmoteDef> = Object.fromEntries(
  EMOTES.map((e) => [e.id, e]),
) as Record<EmoteId, EmoteDef>;

export function isEmoteId(v: unknown): v is EmoteId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(EMOTE_MAP, v);
}

export function notoLottieUrl(codepoint: string) {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoint}/lottie.json`;
}

export function pushEmote(
  current: EmoteEvent[] | undefined,
  seat: number,
  emote: EmoteId,
  now = Date.now(),
): { ok: true; emotes: EmoteEvent[] } | { ok: false; retryAfterMs: number } {
  const list = Array.isArray(current) ? current : [];
  const lastFromSeat = [...list].reverse().find((e) => e.seat === seat);
  if (lastFromSeat && now - lastFromSeat.at < EMOTE_COOLDOWN_MS) {
    return { ok: false, retryAfterMs: EMOTE_COOLDOWN_MS - (now - lastFromSeat.at) };
  }
  const nextSeq = list.reduce((m, e) => Math.max(m, e.seq), 0) + 1;
  const fresh = list.filter((e) => now - e.at <= EMOTE_TTL_MS);
  fresh.push({ seq: nextSeq, seat, emote, at: now });
  return { ok: true, emotes: fresh.slice(-EMOTE_MAX_QUEUE) };
}
