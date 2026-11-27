import type { PublicState } from '../../poker/game-types.ts';
// Efeitos sintetizados com Web Audio: sem arquivos de áudio para baixar.
let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let muted = false;
export const setMuted = (v: boolean) => {
  muted = v;
};
function audio() {
  if (typeof window === 'undefined' || muted) return null;
  if (!ctx) {
    ctx = new (
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!
    )();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 20;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.12;
    bus = ctx.createGain();
    bus.gain.value = 0.85;
    comp.connect(bus).connect(ctx.destination);
    (ctx as AudioContext & { _in?: AudioNode })._in = comp;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function out(a: AudioContext): AudioNode {
  return (a as AudioContext & { _in?: AudioNode })._in ?? a.destination;
}
const jitter = (v: number, spread = 0.1) => v * (1 + (Math.random() * 2 - 1) * spread);
function tone(
  freq: number,
  dur: number,
  {
    type = 'sine',
    vol = 0.2,
    at = 0,
    to,
    attack = 0.004,
  }: { type?: OscillatorType; vol?: number; at?: number; to?: number; attack?: number } = {},
) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at,
    o = a.createOscillator(),
    g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(attack, dur * 0.35));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out(a));
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
  src.connect(f).connect(g).connect(out(a));
  src.start(t);
}
// Ruído rosa amortecido com passa-baixa e ataque suave para simular papel/cartão deslizando no feltro.
function softNoise(
  dur: number,
  {
    freq = 1400,
    to,
    q = 0.9,
    lp = 2900,
    vol = 0.16,
    at = 0,
    attack = 0.008,
  }: {
    freq?: number;
    to?: number;
    q?: number;
    lp?: number;
    vol?: number;
    at?: number;
    attack?: number;
  } = {},
) {
  const a = audio();
  if (!a) return;
  const d0 = jitter(dur, 0.09);
  const t = a.currentTime + at;
  const len = Math.max(1, Math.ceil(a.sampleRate * d0));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  // Filtro rosa simples (Paul Kellet reduzido): remove aspereza aguda do ruído branco
  let b0 = 0,
    b1 = 0,
    b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + w * 0.029;
    b1 = 0.985 * b1 + w * 0.032;
    b2 = 0.95 * b2 + w * 0.048;
    const env = Math.pow(1 - i / len, 1.35);
    ch[i] = (b0 + b1 + b2 + w * 0.18) * env;
  }
  const src = a.createBufferSource();
  src.buffer = buf;

  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(jitter(freq, 0.11), t);
  if (to) bp.frequency.exponentialRampToValueAtTime(jitter(to, 0.11), t + d0);

  const lpf = a.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(lp, t);

  const g = a.createGain();
  const peak = jitter(vol, 0.1);
  const atk = Math.min(attack, d0 * 0.35);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d0);

  src.connect(bp).connect(lpf).connect(g).connect(out(a));
  src.start(t);
  src.stop(t + d0 + 0.02);
}
export const sfx = {
  // Carta deslizando no feltro: curto, quente e com micro-variação orgânica por carta.
  deal: (at = 0) => {
    softNoise(0.058, { freq: 1150, to: 1750, q: 0.85, lp: 2850, vol: 0.17, at, attack: 0.008 });
    tone(jitter(132, 0.08), 0.032, { vol: 0.055, at: at + 0.024, to: 76, attack: 0.005 });
  },
  // Carta virando na mesa: leve dobra do cartão seguida de um pouso macio no feltro.
  flip: (at = 0) => {
    softNoise(0.044, { freq: 1350, to: 2150, q: 0.9, lp: 3150, vol: 0.18, at, attack: 0.006 });
    softNoise(0.028, {
      freq: 1650,
      to: 1150,
      q: 1.0,
      lp: 2550,
      vol: 0.1,
      at: at + 0.028,
      attack: 0.005,
    });
    tone(jitter(124, 0.08), 0.044, { vol: 0.09, at: at + 0.032, to: 68, attack: 0.005 });
  },
  chip: (at = 0) => {
    tone(3200, 0.07, { type: 'triangle', vol: 0.13, at });
    tone(4700, 0.05, { vol: 0.07, at: at + 0.012 });
  },
  chips(n = 3, at = 0) {
    for (let i = 0; i < n; i++) this.chip(at + i * 0.06 + Math.random() * 0.02);
  },
  check: () => {
    tone(160, 0.09, { vol: 0.42, to: 70 });
    tone(160, 0.09, { vol: 0.42, to: 70, at: 0.14 });
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
  // Desistir: dois deslizes curtos e abafados das duas cartas sendo devolvidas no feltro.
  fold: () => {
    softNoise(0.066, { freq: 980, to: 520, q: 0.8, lp: 2100, vol: 0.15, at: 0, attack: 0.012 });
    softNoise(0.064, { freq: 880, to: 460, q: 0.8, lp: 1950, vol: 0.13, at: 0.046, attack: 0.012 });
  },
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
  emote() {
    tone(520, 0.08, { type: 'sine', vol: 0.12, to: 880 });
    tone(920, 0.09, { type: 'triangle', vol: 0.08, at: 0.06, to: 1180 });
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
