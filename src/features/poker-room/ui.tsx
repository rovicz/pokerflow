'use client';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { RANKS, SUITS } from '../../poker/hands.ts';
import type { PublicPlayer, SeatRef } from '../../poker/game-types.ts';

export function matchesSeat(seat: SeatRef, player: PublicPlayer) {
  return seat.uid ? seat.uid === player.uid : seat.name === player.name;
}

export function Tip({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <span className="tip" tabIndex={0} data-tip={text}>
      {children}
    </span>
  );
}

export function MiniCard({ c, tone = 'core' }: { c: number; tone?: string }) {
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

export function ActionButton({
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
  desc?: string;
  kind: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="action-wrap">
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
    </div>
  );
}

// Ícones SVG leves para a topbar
export const IconSoundOn = () => (
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
export const IconSoundOff = () => (
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
export const IconGuide = () => (
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
export const IconShare = () => (
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
export const IconCheck = () => (
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
export const IconExit = () => (
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
export const IconHistory = () => (
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
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14" />
  </svg>
);
export const IconTrophy = () => (
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
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

// Botão de fechar padrão de modais e painéis (mesmo desenho em todas as telas).
export function CloseButton({
  onClick,
  label = 'Fechar',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" className="hh-close" aria-label={label} onClick={onClick}>
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    </button>
  );
}
