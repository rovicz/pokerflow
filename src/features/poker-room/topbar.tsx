'use client';
import { useRef } from 'react';
import { motion } from 'motion/react';
import type { PublicState } from '../../poker/game-types.ts';
import { HAND_RANKINGS } from '../../poker/hands.ts';
import { MAX_BLIND_LEVEL, blindsForLevel, handsUntilNextLevel } from '../../poker/blinds.ts';
import BrandLogo from './brand-logo';
import Avatar from './avatar';
import { useAuth } from '../auth/use-auth';
import { Tip, IconSoundOn, IconSoundOff, IconGuide, IconShare, IconCheck, IconExit } from './ui';

export const phases = [
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
    'Na sua vez: F para Desistir, C para Passar/Pagar, R para Apostar/Aumentar, A para All-in, E para Reações e H para Histórico.',
  ],
];

type Props = {
  s: PublicState | null;
  code?: string;
  now?: number;
  muted: boolean;
  onToggleMute: () => void;
  copied: boolean;
  onInvite: () => void;
  onExit: () => void;
  onOpenAuth?: (view?: 'login' | 'register') => void;
};

function fmtClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Barra superior (marca, fase, ações) e o modal do guia rápido.
export default function Topbar({
  s,
  code,
  now = 0,
  muted,
  onToggleMute,
  copied,
  onInvite,
  onExit,
  onOpenAuth,
}: Props) {
  const guide = useRef<HTMLDialogElement>(null);
  const { enabled: authEnabled, user, profile, signOut } = useAuth();
  const inGame = !!s && s.phase !== 'waiting';
  const inLobby = !!s && s.phase === 'waiting';
  const inApp = inGame || inLobby;

  const blinds = s?.blinds ?? null;
  const nextBlinds =
    blinds && blinds.level < MAX_BLIND_LEVEL
      ? blindsForLevel(blinds.baseBb, blinds.level + 1)
      : null;
  const handsLeft = blinds && inGame ? handsUntilNextLevel(blinds, s.hand) : null;
  const secsLeft =
    blinds && inGame && blinds.mode === 'time' && blinds.nextAt != null && now > 0
      ? Math.max(0, Math.ceil((blinds.nextAt - now) / 1000))
      : null;
  const levelSoon =
    inGame &&
    !!nextBlinds &&
    ((handsLeft != null && handsLeft <= 1) || (secsLeft != null && secsLeft <= 30));
  const blindsTip = !blinds
    ? 'Small blind e big blind: apostas obrigatórias iniciais.'
    : !nextBlinds
      ? `Modo Torneio · Nível máximo (${blinds.level}/${MAX_BLIND_LEVEL}).`
      : `Modo Torneio · Nível ${blinds.level}/${MAX_BLIND_LEVEL}. Próximo nível: ${nextBlinds.sb}/${nextBlinds.bb}` +
        (handsLeft != null
          ? handsLeft === 1
            ? ' na próxima mão.'
            : ` em ${handsLeft} mãos.`
          : secsLeft != null
            ? secsLeft === 0
              ? ' na próxima mão.'
              : ` em ${fmtClock(secsLeft)}.`
            : '.');
  return (
    <>
      {/* Topbar: unificada no modo jogo e lobby, clássica na entrada */}
      <header className={inApp ? 'game-topbar' : ''}>
        <div className="flex min-w-0 items-center gap-[14px]">
          <a href="/" className="brand" aria-label="PokerFlow — página inicial">
            <BrandLogo variant={inApp ? 'compact' : 'full'} />
          </a>

          {inApp && (
            <div className="game-meta">
              {s.role === 'spectator' && <span className="meta-pill">Assistindo</span>}
              {inGame ? (
                <span className="meta-pill accent">Mão {s.hand}</span>
              ) : (
                <>
                  <span className="meta-pill accent">Lobby</span>
                  <span className="meta-pill hide-xs">
                    Sala <b>{code}</b>
                  </span>
                </>
              )}
              <Tip text={blindsTip}>
                <span className={'meta-pill' + (levelSoon ? ' is-level-soon' : '')}>
                  {blinds ? `Nv.${blinds.level}` : 'Blinds'}{' '}
                  <b>
                    {s.sb}/{s.bb}
                  </b>
                  {inGame && nextBlinds && handsLeft != null && (
                    <small className="blinds-next hide-xs">
                      {handsLeft === 1 ? ' · próx. mão' : ` · ${handsLeft}m`}
                    </small>
                  )}
                  {inGame && nextBlinds && secsLeft != null && (
                    <small className="blinds-next hide-xs">
                      {secsLeft === 0 ? ' · próx. mão' : ` · ${fmtClock(secsLeft)}`}
                    </small>
                  )}
                </span>
              </Tip>
              <span className="meta-pill hide-sm">
                Jogadores <b>{s.players.length}/8</b>
                {s.spectators.length > 0 && <> · {s.spectators.length} assistindo</>}
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
          {authEnabled &&
            !inApp &&
            (user ? (
              <div className="auth-user-pill">
                <Avatar
                  a={
                    profile
                      ? {
                          style: (profile.avatar_style as 'lorelei') || 'lorelei',
                          seed: profile.avatar_seed || profile.username,
                        }
                      : undefined
                  }
                  name={profile?.display_name || user.email || 'Conta'}
                  size={22}
                />
                <span className="auth-user-name">
                  {profile?.display_name || user.email?.split('@')[0]}
                </span>
                <button
                  type="button"
                  className="text-button auth-signout-btn"
                  title="Sair da conta"
                  onClick={() => void signOut()}
                >
                  Sair
                </button>
              </div>
            ) : (
              onOpenAuth && (
                <button
                  type="button"
                  className="outline auth-enter-btn"
                  onClick={() => onOpenAuth('login')}
                >
                  Entrar
                </button>
              )
            ))}
          <button
            className="icon-btn"
            onClick={onToggleMute}
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
              onClick={onInvite}
              title="Copiar link de convite"
            >
              {copied ? <IconCheck /> : <IconShare />}
              <span className="btn-txt">{copied ? 'Copiado!' : 'Convidar'}</span>
            </button>
          )}
          {s && (
            <button className="icon-btn danger-ghost" onClick={onExit} title="Sair da mesa">
              <IconExit />
              <span className="btn-txt">Sair</span>
            </button>
          )}
        </div>
      </header>

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
    </>
  );
}
