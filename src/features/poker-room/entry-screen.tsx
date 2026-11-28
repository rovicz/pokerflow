'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { BlindMode, BotDifficulty, GameOperation } from '../../poker/game-types.ts';
import { BOT_DIFFICULTIES, BOT_DIFFICULTY_LABELS } from '../../poker/bot-ai.ts';
import {
  BLIND_HAND_INTERVALS,
  BLIND_TIME_INTERVALS,
  previewBlindLevels,
} from '../../poker/blinds.ts';
import type { SendExtra } from './use-room.ts';
import { PlayingCard, fmt } from './table';
import { Tip } from './ui';
import HomeLeaderboard from './home-leaderboard';
import type { LeaderboardRow } from '../../poker/leaderboard.ts';
import { useAuth } from '../auth/use-auth';

type Props = {
  send: (op: GameOperation, extra?: SendExtra) => void;
  pending: boolean;
  error: string;
  notice: string;
  setError: (e: string) => void;
  onOpenAuth?: (view?: 'login' | 'register') => void;
  initialLeaderboard?: LeaderboardRow[] | null;
};

// Tela de entrada: convite recebido (só entrar) ou começar (criar mesa / entrar com código).
export default function EntryScreen({
  send,
  pending,
  error,
  notice,
  setError,
  onOpenAuth,
  initialLeaderboard = null,
}: Props) {
  const reducedMotion = useReducedMotion();
  const { enabled: authEnabled, user, profile } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [stack, setStack] = useState(2000);
  const [bb, setBb] = useState(20);
  const [seconds, setSeconds] = useState(30);
  const [botCount, setBotCount] = useState(3);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('medium');
  const [blindsMode, setBlindsMode] = useState<BlindMode>('fixed');
  const [blindsEvery, setBlindsEvery] = useState(8);
  const [mode, setMode] = useState<'create' | 'bots' | 'join'>('create');
  const previewLevels = previewBlindLevels(bb, 4);

  function selectBlindsMode(next: BlindMode) {
    setBlindsMode(next);
    if (next === 'hands' && !(BLIND_HAND_INTERVALS as readonly number[]).includes(blindsEvery)) {
      setBlindsEvery(8);
    } else if (
      next === 'time' &&
      !(BLIND_TIME_INTERVALS as readonly number[]).includes(blindsEvery)
    ) {
      setBlindsEvery(300);
    }
  }

  const tournamentControl = (
    <div className="tourney-box">
      <div className="between">
        <span className="field-lbl">
          Blinds{' '}
          <Tip text="No modo torneio, os blinds sobem periodicamente entre mãos para dar ritmo à partida.">
            ⓘ
          </Tip>
        </span>
        <div className="tourney-toggle" role="radiogroup" aria-label="Estrutura de blinds">
          <button
            type="button"
            role="radio"
            aria-checked={blindsMode === 'fixed'}
            className={blindsMode === 'fixed' ? 'on' : ''}
            onClick={() => selectBlindsMode('fixed')}
          >
            Fixos
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={blindsMode !== 'fixed'}
            className={blindsMode !== 'fixed' ? 'on' : ''}
            onClick={() => selectBlindsMode(blindsMode === 'fixed' ? 'hands' : blindsMode)}
          >
            Torneio
          </button>
        </div>
      </div>

      {blindsMode !== 'fixed' && (
        <div className="tourney-opts">
          <div className="tourney-row">
            <div className="tourney-mini-seg" role="radiogroup" aria-label="Critério de subida">
              <button
                type="button"
                role="radio"
                aria-checked={blindsMode === 'hands'}
                className={blindsMode === 'hands' ? 'on' : ''}
                onClick={() => selectBlindsMode('hands')}
              >
                Por mãos
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={blindsMode === 'time'}
                className={blindsMode === 'time' ? 'on' : ''}
                onClick={() => selectBlindsMode('time')}
              >
                Por tempo
              </button>
            </div>
            <div className="tourney-pills" role="radiogroup" aria-label="Ritmo de subida">
              {(blindsMode === 'hands' ? BLIND_HAND_INTERVALS : BLIND_TIME_INTERVALS).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={blindsEvery === v}
                  className={blindsEvery === v ? 'on' : ''}
                  onClick={() => setBlindsEvery(v)}
                >
                  {blindsMode === 'hands' ? `${v} mãos` : `${v / 60} min`}
                </button>
              ))}
            </div>
          </div>
          <div className="tourney-preview">
            {previewLevels.map((lv, i) => (
              <span key={i}>
                {i > 0 && <i aria-hidden="true">→</i>}
                <b>
                  {lv.sb}/{lv.bb}
                </b>
              </span>
            ))}
            <span>…</span>
          </div>
        </div>
      )}
    </div>
  );
  const [invited, setInvited] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const inv = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
    setCode(inv);
    setInvited(!!inv);
    setSaved((!inv && localStorage.getItem('pf-room')) || '');
    setName(localStorage.getItem('pf-name') || '');
  }, []);

  useEffect(() => {
    if (profile?.display_name) setName((cur) => cur || profile.display_name);
  }, [profile?.display_name]);

  function leaveInvite() {
    setInvited(false);
    setCode('');
    setError('');
    history.replaceState(null, '', location.pathname);
  }

  return (
    <>
      <section className={'landing' + (!invited ? ' has-leaderboard' : '')}>
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
          <div className="hero-meta">
            <div className="hero-cards">
              <PlayingCard c={12} className="lg" tilt={-5} />
              <PlayingCard c={25} className="lg" tilt={5} />
            </div>
            <div className="tags">
              <span>02–08 jogadores</span>
              <span>Texas Hold’em</span>
              <span>Fichas virtuais</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="panel entry"
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
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
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && name.trim() && !pending && send('join', { code, name })
                  }
                />
              </label>
              <button
                className="primary wide"
                disabled={pending || !name.trim()}
                onClick={() => send('join', { code, name })}
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
                    onClick={() => send('join', { code: saved, name })}
                  >
                    Voltar à mesa →
                  </button>
                </div>
              )}
              <div className="eyebrow">Começar</div>
              <h2>Entre no clube</h2>
              {authEnabled && !user && onOpenAuth && (
                <p className="auth-entry-hint">
                  Jogue como convidado ou{' '}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onOpenAuth('register')}
                  >
                    crie sua conta
                  </button>{' '}
                  para salvar seu perfil.
                </p>
              )}
              <label>
                Seu apelido
                <input
                  placeholder="Como seus amigos te chamam?"
                  maxLength={24}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <div className="seg" role="tablist" aria-label="O que você quer fazer?">
                <button
                  role="tab"
                  aria-selected={mode === 'create'}
                  className={mode === 'create' ? 'on' : ''}
                  onClick={() => {
                    setMode('create');
                    setError('');
                  }}
                >
                  Criar mesa
                </button>
                <button
                  role="tab"
                  aria-selected={mode === 'bots'}
                  className={mode === 'bots' ? 'on' : ''}
                  onClick={() => {
                    setMode('bots');
                    setError('');
                  }}
                >
                  Contra bots
                </button>
                <button
                  role="tab"
                  aria-selected={mode === 'join'}
                  className={mode === 'join' ? 'on' : ''}
                  onClick={() => {
                    setMode('join');
                    setError('');
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
                        <select value={stack} onChange={(e) => setStack(+e.target.value)}>
                          {[1000, 2000, 5000, 10000].map((v) => (
                            <option key={v} value={v}>
                              {fmt(v)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Big blind <Tip text="A maior aposta obrigatória antes do flop.">ⓘ</Tip>
                        <select value={bb} onChange={(e) => setBb(+e.target.value)}>
                          {[10, 20, 50, 100].map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Tempo
                        <select value={seconds} onChange={(e) => setSeconds(+e.target.value)}>
                          {[15, 30, 45, 60].map((v) => (
                            <option key={v} value={v}>
                              {v}s
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {tournamentControl}
                    <button
                      className="primary wide"
                      disabled={pending || !name.trim()}
                      onClick={() =>
                        send('create', {
                          name,
                          stack,
                          bb,
                          seconds,
                          blindsMode,
                          ...(blindsMode !== 'fixed' ? { blindsEvery } : {}),
                        })
                      }
                    >
                      Criar mesa privada →
                    </button>
                    <p className="step">
                      Depois de criar, você recebe um link para convidar seus amigos.
                    </p>
                  </motion.div>
                ) : mode === 'bots' ? (
                  <motion.div
                    key="bots"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className="bot-picker-row">
                      <div className="between">
                        <span className="field-lbl">Quantidade de bots</span>
                        <small className="bot-total-note">
                          Você + {botCount} {botCount === 1 ? 'bot' : 'bots'} ({botCount + 1}/8)
                        </small>
                      </div>
                      <div
                        className="bot-count-pills"
                        role="radiogroup"
                        aria-label="Quantidade de bots"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={botCount === n}
                            className={botCount === n ? 'on' : ''}
                            onClick={() => setBotCount(n)}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="fields bot-fields">
                      <label>
                        Dificuldade
                        <select
                          value={botDifficulty}
                          onChange={(e) => setBotDifficulty(e.target.value as BotDifficulty)}
                        >
                          {BOT_DIFFICULTIES.map((d) => (
                            <option key={d} value={d}>
                              {BOT_DIFFICULTY_LABELS[d]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Fichas
                        <select value={stack} onChange={(e) => setStack(+e.target.value)}>
                          {[1000, 2000, 5000, 10000].map((v) => (
                            <option key={v} value={v}>
                              {fmt(v)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Big blind <Tip text="A maior aposta obrigatória antes do flop.">ⓘ</Tip>
                        <select value={bb} onChange={(e) => setBb(+e.target.value)}>
                          {[10, 20, 50, 100].map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {tournamentControl}
                    <button
                      className="primary wide"
                      disabled={pending || !name.trim()}
                      onClick={() =>
                        send('create', {
                          name,
                          stack,
                          bb,
                          seconds,
                          bots: botCount,
                          botDifficulty,
                          blindsMode,
                          ...(blindsMode !== 'fixed' ? { blindsEvery } : {}),
                        })
                      }
                    >
                      Criar mesa com bots →
                    </button>
                    <p className="step">
                      Os bots entram no Lobby com você — personalize seu avatar ou convide amigos
                      antes de começar.
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
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) =>
                          e.key === 'Enter' &&
                          code.trim() &&
                          name.trim() &&
                          !pending &&
                          send('join', { code, name })
                        }
                      />
                    </label>
                    <button
                      className="primary wide"
                      disabled={pending || !code.trim() || !name.trim()}
                      onClick={() => send('join', { code, name })}
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
        {!invited && <HomeLeaderboard initialRows={initialLeaderboard} />}
      </section>
      <footer className="landing-foot">
        <span>PokerFlow · Texas Hold’em privado entre amigos</span>
        <span>Apenas fichas virtuais</span>
      </footer>
    </>
  );
}
