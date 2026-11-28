'use client';
import './table.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { animate } from 'motion';
import { AnimatePresence, motion, type Variants, type MotionStyle } from 'motion/react';
import type {
  Action,
  Hand,
  Point,
  PublicPlayer,
  PublicState,
  Winners,
} from '../../poker/game-types.ts';

type Bubble = {
  seat: number;
  seq: number;
  allin: boolean;
  auto?: boolean;
  type: Action;
  txt: string;
};
type Mood = 'idle' | 'deal' | 'nod' | 'cheer' | 'wow' | 'shrug';

import Avatar from './avatar';
import Zake from './zake';
import BrandLogo from './brand-logo';
import NotoEmoji from './noto-emoji';
import PlayerMenu from './player-menu';
import { sfx } from './sound';
import { analyzeShowdown, describeHand } from '../../poker/hands.ts';
import type { EmoteEvent } from '../../poker/emotes.ts';

export const fmt = (n?: number | null) => Number(n || 0).toLocaleString('pt-BR');
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const calm = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Carta: voa do baralho (#deck) até o lugar, com leve rotação, e depois vira em 3D.
export function PlayingCard({
  c,
  delay = 0,
  flipDelay = 0,
  className = '',
  highlight = false,
  kicker = false,
  dim = false,
  tilt = 0,
  onClick,
  title,
}: {
  c: number;
  delay?: number;
  flipDelay?: number;
  className?: string;
  highlight?: boolean;
  kicker?: boolean;
  dim?: boolean;
  tilt?: number;
  onClick?: () => void;
  title?: string;
}) {
  const box = useRef<HTMLDivElement>(null),
    face = useRef<HTMLDivElement>(null),
    ready = useRef<Promise<void> | null>(null),
    side = useRef(180),
    up = c >= 0;

  useEffect(() => {
    const el = box.current,
      runs: { cancel: () => void }[] = [];
    ready.current = (async () => {
      if (!el) return;
      el.style.transform = '';
      const deck = document.getElementById('deck')?.getBoundingClientRect(),
        r = el.getBoundingClientRect();
      if (!deck || calm()) {
        if (tilt) el.style.transform = `rotate(${tilt}deg)`;
        return;
      }
      el.style.opacity = '0';
      const k = r.width / el.offsetWidth || 1;
      const a = animate(
        el,
        {
          x: [(deck.left + deck.width / 2 - (r.left + r.width / 2)) / k, 0],
          y: [(deck.top + deck.height / 2 - (r.top + r.height / 2)) / k, 0],
          rotate: [(Math.random() - 0.5) * 44, tilt],
          scale: [0.52, 1],
          opacity: [0, 1],
        },
        { delay, duration: 0.52, ease: [0.22, 1, 0.36, 1], opacity: { delay, duration: 0.12 } },
      );
      runs.push(a);
      await a;
    })();
    return () => runs.forEach((a) => a.cancel?.());
  }, []);

  useEffect(() => {
    let dead = false;
    const runs: { cancel: () => void }[] = [];
    (async () => {
      await ready.current;
      const to = up ? 0 : 180;
      if (dead || !face.current || !box.current || side.current === to) return;
      const q = calm(),
        d = q ? 0 : flipDelay;
      const a = animate(
        face.current,
        { rotateY: [side.current, to] },
        { duration: q ? 0 : 0.46, delay: d, ease: [0.22, 1, 0.36, 1] },
      );
      runs.push(
        a,
        animate(
          box.current,
          { y: [0, -14, 0], scale: [1, 1.07, 1] },
          { duration: q ? 0 : 0.46, delay: d, ease: [0.22, 1, 0.36, 1] },
        ),
      );
      await a;
      if (!dead) side.current = to;
    })();
    return () => {
      dead = true;
      runs.forEach((a) => a.cancel?.());
    };
  }, [up]);

  const s = SUITS[Math.floor(c / 13)],
    r = RANKS[c % 13];
  const isRed = s === '♥' || s === '♦';
  return (
    <div
      ref={box}
      className={
        'pc ' +
        className +
        (highlight ? ' is-win' : kicker ? ' is-kicker' : '') +
        (dim ? ' is-dim' : '') +
        (onClick ? ' is-clickable' : '')
      }
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      title={title}
      aria-label={up ? r + ' de ' + s : 'Carta virada'}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div ref={face} className="pc-in" style={{ transform: 'rotateY(180deg)' }}>
        <div className={'pc-face' + (isRed ? ' red' : '')}>
          {up && (
            <>
              <span className="pc-corner tl">
                <b>{r}</b>
                <small>{s}</small>
              </span>
              <strong className="pc-pip">{s}</strong>
              <span className="pc-corner br" aria-hidden="true">
                <b>{r}</b>
                <small>{s}</small>
              </span>
            </>
          )}
        </div>
        <div className="pc-back" />
      </div>
    </div>
  );
}

const DEN = [
  [5000, '#7c3aed', '#fff'],
  [1000, '#f59e0b', '#141414'],
  [500, '#0A64FF', '#fff'],
  [100, '#1e293b', '#fff'],
  [25, '#16a34a', '#fff'],
  [5, '#dc2626', '#fff'],
  [1, '#F6F6F3', '#141414'],
] as const;
const pile = (n: number) =>
  DEN.flatMap(([v, c, t]) => {
    const k = Math.floor(n / v);
    n -= k * v;
    return k ? [{ v, c, t, k: Math.min(k, 6) }] : [];
  }).slice(0, 4);

const chipV: Variants = {
  from: (o: { fx: number; fy: number; tx: number; ty: number; d: number }) => ({
    x: o.fx,
    y: o.fy,
    opacity: 0,
    scale: 1.15,
  }),
  show: (o: { fx: number; fy: number; tx: number; ty: number; d: number }) => ({
    x: 0,
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 280, damping: 22, delay: o.d },
  }),
  gone: (o: { fx: number; fy: number; tx: number; ty: number; d: number }) => ({
    x: o.tx,
    y: o.ty,
    opacity: 0,
    scale: 0.82,
    transition: { duration: 0.48, ease: [0.4, 0, 0.2, 1], delay: o.d },
  }),
};

