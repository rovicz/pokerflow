import type { PublicState } from '../../poker/game-types.ts';
// Efeitos sintetizados com Web Audio: sem arquivos de áudio para baixar.
let ctx: AudioContext | null = null;
let muted = false;
export const setMuted = (v: boolean) => {
  muted = v;
};
function audio() {
  if (typeof window === 'undefined' || muted) return null;
  ctx ??= new (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!
  )();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(
  freq: number,
  dur: number,
  {
    type = 'sine',
    vol = 0.2,
    at = 0,
    to,
  }: { type?: OscillatorType; vol?: number; at?: number; to?: number } = {},
) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at,
    o = a.createOscillator(),
    g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(
  dur: number,
  {
    freq = 3000,
    to,
    q = 1,
    vol = 0.3,
    at = 0,
  }: { freq?: number; to?: number; q?: number; vol?: number; at?: number } = {},
) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at,
    buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate),
    d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(),
    f = a.createBiquadFilter(),
    g = a.createGain();
  src.buffer = buf;
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}
export const sfx = {
  deal: (at = 0) => noise(0.12, { freq: 2500, to: 6000, q: 0.7, vol: 0.45, at }),
  // Carta virando: "fff" de papel (ruído varrendo para o agudo) + estalo seco no fim + batida grave na mesa.
  flip: (at = 0) => {
    noise(0.1, { freq: 900, to: 5200, q: 0.8, vol: 0.5, at });
    noise(0.025, { freq: 7500, q: 1.5, vol: 0.5, at: at + 0.09 });
    tone(150, 0.07, { vol: 0.25, at: at + 0.1, to: 70 });
  },
  chip: (at = 0) => {
    tone(3200, 0.07, { type: 'triangle', vol: 0.13, at });
    tone(4700, 0.05, { vol: 0.07, at: at + 0.012 });
  },
  chips(n = 3, at = 0) {
    for (let i = 0; i < n; i++) this.chip(at + i * 0.06 + Math.random() * 0.02);
  },
  check: () => {
    tone(160, 0.09, { vol: 0.5, to: 70 });
    tone(160, 0.09, { vol: 0.5, to: 70, at: 0.14 });
  },
  call() {
    this.chips(3);
  },
  raise() {
    this.chips(6);
    tone(440, 0.12, { type: 'triangle', vol: 0.07, at: 0.4, to: 660 });
  },
  // All-in: sobe a tensão (varredura) e bate forte no 0,6 s, quando o texto aparece na tela.
  allin() {
    tone(180, 0.6, { type: 'sawtooth', vol: 0.07, to: 900 });
    noise(0.6, { freq: 400, to: 4000, q: 0.6, vol: 0.25 });
    tone(55, 0.5, { vol: 0.7, at: 0.6, to: 30 });
    noise(0.3, { freq: 220, vol: 0.5, at: 0.6 });
    this.chips(10, 0.62);
    [523, 659, 784].forEach((f, i) =>
      tone(f, 0.4, { type: 'square', vol: 0.05, at: 0.62 + i * 0.07 }),
    );
  },
  fold: () => noise(0.3, { freq: 1800, to: 300, q: 0.6, vol: 0.35 }),
  gather(at = 0) {
    this.chips(4, at);
  },
  turn: (at = 0) => {
    tone(880, 0.16, { vol: 0.12, at });
    tone(1320, 0.22, { vol: 0.1, at: at + 0.13 });
  },
  tick: () => tone(1600, 0.03, { type: 'square', vol: 0.03 }),
  champion() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone(f, 0.5, { type: 'triangle', vol: 0.1, at: i * 0.15 }),
    );
    this.chips(8, 0.8);
  },
  win(at = 0) {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, 0.3, { type: 'triangle', vol: 0.12, at: at + i * 0.1 }),
    );
    this.chips(8, at + 0.45);
  },
};

// Navegadores só liberam áudio após um gesto do usuário.
export const unlock = () => {
  audio();
};

// Compara dois estados consecutivos da mesa e toca os sons correspondentes,
// alinhados com os tempos das animações em app/table.js.
export function playTransition(a: PublicState, b: PublicState) {
  const N = b.players.length,
    me = b.players.findIndex((q) => q.self),
    mine = (s: PublicState) => s.turn >= 0 && s.players[s.turn]?.self;
  let t = 0;
  if (b.hand !== a.hand) {
    for (let i = 0; i < N * 2; i++) sfx.deal(0.4 + i * 0.13);
    for (let k = 0; k < 2; k++)
      sfx.flip(0.4 + (k * N + ((me - b.dealer - 1 + N) % N)) * 0.13 + 0.6 + 0.2 + k * 0.22);
    sfx.chips(2, 0.1);
    t = 0.4 + N * 2 * 0.13;
  } else {
    const L = b.last;
    if (L && L.seq !== a.last?.seq) {
      const q = b.players[L.seat];
      q && q.stack === 0 && L.type !== 'fold' && L.type !== 'check' ? sfx.allin() : sfx[L.type]?.();
      t = 0.5;
    }
    const n = b.board.length - a.board.length;
    if (n > 0) {
      sfx.gather();
      for (let k = 0; k < n; k++) {
        sfx.deal(k * 0.08);
        sfx.flip(0.7 + k * 0.22);
      }
      t = 0.7 + n * 0.22 + 0.3;
    }
    if (b.phase === 'settled' && a.phase !== 'settled') {
      if (b.reveal) {
        const r0 = n > 0 ? t : 0.2;
        for (let k = 0; k < 2 * (N - 1); k++) sfx.flip(r0 + k * 0.18);
        t = r0 + 2 * (N - 1) * 0.18 + 0.5;
      }
      b.result.some((r) => b.players.find((q) => q.self)?.name === r.name)
        ? sfx.win(t)
        : sfx.gather(t);
    }
  }
  if (mine(b) && (!mine(a) || a.turn !== b.turn || a.phase !== b.phase || a.hand !== b.hand))
    sfx.turn(t + 0.3);
}
