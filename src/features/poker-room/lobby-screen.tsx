'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { GameOperation, PublicState } from '../../poker/game-types.ts';
import type { AvatarStyle } from '../../poker/avatars.ts';
import { AVATAR_STYLES, AVATAR_LABELS } from '../../poker/avatars.ts';
import { BOT_DIFFICULTY_LABELS } from '../../poker/bot-ai.ts';
import {
  BLIND_HAND_INTERVALS,
  BLIND_TIME_INTERVALS,
  previewBlindLevels,
} from '../../poker/blinds.ts';
import type { SendExtra } from './use-room.ts';
import Avatar from './avatar';
import BanVoteBanner from './ban-vote-banner';
import { fmt } from './table';

const svg = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;
const IconVolume = () => (
  <svg {...svg}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
  </svg>
);
const IconVolumeOff = () => (
  <svg {...svg}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="22" y1="9" x2="16" y2="15" />
    <line x1="16" y1="9" x2="22" y2="15" />
  </svg>
);
const IconClose = () => (
  <svg {...svg}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);
const IconBan = () => (
  <svg {...svg}>
    <circle cx="12" cy="12" r="9" />
    <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
  </svg>
);

const mkSeeds = () => Array.from({ length: 12 }, () => Math.random().toString(36).slice(2, 8));

type Props = {
  s: PublicState;
  code: string;
  version: number;
  now: number;
  pending: boolean;
  error: string;
  copied: boolean;
  invite: () => void;
  send: (op: GameOperation, extra?: SendExtra) => void;
  mutedUids: Set<string>;
  onTogglePlayerMute: (uid: string) => void;
};

