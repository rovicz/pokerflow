'use client';
import { AnimatePresence, motion } from 'motion/react';
import type { PublicBanVote } from '../../poker/game-types.ts';

type Props = {
  vote: PublicBanVote | null | undefined;
  now: number;
  pending: boolean;
  onVote: (targetUid: string, choice: 'yes' | 'no') => void;
};

// Banner compacto exibido no topo da mesa ou lobby quando há uma votação de expulsão ativa.
export default function BanVoteBanner({ vote, now, pending, onVote }: Props) {
  const leftSec = vote ? Math.max(0, Math.ceil((vote.expiresAt - now) / 1000)) : 0;
  const pct = vote && vote.required > 0 ? Math.min(100, (vote.yesCount / vote.required) * 100) : 0;

  return (
    <AnimatePresence>
      {vote && (
        <motion.aside
          key={vote.targetUid + '-' + vote.expiresAt}
          className="ban-vote-banner"
          role="region"
          aria-live="polite"
          aria-label={'Votação para expulsar ' + vote.targetName}
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="bvb-info">
            <div className="bvb-title">
              <span className="bvb-badge">VOTAÇÃO</span>
              <strong>Expulsar {vote.targetName}?</strong>
              <span className="bvb-timer">{leftSec}s</span>
            </div>
            <div className="bvb-progress-row">
              <span className="bvb-bar">
                <i style={{ width: pct + '%' }} />
              </span>
              <small>
                {vote.yesCount}/{vote.required} a favor
                {vote.noCount > 0 ? ` · ${vote.noCount} contra` : ''}
              </small>
            </div>
          </div>

          <div className="bvb-actions">
            {vote.canVote ? (
              <>
                <button
                  type="button"
                  className="bvb-btn is-yes"
                  disabled={pending || leftSec === 0}
                  onClick={() => onVote(vote.targetUid, 'yes')}
                >
                  Expulsar
                </button>
                <button
                  type="button"
                  className="bvb-btn is-no"
                  disabled={pending || leftSec === 0}
                  onClick={() => onVote(vote.targetUid, 'no')}
                >
                  Manter
                </button>
              </>
            ) : (
              <span className="bvb-status">
                {vote.myVote === 'yes'
                  ? 'Você votou: Expulsar'
                  : vote.myVote === 'no'
                    ? 'Você votou: Manter'
                    : 'Aguardando votos…'}
              </span>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
