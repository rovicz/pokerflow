'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ActiveStreet, HandLogEntry, PublicState } from '../../poker/game-types.ts';
import { IconHistory, MiniCard } from './ui';
import { fmt } from './table';

const STREET_LABEL: Record<ActiveStreet, string> = {
  preflop: 'Pré-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

function actionLabel(e: HandLogEntry): { text: string; tone: string } {
  switch (e.kind) {
    case 'sb':
      return { text: `Small Blind ${fmt(e.amount)}`, tone: 'blind' };
    case 'bb':
      return { text: `Big Blind ${fmt(e.amount)}`, tone: 'blind' };
    case 'fold':
      return { text: e.auto ? 'Desistiu (tempo)' : 'Desistiu', tone: 'fold' };
    case 'check':
      return { text: e.auto ? 'Passou (tempo)' : 'Passou', tone: 'check' };
    case 'call':
      return { text: `Pagou ${fmt(e.amount)}`, tone: 'call' };
    case 'raise':
      return { text: `Aumentou para ${fmt(e.amount)}`, tone: 'raise' };
    case 'allin':
      return { text: `ALL-IN ${fmt(e.amount)}`, tone: 'allin' };
    case 'street':
      return { text: STREET_LABEL[e.street], tone: 'street' };
  }
}

// Histórico da mesa: Drawer deslizante à esquerda no Desktop (atalho H) e Modal Bottom-Sheet no Mobile.
export default function HandHistory({ s }: { s: PublicState }) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'current' | 'past'>('current');
  const [isMobile, setIsMobile] = useState(false);

  const history = [...(s.history ?? [])].reverse();
  const handLog = s.handLog ?? [];

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 680px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Atalho H para abrir/fechar e Escape para fechar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function openPanel() {
    if (s.phase === 'settled' && history.length > 0) setTab('past');
    else setTab('current');
    setOpen(true);
  }

  return (
    <>
      {/* Botão flutuante no canto inferior esquerdo da mesa (espelha o botão de Emotes à direita) */}
      <button
        type="button"
        className={'history-fab' + (open ? ' is-open' : '')}
        aria-label="Abrir histórico de mãos"
        aria-expanded={open}
        title="Histórico de mãos (atalho H)"
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <IconHistory />
        <span className="history-fab-label">Histórico</span>
        {history.length > 0 && <span className="history-fab-count">{history.length}</span>}
        <kbd className="history-kbd" aria-hidden="true">
          H
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="history-backdrop"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
            />

            <motion.aside
              className="history-panel"
              role="dialog"
              aria-modal={isMobile ? true : undefined}
              aria-label="Histórico de mãos"
              initial={
                reducedMotion
                  ? false
                  : isMobile
                    ? { y: '100%', opacity: 0.9 }
                    : { x: -360, opacity: 0.9 }
              }
              animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : isMobile
                    ? { y: '100%', opacity: 0.9 }
                    : { x: -360, opacity: 0.9 }
              }
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {isMobile && <span className="hh-handle" aria-hidden="true" />}

              <header className="hh-head">
                <div>
                  <div className="hh-title-row">
                    <h3>Histórico da mesa</h3>
                    <span className="hh-sub">
                      Mão #{s.hand} · {s.sb}/{s.bb}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="hh-close"
                  aria-label="Fechar histórico"
                  onClick={() => setOpen(false)}
                >
                  ✕
                </button>
              </header>

              <div className="hh-tabs" role="tablist" aria-label="Visualização do histórico">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'current'}
                  className={tab === 'current' ? 'active' : ''}
                  onClick={() => setTab('current')}
                >
                  Mão atual
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'past'}
                  className={tab === 'past' ? 'active' : ''}
                  onClick={() => setTab('past')}
                >
                  Anteriores ({history.length})
                </button>
              </div>

              <div className="hh-body">
                {tab === 'current' ? (
                  handLog.length === 0 ? (
                    <p className="hh-empty">
                      Nenhuma ação registrada nesta mão ainda. As jogadas aparecem aqui em tempo
                      real.
                    </p>
                  ) : (
                    <ol className="hh-log">
                      {handLog.map((e) => {
                        if (e.kind === 'street') {
                          return (
                            <li key={e.seq} className="hh-street-sep">
                              <span className="hh-street-name">{STREET_LABEL[e.street]}</span>
                              {e.cards && e.cards.length > 0 && (
                                <span className="hh-mini-row">
                                  {e.cards.map((c) => (
                                    <MiniCard key={c} c={c} tone="core" />
                                  ))}
                                </span>
                              )}
                            </li>
                          );
                        }
                        const info = actionLabel(e);
                        return (
                          <li key={e.seq} className="hh-log-row">
                            <span className="hh-actor">{e.actor}</span>
                            <span className={'hh-pill tone-' + info.tone}>{info.text}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )
                ) : history.length === 0 ? (
                  <p className="hh-empty">
                    Nenhuma mão concluída ainda. Assim que uma mão terminar, o resumo aparece aqui.
                  </p>
                ) : (
                  <div className="hh-cards">
                    {history.map((rec) => (
                      <article key={rec.hand + '-' + rec.at} className="hh-card">
                        <div className="hh-card-top">
                          <strong>Mão #{rec.hand}</strong>
                          <span className="hh-pot">Pote {fmt(rec.pot)}</span>
                          <span className={'hh-kind ' + (rec.reveal ? 'is-sd' : 'is-fold')}>
                            {rec.reveal ? 'Showdown' : 'Desistência'}
                          </span>
                        </div>

                        <div className="hh-board-row">
                          {rec.board.length > 0 ? (
                            <span className="hh-mini-row">
                              {rec.board.map((c) => (
                                <MiniCard key={c} c={c} tone="core" />
                              ))}
                            </span>
                          ) : (
                            <small className="hh-preflop-note">Encerrada no pré-flop</small>
                          )}
                        </div>

                        <div className="hh-winners">
                          {rec.winners.map((w) => (
                            <div key={w.name} className="hh-win-line">
                              <span className="hh-trophy" aria-hidden="true">
                                ★
                              </span>
                              <b>{w.name}</b>
                              <span className="hh-win-amt">+{fmt(w.amount)}</span>
                              {w.handName && <small className="hh-win-hand">{w.handName}</small>}
                            </div>
                          ))}
                        </div>

                        {!rec.reveal && rec.shown && rec.shown.cards.some((c) => c >= 0) && (
                          <div className="hh-sd-list">
                            <div className="hh-sd-row is-win">
                              <span className="hh-sd-who">
                                <b>{rec.shown.name}</b>
                                <small>Mostrou na mesa</small>
                              </span>
                              <span className="hh-mini-row">
                                {rec.shown.cards
                                  .filter((c) => c >= 0)
                                  .map((c) => (
                                    <MiniCard key={c} c={c} tone="core" />
                                  ))}
                              </span>
                            </div>
                          </div>
                        )}

                        {rec.reveal && rec.showdown && rec.showdown.length > 0 && (
                          <div className="hh-sd-list">
                            {rec.showdown.map((row) => (
                              <div
                                key={row.name}
                                className={'hh-sd-row' + (row.won ? ' is-win' : '')}
                              >
                                <span className="hh-sd-who">
                                  <b>{row.name}</b>
                                  <small>{row.handName}</small>
                                </span>
                                <span className="hh-mini-row">
                                  {row.cards.map((c) => (
                                    <MiniCard key={c} c={c} tone={row.won ? 'core' : 'kicker'} />
                                  ))}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
