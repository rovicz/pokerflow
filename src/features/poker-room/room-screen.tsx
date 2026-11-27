'use client';
import { useEffect, useState, useRef, type ReactNode, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type {
  GameOperation,
  Room,
  PublicState,
  PublicPlayer,
  Hand,
} from '../../poker/game-types.ts';
import type { AvatarStyle } from '../../poker/avatars.ts';
import Table, { PlayingCard, fmt } from './table';
import ChampionDialog from './champion-dialog';
import EmotePicker from './emote-picker';
import BrandLogo from './brand-logo';
import Avatar from './avatar';
import type { EmoteId } from '../../poker/emotes.ts';
import { AVATAR_STYLES, AVATAR_LABELS } from '../../poker/avatars.ts';
import { HAND_RANKINGS, RANKS, SUITS, analyzeShowdown, describeHand } from '../../poker/hands.ts';
import { sfx, setMuted, unlock, playTransition } from './sound';
import { useRoomChannel } from './use-room-channel';

const phases = [
  ['preflop', 'Pré-flop'],
  ['flop', 'Flop'],
  ['turn', 'Turn'],
  ['river', 'River'],
  ['settled', 'Resultado'],
];
const GUIDE = [
  ['Pré-flop', 'Cada jogador recebe duas cartas privadas.'],
  ['Flop, Turn e River', 'São reveladas 3, 1 e 1 cartas comunitárias.'],
  ['Melhor mão', 'Escolha as melhores cinco cartas entre suas duas e as cinco da mesa.'],
  ['Showdown', 'A melhor mão elegível ganha cada pote; empates dividem o prêmio.'],
  [
    'Atalhos de teclado',
    'Na sua vez: F para Desistir, C para Passar/Pagar, R para Apostar/Aumentar, A para All-in e E para abrir Reações.',
  ],
];

function mkSeeds() {
  return Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 8));
}

function Tip({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <span className="tip" tabIndex={0} data-tip={text}>
      {children}
    </span>
  );
}

function MiniCard({ c, tone = 'core' }: { c: number; tone?: string }) {
  const rank = RANKS[c % 13];
  const suit = SUITS[Math.floor(c / 13)];
  const red = suit === '♥' || suit === '♦';
  const suffix = tone === 'decisive' ? ' (carta decisiva)' : tone === 'kicker' ? ' (kicker)' : '';
  return (
    <span
      className={'mini-card' + (red ? ' red' : '') + ' tone-' + tone}
      aria-label={rank + ' de ' + suit + suffix}
    >
      {rank}
      <span>{suit}</span>
    </span>
  );
}

