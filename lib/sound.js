// Efeitos sintetizados com Web Audio: sem arquivos de áudio para baixar.
let ctx = null, muted = false;
export const setMuted = v => { muted = v };
function audio() {
  if (typeof window === 'undefined' || muted) return null;
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, { type = 'sine', vol = .2, at = 0, to } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
}
function noise(dur, { freq = 3000, to, q = 1, vol = .3, at = 0 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  src.connect(f).connect(g).connect(a.destination); src.start(t);
}
export const sfx = {
  deal: (at = 0) => noise(.12, { freq: 2500, to: 6000, q: .7, vol: .45, at }),
  // Carta virando: "fff" de papel (ruído varrendo para o agudo) + estalo seco no fim + batida grave na mesa.
  flip: (at = 0) => { noise(.1, { freq: 900, to: 5200, q: .8, vol: .5, at }); noise(.025, { freq: 7500, q: 1.5, vol: .5, at: at + .09 }); tone(150, .07, { vol: .25, at: at + .1, to: 70 }) },
  chip: (at = 0) => { tone(3200, .07, { type: 'triangle', vol: .13, at }); tone(4700, .05, { vol: .07, at: at + .012 }) },
  chips(n = 3, at = 0) { for (let i = 0; i < n; i++) this.chip(at + i * .06 + Math.random() * .02) },
  check: () => { tone(160, .09, { vol: .5, to: 70 }); tone(160, .09, { vol: .5, to: 70, at: .14 }) },
  call() { this.chips(3) },
  raise() { this.chips(6); tone(440, .12, { type: 'triangle', vol: .07, at: .4, to: 660 }) },
  // All-in: sobe a tensão (varredura) e bate forte no 0,6 s, quando o texto aparece na tela.
  allin() { tone(180, .6, { type: 'sawtooth', vol: .07, to: 900 }); noise(.6, { freq: 400, to: 4000, q: .6, vol: .25 }); tone(55, .5, { vol: .7, at: .6, to: 30 }); noise(.3, { freq: 220, vol: .5, at: .6 }); this.chips(10, .62); [523, 659, 784].forEach((f, i) => tone(f, .4, { type: 'square', vol: .05, at: .62 + i * .07 })) },
  fold: () => noise(.3, { freq: 1800, to: 300, q: .6, vol: .35 }),
  gather(at = 0) { this.chips(4, at) },
  turn: (at = 0) => { tone(880, .16, { vol: .12, at }); tone(1320, .22, { vol: .1, at: at + .13 }) },
  tick: () => tone(1600, .03, { type: 'square', vol: .03 }),
  win(at = 0) { [523, 659, 784, 1047].forEach((f, i) => tone(f, .3, { type: 'triangle', vol: .12, at: at + i * .1 })); this.chips(8, at + .45) },
};

// Navegadores só liberam áudio após um gesto do usuário.
export const unlock = () => { audio() };

// Compara dois estados consecutivos da mesa e toca os sons correspondentes,
// alinhados com os tempos das animações em app/table.js.
export function playTransition(a, b) {
  const N = b.players.length, me = b.players.findIndex(q => q.self), mine = s => s.turn >= 0 && s.players[s.turn]?.self;
  let t = 0;
  if (b.hand !== a.hand) {
    for (let i = 0; i < N * 2; i++) sfx.deal(.4 + i * .13);
    for (let k = 0; k < 2; k++) sfx.flip(.4 + (k * N + (me - b.dealer - 1 + N) % N) * .13 + .6 + .2 + k * .22);
    sfx.chips(2, .1);
    t = .4 + N * 2 * .13;
  } else {
    const L = b.last;
    if (L && L.seq !== a.last?.seq) {
      const q = b.players[L.seat];
      q && q.stack === 0 && L.type !== 'fold' && L.type !== 'check' ? sfx.allin() : sfx[L.type]?.();
      t = .5;
    }
    const n = b.board.length - a.board.length;
    if (n > 0) {
      sfx.gather();
      for (let k = 0; k < n; k++) { sfx.deal(k * .08); sfx.flip(.7 + k * .22) }
      t = .7 + n * .22 + .3;
    }
    if (b.phase === 'settled' && a.phase !== 'settled') {
      if (b.reveal) { const r0 = n > 0 ? t : .2; for (let k = 0; k < 2 * (N - 1); k++) sfx.flip(r0 + k * .18); t = r0 + 2 * (N - 1) * .18 + .5 }
      b.result.some(r => b.players.find(q => q.self)?.name === r.name) ? sfx.win(t) : sfx.gather(t);
    }
  }
  if (mine(b) && (!mine(a) || a.turn !== b.turn || a.phase !== b.phase || a.hand !== b.hand)) sfx.turn(t + .3);
}
