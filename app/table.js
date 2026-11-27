'use client';
import './table.css';
import {useEffect, useRef, useState} from 'react';
import {animate} from 'motion';
import {AnimatePresence, motion} from 'motion/react';

export const fmt = n => Number(n || 0).toLocaleString('pt-BR');
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const calm = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Carta: voa do baralho (#deck) até o lugar, com leve rotação, e depois vira em 3D (estilo UNO online).
export function PlayingCard({c, delay = 0, className = ''}) {
  const box = useRef(null), face = useRef(null), ready = useRef(null), side = useRef(180), up = c >= 0;

  useEffect(() => {
    const el = box.current, runs = [];
    ready.current = (async () => {
      el.style.transform = '';
      const deck = document.getElementById('deck')?.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (!deck || calm()) return;
      el.style.opacity = 0;
      const a = animate(el, {
        x: [deck.left + deck.width / 2 - (r.left + r.width / 2), 0],
        y: [deck.top + deck.height / 2 - (r.top + r.height / 2), 0],
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
      const a = animate(face.current, {rotateY: [side.current, to]}, {duration: calm() ? 0 : .55, ease: 'easeInOut'});
      runs.push(a);
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
const POT = {x: 57, y: 33};

function Seat({p, j, pos, s, self, active, dealer, left, win, toCenter, bubble}) {
  const N = s.players.length, order = (j - s.dealer - 1 + N) % N;
  const state = p.fold ? (self ? {opacity: .4, x: 0, y: 0, scale: 1} : {x: toCenter.x * .3, y: toCenter.y * .3, opacity: 0, scale: .7}) : {x: 0, y: 0, opacity: 1, scale: 1};
  return <div className={'seat' + (self ? ' self' : '') + (active ? ' active' : '') + (p.fold ? ' folded' : '') + (win ? ' win' : '')} style={at(pos.x, pos.y)}>
    <motion.div className="hand" animate={state} transition={{duration: .5}}>
      {p.cards.map((c, k) => <PlayingCard key={s.hand + '-' + k} c={c} delay={.4 + (k * N + order) * .13} className={self ? 'lg' : 'sm'}/>)}
    </motion.div>
    <div className="plate">
      <span className="avatar">{p.name[0]?.toUpperCase()}</span>
      <div className="who"><b>{p.name}{self ? ' · Você' : ''}</b><small><Num v={p.stack}/></small></div>
      {dealer && <motion.span layoutId="dealer" className="dbtn" title="Dealer" transition={{type: 'spring', stiffness: 220, damping: 22}}>D</motion.span>}
      {active && <span className="timebar" style={{width: left + '%'}}/>}
    </div>
    <div className="status">{p.fold ? 'Desistiu' : p.cards.length && p.stack === 0 ? 'All-in' : active ? 'Pensando…' : ''}</div>
    <div className="bubble-w"><AnimatePresence>{bubble && <motion.div key={bubble.seq} className="bubble" initial={{y: -8, opacity: 0, scale: .8}} animate={{y: 0, opacity: 1, scale: 1}} exit={{opacity: 0, y: 6}}>{bubble.txt}</motion.div>}</AnimatePresence></div>
  </div>;
}

export default function Table({s, pot, winners, left}) {
  const wrap = useRef(null), seen = useRef(0), lastSeq = useRef(s.last?.seq);
  const [dim, setDim] = useState({w: 900, h: 500}), [bub, setBub] = useState(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setDim({w: e.contentRect.width, h: e.contentRect.height}));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { seen.current = s.board.length });
  useEffect(() => {
    const L = s.last;
    if (!L || L.seq === lastSeq.current) return;
    lastSeq.current = L.seq;
    const q = s.players[L.seat], allin = q?.stack === 0 && L.type !== 'fold' && L.type !== 'check';
    setBub({seat: L.seat, seq: L.seq, txt: allin ? 'All-in' : {fold: 'Desistiu', check: 'Passou', call: 'Pagou', raise: 'Aumentou para ' + fmt(q?.bet)}[L.type]});
    const t = setTimeout(() => setBub(null), 1800);
    return () => clearTimeout(t);
  }, [s.last?.seq]);

  const N = s.players.length, me = Math.max(0, s.players.findIndex(q => q.self)), compact = dim.w < 620, rx = compact ? .37 : .42, ry = compact ? .44 : .43;
  const pos = s.players.map((_, j) => { const a = Math.PI / 2 + 2 * Math.PI * ((j - me + N) % N) / N; return {x: 50 + Math.cos(a) * rx * 100, y: 50 + Math.sin(a) * ry * 100} });
  const vec = (a, b) => ({x: (b.x - a.x) / 100 * dim.w, y: (b.y - a.y) / 100 * dim.h});
  const settled = s.phase === 'settled', wi = winners.length ? s.players.findIndex(q => q.name === winners[0][0]) : -1;
  const bets = s.players.reduce((a, q) => a + q.bet, 0), won = winners.map(w => w[0]);
  const toPot = b => settled && wi >= 0 ? vec(b, pos[wi]) : vec(b, POT);

  return <div className="table-wrap" ref={wrap}>
    <div className="rail"><div className="felt"><span className="felt-mark">PokerFlow</span></div></div>

    <div className="spot" style={at(43, 33)}>
      <motion.div key={s.hand} className="deck pc md" initial={{rotate: -8, scale: 1.1}} animate={{rotate: 0, scale: 1}}>
        <div className="pc-back" style={{transform: 'translate(-4px,-4px)'}}/><div className="pc-back" style={{transform: 'translate(-2px,-2px)'}}/><div id="deck" className="pc-back"/>
      </motion.div>
    </div>
    <div className="spot" style={at(POT.x, POT.y)}>
      <ChipStack amount={settled ? 0 : Math.max(0, pot - bets)} from={{x: 0, y: -14}} to={settled && wi >= 0 ? vec(POT, pos[wi]) : {x: 0, y: 0}}/>
      <span className="amt">Pote {fmt(settled ? winners.reduce((a, w) => a + w[1], 0) : pot)}</span>
    </div>

    <div className="spot board" style={at(50, 53)}>
      {[0, 1, 2, 3, 4].map(i => <div className="slot" key={i}>{s.board[i] != null && <PlayingCard key={s.hand + '-' + i} c={s.board[i]} delay={Math.max(0, i - seen.current) * .15} className="md"/>}</div>)}
    </div>
    {settled && winners.length > 0 && <div className="spot winners" style={at(50, 70)}>{winners.map(([n, v]) => <span key={n}>{n} +{fmt(v)}</span>)}</div>}

    {s.players.map((q, j) => {
      const b = {x: pos[j].x + (50 - pos[j].x) * (j === me ? .3 : .34), y: pos[j].y + (50 - pos[j].y) * (j === me ? .3 : .34)};
      return <div key={'b' + j} className="spot bet" style={at(b.x, b.y)}>
        <ChipStack amount={q.bet} from={vec(b, pos[j])} to={toPot(b)}/>
        {q.bet > 0 && <span className="amt">{fmt(q.bet)}</span>}
      </div>;
    })}

    {s.players.map((q, j) => <Seat key={j} p={q} j={j} pos={pos[j]} s={s} self={q.self} active={j === s.turn} dealer={j === s.dealer}
      left={j === s.turn ? Math.min(100, left / s.seconds * 100) : 0} win={settled && won.includes(q.name)} toCenter={vec(pos[j], {x: 50, y: 50})} bubble={bub?.seat === j ? bub : null}/>)}
  </div>;
}
