'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { GameOperation } from '../../poker/game-types.ts';
import type { SendExtra } from './use-room.ts';
import { PlayingCard, fmt } from './table';
import { Tip } from './ui';

type Props = {
  send: (op: GameOperation, extra?: SendExtra) => void;
  pending: boolean;
  error: string;
  notice: string;
  setError: (e: string) => void;
};

// Tela de entrada: convite recebido (só entrar) ou começar (criar mesa / entrar com código).
export default function EntryScreen({ send, pending, error, notice, setError }: Props) {
  const reducedMotion = useReducedMotion();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [stack, setStack] = useState(2000);
  const [bb, setBb] = useState(20);
  const [seconds, setSeconds] = useState(30);
  const [mode, setMode] = useState('create');
  const [invited, setInvited] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const inv = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
    setCode(inv);
    setInvited(!!inv);
    setSaved((!inv && localStorage.getItem('pf-room')) || '');
    setName(localStorage.getItem('pf-name') || '');
  }, []);

  function leaveInvite() {
    setInvited(false);
    setCode('');
    setError('');
    history.replaceState(null, '', location.pathname);
  }

  return (
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
                    <button
                      className="primary wide"
                      disabled={pending || !name.trim()}
                      onClick={() => send('create', { name, stack, bb, seconds })}
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
      </section>
      <footer className="landing-foot">
        <span>PokerFlow · Texas Hold’em privado entre amigos</span>
        <span>Apenas fichas virtuais</span>
      </footer>
    </>
  );
}
