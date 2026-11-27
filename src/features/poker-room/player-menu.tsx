'use client';
import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { PublicPlayer } from '../../poker/game-types.ts';
import Avatar from './avatar';

type Props = {
  player: PublicPlayer;
  muted: boolean;
  onToggleMute: () => void;
  canVoteKick: boolean;
  voteKickReason?: string;
  onVoteKick?: () => void;
  pending?: boolean;
  align?: 'above' | 'below';
  onClose: () => void;
};

// Popover contextual ao clicar na placa de um oponente: silenciar emotes e votar expulsão.
export default function PlayerMenu({
  player,
  muted,
  onToggleMute,
  canVoteKick,
  voteKickReason,
  onVoteKick,
  pending,
  align = 'below',
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className={'player-menu is-' + align}
      role="menu"
      aria-label={'Ações para ' + player.name}
      initial={{ opacity: 0, scale: 0.94, y: align === 'above' ? 6 : -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: align === 'above' ? 6 : -6 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="pm-head">
        <Avatar a={player.avatar} name={player.name} size={24} />
        <div className="pm-who">
          <b>{player.name}</b>
          <small>
            {player.bot ? 'Bot' : player.isHost ? 'Anfitrião' : 'Jogador'}
            {muted ? ' · Silenciado' : ''}
          </small>
        </div>
      </div>

      <button
        type="button"
        role="menuitem"
        className={'pm-item' + (muted ? ' is-active' : '')}
        onClick={() => {
          onToggleMute();
          onClose();
        }}
      >
        <span className="pm-ico" aria-hidden="true">
          {muted ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
        </span>
        <span>{muted ? 'Reativar emotes' : 'Silenciar emotes'}</span>
      </button>

      {onVoteKick && !player.bot && !player.isHost && !player.kicked && (
        <button
          type="button"
          role="menuitem"
          className="pm-item is-danger"
          disabled={!canVoteKick || pending}
          title={voteKickReason}
          onClick={() => {
            onVoteKick();
            onClose();
          }}
        >
          <span className="pm-ico" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="18" y1="8" x2="23" y2="13" />
              <line x1="23" y1="8" x2="18" y2="13" />
            </svg>
          </span>
          <span className="pm-col">
            <span>Votar para expulsar</span>
            {voteKickReason && <small className="pm-hint">{voteKickReason}</small>}
          </span>
        </button>
      )}
    </motion.div>
  );
}
