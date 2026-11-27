'use client';
import './table.css';
import {useEffect, useRef, useState} from 'react';
import {animate} from 'motion';
import {AnimatePresence, motion} from 'motion/react';
import Avatar from './avatar';
import Zake from './zake';

export const fmt = n => Number(n || 0).toLocaleString('pt-BR');
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const calm = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Carta: voa do baralho (#deck) até o lugar, com leve rotação, e depois vira em 3D (estilo UNO online).
export function PlayingCard({c, delay = 0, flipDelay = 0, className = ''}) {
  const box = useRef(null), face = useRef(null), ready = useRef(null), side = useRef(180), up = c >= 0;

  useEffect(() => {
    const el = box.current, runs = [];
    ready.current = (async () => {
      el.style.transform = '';
      const deck = document.getElementById('deck')?.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (!deck || calm()) return;
      el.style.opacity = 0;
      const k = r.width / el.offsetWidth || 1; // a mesa é escalada para caber na tela
      const a = animate(el, {
        x: [(deck.left + deck.width / 2 - (r.left + r.width / 2)) / k, 0],
        y: [(deck.top + deck.height / 2 - (r.top + r.height / 2)) / k, 0],
        rotate: [(Math.random() - .5) * 60, 0], scale: [.55, 1], opacity: [0, 1],
      }, {delay, duration: .6, ease: [.2, .8, .2, 1], opacity: {delay, duration: .1}});
      runs.push(a);
      await a;
    })();
    return () => runs.forEach(a => a.cancel?.());
  }, []);

  useEffect(() => {
    let dead = false;
    const runs = [];
    (async () => {
      await ready.current;
      const to = up ? 0 : 180;
      if (dead || side.current === to) return;
      const q = calm(), d = q ? 0 : flipDelay;
      // Domino: cada carta tomba em sequência (flipDelay escalonado) e dá um pequeno salto.
      const a = animate(face.current, {rotateY: [side.current, to]}, {duration: q ? 0 : .5, delay: d, ease: [.3, .1, .3, 1]});
      runs.push(a, animate(box.current, {y: [0, -16, 0], scale: [1, 1.08, 1]}, {duration: q ? 0 : .5, delay: d}));
      await a;
      if (!dead) side.current = to;
    })();
    return () => { dead = true; runs.forEach(a => a.cancel?.()) };
  }, [up]);

  const s = SUITS[Math.floor(c / 13)], r = RANKS[c % 13];
  return <div ref={box} className={'pc ' + className} role="img" aria-label={up ? r + ' de ' + s : 'Carta virada'}>
    <div ref={face} className="pc-in" style={{transform: 'rotateY(180deg)'}}>
      <div className={'pc-face' + (s === '♥' || s === '♦' ? ' red' : '')}>
        {up && <><span className="pc-corner">{r}<small>{s}</small></span><strong>{s}</strong></>}
      </div>
      <div className="pc-back"/>
    </div>
  </div>;
}

const DEN = [[5000, '#7c3aed', '#fff'], [1000, '#f59e0b', '#141414'], [500, '#0A64FF', '#fff'], [100, '#141414', '#fff'], [25, '#16a34a', '#fff'], [5, '#dc2626', '#fff'], [1, '#F6F6F3', '#141414']];
const pile = n => DEN.flatMap(([v, c, t]) => { const k = Math.floor(n / v); n -= k * v; return k ? [{v, c, t, k: Math.min(k, 7)}] : [] }).slice(0, 4);
const chipV = {
  from: o => ({x: o.fx, y: o.fy, opacity: 0, scale: 1.15}),
  show: o => ({x: 0, y: 0, opacity: 1, scale: 1, transition: {type: 'spring', stiffness: 260, damping: 20, delay: o.d}}),
  gone: o => ({x: o.tx, y: o.ty, opacity: 0, scale: .85, transition: {duration: .55, ease: [.4, 0, .2, 1], delay: o.d}}),
};

// Pilhas de fichas por valor; fichas novas entram de `from`, as que saem vão para `to` (pixels).
function ChipStack({amount, from, to}) {
  const piles = pile(amount);
  let n = 0;
  const items = piles.flatMap((p, si) => Array.from({length: p.k}, (_, i) => ({p, si, i, d: n++ * .035})));
  return <div className="chips" style={{width: Math.max(1, piles.length) * 30}}>
    <AnimatePresence custom={{tx: to.x, ty: to.y, d: 0}}>
      {items.map(({p, si, i, d}) => <motion.i key={p.v + '-' + i} className="chip" variants={chipV} initial="from" animate="show" exit="gone"
        custom={{fx: from.x, fy: from.y, tx: to.x, ty: to.y, d}} style={{'--c': p.c, '--t': p.t, '--i': i, '--s': si}}>{i === p.k - 1 ? (p.v >= 1000 ? p.v / 1000 + 'k' : p.v) : ''}</motion.i>)}
    </AnimatePresence>
  </div>;
}

// Número que "conta" até o novo valor quando as fichas chegam.
function Num({v}) {
  const ref = useRef(null), prev = useRef(v);
  useEffect(() => {
    const c = animate(prev.current, v, {duration: calm() ? 0 : .8, delay: v > prev.current && !calm() ? .7 : 0, ease: 'easeOut', onUpdate: x => { if (ref.current) ref.current.textContent = fmt(Math.round(x)) }});
    prev.current = v;
    return () => c.stop();
  }, [v]);
  return <span ref={ref}>{fmt(v)}</span>;
}

const at = (x, y) => ({left: x + '%', top: y + '%'});
const POT = {x: 61, y: 41};

// Contorno da mesa: estádio com um recorte suave no topo (lugar do dealer), como nas mesas reais.
function shape(x0, x1, y0, y1, nd, nw, sh) {
  const r = (y1 - y0) / 2, c = (x0 + x1) / 2, a = c - nw / 2, b = c + nw / 2;
  return `M${x0 + r},${y0} L${a - sh},${y0} C${a - sh / 2},${y0} ${a - sh / 2},${y0 + nd} ${a},${y0 + nd} L${b},${y0 + nd} C${b + sh / 2},${y0 + nd} ${b + sh / 2},${y0} ${b + sh},${y0} L${x1 - r},${y0} A${r},${r} 0 0 1 ${x1 - r},${y1} L${x0 + r},${y1} A${r},${r} 0 0 1 ${x0 + r},${y0} Z`;
}

function Seat({p, j, pos, s, self, active, dealer, left, win, toCenter, bubble, rb}) {
  const N = s.players.length, order = (j - s.dealer - 1 + N) % N;
  const state = p.fold ? (self ? {opacity: .4, x: 0, y: 0, scale: 1} : {x: toCenter.x * .3, y: toCenter.y * .3, opacity: 0, scale: .7}) : {x: 0, y: 0, opacity: 1, scale: 1};
  return <div className={'seat' + (self ? ' self' : '') + (active ? ' active' : '') + (p.fold ? ' folded' : '') + (win ? ' win' : '') + (!p.fold && p.cards.length && p.stack === 0 && s.phase !== 'settled' ? ' allin' : '')} style={at(pos.x, pos.y)}>
    <motion.div className="hand" animate={state} transition={{duration: .5}}>
      {p.cards.map((c, k) => <PlayingCard key={s.hand + '-' + k} c={c} delay={.4 + (k * N + order) * .13} flipDelay={self ? .2 + k * .22 : rb + (order * 2 + k) * .18} className={self ? 'lg' : 'sm'}/>)}
    </motion.div>
    <div className="plate">
      <Avatar a={p.avatar} name={p.name} size={30}/>
      <div className="who"><b>{p.name}{self ? ' · Você' : ''}</b><small><Num v={p.stack}/></small></div>
      {dealer && <motion.span layoutId="dealer" className="dbtn" title="Dealer" transition={{type: 'spring', stiffness: 220, damping: 22}}>D</motion.span>}
      {active && <span className="timebar" style={{width: left + '%'}}/>}
    </div>
    <div className="status">{p.fold ? 'Desistiu' : p.cards.length && p.stack === 0 ? 'ALL-IN' : active ? 'Pensando…' : ''}</div>
    <div className="bubble-w"><AnimatePresence>{bubble && <motion.div key={bubble.seq} className={'bubble' + (bubble.allin ? ' allin-b' : '')} initial={{y: -8, opacity: 0, scale: .8}} animate={{y: 0, opacity: 1, scale: 1}} exit={{opacity: 0, y: 6}}>{bubble.txt}</motion.div>}</AnimatePresence></div>
  </div>;
}

export default function Table({s, pot, winners, left}) {
  const wrap = useRef(null), seen = useRef(0), lastSeq = useRef(s.last?.seq);
  const [area, setArea] = useState({w: 900, h: 500}), [bub, setBub] = useState(null), [mood, setMood] = useState({n: 'idle'}), hand0 = useRef(s.hand), len0 = useRef(s.board.length), ph0 = useRef(s.phase), mt = useRef(0);
  const act = (n, ms, say) => { clearTimeout(mt.current); setMood({n, say}); mt.current = setTimeout(() => setMood({n: 'idle'}), ms) };
  useEffect(() => {
    const el = wrap.current.parentElement, ro = new ResizeObserver(([e]) => setArea({w: e.contentRect.width, h: e.contentRect.height}));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { seen.current = s.board.length });
  useEffect(() => {
    if (s.hand !== hand0.current) act('deal', 1700, 'Boa sorte!');
    else if (s.board.length > len0.current) act('nod', 800);
    else if (s.phase === 'settled' && ph0.current !== 'settled') act('cheer', 2600, (winners[0]?.[0] || 'Alguém') + ' leva o pote!');
    hand0.current = s.hand; len0.current = s.board.length; ph0.current = s.phase;
  }, [s.hand, s.board.length, s.phase]);
  useEffect(() => {
    const L = s.last;
    if (!L || L.seq === lastSeq.current) return;
    lastSeq.current = L.seq;
    const q = s.players[L.seat], allin = q?.stack === 0 && L.type !== 'fold' && L.type !== 'check';
    if (allin) act('wow', 2400, 'Uau, all-in!');
    else if (L.type === 'fold') act('shrug', 800);
    setBub({seat: L.seat, seq: L.seq, allin, txt: allin ? 'ALL-IN' : {fold: 'Desistiu', check: 'Passou', call: 'Pagou', raise: 'Aumentou para ' + fmt(q?.bet)}[L.type]});
    const t = setTimeout(() => setBub(null), 1800);
    return () => clearTimeout(t);
  }, [s.last?.seq]);

  const N = s.players.length, me = Math.max(0, s.players.findIndex(q => q.self)), compact = area.w < 620;
  const dim = {w: Math.min(1600, Math.max(compact ? 380 : 640, area.w / Math.max(1, area.h) * 520)), h: 520};
  const scale = Math.min(area.w / dim.w, area.h / dim.h), rx = compact ? .37 : Math.min(.43, .5 - 90 / dim.w), ry = compact ? .44 : .43;
  const pos = s.players.map((_, j) => {
    const f = ((j - me + N) % N) / N, H = Math.PI - .42;
    const a = Math.PI / 2 + (f <= .5 ? f * 2 * H : -(1 - f) * 2 * H);
    const y = 50 + Math.sin(a) * ry * 100;
    // Keep the side seats above the community cards on narrow tables.
    return {x: 50 + Math.cos(a) * rx * 100, y: compact && y > 50 && y < 70 ? 50 : y};
  });
  const vec = (a, b) => ({x: (b.x - a.x) / 100 * dim.w, y: (b.y - a.y) / 100 * dim.h});
  const settled = s.phase === 'settled', wi = winners.length ? s.players.findIndex(q => q.name === winners[0][0]) : -1;
  const bets = s.players.reduce((a, q) => a + q.bet, 0), won = winners.map(w => w[0]);
  const tgt = s.phase === 'settled' ? pos[wi] : s.turn >= 0 ? pos[s.turn] : null, G = compact ? {x0: .13, x1: .87, y0: .09, y1: .91, pad: 10, nd: 66, nw: 70, sh: 36, zw: 48, zh: 56} : {x0: .10, x1: .90, y0: .11, y1: .89, pad: 26, nd: 96, nw: 130, sh: 70, zw: 68, zh: 80}, X0 = G.x0 * dim.w, X1 = G.x1 * dim.w, Y0 = G.y0 * dim.h, Y1 = G.y1 * dim.h, zx = dim.w / 2, zy = Y0 + G.nd - G.zh / 2;
  const look = mood.n === 'deal' || mood.n === 'nod' || !tgt ? {x: 0, y: 1} : {x: Math.max(-1, Math.min(1, (tgt.x / 100 * dim.w - zx) / 260)), y: Math.max(-.6, Math.min(1, (tgt.y / 100 * dim.h - zy) / 260))};
  const toPot = b => settled && wi >= 0 ? vec(b, pos[wi]) : vec(b, POT);

  return <div className={'table-wrap'+(compact?' compact':'')} ref={wrap} style={{width: dim.w, height: dim.h, transform: `translate(-50%,-50%) scale(${scale})`}}>
    <svg className="tableshape" width={dim.w} height={dim.h} aria-hidden="true">
      <defs>
        <linearGradient id="railg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b2b2b"/><stop offset=".55" stopColor="#141414"/><stop offset="1" stopColor="#0a0a0a"/></linearGradient>
        <radialGradient id="feltg" cx=".5" cy=".4" r=".75"><stop offset="0" stopColor="#064EE9"/><stop offset=".62" stopColor="#051C9E"/><stop offset="1" stopColor="#081473"/></radialGradient>
      </defs>
      <path d={shape(X0, X1, Y0, Y1, G.nd, G.nw, G.sh)} fill="url(#railg)" stroke="rgba(246,246,243,.2)" strokeWidth="1" strokeLinejoin="round"/>
      <path d={shape(X0 + G.pad, X1 - G.pad, Y0 + G.pad, Y1 - G.pad, G.nd, G.nw + G.pad, G.sh)} fill="url(#feltg)" stroke="rgba(246,246,243,.2)" strokeWidth="1" strokeLinejoin="round"/>
      <path d={shape(X0 + G.pad * 2.4, X1 - G.pad * 2.4, Y0 + G.pad * 2.4, Y1 - G.pad * 2.4, G.nd, G.nw + G.pad * 2, G.sh)} fill="none" stroke="rgba(246,246,243,.26)" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
    <span className="felt-mark">PokerFlow</span>
    <div className="dealer" style={{width: G.zw, height: G.zh, top: Y0 + G.nd - G.zh}}><Zake look={look} mood={mood.n}/>
      <AnimatePresence>{mood.say && mood.n !== 'idle' && <motion.div key={mood.say} className="bubble zbubble" initial={{opacity: 0, x: -6}} animate={{opacity: 1, x: 0}} exit={{opacity: 0}}>{mood.say}</motion.div>}</AnimatePresence>
    </div>


    <div className="spot" style={at(50, 41)}>
      <motion.div key={s.hand} className="deck pc md" initial={{rotate: -8, scale: 1.1}} animate={{rotate: 0, scale: 1}}>
        <div className="pc-back" style={{transform: 'translate(-4px,-4px)'}}/><div className="pc-back" style={{transform: 'translate(-2px,-2px)'}}/><div id="deck" className="pc-back"/>
      </motion.div>
    </div>
    <div className="spot" style={at(POT.x, POT.y)}>
      <ChipStack amount={settled ? 0 : Math.max(0, pot - bets)} from={{x: 0, y: -14}} to={settled && wi >= 0 ? vec(POT, pos[wi]) : {x: 0, y: 0}}/>
      <span className="amt">Pote {fmt(settled ? winners.reduce((a, w) => a + w[1], 0) : pot)}</span>
    </div>

    <div className="spot board" style={at(50, compact ? 60 : 57)}>
      {[0, 1, 2, 3, 4].map(i => <div className="slot" key={i}>{s.board[i] != null && <PlayingCard key={s.hand + '-' + i} c={s.board[i]} delay={Math.max(0, i - seen.current) * .08} flipDelay={.1 + Math.max(0, i - seen.current) * .14} className="md"/>}</div>)}
    </div>
    {settled && winners.length > 0 && <div className="spot winners" style={at(50, compact ? 71 : 69)}>{winners.map(([n, v]) => <span key={n}>{n} +{fmt(v)}</span>)}</div>}

    {s.players.map((q, j) => {
      const f = compact ? .24 : .34, b = j === me ? {x: compact ? 70 : 63, y: 76} : {x: pos[j].x + (50 - pos[j].x) * f, y: pos[j].y + (50 - pos[j].y) * f};
      return <div key={'b' + j} className="spot bet" style={at(b.x, b.y)}>
        <ChipStack amount={q.bet} from={vec(b, pos[j])} to={toPot(b)}/>
        {q.bet > 0 && <span className="amt">{fmt(q.bet)}</span>}
      </div>;
    })}

    {s.players.map((q, j) => <Seat key={j} p={q} j={j} pos={pos[j]} s={s} self={q.self} active={j === s.turn} dealer={j === s.dealer}
      left={j === s.turn ? Math.min(100, left / s.seconds * 100) : 0} win={settled && won.includes(q.name)} rb={s.board.length > seen.current ? .7 + (s.board.length - seen.current) * .22 + .3 : .2} toCenter={vec(pos[j], {x: 50, y: 50})} bubble={bub?.seat === j ? bub : null}/>)}
  </div>;
}
