'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { GameOperation, PublicState } from '../../poker/game-types.ts';
import type { AvatarStyle } from '../../poker/avatars.ts';
import { AVATAR_STYLES, AVATAR_LABELS } from '../../poker/avatars.ts';
import type { SendExtra } from './use-room.ts';
import Avatar from './avatar';
import { fmt } from './table';

const mkSeeds = () => Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 8));

type Props = {
  s: PublicState;
  code: string;
  version: number;
  pending: boolean;
  error: string;
  copied: boolean;
  invite: () => void;
  send: (op: GameOperation, extra?: SendExtra) => void;
};

// Sala de espera: lugares, convite, início da partida e escolha de avatar.
export default function LobbyScreen({
  s,
  code,
  version,
  pending,
  error,
  copied,
  invite,
  send,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [pstyle, setPstyle] = useState<AvatarStyle>('lorelei');
  const [seeds, setSeeds] = useState(mkSeeds);
  const p = s.players.find((q) => q.self);
  const watching = s.role === 'spectator';
  return (
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
            <b>{code}</b>
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
                    onClick={() => send('remove', { seat: i, version })}
                  >
                    Remover
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {watching && (
          <p className="notice" role="status">
            Você está assistindo porque a sala está cheia.{' '}
            {s.players.length < 8 && (
              <button
                className="text-button"
                disabled={pending}
                onClick={() => send('sit', { version })}
              >
                Sentar na mesa
              </button>
            )}
          </p>
        )}
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

      {!watching && (
        <section className="panel lobby-card lobby-avatar-card">
          <div className="lobby-card-head">
            <div>
              <div className="eyebrow">SEU PERFIL NA MESA</div>
              <h3>Escolha seu avatar</h3>
            </div>
            <button className="text-button" onClick={() => setSeeds(mkSeeds())}>
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
                onClick={() => setPstyle(st)}
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
      )}
    </div>
  );
}
