'use client';
import {useEffect, useState, useRef} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import Table, {PlayingCard, fmt} from './table';
import Avatar from './avatar';
import {AVATAR_STYLES, AVATAR_LABELS} from '../lib/avatars.mjs';
import {HAND_RANKINGS, RANKS, SUITS, describeHand, explainVictory} from '../lib/hands.mjs';
import {sfx, setMuted, unlock, playTransition} from '../lib/sound';

const phases = [['preflop', 'Pré-flop'], ['flop', 'Flop'], ['turn', 'Turn'], ['river', 'River'], ['settled', 'Resultado']];
const GUIDE = [
  ['Pré-flop', 'Cada jogador recebe duas cartas privadas.'],
  ['Flop, Turn e River', 'São reveladas 3, 1 e 1 cartas comunitárias.'],
  ['Melhor mão', 'Escolha as melhores cinco cartas entre suas duas e as cinco da mesa.'],
  ['Showdown', 'A melhor mão elegível ganha cada pote; empates dividem o prêmio.'],
  ['Atalhos de teclado', 'Na sua vez: F para Desistir, C para Passar/Pagar, R para Apostar/Aumentar e A para All-in.'],
];

const CONFETTI = [
  {x: -170, y: -120, r: -140, c: '#fbbf24', d: 0},
  {x: -120, y: -150, r: 95, c: '#66A1FF', d: .06},
  {x: -60, y: -170, r: -75, c: '#f59e0b', d: .12},
  {x: 10, y: -175, r: 120, c: '#fde68a', d: .04},
  {x: 80, y: -160, r: -110, c: '#0A64FF', d: .1},
  {x: 145, y: -135, r: 140, c: '#fbbf24', d: .08},
  {x: 185, y: -90, r: -90, c: '#34d399', d: .14},
  {x: -185, y: -70, r: 110, c: '#fde68a', d: .16},
  {x: -95, y: -110, r: -160, c: '#f43f5e', d: .18},
  {x: 110, y: -100, r: 85, c: '#66A1FF', d: .15},
];

function mkSeeds() {
  return Array.from({length: 8}, () => Math.random().toString(36).slice(2, 8));
}

function Tip({text, children}) {
  return <span className="tip" tabIndex={0} data-tip={text}>{children}</span>;
}

function MiniCard({c, isCore = true}) {
  const rank = RANKS[c % 13];
  const suit = SUITS[Math.floor(c / 13)];
  const red = suit === '♥' || suit === '♦';
  return (
    <span
      className={'mini-card' + (red ? ' red' : '') + (isCore ? ' is-core' : ' is-kicker')}
      aria-label={rank + ' de ' + suit + (isCore ? '' : ' (kicker)')}
    >
      {rank}<span>{suit}</span>
    </span>
  );
}

function ActionButton({label, sub, hotkey, desc, kind, disabled, onClick}) {
  return (
    <div className="action-wrap">
      <Tip text={desc}>
        <motion.button
          type="button"
          className={'action ' + kind}
          disabled={disabled}
          onClick={onClick}
          whileHover={disabled ? undefined : {y: -2}}
          whileTap={disabled ? undefined : {scale: .97}}
          transition={{type: 'spring', stiffness: 420, damping: 24}}
        >
          <span className="action-main">
            <strong>{label}</strong>
            {sub && <small>{sub}</small>}
          </span>
          {hotkey && <kbd className="kbd" aria-hidden="true">{hotkey}</kbd>}
        </motion.button>
      </Tip>
    </div>
  );
}

// Ícones SVG leves para a topbar
const IconSoundOn = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
);
const IconSoundOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/>
    <line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
);
const IconGuide = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconShare = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconExit = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