// Pilhas de fichas por valor; fichas novas entram de `from`, as que saem vão para `to` (pixels).
function ChipStack({ amount, from, to }: { amount: number; from: Point; to: Point }) {
  const piles = pile(amount);
  let n = 0;
  const items = piles.flatMap((p, si) =>
    Array.from({ length: p.k }, (_, i) => ({ p, si, i, d: n++ * 0.03 })),
  );
  return (
    <div className="chips" style={{ width: piles.length * 28, marginRight: piles.length ? 8 : 0 }}>
      <AnimatePresence custom={{ tx: to.x, ty: to.y, d: 0 }}>
        {items.map(({ p, si, i, d }) => (
          <motion.i
            key={p.v + '-' + i}
            className="chip"
            variants={chipV}
            initial="from"
            animate="show"
            exit="gone"
            custom={{ fx: from.x, fy: from.y, tx: to.x, ty: to.y, d }}
            style={{ '--c': p.c, '--t': p.t, '--i': i, '--s': si } as MotionStyle}
          >
            {i === p.k - 1 ? (p.v >= 1000 ? p.v / 1000 + 'k' : p.v) : ''}
          </motion.i>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Número que "conta" até o novo valor quando as fichas chegam.
function Num({ v }: { v: number }) {
  const ref = useRef<HTMLSpanElement>(null),
    prev = useRef(v);
  useEffect(() => {
    const c = animate(prev.current, v, {
      duration: calm() ? 0 : 0.7,
      delay: v > prev.current && !calm() ? 0.45 : 0,
      ease: 'easeOut',
      onUpdate: (x) => {
        if (ref.current) ref.current.textContent = fmt(Math.round(x));
      },
    });
    prev.current = v;
    return () => c.stop();
  }, [v]);
  return <span ref={ref}>{fmt(v)}</span>;
}

const at = (x: number, y: number) => ({ left: x + '%', top: y + '%' });
const POT = { x: 50, y: 33 };

// Contorno da mesa desktop: estádio horizontal com recorte suave no topo (lugar do dealer).
function shape(x0: number, x1: number, y0: number, y1: number, nd: number, nw: number, sh: number) {
  const r = (y1 - y0) / 2,
    c = (x0 + x1) / 2,
    a = c - nw / 2,
    b = c + nw / 2;
  return `M${x0 + r},${y0} L${a - sh},${y0} C${a - sh / 2},${y0} ${a - sh / 2},${y0 + nd} ${a},${y0 + nd} L${b},${y0 + nd} C${b + sh / 2},${y0 + nd} ${b + sh / 2},${y0} ${b + sh},${y0} L${x1 - r},${y0} A${r},${r} 0 0 1 ${x1 - r},${y1} L${x0 + r},${y1} A${r},${r} 0 0 1 ${x0 + r},${y0} Z`;
}

// Contorno da mesa mobile (portrait): cápsula oval vertical sempre válida (sem arcos cruzados).
// Mesa vertical (mobile): mesmo desenho do desktop (cantos arredondados + recorte do dealer no topo), girado para caber em pé.
function portraitShape(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  nd: number,
  nw: number,
  sh: number,
) {
  const c = (x0 + x1) / 2,
    a = c - nw / 2,
    b = c + nw / 2,
    r = Math.max(30, Math.min((x1 - x0) / 2 - nw / 2 - sh - 4, (y1 - y0) / 2));
  return `M${x0 + r},${y0} L${a - sh},${y0} C${a - sh / 2},${y0} ${a - sh / 2},${y0 + nd} ${a},${y0 + nd} L${b},${y0 + nd} C${b + sh / 2},${y0 + nd} ${b + sh / 2},${y0} ${b + sh},${y0} L${x1 - r},${y0} A${r},${r} 0 0 1 ${x1},${y0 + r} L${x1},${y1 - r} A${r},${r} 0 0 1 ${x1 - r},${y1} L${x0 + r},${y1} A${r},${r} 0 0 1 ${x0},${y1 - r} L${x0},${y0 + r} A${r},${r} 0 0 1 ${x0 + r},${y0} Z`;
}

// Posições dedicadas para mesa vertical mobile (índice 0 = jogador local na base).
// Cada assento define (x, y) do plate e (bx, by) da ficha de aposta na zona limpa do feltro.

function Seat({
  p,
  j,
  pos,
  s,
  self,
  active,
  blind,
  left,
  win,
  toCenter,
  bubble,
  emote,
  rb,
  winCore,
  winKickers,
  settled,
  compact,
  muted,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onToggleMute,
  canVoteKick,
  voteKickReason,
  onVoteKick,
  onShowCard,
  pending,
}: {
  p: PublicPlayer;
  j: number;
  pos: Point;
  s: PublicState;
  self: boolean;
  active: boolean;
  blind: 'SB' | 'BB' | null;
  left: number;
  win: boolean;
  toCenter: Point;
  bubble: Bubble | null;
  emote: EmoteEvent | null;
  rb: number;
  winCore: Set<number>;
  winKickers: Set<number>;
  settled: boolean;
  compact: boolean;
  muted: boolean;
  menuOpen: boolean;
  onToggleMenu?: () => void;
  onCloseMenu: () => void;
  onToggleMute?: () => void;
  canVoteKick: boolean;
  voteKickReason?: string;
  onVoteKick?: () => void;
  onShowCard?: (index: number) => void;
  pending?: boolean;
}) {
  const N = s.players.length,
    order = (j - s.dealer - 1 + N) % N;
  const isAllIn = !p.fold && p.cards.length > 0 && p.stack === 0 && s.phase !== 'settled';
  const state = p.fold
    ? self
      ? { opacity: 0.38, x: 0, y: 4, scale: 0.96 }
      : { x: toCenter.x * 0.26, y: toCenter.y * 0.26, opacity: 0, scale: 0.72 }
    : { x: 0, y: 0, opacity: 1, scale: 1 };

  const timerTone = left <= 18 ? 'danger' : left <= 38 ? 'warn' : 'ok';
  const isTop = !compact && !self && pos.y < 32;
  const topSide = isTop ? (pos.x < 48 ? ' top-seat top-left' : ' top-seat top-right') : '';
  const emoteSide = self ? 'side-left' : pos.x < 50 ? 'side-right' : 'side-left';

  return (
    <div
      className={
        'seat' +
        (self ? ' self' : '') +
        topSide +
        (active ? ' active' : '') +
        (p.fold ? ' folded' : '') +
        (win ? ' win' : '') +
        (isAllIn ? ' allin' : '') +
        (p.sittingOut || p.left ? ' is-away' : '') +
        (menuOpen ? ' has-menu' : '')
      }
      style={at(pos.x, pos.y)}
    >
      <motion.div
        className="hand"
        animate={state}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        {p.cards.map((c, k) => {
          const hasShowdown = settled && s.reveal && winCore.size > 0;
          const isWinCard = hasShowdown && win && winCore.has(c);
          const isKickerCard = hasShowdown && win && !isWinCard && winKickers.has(c);
          const isDimCard = hasShowdown && !isWinCard && !isKickerCard && !p.fold;
          const cardTilt = self
            ? k === 0
              ? -3.5
              : 3.5
            : isTop
              ? k === 0
                ? -6
                : 6
              : k === 0
                ? -4
                : 4;
          const canRevealThis =
            self && settled && !s.reveal && !p.fold && !!onShowCard && !(p.shown ?? []).includes(k);
          const isVoluntaryShown = settled && !s.reveal && (p.shown ?? []).includes(k);
          return (
            <PlayingCard
              key={s.hand + '-' + k}
              c={c}
              delay={0.32 + (k * N + order) * 0.11}
              flipDelay={self ? 0.18 + k * 0.18 : rb + (order * 2 + k) * 0.15}
              className={self ? 'lg' : 'sm'}
              highlight={isWinCard || isVoluntaryShown}
              kicker={isKickerCard}
              dim={isDimCard}
              tilt={cardTilt}
              onClick={canRevealThis ? () => onShowCard(k) : undefined}
              title={canRevealThis ? 'Clique para mostrar esta carta na mesa' : undefined}
            />
          );
        })}
      </motion.div>

      <motion.div
        className={'plate' + (!self && onToggleMenu ? ' is-interactive' : '')}
        role={!self && onToggleMenu ? 'button' : undefined}
        tabIndex={!self && onToggleMenu ? 0 : undefined}
        aria-haspopup={!self && onToggleMenu ? 'menu' : undefined}
        aria-expanded={!self && onToggleMenu ? menuOpen : undefined}
        aria-label={!self && onToggleMenu ? 'Opções para ' + p.name : undefined}
        onClick={!self && onToggleMenu ? onToggleMenu : undefined}
        onKeyDown={
          !self && onToggleMenu
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggleMenu();
                }
              }
            : undefined
        }
        initial={{ opacity: 0, scale: 0.92 }}
        animate={win ? { opacity: 1, scale: 1, y: [0, -4, 0] } : { opacity: 1, scale: 1, y: 0 }}
        transition={
          win
            ? { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
            : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
        }
      >
        <div className="avatar-ring">
          <Avatar a={p.avatar} name={p.name} size={self ? 36 : 32} />
        </div>
        <div className="who">
          <b>
            {p.name}
            {self ? <span className="you-tag">Você</span> : null}
            {p.bot ? <span className="bot-tag">Bot</span> : null}
            {muted && !self ? (
              <span
                className="muted-tag"
                title="Emotes deste jogador estão silenciados"
                aria-label="Silenciado"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              </span>
            ) : null}
          </b>
          <small className="stack-val">
            <i className="chip-dot" aria-hidden="true" />
            <Num v={p.stack} />
          </small>
        </div>
        {blind && (
          <motion.span
            layoutId={blind === 'SB' ? 'sb-badge' : 'bb-badge'}
            className={'blind-badge ' + (blind === 'SB' ? 'is-sb' : 'is-bb')}
            title={
              blind === 'SB'
                ? `Small Blind (${fmt(s.sb)} fichas)`
                : `Big Blind (${fmt(s.bb)} fichas)`
            }
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            {blind}
          </motion.span>
        )}
        {active && (
          <span className="timebar-track">
            <span className={'timebar ' + timerTone} style={{ width: left + '%' }} />
          </span>
        )}
      </motion.div>

      <div className="status">
        {p.kicked
          ? 'Expulso'
          : p.left
            ? 'Saiu'
            : p.sittingOut
              ? 'Ausente'
              : settled && !s.reveal && (p.shown?.length ?? 0) > 0
                ? 'Mostrou a mão!'
                : p.fold
                  ? 'Desistiu'
                  : isAllIn
                    ? 'ALL-IN'
                    : active
                      ? self
                        ? 'Sua vez'
                        : 'Pensando…'
                      : win
                        ? 'Venceu!'
                        : ''}
      </div>

      <AnimatePresence>
        {menuOpen && !self && onToggleMute && (
          <PlayerMenu
            player={p}
            muted={muted}
            onToggleMute={onToggleMute}
            canVoteKick={canVoteKick}
            voteKickReason={voteKickReason}
            onVoteKick={onVoteKick}
            pending={pending}
            align={pos.y > 58 ? 'above' : 'below'}
            onClose={onCloseMenu}
          />
        )}
      </AnimatePresence>

      <div className={'bubble-w' + (pos.x < 18 ? ' edge-l' : pos.x > 82 ? ' edge-r' : '')}>
        <AnimatePresence>
          {bubble && (
            <motion.div
              key={bubble.seq}
              className={
                'bubble b-' +
                (bubble.allin ? 'allin' : bubble.auto ? 'auto' : bubble.type || 'neutral')
              }
              initial={{ y: -10, opacity: 0, scale: 0.82 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            >
              {bubble.txt}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={'emote-wrap ' + emoteSide}>
        <AnimatePresence mode="wait">
          {emote && (
            <motion.div
              key={emote.seq}
              className="emote-bubble"
              initial={{ opacity: 0, scale: 0.35, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.78, y: -10 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
            >
              <NotoEmoji id={emote.emote} size={62} play />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Table({
  s,
  pot,
  winners,
  left,
  emotesMuted = false,
  mutedUids,
  onTogglePlayerMute,
  onStartVoteKick,
  onShowCard,
  pending = false,
}: {
  s: PublicState;
  pot: number;
  winners: Winners;
  left: number;
  emotesMuted?: boolean;
  mutedUids?: Set<string>;
  onTogglePlayerMute?: (uid: string) => void;
  onStartVoteKick?: (uid: string) => void;
  onShowCard?: (index: number) => void;
  pending?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null),
    seen = useRef(0),
    lastSeq = useRef(s.last?.seq);
  const [area, setArea] = useState({ w: 960, h: 560 });
  const [bub, setBub] = useState<Bubble | null>(null);
  const [openMenuUid, setOpenMenuUid] = useState<string | null>(null);
  const [activeEmotes, setActiveEmotes] = useState<Record<number, EmoteEvent>>({});
  const seenEmoteSeq = useRef((s.emotes || []).reduce((m, e) => Math.max(m, e.seq), 0));
  const emoteTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [mood, setMood] = useState<{ n: Mood; say?: string }>({ n: 'idle' });
  const hand0 = useRef(s.hand),
    len0 = useRef(s.board.length),
    ph0 = useRef(s.phase),
    mt = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const timers = emoteTimers.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    const list = s.emotes || [];
    const incoming = list.filter((e) => e.seq > seenEmoteSeq.current);
    if (!incoming.length) return;
    seenEmoteSeq.current = incoming.reduce((m, e) => Math.max(m, e.seq), seenEmoteSeq.current);
    let played = false;
    for (const ev of incoming) {
      const sender = s.players[ev.seat];
      const isSelf = !!sender?.self;
      const isIndividuallyMuted = !!sender?.uid && !!mutedUids?.has(sender.uid);
      if (!isSelf && (emotesMuted || isIndividuallyMuted)) continue;
      if (!played) {
        sfx.emote();
        played = true;
      }
      setActiveEmotes((cur) => ({ ...cur, [ev.seat]: ev }));
      clearTimeout(emoteTimers.current[ev.seat]);
      emoteTimers.current[ev.seat] = setTimeout(() => {
        setActiveEmotes((cur) => {
          if (cur[ev.seat]?.seq !== ev.seq) return cur;
          const next = { ...cur };
          delete next[ev.seat];
          return next;
        });
      }, 3200);
    }
  }, [s.emotes, emotesMuted, mutedUids, s.players]);

  // Remove imediatamente a bolha ativa se o jogador for silenciado.
  useEffect(() => {
    if (!mutedUids?.size) return;
    setActiveEmotes((cur) => {
      let changed = false;
      const next = { ...cur };
      for (const seatKey of Object.keys(next)) {
        const idx = Number(seatKey);
        const sender = s.players[idx];
        if (sender && !sender.self && mutedUids.has(sender.uid)) {
          delete next[idx];
          changed = true;
        }
      }
      return changed ? next : cur;
    });
  }, [mutedUids, s.players]);

  const act = (n: Mood, ms: number, say?: string) => {
    clearTimeout(mt.current);
    setMood({ n, say });
    mt.current = setTimeout(() => setMood({ n: 'idle' }), ms);
  };

  useEffect(() => {
    const el = wrap.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setArea({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    seen.current = s.board.length;
  });

  useEffect(() => {
    if (s.hand !== hand0.current) act('deal', 1700, 'Boa sorte!');
    else if (s.board.length > len0.current) act('nod', 800);
    else if (s.phase === 'settled' && ph0.current !== 'settled')
      act('cheer', 2800, (winners[0]?.[0] || 'Alguém') + ' leva o pote!');
    hand0.current = s.hand;
    len0.current = s.board.length;
    ph0.current = s.phase;
  }, [s.hand, s.board.length, s.phase]);

  const shownKey = s.players.map((q) => (q.shown ?? []).join(',')).join('|');
  const prevShownKey = useRef(shownKey);
  useEffect(() => {
    if (shownKey !== prevShownKey.current) {
      prevShownKey.current = shownKey;
      if (s.phase === 'settled' && !s.reveal && s.players.some((q) => (q.shown?.length ?? 0) > 0)) {
        act('wow', 2200, 'Olha o blefe!');
        sfx.flip();
      }
    }
  }, [shownKey, s.phase, s.reveal]);

  const blindLevel = s.blinds?.level ?? 1;
  const prevBlindLevel = useRef(blindLevel);
  useEffect(() => {
    if (blindLevel > prevBlindLevel.current) {
      act('wow', 2400, `Blinds ${s.sb}/${s.bb}!`);
      sfx.chip();
    }
    prevBlindLevel.current = blindLevel;
  }, [blindLevel, s.sb, s.bb]);

  useEffect(() => {
    const L = s.last;
    if (!L || L.seq === lastSeq.current) return;
    lastSeq.current = L.seq;
    const q = s.players[L.seat],
      allin = q?.stack === 0 && L.type !== 'fold' && L.type !== 'check';
    if (allin) act('wow', 2400, 'Uau, all-in!');
    else if (L.type === 'fold') act('shrug', 800);
    setBub({
      seat: L.seat,
      seq: L.seq,
      allin,
      auto: !!L.auto,
      type: L.type,
      txt: allin
        ? 'ALL-IN'
        : L.auto
          ? L.type === 'fold'
            ? 'Sem tempo · desistiu'
            : 'Sem tempo · passou'
          : {
              fold: 'Desistiu',
              check: 'Passou',
              call: 'Pagou',
              raise: 'Aumentou para ' + fmt(q?.bet),
            }[L.type],
    });
    const t = setTimeout(() => setBub(null), L.auto ? 3200 : 2000);
    return () => clearTimeout(t);
  }, [s.last?.seq]);

  const N = s.players.length;
  const me = Math.max(
    0,
    s.players.findIndex((q) => q.self),
  );
  const compact = area.w < 640;

  // Canvas virtual: desktop horizontal (inalterado) vs mobile portrait dedicado.
  const baseH = 560;
  const dim = compact
    ? { w: 390, h: Math.round(Math.min(780, Math.max(560, (area.h / Math.max(1, area.w)) * 390))) }
    : {
        w: Math.min(1440, Math.max(780, (area.w / Math.max(1, area.h)) * baseH)),
        h: baseH,
      };
  const scale = Math.min(area.w / dim.w, area.h / dim.h);
  const rx = compact ? 0.365 : Math.min(0.42, 0.48 - 84 / dim.w);
  const ry = compact ? 0.4 : 0.39;
  const cy = compact ? 54 : 51.5;

  const pos = s.players.map((_, j) => {
    const rel = (j - me + N) % N;
    if (compact && rel > 0) {
      // Mobile: adversários distribuídos com vão no topo (dealer) e na base (você), nos dois lados.
      const M = N - 1,
        lo = 0.62,
        hi = Math.PI - 0.75,
        L = hi - lo,
        u = ((rel - 0.5) / M) * 2 * L,
        th = u <= L ? lo + u : Math.PI + 0.75 + (u - L),
        a = Math.PI / 2 + th;
      return { x: 50 + Math.cos(a) * rx * 100, y: cy + Math.sin(a) * ry * 100 };
    }
    const f = rel / N,
      H = Math.PI - 0.42; // vão no topo para o dealer
    const a = Math.PI / 2 + (f <= 0.5 ? f * 2 * H : -(1 - f) * 2 * H);
    const y = cy + Math.sin(a) * ry * 100;
    return { x: 50 + Math.cos(a) * rx * 100, y };
  });

  const vec = (a: Point, b: Point) => ({
    x: ((b.x - a.x) / 100) * dim.w,
    y: ((b.y - a.y) / 100) * dim.h,
  });
  const settled = s.phase === 'settled';
  const wi = winners.length ? s.players.findIndex((q) => q.name === winners[0][0]) : -1;
  const bets = s.players.reduce((a, q) => a + q.bet, 0);
  const won = winners.map((w) => w[0]);

  // Índices de Small Blind (SB) e Big Blind (BB) da mão atual (com fallback para salas já iniciadas)
  const { sbSeat, bbSeat } = useMemo(() => {
    if (typeof s.sbSeat === 'number' && typeof s.bbSeat === 'number') {
      return { sbSeat: s.sbSeat, bbSeat: s.bbSeat };
    }
    const inHand = s.players
      .map((q, idx) => (q.cards.length > 0 ? idx : -1))
      .filter((idx) => idx >= 0);
    if (inHand.length < 2 || s.dealer < 0) return { sbSeat: -1, bbSeat: -1 };
    const nextInHand = (from: number) => {
      for (let step = 1; step <= s.players.length; step++) {
        const idx = (from + step) % s.players.length;
        if (s.players[idx]?.cards.length > 0) return idx;
      }
      return -1;
    };
    const sb = inHand.length === 2 ? s.dealer : nextInHand(s.dealer);
    const bb = nextInHand(sb);
    return { sbSeat: sb, bbSeat: bb };
  }, [s.sbSeat, s.bbSeat, s.dealer, s.players]);

  // Conjuntos de cartas da combinação principal (core) + carta decisiva de desempate e kickers no showdown
  const { winCore, winKickers } = useMemo(() => {
    const core = new Set<number>(),
      kickers = new Set<number>();
    if (!settled || !s.reveal) return { winCore: core, winKickers: kickers };
    const sdRows = s.players
      .filter((q): q is PublicPlayer & { hand: Hand } => q.hand != null)
      .sort((a, b) => b.hand.score - a.hand.score);
    const wRows = sdRows.filter((q) => won.includes(q.name));
    const rRow = sdRows.find((q) => !won.includes(q.name));
    const { decisiveIndex } = analyzeShowdown(wRows, rRow);
    for (const q of wRows) {
      const nCore = q.hand.coreCount ?? q.hand.cards.length;
      q.hand.cards.forEach((c, idx) => {
        if (idx < nCore || (decisiveIndex != null && idx === decisiveIndex)) core.add(c);
        else kickers.add(c);
      });
    }
    return { winCore: core, winKickers: kickers };
  }, [settled, s.reveal, s.players, won.join('|')]);

  const tgt = settled ? pos[wi] : s.turn >= 0 ? pos[s.turn] : null;
  const G = compact
    ? { x0: 0.03, x1: 0.97, y0: 0.085, y1: 0.935, pad: 10, nd: 54, nw: 72, sh: 30, zw: 50, zh: 58 }
    : { x0: 0.11, x1: 0.89, y0: 0.125, y1: 0.87, pad: 26, nd: 82, nw: 126, sh: 64, zw: 82, zh: 98 };
  const X0 = G.x0 * dim.w,
    X1 = G.x1 * dim.w,
    Y0 = G.y0 * dim.h,
    Y1 = G.y1 * dim.h;
  const dealerTop = Y0 + G.nd - G.zh;
  const zx = dim.w / 2,
    zy = Y0 + G.nd - G.zh / 2;
  const look =
    mood.n === 'deal' || mood.n === 'nod' || !tgt
      ? { x: 0, y: 1 }
      : {
          x: Math.max(-1, Math.min(1, ((tgt.x / 100) * dim.w - zx) / 260)),
          y: Math.max(-0.6, Math.min(1, ((tgt.y / 100) * dim.h - zy) / 260)),
        };

  const potPos = compact ? { x: 50, y: 37 } : POT;
  const toPot = (b: Point) => (settled && wi >= 0 ? vec(b, pos[wi]) : vec(b, potPos));
  const displayPot = settled ? winners.reduce((a, w) => a + w[1], 0) : pot;
  const tblPath = (x0: number, x1: number, y0: number, y1: number, nw = G.nw) =>
    compact ? portraitShape(x0, x1, y0, y1, G.nd, nw, G.sh) : shape(x0, x1, y0, y1, G.nd, nw, G.sh);

  return (
    <>
      <div
        className={'table-wrap' + (compact ? ' compact' : '')}
        ref={wrap}
        style={{ width: dim.w, height: dim.h, transform: `translate(-50%,-50%) scale(${scale})` }}
      >
        <svg className="tableshape" width={dim.w} height={dim.h} aria-hidden="true">
          <defs>
            <linearGradient id="railg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#353842" />
              <stop offset=".45" stopColor="#1b1d24" />
              <stop offset="1" stopColor="#0d0e12" />
            </linearGradient>
            <linearGradient id="railRim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.22)" />
              <stop offset=".5" stopColor="rgba(255,255,255,0.06)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.14)" />
            </linearGradient>
            <radialGradient id="feltg" cx=".5" cy=".36" r=".72">
              <stop offset="0" stopColor="#0e58f2" />
              <stop offset=".45" stopColor="#0832a8" />
              <stop offset=".85" stopColor="#051a6b" />
              <stop offset="1" stopColor="#031047" />
            </radialGradient>
            <radialGradient id="feltGlow" cx=".5" cy=".48" r=".55">
              <stop offset="0" stopColor="rgba(102, 161, 255, 0.22)" />
              <stop offset="1" stopColor="rgba(102, 161, 255, 0)" />
            </radialGradient>
            <pattern id="feltGrain" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r=".6" fill="rgba(255,255,255,0.035)" />
              <circle cx="4.5" cy="4.5" r=".5" fill="rgba(0,0,0,0.05)" />
            </pattern>
          </defs>
          {/* Rail externo */}
          <path
            d={tblPath(X0, X1, Y0, Y1)}
            fill="url(#railg)"
            stroke="url(#railRim)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Borda interna do rail (sombra) */}
          <path
            d={tblPath(
              X0 + G.pad - 3,
              X1 - G.pad + 3,
              Y0 + G.pad - 3,
              Y1 - G.pad + 3,
              G.nw + G.pad - 3,
            )}
            fill="#040b2a"
          />
          {/* Feltro principal */}
          <path
            d={tblPath(X0 + G.pad, X1 - G.pad, Y0 + G.pad, Y1 - G.pad, G.nw + G.pad)}
            fill="url(#feltg)"
            stroke="rgba(143, 184, 255, .28)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* Textura + iluminação central do feltro */}
          <path
            d={tblPath(X0 + G.pad, X1 - G.pad, Y0 + G.pad, Y1 - G.pad, G.nw + G.pad)}
            fill="url(#feltGrain)"
            strokeLinejoin="round"
          />
          <path
            d={tblPath(X0 + G.pad, X1 - G.pad, Y0 + G.pad, Y1 - G.pad, G.nw + G.pad)}
            fill="url(#feltGlow)"
            strokeLinejoin="round"
          />
          {/* Linha de apostas interna */}
          <path
            d={tblPath(
              X0 + G.pad * 2.35,
              X1 - G.pad * 2.35,
              Y0 + G.pad * 2.35,
              Y1 - G.pad * 2.35,
              G.nw + G.pad * 1.9,
            )}
            fill="none"
            stroke="rgba(219, 233, 255, .18)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>

        <BrandLogo variant="watermark" className="felt-mark" />

        {/* Pote centralizado na linha superior */}
        <div className="spot pot-spot" style={at(potPos.x, potPos.y)}>
          <ChipStack
            amount={settled ? 0 : Math.max(0, pot - bets)}
            from={{ x: 0, y: -14 }}
            to={settled && wi >= 0 ? vec(potPos, pos[wi]) : { x: 0, y: 0 }}
          />
          <motion.div
            key={displayPot}
            className={'pot-pill' + (displayPot > 0 ? ' has-pot' : '')}
            initial={{ scale: 0.94 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22 }}
          >
            <span className="pot-label">Pote</span>
            <strong className="pot-val">{fmt(displayPot)}</strong>
          </motion.div>
        </div>

        {/* Cartas comunitárias (Board) com baralho ancorado à esquerda no desktop */}
        <div className="spot board" style={at(50, compact ? 53 : 50)}>
          {!compact && (
            <div className="deck-anchor">
              <motion.div
                key={s.hand}
                className="deck pc deck-sz"
                initial={{ rotate: -10, scale: 1.08, opacity: 0.7 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 20 }}
              >
                <div className="pc-back" style={{ transform: 'translate(-4px,-4px)' }} />
                <div className="pc-back" style={{ transform: 'translate(-2px,-2px)' }} />
                <div id="deck" className="pc-back" />
              </motion.div>
            </div>
          )}
          {[0, 1, 2, 3, 4].map((i) => {
            const card = s.board[i];
            const hasShowdown = settled && s.reveal && card != null && winCore.size > 0;
            const isWinCard = hasShowdown && winCore.has(card);
            const isKickerCard = hasShowdown && !isWinCard && winKickers.has(card);
            const isDimCard = hasShowdown && !isWinCard && !isKickerCard;
            return (
              <div className={'slot' + (card != null ? ' filled' : '')} key={i}>
                {card != null && (
                  <PlayingCard
                    key={s.hand + '-' + i}
                    c={card}
                    delay={Math.max(0, i - seen.current) * 0.08}
                    flipDelay={0.1 + Math.max(0, i - seen.current) * 0.13}
                    className="md"
                    highlight={isWinCard}
                    kicker={isKickerCard}
                    dim={isDimCard}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Banner de vencedores em zona limpa entre o board e o jogador */}
        <div className="spot winners-spot" style={at(50, compact ? 68 : 64)}>
          <AnimatePresence>
            {settled && winners.length > 0 && (
              <motion.div
                key={'win-' + s.hand}
                className="winners"
                initial={{ opacity: 0, y: 10, scale: 0.88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              >
                {winners.map(([n, v]) => {
                  const wp = s.players.find((q) => q.name === n);
                  const h = s.reveal ? wp?.hand : null;
                  return (
                    <span key={n} className="winner-chip">
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                      </svg>
                      <strong>{n}</strong>
                      <b className="win-amt">+{fmt(v)}</b>
                      <em className="win-hand">{h ? describeHand(h) : 'Por desistência'}</em>
                    </span>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Apostas na mesa por jogador */}
        {s.players.map((q, j) => {
          const rel = (j - me + N) % N;
          const isTopSeat = j !== me && pos[j].y < 32;
          const f = isTopSeat ? 0.25 : compact ? 0.36 : 0.3;
          const b =
            j === me
              ? { x: compact ? 50 : 63, y: compact ? 72 : 74 } // mobile: acima das suas cartas, nunca atrás delas
              : { x: pos[j].x + (50 - pos[j].x) * f, y: pos[j].y + (50 - pos[j].y) * f };
          return (
            <div key={'b' + j} className="spot bet" style={at(b.x, b.y)}>
              <ChipStack amount={q.bet} from={vec(b, pos[j])} to={toPot(b)} />
              <AnimatePresence>
                {q.bet > 0 && (
                  <motion.span
                    key={q.bet}
                    className="amt"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    {fmt(q.bet)}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Assentos dos jogadores */}
        {s.players.map((q, j) => {
          const humanCount = s.players.filter((pl) => !pl.bot && !pl.kicked).length;
          const canVoteKick =
            !!onStartVoteKick &&
            !q.self &&
            !q.bot &&
            !q.isHost &&
            !q.kicked &&
            humanCount >= 3 &&
            !s.banVote;
          const voteKickReason = s.banVote
            ? 'Votação em andamento'
            : humanCount < 3
              ? 'Requer 3+ humanos'
              : undefined;
          return (
            <Seat
              key={j}
              p={q}
              j={j}
              pos={pos[j]}
              s={s}
              self={q.self}
              active={j === s.turn}
              blind={j === sbSeat ? 'SB' : j === bbSeat ? 'BB' : null}
              left={j === s.turn ? Math.min(100, (left / s.seconds) * 100) : 0}
              win={settled && won.includes(q.name)}
              winCore={winCore}
              winKickers={winKickers}
              settled={settled}
              compact={compact}
              muted={!!mutedUids?.has(q.uid)}
              menuOpen={openMenuUid === q.uid}
              onToggleMenu={
                !q.self && onTogglePlayerMute
                  ? () => setOpenMenuUid((cur) => (cur === q.uid ? null : q.uid))
                  : undefined
              }
              onCloseMenu={() => setOpenMenuUid(null)}
              onToggleMute={onTogglePlayerMute ? () => onTogglePlayerMute(q.uid) : undefined}
              canVoteKick={canVoteKick}
              voteKickReason={voteKickReason}
              onVoteKick={onStartVoteKick ? () => onStartVoteKick(q.uid) : undefined}
              onShowCard={q.self ? onShowCard : undefined}
              pending={pending}
              rb={
                s.board.length > seen.current
                  ? 0.65 + (s.board.length - seen.current) * 0.2 + 0.25
                  : 0.18
              }
              toCenter={vec(pos[j], { x: 50, y: 50 })}
              bubble={bub?.seat === j ? bub : null}
              emote={activeEmotes[j] ?? null}
            />
          );
        })}
      </div>

      {/* Dealer Zake renderizado fora do transform: scale() da mesa para nitidez vetorial 1:1 */}
      <div
        className="dealer"
        style={{
          width: Math.round(G.zw * scale),
          height: Math.round(G.zh * scale),
          top: `calc(50% + ${(dealerTop - dim.h / 2) * scale}px)`,
        }}
      >
        <Zake look={look} mood={mood.n} />
        {compact && <span id="deck" className="mobile-deck-origin" aria-hidden="true" />}
        <AnimatePresence>
          {mood.say && mood.n !== 'idle' && (
            <motion.div
              key={mood.say}
              className="bubble zbubble"
              initial={{ opacity: 0, x: -8, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            >
              {mood.say}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
