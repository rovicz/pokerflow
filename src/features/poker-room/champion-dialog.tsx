import type { RefObject } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { PublicPlayer } from '../../poker/game-types.ts';
import Avatar from './avatar';
import { fmt } from './table';

const CONFETTI = [
  { x: -170, y: -120, r: -140, c: '#fbbf24', d: 0 },
  { x: -120, y: -150, r: 95, c: '#66A1FF', d: 0.06 },
  { x: -60, y: -170, r: -75, c: '#f59e0b', d: 0.12 },
  { x: 10, y: -175, r: 120, c: '#fde68a', d: 0.04 },
  { x: 80, y: -160, r: -110, c: '#0A64FF', d: 0.1 },
  { x: 145, y: -135, r: 140, c: '#fbbf24', d: 0.08 },
  { x: 185, y: -90, r: -90, c: '#34d399', d: 0.14 },
  { x: -185, y: -70, r: 110, c: '#fde68a', d: 0.16 },
  { x: -95, y: -110, r: -160, c: '#f43f5e', d: 0.18 },
  { x: 110, y: -100, r: 85, c: '#66A1FF', d: 0.15 },
];

export default function ChampionDialog({
  celebration,
  champion,
  hand,
  isHost = false,
  pending = false,
  canStartImmediately = false,
  onRematch,
}: {
  celebration: RefObject<HTMLDialogElement | null>;
  champion: PublicPlayer | null | undefined;
  hand?: number;
  isHost?: boolean;
  pending?: boolean;
  canStartImmediately?: boolean;
  onRematch?: (mode: 'start' | 'lobby') => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <dialog ref={celebration} className="modal celebration" aria-labelledby="champion-title">
      {champion && (
        <div className="cel-inner">
          {!reducedMotion && (
            <div className="confetti-layer" aria-hidden="true">
              {CONFETTI.map((cf, i) => (
                <motion.span
                  key={i}
                  className="confetti-piece"
                  style={{ background: cf.c }}
                  initial={{ x: 0, y: 20, scale: 0, opacity: 1, rotate: 0 }}
                  animate={{
                    x: cf.x,
                    y: [20, cf.y, cf.y + 90],
                    scale: [0, 1.1, 0.8],
                    opacity: [1, 1, 0],
                    rotate: cf.r,
                  }}
                  transition={{ duration: 1.6, delay: cf.d, ease: [0.22, 1, 0.36, 1] }}
                />
              ))}
            </div>
          )}

          <div className="trophy-wrap">
            <motion.div
              className="trophy-halo"
              animate={reducedMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="trophy"
              aria-hidden="true"
              initial={reducedMotion ? false : { scale: 0.3, rotate: -18, y: 20 }}
              animate={reducedMotion ? {} : { scale: [0.3, 1.14, 1], rotate: [-18, 8, 0], y: 0 }}
              transition={{ duration: 0.9, type: 'spring', stiffness: 220, damping: 16 }}
            >
              <svg width="78" height="78" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient
                    id="goldCup"
                    x1="12"
                    y1="8"
                    x2="52"
                    y2="56"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0" stopColor="#FEF08A" />
                    <stop offset=".45" stopColor="#F59E0B" />
                    <stop offset="1" stopColor="#B45309" />
                  </linearGradient>
                </defs>
                <path
                  d="M18 12H46V24C46 33.5 39.8 40 32 40C24.2 40 18 33.5 18 24V12Z"
                  fill="url(#goldCup)"
                />
                <path
                  d="M18 16H11C11 24 14 28 19 28"
                  stroke="#FBBF24"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="M46 16H53C53 24 50 28 45 28"
                  stroke="#FBBF24"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <rect x="28" y="39" width="8" height="10" rx="2" fill="#D97706" />
                <rect x="20" y="48" width="24" height="6" rx="3" fill="url(#goldCup)" />
                <path
                  d="M32 18L34.2 22.4L39 23.1L35.5 26.5L36.3 31.3L32 29L27.7 31.3L28.5 26.5L25 23.1L29.8 22.4L32 18Z"
                  fill="#FFFBEB"
                />
              </svg>
            </motion.div>
          </div>

          <p className="eyebrow">FIM DE PARTIDA · MÃO {hand}</p>
          <h2 id="champion-title">Temos um campeão!</h2>

          <motion.div
            className="champion"
            initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: reducedMotion ? 0 : 0.32,
              type: 'spring',
              stiffness: 260,
              damping: 22,
            }}
          >
            <div className="champ-avatar-frame">
              <Avatar a={champion.avatar} name={champion.name} size={96} />
            </div>
            <strong>{champion.name}</strong>
            <span className="champ-stack">{fmt(champion.stack)} fichas</span>
          </motion.div>

          {isHost && onRematch ? (
            <div className="cel-actions">
              {canStartImmediately && (
                <motion.button
                  type="button"
                  className="primary cel-btn"
                  autoFocus
                  disabled={pending}
                  whileHover={pending ? undefined : { scale: 1.03 }}
                  whileTap={pending ? undefined : { scale: 0.97 }}
                  onClick={() => onRematch('start')}
                >
                  Revanche agora ↻
                </motion.button>
              )}
              <button
                type="button"
                className="outline cel-sub-btn"
                disabled={pending}
                onClick={() => onRematch('lobby')}
              >
                Voltar ao Lobby
              </button>
              <button
                type="button"
                className="text-button cel-dismiss"
                onClick={() => celebration.current?.close()}
              >
                Ver resultado da mesa
              </button>
            </div>
          ) : (
            <div className="cel-actions">
              <small className="cel-wait">Aguardando o anfitrião iniciar a revanche…</small>
              <motion.button
                type="button"
                className="primary cel-btn"
                autoFocus
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => celebration.current?.close()}
              >
                Ver resultado da mesa
              </motion.button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