export default function Page() {
  const [name, N] = useState('');
  const [code, C] = useState('');
  const [game, G] = useState(null);
  const [error, E] = useState('');
  const [now, T] = useState(Date.now());
  const [stack, S] = useState(2000);
  const [bb, B] = useState(20);
  const [seconds, D] = useState(30);
  const [pending, P] = useState(false);
  const [copied, Copy] = useState(false);
  const [choice, Choose] = useState({key: '', amount: 0});
  const [muted, Mute] = useState(false);
  const [invited, Inv] = useState(false);
  const [mode, Mode] = useState('create');
  const [saved, Saved] = useState('');
  const [pstyle, Pstyle] = useState('lorelei');
  const [seeds, Seeds] = useState(() => mkSeeds());

  const prev = useRef(null);
  const guide = useRef(null);
  const celebration = useRef(null);
  const celebrated = useRef('');
  const reducedMotion = useReducedMotion();
  const token = useRef('');
  const latest = useRef(null);
  const mutating = useRef(false);
  const polling = useRef(false);
  const epoch = useRef(0);

  useEffect(() => {
    let t = localStorage.getItem('pf-token');
    if (!t) {
      t = Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('pf-token', t);
    }
    token.current = t;
    const inv = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
    C(inv);
    Inv(!!inv);
    Saved(!inv && localStorage.getItem('pf-room') || '');
    N(localStorage.getItem('pf-name') || '');
    const m = localStorage.getItem('pf-mute') === '1';
    Mute(m);
    setMuted(m);
    addEventListener('pointerdown', unlock, {once: true});
    addEventListener('keydown', unlock, {once: true});
    const timer = setInterval(() => T(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);

  async function send(op, extra = {}, quiet = false) {
    if (!token.current || mutating.current || (quiet && polling.current)) return;
    const ep = epoch.current, prevGame = latest.current;
    if (quiet) polling.current = true;
    else { mutating.current = true; P(true); E(''); }
    try {
      const r = await fetch('/api/game', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({op, token: token.current, code: prevGame?.code || code, name, stack, bb, seconds, version: prevGame?.version, ...extra}),
      });
      const x = await r.json();
      if (r.status === 403 && op === 'state' && ep === epoch.current && prevGame?.code === latest.current?.code) {
        exit();
        E('Você não está mais nesta sala.');
        return;
      }
      if (!r.ok) throw Error(x.error || 'Não foi possível concluir.');
      if (ep !== epoch.current || (latest.current?.code === x.code && latest.current.version > x.version)) return;
      latest.current = x;
      G(x);
      C(x.code);
      localStorage.setItem('pf-room', x.code);
      if (!quiet) localStorage.setItem('pf-name', name);
    } catch (e) {
      if (!quiet && ep === epoch.current) E(e.message);
    } finally {
      if (quiet) polling.current = false;
      else { mutating.current = false; P(false); }
    }
  }

  // O relógio avança enquanto uma mesa está aberta
  useEffect(() => {
    if (!game) return;
    const timer = setInterval(async () => {
      await send('state', {}, true);
      const g = latest.current;
      if (g?.state.deadline && Date.now() >= g.state.deadline) {
        await send('action', {type: 'tick'}, true);
      } else if (
        g?.state.phase === 'settled' &&
        g.state.players.filter(q => q.stack > 0).length >= 2 &&
        g.state.pausedFor == null &&
        (g.state.nextHandAt ?? 0) <= Date.now()
      ) {
        await send('interval', {type: 'tick'}, true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [!!game]);

  const s = game?.state;
  const inGame = !!s && s.phase !== 'waiting';
  const inLobby = !!s && s.phase === 'waiting';
  const inApp = inGame || inLobby;
  const p = s?.players.find(q => q.self);
  const mine = !!s?.players[s.turn]?.self;
  const live = !!s && !['waiting', 'settled'].includes(s.phase);
  const left = s?.deadline ? Math.max(0, Math.ceil((s.deadline - now) / 1000)) : 0;
  const pot = s?.players.reduce((a, q) => a + q.total, 0) || 0;
  const due = p ? Math.max(0, (s.current || 0) - p.bet) : 0;
  const max = p ? p.bet + p.stack : 0;
  const min = Math.min(max, (s?.current || 0) + (s?.minRaise || s?.bb || 20));
  const canAct = live && mine && left > 0 && !pending;
  const raiseAllowed = !!p && max > s.current && (p.actedAt == null || s.current - p.actedAt >= s.minRaise) && s.players.some(q => !q.self && !q.fold && q.cards?.length && q.stack > 0);
  const canRaise = canAct && raiseAllowed;
  const canAllIn = canAct && (raiseAllowed || (due > 0 && max <= s.current));
  const key = [game?.code, s?.hand, s?.phase, s?.turn, min, max].join('/');
  const amount = choice.key === key ? Math.min(max, Math.max(min, choice.amount)) : min;
  const rangePct = max > min ? Math.min(100, Math.max(0, ((amount - min) / (max - min)) * 100)) : 100;
  const nextLeft = Math.max(0, Math.ceil(((s?.nextHandAt ?? now) - now) / 1000));
  const hasNext = s?.players.filter(q => q.stack > 0).length >= 2;
  const champion = s?.phase === 'settled' && s.players.filter(q => q.stack > 0).length === 1 ? s.players.find(q => q.stack > 0) : null;
  const winners = Object.entries((s?.result || []).reduce((a, r) => {
    a[r.name] = (a[r.name] || 0) + r.amount;
    return a;
  }, Object.create(null)));

  const choose = v => Choose({key, amount: Math.round(Math.min(max, Math.max(min, v)))});

  useEffect(() => {
    if (!champion || !game) return;
    const ckey = game.code + '/' + s.hand;
    if (celebrated.current === ckey) return;
    celebrated.current = ckey;
    celebration.current?.showModal();
    sfx.champion();
  }, [game?.code, s?.hand, !!champion]);

  useEffect(() => {
    if (!game) { prev.current = null; return; }
    const a = prev.current;
    prev.current = {code: game.code, s: game.state};
    if (a && a.code === game.code) playTransition(a.s, game.state);
  }, [game]);

  useEffect(() => {
    if (mine && live && left > 0 && left <= 5) sfx.tick();
  }, [left, mine, live]);

  // Atalhos de teclado acessíveis na vez do jogador (F = Fold, C = Check/Call, R = Raise/Bet, A = All-in)
  useEffect(() => {
    if (!canAct) return;
    const onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (guide.current?.open || celebration.current?.open) return;
      const k = e.key.toLowerCase();
      if (k === 'f') { e.preventDefault(); send('action', {type: 'fold'}); }
      else if (k === 'c') { e.preventDefault(); send('action', {type: due ? 'call' : 'check'}); }
      else if (k === 'r' && canRaise) { e.preventDefault(); send('action', {type: 'raise', amount}); }
      else if (k === 'a' && canAllIn) { e.preventDefault(); send('action', {type: max <= s.current ? 'call' : 'raise', amount: max}); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canAct, canRaise, canAllIn, due, amount, max, s?.current]);

  function toggleMute() {
    const m = !muted;
    Mute(m);
    setMuted(m);
    localStorage.setItem('pf-mute', m ? '1' : '0');
    if (!m) sfx.chip();
  }

  async function invite() {
    try {
      await navigator.clipboard.writeText(location.origin + '/?room=' + game.code);
      Copy(true);
      setTimeout(() => Copy(false), 2000);
    } catch {
      E('Copie o código da sala para compartilhar.');
    }
  }

  function leaveInvite() {
    Inv(false);
    C('');
    E('');
    history.replaceState(null, '', location.pathname);
  }

  function exit() {
    history.replaceState(null, '', location.pathname);
    Inv(false);
    Saved('');
    epoch.current++;
    latest.current = null;
    G(null);
    C('');
    E('');
    localStorage.removeItem('pf-room');
  }

  const timePct = s?.seconds ? Math.min(100, (left / s.seconds) * 100) : 0;
  const turnPlayer = live ? s.players[s.turn] : null;
  const showdownRows = s?.reveal
    ? s.players.filter(q => q.hand).sort((a, b) => b.hand.score - a.hand.score)
    : [];
  const winnerRows = showdownRows.filter(q => winners.some(([wname]) => wname === q.name));
  const runnerUpRow = showdownRows.find(q => !winners.some(([wname]) => wname === q.name));
  const victorySummary = s?.reveal ? explainVictory(winnerRows, runnerUpRow) : '';
  const winRankSet = new Set(winnerRows.map(q => q.hand.rank));
  const otherRankSet = new Set(showdownRows.filter(q => !winRankSet.has(q.hand.rank)).map(q => q.hand.rank));

  return (
    <main className={inGame ? 'in-game' : inLobby ? 'in-lobby' : ''}>
      {/* Topbar: unificada no modo jogo e lobby, clássica na entrada */}
      <header className={inApp ? 'game-topbar' : ''}>
        <div className="header-left">
          <a href="/" className="brand">
            <span className="mark">♠</span>
            <div>
              PokerFlow<i>.</i>
              {!inApp && <small>PRIVATE POKER CLUB</small>}
            </div>
          </a>

          {inApp && (
            <div className="game-meta">
              {inGame ? (
                <span className="meta-pill accent">Mão {s.hand}</span>
              ) : (
                <>
                  <span className="meta-pill accent">Lobby</span>
                  <span className="meta-pill hide-xs">Sala <b>{game.code}</b></span>
                </>
              )}
              <Tip text="Small blind e big blind: apostas obrigatórias iniciais.">
                <span className="meta-pill">Blinds <b>{s.sb}/{s.bb}</b></span>
              </Tip>
              <span className="meta-pill hide-sm">Jogadores <b>{s.players.length}/8</b></span>
            </div>
          )}
        </div>

        {/* Stepper de fases integrado na topbar durante a partida */}
        {inGame && (
          <nav className="stagebar" aria-label="Fase da mão">
            {phases.map(([id, label], i) => {
              const isCurrent = id === s.phase;
              const phaseIdx = phases.findIndex(([pid]) => pid === s.phase);
              const isDone = i < phaseIdx;
              return (
                <span className={'stage-step' + (isCurrent ? ' current' : '') + (isDone ? ' done' : '')} key={id}>
                  {isCurrent && (
                    <motion.span
                      layoutId="stage-pill"
                      className="stage-pill-bg"
                      transition={{type: 'spring', stiffness: 360, damping: 28}}
                    />
                  )}
                  <i className="stage-num">{i + 1}</i>
                  <span className="stage-lbl">{label}</span>
                </span>
              );
            })}
          </nav>
        )}

        <div className="header-right">
          {!inApp && <span className="private">● Mesa privada</span>}
          <button
            className="icon-btn"
            onClick={toggleMute}
            aria-pressed={muted}
            title={muted ? 'Ativar som' : 'Silenciar som'}
          >
            {muted ? <IconSoundOff/> : <IconSoundOn/>}
            <span className="btn-txt">{muted ? 'Mudo' : 'Som'}</span>
          </button>
          {s && (
            <button className="icon-btn" onClick={() => guide.current?.showModal()} title="Guia rápido">
              <IconGuide/>
              <span className="btn-txt">Guia</span>
            </button>
          )}
          {s && (
            <button
              className={'icon-btn' + (copied ? ' is-copied' : '')}
              onClick={invite}
              title="Copiar link de convite"
            >
              {copied ? <IconCheck/> : <IconShare/>}
              <span className="btn-txt">{copied ? 'Copiado!' : 'Convidar'}</span>
            </button>
          )}
          {s && (
            <button className="icon-btn danger-ghost" onClick={exit} title="Sair da mesa">
              <IconExit/>
              <span className="btn-txt">Sair</span>
            </button>
          )}
        </div>
      </header>

      {/* Modal de Campeão (Celebration) */}
      <dialog ref={celebration} className="modal celebration" aria-labelledby="champion-title">
        {champion && (
          <div className="cel-inner">
            {!reducedMotion && (
              <div className="confetti-layer" aria-hidden="true">
                {CONFETTI.map((cf, i) => (
                  <motion.span
                    key={i}
                    className="confetti-piece"
                    style={{background: cf.c}}
                    initial={{x: 0, y: 20, scale: 0, opacity: 1, rotate: 0}}
                    animate={{x: cf.x, y: [20, cf.y, cf.y + 90], scale: [0, 1.1, .8], opacity: [1, 1, 0], rotate: cf.r}}
                    transition={{duration: 1.6, delay: cf.d, ease: [.22, 1, .36, 1]}}
                  />
                ))}
              </div>
            )}

            <div className="trophy-wrap">
              <motion.div
                className="trophy-halo"
                animate={reducedMotion ? undefined : {rotate: 360}}
                transition={{duration: 18, repeat: Infinity, ease: 'linear'}}
              />
              <motion.div
                className="trophy"
                aria-hidden="true"
                initial={reducedMotion ? false : {scale: .3, rotate: -18, y: 20}}
                animate={reducedMotion ? {} : {scale: [0.3, 1.14, 1], rotate: [-18, 8, 0], y: 0}}
                transition={{duration: .9, type: 'spring', stiffness: 220, damping: 16}}
              >
                <svg width="78" height="78" viewBox="0 0 64 64" fill="none">
                  <defs>
                    <linearGradient id="goldCup" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#FEF08A"/>
                      <stop offset=".45" stopColor="#F59E0B"/>
                      <stop offset="1" stopColor="#B45309"/>
                    </linearGradient>
                  </defs>
                  <path d="M18 12H46V24C46 33.5 39.8 40 32 40C24.2 40 18 33.5 18 24V12Z" fill="url(#goldCup)"/>
                  <path d="M18 16H11C11 24 14 28 19 28" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round"/>
                  <path d="M46 16H53C53 24 50 28 45 28" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round"/>
                  <rect x="28" y="39" width="8" height="10" rx="2" fill="#D97706"/>
                  <rect x="20" y="48" width="24" height="6" rx="3" fill="url(#goldCup)"/>
                  <path d="M32 18L34.2 22.4L39 23.1L35.5 26.5L36.3 31.3L32 29L27.7 31.3L28.5 26.5L25 23.1L29.8 22.4L32 18Z" fill="#FFFBEB"/>
                </svg>
              </motion.div>
            </div>

            <p className="eyebrow">FIM DE PARTIDA · MÃO {s.hand}</p>
            <h2 id="champion-title">Temos um campeão!</h2>

            <motion.div
              className="champion"
              initial={reducedMotion ? false : {opacity: 0, y: 18, scale: .94}}
              animate={{opacity: 1, y: 0, scale: 1}}
              transition={{delay: reducedMotion ? 0 : .32, type: 'spring', stiffness: 260, damping: 22}}
            >
              <div className="champ-avatar-frame">
                <Avatar a={champion.avatar} name={champion.name} size={96}/>
              </div>
              <strong>{champion.name}</strong>
              <span className="champ-stack">{fmt(champion.stack)} fichas</span>
            </motion.div>

            <motion.button
              type="button"
              className="primary cel-btn"
              autoFocus
              whileHover={{scale: 1.03}}
              whileTap={{scale: .97}}
              onClick={() => celebration.current?.close()}
            >
              Ver resultado da mesa
            </motion.button>
          </div>
        )}
      </dialog>

      {/* Modal Guia Rápido */}
      <dialog ref={guide} className="modal" onClick={e => e.target === guide.current && guide.current.close()}>
        <div className="between">
          <div>
            <div className="eyebrow">Guia rápido</div>
            <h2>Como jogar?</h2>
          </div>
          <button className="outline" onClick={() => guide.current.close()} aria-label="Fechar guia">Fechar</button>
        </div>
        {GUIDE.map(([h, t]) => (
          <div className="gitem" key={h}>
            <h3>{h}</h3>
            <p>{t}</p>
          </div>
        ))}
        <div className="gitem">
          <h3>Classificação das mãos (1º ao 10º)</h3>
          <ol className="guide-ranks">
            {HAND_RANKINGS.map(r => (
              <li key={r.rank}>
                <span className="gr-ord">{r.ordinal}</span>
                <b>{r.name}</b>
                <small>{r.hint}</small>
              </li>
            ))}
          </ol>
        </div>
      </dialog>

      {/* Tela Inicial (Landing) */}
      {!s ? (
        <section className="landing">
          <motion.div
            className="hero"
            initial={reducedMotion ? false : {opacity: 0, y: 16}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: .45, ease: [.22, 1, .36, 1]}}
          >
            <div className="eyebrow">● O CLUBE É SEU</div>
            <h1>Seus amigos.<br/>Sua mesa.<br/><em>Seu jogo.</em></h1>
            <p>Texas Hold’em privado para até oito amigos. Apenas fichas virtuais.</p>
            <div className="hero-cards">
              <PlayingCard c={12} className="lg" tilt={-5}/>
              <PlayingCard c={25} className="lg" tilt={5}/>
            </div>
            <div className="tags">
              <span>02–08 jogadores</span>
              <span>Texas Hold’em</span>
              <span>Fichas virtuais</span>
            </div>
          </motion.div>

          <motion.div
            className="panel entry"
            initial={reducedMotion ? false : {opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: .45, delay: .08, ease: [.22, 1, .36, 1]}}
          >
            {invited ? (
              <>
                <div className="eyebrow">Convite recebido</div>
                <h2>Você foi chamado para jogar</h2>
                <p className="lead">Mesa <b className="code">{code}</b>. Escolha um apelido e entre. Seu avatar você escolhe na sala de espera.</p>
                <label>
                  Seu apelido
                  <input autoFocus placeholder="Como seus amigos te chamam?" maxLength={24} value={name} onChange={e => N(e.target.value)} onKeyDown={e => e.key === 'Enter' && name.trim() && !pending && send('join')}/>
                </label>
                <button className="primary wide" disabled={pending || !name.trim()} onClick={() => send('join')}>Entrar na mesa →</button>
                {error && <p className="error" role="alert">{error}</p>}
                <button className="text-button" onClick={leaveInvite}>Prefere criar a sua própria mesa?</button>
              </>
            ) : (
              <>
                {saved && (
                  <div className="resume">
                    <div>
                      <small>Você estava jogando</small>
                      <b>Mesa {saved}</b>
                    </div>
                    <button className="primary" disabled={pending || !name.trim()} onClick={() => send('join', {code: saved})}>Voltar à mesa →</button>
                  </div>
                )}
                <div className="eyebrow">Começar</div>
                <h2>Entre no clube</h2>
                <label>
                  Seu apelido
                  <input placeholder="Como seus amigos te chamam?" maxLength={24} value={name} onChange={e => N(e.target.value)}/>
                </label>
                <div className="seg" role="tablist" aria-label="O que você quer fazer?">
                  <button role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'on' : ''} onClick={() => { Mode('create'); E(''); }}>Criar mesa</button>
                  <button role="tab" aria-selected={mode === 'join'} className={mode === 'join' ? 'on' : ''} onClick={() => { Mode('join'); E(''); }}>Tenho um convite</button>
                </div>
                <AnimatePresence mode="wait">
                  {mode === 'create' ? (
                    <motion.div key="create" initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -6}} transition={{duration: .18}}>
                      <div className="fields">
                        <label>
                          Fichas
                          <select value={stack} onChange={e => S(+e.target.value)}>
                            {[1000, 2000, 5000, 10000].map(v => <option key={v} value={v}>{fmt(v)}</option>)}
                          </select>
                        </label>
                        <label>
                          Big blind <Tip text="A maior aposta obrigatória antes do flop.">ⓘ</Tip>
                          <select value={bb} onChange={e => B(+e.target.value)}>
                            {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </label>
                        <label>
                          Tempo
                          <select value={seconds} onChange={e => D(+e.target.value)}>
                            {[15, 30, 45, 60].map(v => <option key={v} value={v}>{v}s</option>)}
                          </select>
                        </label>
                      </div>
                      <button className="primary wide" disabled={pending || !name.trim()} onClick={() => send('create')}>Criar mesa privada →</button>
                      <p className="step">Depois de criar, você recebe um link para convidar seus amigos.</p>
                    </motion.div>
                  ) : (
                    <motion.div key="join" initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -6}} transition={{duration: .18}}>
                      <label>
                        Código do convite
                        <input placeholder="A1B2C3D4E5F6" value={code} onChange={e => C(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && code.trim() && name.trim() && !pending && send('join')}/>
                      </label>
                      <button className="primary wide" disabled={pending || !code.trim() || !name.trim()} onClick={() => send('join')}>Entrar na mesa →</button>
                    </motion.div>
                  )}
                </AnimatePresence>
                {error && <p className="error" role="alert">{error}</p>}
              </>
            )}
          </motion.div>
        </section>
      ) : s.phase === 'waiting' ? (
        /* Sala de Espera (Lobby 100% responsivo à viewport) */
        <div className="lobby-arena">
          <section className="panel lobby-card lobby-seats-card">
            <div className="lobby-card-head">
              <div>
                <div className="eyebrow">AGUARDANDO JOGADORES</div>
                <h2>Chame seus amigos.</h2>
                <p>Compartilhe o convite e inicie a partida com pelo menos dois jogadores.</p>
              </div>
              <div className="room-code-box">
                <small>Código da mesa</small>
                <b>{game.code}</b>
              </div>
            </div>

            <div className="lobby-grid">
              {Array.from({length: 8}, (_, i) => {
                const q = s.players[i];
                return (
                  <motion.div
                    className={'lobby-seat ' + (!q ? 'vacant' : q.self ? 'is-self' : '')}
                    key={i}
                    initial={reducedMotion ? false : {opacity: 0, scale: .96}}
                    animate={{opacity: 1, scale: 1}}
                    transition={{duration: .25, delay: i * .03}}
                  >
                    {q ? <Avatar a={q.avatar} name={q.name} size={52}/> : (
                      <span className="vacant-av" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </span>
                    )}
                    <b>{q ? q.name : 'Lugar disponível'}{q?.self && <span className="you-tag">Você</span>}</b>
                    <small>{q ? fmt(q.stack) + ' fichas' : 'Aguardando convite'}</small>
                    {s.host && q && !q.self && (
                      <button className="outline remove-player" aria-label={'Remover ' + q.name} disabled={pending} onClick={() => send('remove', {seat: i, version: game.version})}>
                        Remover
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>

            <div className="lobby-footer">
              <div className="between">
                <button className={'outline' + (copied ? ' is-copied' : '')} onClick={invite}>
                  {copied ? '✓ Convite copiado!' : 'Copiar link de convite'}
                </button>
                {s.host ? (
                  <motion.button
                    type="button"
                    className="primary start-btn"
                    disabled={pending || s.players.filter(q => q.stack > 0).length < 2}
                    whileHover={pending || s.players.filter(q => q.stack > 0).length < 2 ? undefined : {scale: 1.02}}
                    whileTap={pending || s.players.filter(q => q.stack > 0).length < 2 ? undefined : {scale: .98}}
                    onClick={() => send('start')}
                  >
                    Iniciar partida →
                  </motion.button>
                ) : (
                  <span className="waiting-host">Aguardando o anfitrião iniciar…</span>
                )}
              </div>
              {error && <p className="error" role="alert">{error}</p>}
            </div>
          </section>

          <section className="panel lobby-card lobby-avatar-card">
            <div className="lobby-card-head">
              <div>
                <div className="eyebrow">SEU PERFIL NA MESA</div>
                <h3>Escolha seu avatar</h3>
              </div>
              <button className="text-button" onClick={() => Seeds(mkSeeds())}>Sortear outros</button>
            </div>

            {p && (
              <div className="my-preview">
                <Avatar a={p.avatar} name={p.name} size={54}/>
                <div>
                  <b>{p.name}</b>
                  <small>{fmt(p.stack)} fichas iniciais · {s.host ? 'Anfitrião' : 'Convidado'}</small>
                </div>
              </div>
            )}

            <div className="seg" role="tablist" aria-label="Estilo do avatar">
              {AVATAR_STYLES.map(st => (
                <button key={st} role="tab" aria-selected={st === pstyle} className={st === pstyle ? 'on' : ''} onClick={() => Pstyle(st)}>
                  {AVATAR_LABELS[st]}
                </button>
              ))}
            </div>

            <div className="choices">
              {seeds.map(sd => {
                const on = p?.avatar?.style === pstyle && p?.avatar?.seed === sd;
                return (
                  <motion.button
                    key={sd}
                    whileHover={{scale: 1.05}}
                    whileTap={{scale: .95}}
                    className={'choice' + (on ? ' on' : '')}
                    aria-pressed={on}
                    aria-label="Usar este avatar"
                    disabled={pending}
                    onClick={() => send('avatar', {avatar: {style: pstyle, seed: sd}})}
                  >
                    <Avatar a={{style: pstyle, seed: sd}} size={72}/>
                  </motion.button>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        /* Arena de Jogo (Mesa + Dock de Controles) */
        <div className="arena">
          <div className="table-area">
            <Table s={s} pot={pot} winners={winners} left={left}/>
          </div>

          <section className={'dock ' + (mine && live ? 'your-turn' : !live ? 'is-settled' : 'is-waiting')}>
            {/* Barra superior do Dock: status + métricas + timer */}
            <div className="dock-head">
              <div className="dock-status">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={live ? (mine ? 'mine' : 'turn-' + s.turn) : 'settled'}
                    className={'turn-pill ' + (live ? (mine ? 'is-mine' : 'is-other') : 'is-end')}
                    initial={{opacity: 0, y: 6}}
                    animate={{opacity: 1, y: 0}}
                    exit={{opacity: 0, y: -6}}
                    transition={{duration: .18}}
                  >
                    <span className="turn-dot" aria-hidden="true"/>
                    <strong>
                      {live
                        ? (mine ? 'Sua vez de agir' : 'Vez de ' + (turnPlayer?.name || '…'))
                        : 'Resultado da mão'}
                    </strong>
                  </motion.div>
                </AnimatePresence>

                <div className="dock-metrics">
                  <span className="metric">Fichas <b>{fmt(p?.stack)}</b></span>
                  <span className="metric-sep" aria-hidden="true">·</span>
                  <span className="metric">Pote <b>{fmt(pot)}</b></span>
                  {due > 0 && mine && live && (
                    <>
                      <span className="metric-sep" aria-hidden="true">·</span>
                      <span className="metric call-due">Para pagar <b>{fmt(Math.min(due, p.stack))}</b></span>
                    </>
                  )}
                </div>
              </div>

              {live && (
                <div className={'timer' + (left <= 5 ? ' urgent' : left <= 10 ? ' warn' : '')}>
                  <div className="timer-row">
                    <small>Tempo</small>
                    <b>{left}s</b>
                  </div>
                  <div className="track">
                    <div style={{width: timePct + '%'}}/>
                  </div>
                </div>
              )}
            </div>

            {/* Corpo do Dock */}
            <AnimatePresence mode="wait">
              {live ? (
                <motion.div
                  key="live-controls"
                  className="dock-body"
                  initial={{opacity: 0, y: 8}}
                  animate={{opacity: 1, y: 0}}
                  exit={{opacity: 0, y: -6}}
                  transition={{duration: .2}}
                >
                  <div className="actions">
                    <ActionButton
                      label="Desistir"
                      sub="Fold"
                      hotkey="F"
                      kind="fold-btn"
                      desc="Abandone esta mão e preserve suas fichas restantes."
                      disabled={!canAct}
                      onClick={() => send('action', {type: 'fold'})}
                    />
                    <ActionButton
                      label={due ? 'Pagar ' + fmt(Math.min(due, p.stack)) : 'Passar a vez'}
                      sub={due ? 'Call' : 'Check'}
                      hotkey="C"
                      kind="call-btn"
                      desc={due ? 'Iguale a aposta até o limite das suas fichas.' : 'Continue sem colocar fichas no pote.'}
                      disabled={!canAct}
                      onClick={() => send('action', {type: due ? 'call' : 'check'})}
                    />
                    <ActionButton
                      label={(s.current ? 'Aumentar ' : 'Apostar ') + fmt(amount)}
                      sub={s.current ? 'Raise' : 'Bet'}
                      hotkey="R"
                      kind="raise-btn"
                      desc={raiseAllowed ? 'Confirme o valor total selecionado abaixo.' : 'Não é possível aumentar neste momento.'}
                      disabled={!canRaise}
                      onClick={() => send('action', {type: 'raise', amount})}
                    />
                  </div>

                  <div className={'bet-panel' + (!canRaise ? ' is-disabled' : '')}>
                    <div className="bet-left">
                      <span className="bet-title">
                        Aposta total <Tip text="Inclui as fichas já colocadas nesta rodada; não é o valor adicional.">ⓘ</Tip>
                      </span>
                      <input
                        type="number"
                        aria-label="Valor total da aposta"
                        min={min}
                        max={max}
                        value={amount}
                        disabled={!canRaise}
                        onChange={e => choose(+e.target.value)}
                      />
                    </div>

                    <div className="bet-slider-wrap">
                      <input
                        className="range"
                        aria-label="Ajustar aposta"
                        type="range"
                        min={min}
                        max={max}
                        value={amount}
                        disabled={!canRaise}
                        style={{'--pct': rangePct + '%'}}
                        onChange={e => choose(+e.target.value)}
                      />
                      <div className="range-limits">
                        <span>Mín {fmt(min)}</span>
                        <span>Máx {fmt(max)}</span>
                      </div>
                    </div>

                    <div className="presets">
                      {[
                        ['Mín', min],
                        ['½ pote', p.bet + due + Math.ceil((pot + due) / 2)],
                        ['Pote', p.bet + due + pot + due],
                        ['Máx', max],
                      ].map(([n, v]) => (
                        <button key={n} type="button" disabled={!canRaise} onClick={() => choose(v)}>
                          {n}
                        </button>
                      ))}
                      <Tip text="Aposte todas as fichas restantes. Só concorre aos potes para os quais contribuiu.">
                        <button
                          type="button"
                          className="allin"
                          disabled={!canAllIn}
                          onClick={() => send('action', {type: max <= s.current ? 'call' : 'raise', amount: max})}
                        >
                          All-in
                        </button>
                      </Tip>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="settled-controls"
                  className="dock-end"
                  initial={{opacity: 0, y: 8}}
                  animate={{opacity: 1, y: 0}}
                  exit={{opacity: 0, y: -6}}
                  transition={{duration: .22}}
                >
                  {s.reveal && showdownRows.length > 0 ? (
                    <>
                      {victorySummary && (
                        <div className="victory-banner">
                          <span className="vb-icon" aria-hidden="true">★</span>
                          <span>{victorySummary}</span>
                        </div>
                      )}

                      {/* Escala visual de classificação 1º (Melhor) até 10º (Pior) */}
                      <div className="rank-strip" role="list" aria-label="Ranking das mãos de 1º a 10º">
                        {HAND_RANKINGS.map(item => {
                          const isWinR = winRankSet.has(item.rank);
                          const isOtherR = otherRankSet.has(item.rank);
                          return (
                            <Tip key={item.rank} text={`${item.ordinal} ${item.name}: ${item.hint}`}>
                              <span
                                role="listitem"
                                className={
                                  'rank-pill' +
                                  (isWinR ? ' is-win-rank' : isOtherR ? ' is-other-rank' : '')
                                }
                              >
                                <i className="rp-ord">{item.ordinal}</i>
                                <span className="rp-name">{item.shortName}</span>
                              </span>
                            </Tip>
                          );
                        })}
                      </div>

                      <div className="showdown-grid">
                        {showdownRows.map((q, i) => {
                          const isWinner = winners.some(([wname]) => wname === q.name);
                          const rInfo = HAND_RANKINGS[q.hand.rank - 1];
                          const coreCount = q.hand.coreCount ?? 5;
                          return (
                            <motion.div
                              key={q.name + '-' + i}
                              className={'sd-card' + (isWinner ? ' is-winner' : '')}
                              initial={reducedMotion ? false : {opacity: 0, y: 8}}
                              animate={{opacity: 1, y: 0}}
                              transition={{delay: i * .06, duration: .25}}
                            >
                              <div className="sd-who">
                                <span className={'sd-rank' + (isWinner ? ' is-win' : '')} title={`${rInfo.ordinal} de 10 — ${rInfo.name}`}>
                                  {rInfo.ordinal}
                                </span>
                                <Avatar a={q.avatar} name={q.name} size={28}/>
                                <div className="sd-meta">
                                  <b>
                                    {q.name}
                                    {isWinner && <span className="sd-badge">{winners.length > 1 ? 'Empate' : 'Vencedor'}</span>}
                                  </b>
                                  <small>{describeHand(q.hand)}</small>
                                </div>
                              </div>
                              <div className="sd-cards" aria-label={`Sequência de 5 cartas: ${describeHand(q.hand)}`}>
                                {q.hand.cards.map((c, ci) => (
                                  <MiniCard key={ci} c={c} isCore={ci < coreCount}/>
                                ))}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="fold-win-msg">
                      <strong>{winners.map(([wname]) => wname).join(', ')}</strong> venceu por desistência dos adversários.
                    </p>
                  )}

                  <div className="end-footer">
                    {!hasNext ? (
                      <span className="end-note">Partida encerrada · É preciso ter dois jogadores com fichas para continuar.</span>
                    ) : (
                      <>
                        <span className="end-note">
                          {s.pausedFor != null
                            ? 'Intervalo pausado pelo anfitrião'
                            : s.nextHandAt == null
                              ? 'Preparando próxima mão…'
                              : nextLeft
                                ? <>Próxima mão em <b>{nextLeft}s</b></>
                                : 'Distribuindo a próxima mão…'}
                        </span>
                        {s.host && (
                          <button
                            type="button"
                            className="outline sm-btn"
                            disabled={pending || (s.pausedFor == null && !nextLeft)}
                            onClick={() => send('interval', {type: s.pausedFor != null ? 'resume' : 'pause'})}
                          >
                            {s.pausedFor != null ? 'Retomar contagem' : 'Pausar intervalo'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && <p className="error" role="alert">{error}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