// Sala de espera: lugares, convite, início da partida e escolha de avatar.
export default function LobbyScreen({
  s,
  code,
  version,
  now,
  pending,
  error,
  copied,
  invite,
  send,
  mutedUids,
  onTogglePlayerMute,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [pstyle, setPstyle] = useState<AvatarStyle>('lorelei');
  const [seeds, setSeeds] = useState(mkSeeds);
  const p = s.players.find((q) => q.self);
  const watching = s.role === 'spectator';
  const humanCount = s.players.filter((q) => !q.bot && !q.kicked).length;
  return (
    <div className="lobby-arena">
      <section className="panel lobby-card lobby-seats-card">
        <BanVoteBanner
          vote={s.banVote}
          now={now}
          pending={pending}
          onVote={(targetUid, vote) => send('vote_kick', { targetUid, vote })}
        />
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

        {/* Faixa de estrutura de blinds (Fixos vs Modo Torneio) */}
        <div className="lobby-blinds-bar">
          <div className="lbb-info">
            <span className={'lbb-badge' + (s.blinds ? ' is-tourney' : '')}>
              {s.blinds ? 'MODO TORNEIO' : 'BLINDS FIXOS'}
            </span>
            {s.blinds ? (
              <span className="lbb-text">
                Sobe a cada{' '}
                <b>
                  {s.blinds.mode === 'hands'
                    ? `${s.blinds.every} mãos`
                    : `${s.blinds.every / 60} min`}
                </b>{' '}
                ·{' '}
                {previewBlindLevels(s.blinds.baseBb, 4)
                  .map((lv) => `${lv.sb}/${lv.bb}`)
                  .join(' → ')}
              </span>
            ) : (
              <span className="lbb-text">
                Blinds constantes em{' '}
                <b>
                  {s.sb}/{s.bb}
                </b>
              </span>
            )}
          </div>
          {s.host && (
            <div className="lbb-controls">
              <button
                type="button"
                className={'outline seat-mini-btn' + (!s.blinds ? ' is-selected' : '')}
                disabled={pending}
                onClick={() => send('blinds', { version, blindsMode: 'fixed' })}
              >
                Fixos
              </button>
              <button
                type="button"
                className={
                  'outline seat-mini-btn' + (s.blinds?.mode === 'hands' ? ' is-selected' : '')
                }
                disabled={pending}
                onClick={() =>
                  send('blinds', {
                    version,
                    blindsMode: 'hands',
                    blindsEvery: s.blinds?.mode === 'hands' ? s.blinds.every : 8,
                  })
                }
              >
                Por mãos
              </button>
              <button
                type="button"
                className={
                  'outline seat-mini-btn' + (s.blinds?.mode === 'time' ? ' is-selected' : '')
                }
                disabled={pending}
                onClick={() =>
                  send('blinds', {
                    version,
                    blindsMode: 'time',
                    blindsEvery: s.blinds?.mode === 'time' ? s.blinds.every : 300,
                  })
                }
              >
                Por tempo
              </button>
              {s.blinds && (
                <select
                  aria-label="Intervalo de subida dos blinds"
                  className="lbb-select"
                  disabled={pending}
                  value={s.blinds.every}
                  onChange={(e) =>
                    send('blinds', {
                      version,
                      blindsMode: s.blinds!.mode,
                      blindsEvery: Number(e.target.value),
                    })
                  }
                >
                  {(s.blinds.mode === 'hands' ? BLIND_HAND_INTERVALS : BLIND_TIME_INTERVALS).map(
                    (v) => (
                      <option key={v} value={v}>
                        {s.blinds!.mode === 'hands' ? `${v} mãos` : `${v / 60} min`}
                      </option>
                    ),
                  )}
                </select>
              )}
            </div>
          )}
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
                  {q?.bot && <span className="bot-tag">Bot</span>}
                </b>
                <small>
                  {q
                    ? q.bot
                      ? `${fmt(q.stack)} fichas · ${BOT_DIFFICULTY_LABELS[q.bot.difficulty]}`
                      : fmt(q.stack) + ' fichas'
                    : 'Aguardando convite'}
                </small>
                {q && !q.self && (
                  <div className="lobby-seat-actions">
                    <button
                      type="button"
                      className={
                        'outline seat-mini-btn seat-icon-btn' +
                        (mutedUids.has(q.uid) ? ' is-muted' : '')
                      }
                      aria-label={
                        (mutedUids.has(q.uid) ? 'Reativar emotes de ' : 'Silenciar emotes de ') +
                        q.name
                      }
                      title={
                        mutedUids.has(q.uid)
                          ? 'Emotes silenciados (clique para reativar)'
                          : 'Silenciar emotes deste jogador'
                      }
                      onClick={() => onTogglePlayerMute(q.uid)}
                    >
                      {mutedUids.has(q.uid) ? <IconVolumeOff /> : <IconVolume />}
                    </button>
                    {s.host ? (
                      <button
                        type="button"
                        className="outline remove-player seat-icon-btn"
                        aria-label={'Remover ' + q.name}
                        disabled={pending}
                        title={'Remover ' + q.name + ' da sala'}
                        onClick={() => send('remove', { seat: i, version })}
                      >
                        <IconClose />
                      </button>
                    ) : !watching && !q.bot && !q.isHost ? (
                      <button
                        type="button"
                        className="outline remove-player seat-icon-btn"
                        aria-label={'Votar para expulsar ' + q.name}
                        disabled={pending || humanCount < 3 || !!s.banVote}
                        title={
                          humanCount < 3
                            ? 'Requer pelo menos 3 jogadores humanos'
                            : s.banVote
                              ? 'Já existe uma votação em andamento'
                              : 'Abrir votação para expulsar da sala'
                        }
                        onClick={() => send('vote_kick', { targetUid: q.uid, vote: 'yes' })}
                      >
                        <IconBan />
                      </button>
                    ) : null}
                  </div>
                )}
                {s.host && !q && s.players.length < 8 && (
                  <button
                    className="outline add-bot-btn"
                    disabled={pending}
                    onClick={() =>
                      send('add_bot', {
                        version,
                        botDifficulty: s.botDifficulty ?? 'medium',
                      })
                    }
                  >
                    + Adicionar bot
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
