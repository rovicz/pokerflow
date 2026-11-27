'use client';
import { useRef } from 'react';
import { motion } from 'motion/react';
import type { PublicState } from '../../poker/game-types.ts';
import { HAND_RANKINGS } from '../../poker/hands.ts';
import BrandLogo from './brand-logo';
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
  muted: boolean;
  onToggleMute: () => void;
  copied: boolean;
  onInvite: () => void;
  onExit: () => void;
};

// Barra superior (marca, fase, ações) e o modal do guia rápido.
export default function Topbar({ s, code, muted, onToggleMute, copied, onInvite, onExit }: Props) {
  const guide = useRef<HTMLDialogElement>(null);
  const inGame = !!s && s.phase !== 'waiting';
  const inLobby = !!s && s.phase === 'waiting';
  const inApp = inGame || inLobby;
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