function ActionButton({
  label,
  sub,
  hotkey,
  desc,
  kind,
  disabled,
  onClick,
}: {
  label: string;
  sub: string;
  hotkey?: string;
  desc: string;
  kind: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="action-wrap">
      <Tip text={desc}>
        <motion.button
          type="button"
          className={'action ' + kind}
          disabled={disabled}
          onClick={onClick}
          whileHover={disabled ? undefined : { y: -2 }}
          whileTap={disabled ? undefined : { scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
        >
          <span className="action-main flex flex-col leading-[1.2]">
            <strong>{label}</strong>
            {sub && <small>{sub}</small>}
          </span>
          {hotkey && (
            <kbd className="kbd" aria-hidden="true">
              {hotkey}
            </kbd>
          )}
        </motion.button>
      </Tip>
    </div>
  );
}

// Ícones SVG leves para a topbar
const IconSoundOn = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);
const IconSoundOff = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);
const IconGuide = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const IconShare = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const IconCheck = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconExit = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function Page() {
  const [name, N] = useState('');
  const [code, C] = useState('');
  const [game, G] = useState<Room | null>(null);
  const [error, E] = useState('');
  const [now, T] = useState(Date.now());
  const [stack, S] = useState(2000);
  const [bb, B] = useState(20);
  const [seconds, D] = useState(30);
  const [pending, P] = useState(false);
  const [copied, Copy] = useState(false);
  const [choice, Choose] = useState({ key: '', amount: 0 });
  const [muted, Mute] = useState(false);
  const [emotesMuted, setEmotesMuted] = useState(false);
  const [invited, Inv] = useState(false);
  const [mode, Mode] = useState('create');
  const [saved, Saved] = useState('');
  const [pstyle, Pstyle] = useState<AvatarStyle>('lorelei');
  const [seeds, Seeds] = useState(() => mkSeeds());

  const prev = useRef<{ code: string; s: PublicState } | null>(null);
  const guide = useRef<HTMLDialogElement>(null);
  const celebration = useRef<HTMLDialogElement>(null);
  const celebrated = useRef('');
  const reducedMotion = useReducedMotion();
  const token = useRef('');
  const latest = useRef<Room | null>(null);
  const mutating = useRef(false);
  const polling = useRef(false);
  const again = useRef(false);
  const epoch = useRef(0);

  useEffect(() => {
    let t = localStorage.getItem('pf-token');
    if (!t) {
      t = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
        x.toString(16).padStart(2, '0'),
      ).join('');
      localStorage.setItem('pf-token', t);
    }
    token.current = t;
    const inv = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
    C(inv);
    Inv(!!inv);
    Saved((!inv && localStorage.getItem('pf-room')) || '');
    N(localStorage.getItem('pf-name') || '');
    const m = localStorage.getItem('pf-mute') === '1';
    Mute(m);
    setMuted(m);
    setEmotesMuted(localStorage.getItem('pf-emotes-mute') === '1');
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
    const timer = setInterval(() => T(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);

  async function send(
    op: GameOperation,
    extra: {
      code?: string;
      version?: number;
      type?: string;
      amount?: number;
      seat?: number;
      avatar?: { style: AvatarStyle; seed: string };
    } = {},
    quiet = false,
  ) {
    if (!token.current || mutating.current || (quiet && polling.current)) return;
    const ep = epoch.current,
      prevGame = latest.current;
    if (quiet) polling.current = true;
    else {
      mutating.current = true;
      P(true);
      E('');
    }
    try {
      const r = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op,
          token: token.current,
          code: prevGame?.code || code,
          name,
          stack,
          bb,
          seconds,
          version: prevGame?.version,
          ...extra,
        }),
      });
      const body: unknown = await r.json();
      if (
        r.status === 403 &&
        op === 'state' &&
        ep === epoch.current &&
        prevGame?.code === latest.current?.code
      ) {
        exit();
        E('Você não está mais nesta sala.');
        return;
      }
      if (!r.ok)
        throw Error(
          body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'Não foi possível concluir.',
        );
      const x = body as Room;
      if (
        ep !== epoch.current ||
        (latest.current?.code === x.code && latest.current.version > x.version)
      )
        return;
      latest.current = x;
      G(x);
      C(x.code);
      localStorage.setItem('pf-room', x.code);
      if (!quiet) localStorage.setItem('pf-name', name);
    } catch (e) {
      if (!quiet && ep === epoch.current)
        E(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      if (quiet) polling.current = false;
      else {
        mutating.current = false;
        P(false);
      }
      if (again.current) {
        again.current = false;
        void send('state', {}, true);
      }
    }
  }

  // Aviso do canal em tempo real: busca o estado agora (ou logo após a chamada em andamento).
  const socket = useRoomChannel(game?.code, () => {
    if (mutating.current || polling.current) again.current = true;
    else void send('state', {}, true);
  });

  // O relógio avança enquanto uma mesa está aberta. Com o socket conectado o estado chega por aviso e o polling vira reserva (10 s).
  useEffect(() => {
    if (!game) return;
    let n = 0;
    const onVisible = () => document.visibilityState === 'visible' && void send('state', {}, true);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(async () => {
      if (!socket.current || ++n % 10 === 0) await send('state', {}, true);
      const g = latest.current;
      if (g?.state.deadline && Date.now() >= g.state.deadline) {
        await send('action', { type: 'tick' }, true);
      } else if (
        g?.state.phase === 'settled' &&
        g.state.players.filter((q) => q.stack > 0).length >= 2 &&
        g.state.pausedFor == null &&
        (g.state.nextHandAt ?? 0) <= Date.now()
      ) {
        await send('interval', { type: 'tick' }, true);
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [!!game]);

  const s = game?.state;
  const inGame = !!s && s.phase !== 'waiting';
  const inLobby = !!s && s.phase === 'waiting';
  const inApp = inGame || inLobby;
  const p = s?.players.find((q) => q.self);
  const mine = !!s?.players[s.turn]?.self;
  const live = !!s && !['waiting', 'settled'].includes(s.phase);
  const left = s?.deadline ? Math.max(0, Math.ceil((s.deadline - now) / 1000)) : 0;
  const pot = s?.players.reduce((a, q) => a + q.total, 0) || 0;
  const due = p ? Math.max(0, (s?.current || 0) - p.bet) : 0;
  const max = p ? p.bet + p.stack : 0;
  const min = Math.min(max, (s?.current || 0) + (s?.minRaise || s?.bb || 20));
  const canAct = live && mine && left > 0 && !pending;
  const raiseAllowed =
    !!p &&
    !!s &&
    s.current != null &&
    s.minRaise != null &&
    max > s.current &&
    (p.actedAt == null || s.current - p.actedAt >= s.minRaise) &&
    s.players.some((q) => !q.self && !q.fold && q.cards?.length && q.stack > 0);
  const canRaise = canAct && raiseAllowed;
  const canAllIn = canAct && (raiseAllowed || (due > 0 && max <= (s?.current ?? 0)));
  const key = [game?.code, s?.hand, s?.phase, s?.turn, min, max].join('/');
  const amount = choice.key === key ? Math.min(max, Math.max(min, choice.amount)) : min;
  const rangePct =
    max > min ? Math.min(100, Math.max(0, ((amount - min) / (max - min)) * 100)) : 100;
  const nextLeft = Math.max(0, Math.ceil(((s?.nextHandAt ?? now) - now) / 1000));
  const hasNext = (s?.players.filter((q) => q.stack > 0).length ?? 0) >= 2;
  const champion =
    s?.phase === 'settled' && s.players.filter((q) => q.stack > 0).length === 1
      ? s.players.find((q) => q.stack > 0)
      : null;
  const winners = Object.entries(
    (s?.result || []).reduce<Record<string, number>>((a, r) => {
      a[r.name] = (a[r.name] || 0) + r.amount;
      return a;
    }, Object.create(null)),
  );

  const choose = (v: number) =>
    Choose({ key, amount: Math.round(Math.min(max, Math.max(min, v))) });

  useEffect(() => {
    if (!champion || !game || !s) return;
    const ckey = game.code + '/' + s.hand;
    if (celebrated.current === ckey) return;
    celebrated.current = ckey;
    celebration.current?.showModal();
    sfx.champion();
  }, [game?.code, s?.hand, !!champion]);

  useEffect(() => {
    if (!game) {
      prev.current = null;
      return;
    }
    const a = prev.current;
    prev.current = { code: game.code, s: game.state };
    if (a && a.code === game.code) playTransition(a.s, game.state);
  }, [game]);

  useEffect(() => {
    if (mine && live && left > 0 && left <= 5) sfx.tick();
  }, [left, mine, live]);

  // Atalhos de teclado acessíveis na vez do jogador (F = Fold, C = Check/Call, R = Raise/Bet, A = All-in)
  useEffect(() => {
    if (!canAct) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (guide.current?.open || celebration.current?.open) return;
      const k = e.key.toLowerCase();
      if (k === 'f') {
        e.preventDefault();
        send('action', { type: 'fold' });
      } else if (k === 'c') {
        e.preventDefault();
        send('action', { type: due ? 'call' : 'check' });
      } else if (k === 'r' && canRaise) {
        e.preventDefault();
        send('action', { type: 'raise', amount });
      } else if (k === 'a' && canAllIn) {
        e.preventDefault();
        send('action', { type: max <= (s.current ?? 0) ? 'call' : 'raise', amount: max });
      }
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

  function toggleEmotesMute() {
    const m = !emotesMuted;
    setEmotesMuted(m);
    localStorage.setItem('pf-emotes-mute', m ? '1' : '0');
  }

  async function sendEmote(emote: EmoteId) {
    const cur = latest.current;
    if (!token.current || !cur) return;
    const ep = epoch.current;
    try {
      const r = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'emote', token: token.current, code: cur.code, emote }),
      });
      if (!r.ok) return;
      const x = (await r.json()) as Room;
      if (ep !== epoch.current || (latest.current?.code === x.code && latest.current.version > x.version))
        return;
      latest.current = x;
      G(x);
    } catch {
      // Falha silenciosa em rede instável para não interromper o jogo
    }
  }

  async function invite() {
    if (!game) return;
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
    ? s.players
        .filter((q): q is PublicPlayer & { hand: Hand } => q.hand != null)
        .sort((a, b) => b.hand.score - a.hand.score)
    : [];
  const winnerRows = showdownRows.filter((q) => winners.some(([wname]) => wname === q.name));
  const runnerUpRow = showdownRows.find((q) => !winners.some(([wname]) => wname === q.name));
  const showdown = s?.reveal
    ? analyzeShowdown(winnerRows, runnerUpRow)
    : { headline: '', decisiveIndex: null };
  const winRankSet = new Set(winnerRows.map((q) => q.hand.rank));
  const otherRankSet = new Set(
    showdownRows.filter((q) => !winRankSet.has(q.hand.rank)).map((q) => q.hand.rank),
  );
  const wonPotTotal = winners.reduce((a, w) => a + w[1], 0);
  const winnerNames = winners.map(([wname]) => wname).join(' e ');

  return (
    <main className={inGame ? 'in-game' : inLobby ? 'in-lobby' : 'in-landing'}>
      {/* Topbar: unificada no modo jogo e lobby, clássica na entrada */}
      <header className={inApp ? 'game-topbar' : ''}>
        <div className="flex min-w-0 items-center gap-[14px]">
          <a href="/" className="brand" aria-label="PokerFlow — página inicial">
            <BrandLogo variant={inApp ? 'compact' : 'full'} />
          </a>

          {inApp && (
            <div className="game-meta">
              {inGame ? (
                <span className="meta-pill accent">Mão {s.hand}</span>
              ) : (
                <>
                  <span className="meta-pill accent">Lobby</span>
                  <span className="meta-pill hide-xs">
                    Sala <b>{game.code}</b>
                  </span>
                </>
              )}
              <Tip text="Small blind e big blind: apostas obrigatórias iniciais.">
                <span className="meta-pill">
                  Blinds{' '}
                  <b>
                    {s.sb}/{s.bb}
                  </b>
                </span>
              </Tip>
              <span className="meta-pill hide-sm">
                Jogadores <b>{s.players.length}/8</b>
              </span>
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
                <span
                  className={'stage-step' + (isCurrent ? ' current' : '') + (isDone ? ' done' : '')}
                  key={id}
                >
                  {isCurrent && (
                    <motion.span
                      layoutId="stage-pill"
                      className="stage-pill-bg"
                      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
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
            {muted ? <IconSoundOff /> : <IconSoundOn />}
            <span className="btn-txt">{muted ? 'Mudo' : 'Som'}</span>
          </button>
          {s && (
            <button
              className="icon-btn"
              onClick={() => guide.current?.showModal()}
              title="Guia rápido"
            >
              <IconGuide />
              <span className="btn-txt">Guia</span>
            </button>
          )}
          {s && (
            <button
              className={'icon-btn' + (copied ? ' is-copied' : '')}
              onClick={invite}
              title="Copiar link de convite"
            >
              {copied ? <IconCheck /> : <IconShare />}
              <span className="btn-txt">{copied ? 'Copiado!' : 'Convidar'}</span>
            </button>
          )}
          {s && (
            <button className="icon-btn danger-ghost" onClick={exit} title="Sair da mesa">
              <IconExit />
              <span className="btn-txt">Sair</span>
            </button>
          )}
        </div>
      </header>

      <ChampionDialog celebration={celebration} champion={champion} hand={s?.hand} />

      {/* Modal Guia Rápido */}
      <dialog
        ref={guide}
        className="modal"
        onClick={(e) => e.target === guide.current && guide.current?.close()}
      >
        <div className="between">
          <div>
            <div className="eyebrow">Guia rápido</div>
            <h2>Como jogar?</h2>
          </div>
          <button
            className="outline"
            onClick={() => guide.current?.close()}
            aria-label="Fechar guia"
          >
            Fechar
          </button>
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
            {HAND_RANKINGS.map((r) => (
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
        <>
          <section className="landing">
            <motion.div
              className="hero"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="eyebrow">● O CLUBE É SEU</div>
              <h1>
                Seus amigos.
                <br />
                Sua mesa.
                <br />
                <em>Seu jogo.</em>
              </h1>
              <p>Texas Hold’em privado para até oito amigos. Apenas fichas virtuais.</p>
              <div className="hero-cards">
                <PlayingCard c={12} className="lg" tilt={-5} />
                <PlayingCard c={25} className="lg" tilt={5} />
              </div>
              <div className="tags">
                <span>02–08 jogadores</span>
                <span>Texas Hold’em</span>
                <span>Fichas virtuais</span>
              </div>
            </motion.div>

            <motion.div
              className="panel entry"
              initial={reducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              {invited ? (
                <>
                  <div className="eyebrow">Convite recebido</div>
                  <h2>Você foi chamado para jogar</h2>
                  <p className="lead">
                    Mesa <b className="code">{code}</b>. Escolha um apelido e entre. Seu avatar você
                    escolhe na sala de espera.
                  </p>
                  <label>
                    Seu apelido
                    <input
                      autoFocus
                      placeholder="Como seus amigos te chamam?"
                      maxLength={24}
                      value={name}
                      onChange={(e) => N(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && name.trim() && !pending && send('join')
                      }
                    />
                  </label>
                  <button
                    className="primary wide"
                    disabled={pending || !name.trim()}
                    onClick={() => send('join')}
                  >
                    Entrar na mesa →
                  </button>
                  {error && (
                    <p className="error" role="alert">
                      {error}
                    </p>
                  )}
                  <button className="text-button" onClick={leaveInvite}>
                    Prefere criar a sua própria mesa?
                  </button>
                </>
              ) : (
                <>
                  {saved && (
                    <div className="resume">
                      <div>
                        <small>Você estava jogando</small>
                        <b>Mesa {saved}</b>
                      </div>
                      <button
                        className="primary"
                        disabled={pending || !name.trim()}
                        onClick={() => send('join', { code: saved })}
                      >
                        Voltar à mesa →
                      </button>
                    </div>
                  )}
                  <div className="eyebrow">Começar</div>
                  <h2>Entre no clube</h2>
                  <label>
                    Seu apelido
                    <input
                      placeholder="Como seus amigos te chamam?"
                      maxLength={24}
                      value={name}
                      onChange={(e) => N(e.target.value)}
                    />
                  </label>
                  <div className="seg" role="tablist" aria-label="O que você quer fazer?">
                    <button
                      role="tab"
                      aria-selected={mode === 'create'}
                      className={mode === 'create' ? 'on' : ''}
                      onClick={() => {
                        Mode('create');
                        E('');
                      }}
                    >
                      Criar mesa
                    </button>
                    <button
                      role="tab"
                      aria-selected={mode === 'join'}
                      className={mode === 'join' ? 'on' : ''}
                      onClick={() => {
                        Mode('join');
                        E('');
                      }}
                    >
                      Tenho um convite
                    </button>
                  </div>
                  <AnimatePresence mode="wait">
                    {mode === 'create' ? (
                      <motion.div
                        key="create"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="fields">
                          <label>
                            Fichas
                            <select value={stack} onChange={(e) => S(+e.target.value)}>
                              {[1000, 2000, 5000, 10000].map((v) => (
                                <option key={v} value={v}>
                                  {fmt(v)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Big blind <Tip text="A maior aposta obrigatória antes do flop.">ⓘ</Tip>
                            <select value={bb} onChange={(e) => B(+e.target.value)}>
                              {[10, 20, 50, 100].map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Tempo
                            <select value={seconds} onChange={(e) => D(+e.target.value)}>
                              {[15, 30, 45, 60].map((v) => (
                                <option key={v} value={v}>
                                  {v}s
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <button
                          className="primary wide"
                          disabled={pending || !name.trim()}
                          onClick={() => send('create')}
                        >
                          Criar mesa privada →
                        </button>
                        <p className="step">
                          Depois de criar, você recebe um link para convidar seus amigos.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="join"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                      >
                        <label>
                          Código do convite
                          <input
                            placeholder="A1B2C3D4E5F6"
                            value={code}
                            onChange={(e) => C(e.target.value.toUpperCase())}
                            onKeyDown={(e) =>
                              e.key === 'Enter' &&
                              code.trim() &&
                              name.trim() &&
                              !pending &&
                              send('join')
                            }
                          />
                        </label>
                        <button
                          className="primary wide"
                          disabled={pending || !code.trim() || !name.trim()}
                          onClick={() => send('join')}
                        >
                          Entrar na mesa →
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {error && (
                    <p className="error" role="alert">
                      {error}
                    </p>
                  )}
                </>
              )}
            </motion.div>
          </section>
          <footer className="landing-foot">
            <span>PokerFlow · Texas Hold’em privado entre amigos</span>
            <span>Apenas fichas virtuais</span>
          </footer>
        </>
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
              {Array.from({ length: 8 }, (_, i) => {
                const q = s.players[i];
                return (
                  <motion.div
                    className={'lobby-seat ' + (!q ? 'vacant' : q.self ? 'is-self' : '')}
                    key={i}
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                  >
                    {q ? (
                      <Avatar a={q.avatar} name={q.name} size={52} />
                    ) : (
                      <span className="vacant-av" aria-hidden="true">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        >
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </span>
                    )}
                    <b>
                      {q ? q.name : 'Lugar disponível'}
                      {q?.self && <span className="you-tag">Você</span>}
                    </b>
                    <small>{q ? fmt(q.stack) + ' fichas' : 'Aguardando convite'}</small>
                    {s.host && q && !q.self && (
                      <button
                        className="outline remove-player"
                        aria-label={'Remover ' + q.name}
                        disabled={pending}
                        onClick={() => send('remove', { seat: i, version: game.version })}
                      >
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
                    disabled={pending || s.players.filter((q) => q.stack > 0).length < 2}
                    whileHover={
                      pending || s.players.filter((q) => q.stack > 0).length < 2
                        ? undefined
                        : { scale: 1.02 }
                    }
                    whileTap={
                      pending || s.players.filter((q) => q.stack > 0).length < 2
                        ? undefined
                        : { scale: 0.98 }
                    }
                    onClick={() => send('start')}
                  >
                    Iniciar partida →
                  </motion.button>
                ) : (
                  <span className="waiting-host">Aguardando o anfitrião iniciar…</span>
                )}
              </div>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </div>
          </section>

          <section className="panel lobby-card lobby-avatar-card">
            <div className="lobby-card-head">
              <div>
                <div className="eyebrow">SEU PERFIL NA MESA</div>
                <h3>Escolha seu avatar</h3>
              </div>
              <button className="text-button" onClick={() => Seeds(mkSeeds())}>
                Sortear outros
              </button>
            </div>

            {p && (
              <div className="my-preview">
                <Avatar a={p.avatar} name={p.name} size={54} />
                <div>
                  <b>{p.name}</b>
                  <small>
                    {fmt(p.stack)} fichas iniciais · {s.host ? 'Anfitrião' : 'Convidado'}
                  </small>
                </div>
              </div>
            )}

            <div className="seg" role="tablist" aria-label="Estilo do avatar">
              {AVATAR_STYLES.map((st) => (
                <button
                  key={st}
                  role="tab"
                  aria-selected={st === pstyle}
                  className={st === pstyle ? 'on' : ''}
                  onClick={() => Pstyle(st)}
                >
                  {AVATAR_LABELS[st]}
                </button>
              ))}
            </div>

            <div className="choices">
              {seeds.map((sd) => {
                const on = p?.avatar?.style === pstyle && p?.avatar?.seed === sd;
                return (
                  <motion.button
                    key={sd}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={'choice' + (on ? ' on' : '')}
                    aria-pressed={on}
                    aria-label="Usar este avatar"
                    disabled={pending}
                    onClick={() => send('avatar', { avatar: { style: pstyle, seed: sd } })}
                  >
                    <Avatar a={{ style: pstyle, seed: sd }} size={72} />
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
            <Table s={s} pot={pot} winners={winners} left={left} emotesMuted={emotesMuted} />
            <EmotePicker
              onSend={sendEmote}
              muted={emotesMuted}
              onToggleMute={toggleEmotesMute}
            />
          </div>

          <section
            className={'dock ' + (mine && live ? 'your-turn' : !live ? 'is-settled' : 'is-waiting')}
          >
            {/* Barra superior do Dock: durante a mão = turno + métricas + timer; no showdown = manchete única clara */}
            {live ? (
              <div className="dock-head">
                <div className="dock-status">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={mine ? 'mine' : 'turn-' + s.turn}
                      className={'turn-pill ' + (mine ? 'is-mine' : 'is-other')}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                    >
                      <span className="turn-dot" aria-hidden="true" />
                      <strong>
                        {mine ? 'Sua vez de agir' : 'Vez de ' + (turnPlayer?.name || '…')}
                      </strong>
                    </motion.div>
                  </AnimatePresence>

                  <div className="dock-metrics">
                    <span className="metric">
                      Fichas <b>{fmt(p?.stack)}</b>
                    </span>
                    <span className="metric-sep" aria-hidden="true">
                      ·
                    </span>
                    <span className="metric">
                      Pote <b>{fmt(pot)}</b>
                    </span>
                    {due > 0 && mine && (
                      <>
                        <span className="metric-sep" aria-hidden="true">
                          ·
                        </span>
                        <span className="metric call-due">
                          Para pagar <b>{fmt(Math.min(due, p?.stack ?? 0))}</b>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className={'timer' + (left <= 5 ? ' urgent' : left <= 10 ? ' warn' : '')}>
                  <div className="timer-row">
                    <small>Tempo</small>
                    <b>{left}s</b>
                  </div>
                  <div className="track">
                    <div style={{ width: timePct + '%' }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="dock-head showdown-head">
                <div className="showdown-headline">
                  <span className="sh-win">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                    </svg>
                    <strong>{winnerNames || 'Fim da mão'}</strong>
                    {winners.length > 0 && (
                      <span>
                        {winners.length > 1 ? 'dividiram' : 'venceu'} <b>+{fmt(wonPotTotal)}</b>
                      </span>
                    )}
                  </span>
                  {showdown.headline ? (
                    <span className="sh-reason">{showdown.headline}</span>
                  ) : (
                    <span className="sh-reason">Vitória por desistência</span>
                  )}
                </div>
                <span className="metric sh-stack">
                  Suas fichas <b>{fmt(p?.stack)}</b>
                </span>
              </div>
            )}

            {/* Corpo do Dock */}
            <AnimatePresence mode="wait">
              {live ? (
                <motion.div
                  key="live-controls"
                  className="dock-body"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="actions">
                    <ActionButton
                      label="Desistir"
                      sub="Fold"
                      hotkey="F"
                      kind="fold-btn"
                      desc="Abandone esta mão e preserve suas fichas restantes."
                      disabled={!canAct}
                      onClick={() => send('action', { type: 'fold' })}
                    />
                    <ActionButton
                      label={due ? 'Pagar ' + fmt(Math.min(due, p?.stack ?? 0)) : 'Passar a vez'}
                      sub={due ? 'Call' : 'Check'}
                      hotkey="C"
                      kind="call-btn"
                      desc={
                        due
                          ? 'Iguale a aposta até o limite das suas fichas.'
                          : 'Continue sem colocar fichas no pote.'
                      }
                      disabled={!canAct}
                      onClick={() => send('action', { type: due ? 'call' : 'check' })}
                    />
                    <ActionButton
                      label={(s.current ? 'Aumentar ' : 'Apostar ') + fmt(amount)}
                      sub={s.current ? 'Raise' : 'Bet'}
                      hotkey="R"
                      kind="raise-btn"
                      desc={
                        raiseAllowed
                          ? 'Confirme o valor total selecionado abaixo.'
                          : 'Não é possível aumentar neste momento.'
                      }
                      disabled={!canRaise}
                      onClick={() => send('action', { type: 'raise', amount })}
                    />
                  </div>

                  <div className={'bet-panel' + (!canRaise ? ' is-disabled' : '')}>
                    <div className="bet-left">
                      <span className="bet-title">
                        Aposta total{' '}
                        <Tip text="Inclui as fichas já colocadas nesta rodada; não é o valor adicional.">
                          ⓘ
                        </Tip>
                      </span>
                      <input
                        type="number"
                        aria-label="Valor total da aposta"
                        min={min}
                        max={max}
                        value={amount}
                        disabled={!canRaise}
                        onChange={(e) => choose(+e.target.value)}
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
                        style={{ '--pct': rangePct + '%' } as CSSProperties}
                        onChange={(e) => choose(+e.target.value)}
                      />
                      <div className="range-limits">
                        <span>Mín {fmt(min)}</span>
                        <span>Máx {fmt(max)}</span>
                      </div>
                    </div>

                    <div className="presets">
                      {[
                        ['Mín', min],
                        ['½ pote', (p?.bet ?? 0) + due + Math.ceil((pot + due) / 2)],
                        ['Pote', (p?.bet ?? 0) + due + pot + due],
                        ['Máx', max],
                      ].map(([n, v]) => (
                        <button
                          key={n}
                          type="button"
                          disabled={!canRaise}
                          onClick={() => choose(Number(v))}
                        >
                          {n}
                        </button>
                      ))}
                      <Tip text="Aposte todas as fichas restantes. Só concorre aos potes para os quais contribuiu.">
                        <button
                          type="button"
                          className="allin"
                          disabled={!canAllIn}
                          onClick={() =>
                            send('action', {
                              type: max <= (s.current ?? 0) ? 'call' : 'raise',
                              amount: max,
                            })
                          }
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                >
                  {s.reveal && showdownRows.length > 0 ? (
                    <>
                      <div className="showdown-grid">
                        {showdownRows.map((q, i) => {
                          const isWinner = winners.some(([wname]) => wname === q.name);
                          const coreCount = q.hand.coreCount ?? 5;
                          const hasTiebreak = showdown.decisiveIndex != null;
                          return (
                            <motion.div
                              key={q.name + '-' + i}
                              className={'sd-card' + (isWinner ? ' is-winner' : '')}
                              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.06, duration: 0.25 }}
                            >
                              <div className="sd-who">
                                <Avatar a={q.avatar} name={q.name} size={30} />
                                <div className="sd-meta">
                                  <b>
                                    {q.name}
                                    {isWinner && (
                                      <span className="sd-badge">
                                        {winners.length > 1 ? 'Empate' : 'Vencedor'}
                                      </span>
                                    )}
                                  </b>
                                  <small>{describeHand(q.hand)}</small>
                                </div>
                              </div>
                              <div
                                className="sd-cards"
                                aria-label={`Sequência de 5 cartas: ${describeHand(q.hand)}`}
                              >
                                {q.hand.cards.map((c, ci) => {
                                  const tone = hasTiebreak
                                    ? ci === showdown.decisiveIndex
                                      ? isWinner
                                        ? 'decisive'
                                        : 'compared'
                                      : 'neutral'
                                    : ci < coreCount
                                      ? 'core'
                                      : 'kicker';
                                  return <MiniCard key={ci} c={c} tone={tone} />;
                                })}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Régua compacta de força: Mais forte (1º) -> Mais fraca (10º) */}
                      <div
                        className="rank-ruler"
                        role="list"
                        aria-label="Força das mãos de 1º (mais forte) a 10º (mais fraca)"
                      >
                        <span className="ruler-edge">Mais forte</span>
                        <div className="ruler-steps">
                          {HAND_RANKINGS.map((item) => {
                            const isWinR = winRankSet.has(item.rank);
                            const isOtherR = otherRankSet.has(item.rank);
                            const showName = isWinR || isOtherR;
                            return (
                              <Tip
                                key={item.rank}
                                text={`${item.ordinal} ${item.name}: ${item.hint}`}
                              >
                                <span
                                  role="listitem"
                                  className={
                                    'ruler-step' +
                                    (isWinR ? ' is-win-rank' : isOtherR ? ' is-other-rank' : '')
                                  }
                                >
                                  <i>{item.ordinal}</i>
                                  {showName && <span>{item.name}</span>}
                                </span>
                              </Tip>
                            );
                          })}
                        </div>
                        <span className="ruler-edge">Mais fraca</span>
                      </div>
                    </>
                  ) : null}

                  <div className="end-footer">
                    {!hasNext ? (
                      <span className="end-note">
                        Partida encerrada · É preciso ter dois jogadores com fichas para continuar.
                      </span>
                    ) : (
                      <>
                        <span className="end-note">
                          {s.pausedFor != null ? (
                            'Intervalo pausado pelo anfitrião'
                          ) : s.nextHandAt == null ? (
                            'Preparando próxima mão…'
                          ) : nextLeft ? (
                            <>
                              Próxima mão em <b>{nextLeft}s</b>
                            </>
                          ) : (
                            'Distribuindo a próxima mão…'
                          )}
                        </span>
                        {s.host && (
                          <button
                            type="button"
                            className="outline sm-btn"
                            disabled={pending || (s.pausedFor == null && !nextLeft)}
                            onClick={() =>
                              send('interval', { type: s.pausedFor != null ? 'resume' : 'pause' })
                            }
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

            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
