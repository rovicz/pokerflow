'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type {
  ActiveStreet,
  HandLogEntry,
  HandRecord,
  Phase,
  PublicState,
} from '../../poker/game-types.ts';
import { IconHistory, MiniCard } from './ui';
import { fmt } from './table';
import { PotBreakdown, seatLabel } from './hand-result';

const STREET_LABEL: Record<ActiveStreet, string> = {
  preflop: 'Pré-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

const PHASE_LABEL: Record<Phase, string> = {
  waiting: 'Aguardando',
  preflop: 'Pré-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  settled: 'Encerrada',
};

function describeAction(e: HandLogEntry): { verb: string; value?: string; tone: string } {
  switch (e.kind) {
    case 'sb':
      return { verb: 'pagou small blind', value: fmt(e.amount), tone: 'blind' };
    case 'bb':
      return { verb: 'pagou big blind', value: fmt(e.amount), tone: 'blind' };
    case 'fold':
      return { verb: e.auto ? 'desistiu (tempo esgotado)' : 'desistiu', tone: 'fold' };
    case 'check':
      return { verb: e.auto ? 'passou (tempo esgotado)' : 'passou a vez', tone: 'check' };
    case 'call':
      return { verb: 'pagou', value: fmt(e.paid ?? e.amount), tone: 'call' };
    case 'raise':
      return { verb: 'aumentou para', value: fmt(e.amount), tone: 'raise' };
    case 'allin':
      return { verb: 'foi ALL-IN com', value: fmt(e.amount), tone: 'allin' };
    case 'street':
      return { verb: STREET_LABEL[e.street], tone: 'street' };
  }
}

function HandReplay({ hand, onBack }: { hand: HandRecord; onBack: () => void }) {
  const [step, setStep] = useState(0);
  const timeline = hand.log ?? [];
  const lastStep = timeline.length;
  const finished = step === lastStep;
  const current = timeline[step];
  const info = current ? describeAction(current) : null;
  const board = finished
    ? hand.board
    : timeline.slice(0, step + 1).flatMap((entry) => entry.cards ?? []);
  return (
    <section className="hand-replay" aria-label={`Replay da mão ${hand.hand}`}>
      <header className="between">
        <h4>Replay da mão {hand.hand}</h4>
        <button type="button" className="text-button" onClick={onBack}>
          Voltar ao histórico
        </button>
      </header>
      <div className="replay-controls">
        <button
          type="button"
          className="outline sm-btn"
          disabled={step === 0}
          onClick={() => setStep(step - 1)}
        >
          Anterior
        </button>
        <span>
          {step + 1} de {lastStep + 1}
        </span>
        <button
          type="button"
          className="outline sm-btn"
          disabled={finished}
          onClick={() => setStep(step + 1)}
        >
          Próximo
        </button>
      </div>
      <div aria-live="polite">
        {info && (
          <p className="replay-action">
            <strong>{current.actor ? `${current.actor} ` : ''}</strong>
            {info.verb}
            {info.value ? ` ${info.value}` : ''}
          </p>
        )}
        {!!board.length && (
          <p className="hh-mini-row">
            {board.map((card) => (
              <MiniCard key={card} c={card} />
            ))}
          </p>
        )}
        {finished && (
          <>
            <p className="replay-action">
              <strong>Resultado da mão</strong>
            </p>
            {hand.pots ? (
              <PotBreakdown hand={hand} />
            ) : (
              <p>
                {hand.winners
                  .map((winner) => `${seatLabel(winner)} ganhou ${fmt(winner.amount)}`)
                  .join(' · ')}
              </p>
            )}
            {hand.showdown?.map((row) => (
              <div key={row.uid ?? row.name} className="hh-sd-row">
                <span className="hh-sd-who">
                  <b>{seatLabel(row)}</b>
                  <small>{row.handName}</small>
                </span>
                <span className="hh-mini-row">
                  {row.cards.map((card) => (
                    <MiniCard key={card} c={card} />
                  ))}
                </span>
              </div>
            ))}
            {!!hand.shown && hand.shown.cards.some((card) => card >= 0) && (
              <div className="hh-sd-row">
                <span className="hh-sd-who">
                  <b>{hand.shown.name}</b>
                  <small>Mostrou na mesa</small>
                </span>
                <span className="hh-mini-row">
                  {hand.shown.cards
                    .filter((card) => card >= 0)
                    .map((card) => (
                      <MiniCard key={card} c={card} />
                    ))}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// Histórico da mesa orientado a leitura instantânea ("Não me faça pensar"):
// - Mobile / retrato: Modal Bottom-Sheet limpo na base.
// - Desktop landscape: Card flutuante elegante acima do botão no canto inferior esquerdo (atalho H).
export default function HandHistory({ s }: { s: PublicState }) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'current' | 'past'>('current');
  const [isSheet, setIsSheet] = useState(false);
  const [replay, setReplay] = useState<HandRecord | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const replayTrigger = useRef<HTMLButtonElement | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);

  const history = [...(s.history ?? [])].reverse();
  const handLog = (s.handLog ?? []).slice(-40);
  const pot =
    s.phase === 'settled' ? (history[0]?.pot ?? 0) : s.players.reduce((sum, p) => sum + p.total, 0);
  const turnPlayer = s.turn >= 0 ? s.players[s.turn] : null;
  const hasPast = history.length > 0;
  const activeView = hasPast ? view : 'current';

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px), (orientation: portrait)');
    const sync = () => setIsSheet(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [open]);

  function closePanel() {
    setOpen(false);
    trigger.current?.focus();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        closePanel();
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        if (open) closePanel();
        else openPanel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, s.phase, hasPast]);

  function closeReplay() {
    setReplay(null);
    requestAnimationFrame(() => {
      if (replayTrigger.current)
        body.current
          ?.querySelector<HTMLButtonElement>(
            `[data-replay="${replayTrigger.current.dataset.replay}"]`,
          )
          ?.focus();
    });
  }

  function openPanel() {
    setReplay(null);
    setView(s.phase === 'settled' && hasPast ? 'past' : 'current');
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        ref={trigger}
        className={'history-fab' + (open ? ' is-open' : '')}
        aria-label="Abrir histórico de mãos"
        aria-expanded={open}
        title="Histórico de mãos (atalho H)"
        onClick={() => (open ? closePanel() : openPanel())}
      >
        <IconHistory />
        <span className="history-fab-label">Histórico</span>
        {hasPast && <span className="history-fab-count">{history.length}</span>}
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
              transition={{ duration: 0.16 }}
              onClick={closePanel}
            />

            <motion.aside
              className={'history-panel' + (isSheet ? ' is-sheet' : ' is-popover')}
              ref={panel}
              onKeyDown={(event) => {
                if (!isSheet || event.key !== 'Tab') return;
                const buttons = [
                  ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    'button:not([disabled])',
                  ),
                ];
                const first = buttons[0];
                const last = buttons.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }}
              role="dialog"
              aria-modal={isSheet ? true : undefined}
              aria-label="Histórico da mesa"
              initial={
                reducedMotion
                  ? false
                  : isSheet
                    ? { y: '100%', opacity: 0.9 }
                    : { y: 14, scale: 0.97, opacity: 0 }
              }
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : isSheet
                    ? { y: '100%', opacity: 0.9 }
                    : { y: 10, scale: 0.97, opacity: 0 }
              }
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {isSheet && <span className="hh-handle" aria-hidden="true" />}

              <header className="hh-head">
                <div className="hh-head-left">
                  <h3>Histórico</h3>
                  <span className="hh-phase-pill">{PHASE_LABEL[s.phase]}</span>
                </div>
                <button
                  type="button"
                  className="hh-close"
                  aria-label="Fechar histórico"
                  onClick={closePanel}
                >
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
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </header>

              {/* Só mostra o seletor quando já existem mãos anteriores — evita ruído na Mão #1 */}
              {hasPast && (
                <div className="hh-tabs" role="tablist" aria-label="Alternar visualização">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeView === 'current'}
                    className={activeView === 'current' ? 'active' : ''}
                    onClick={() => {
                      setReplay(null);
                      setView('current');
                    }}
                  >
                    Mão #{s.hand}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeView === 'past'}
                    className={activeView === 'past' ? 'active' : ''}
                    onClick={() => {
                      setReplay(null);
                      setView('past');
                    }}
                  >
                    Anteriores ({history.length})
                  </button>
                </div>
              )}

              <div className="hh-body" ref={body}>
                {replay ? (
                  <HandReplay key={replay.at} hand={replay} onBack={closeReplay} />
                ) : activeView === 'current' ? (
                  <>
                    {/* Resumo instantâneo da mão atual: bateu o olho, entendeu */}
                    <div className="hh-summary">
                      <div className="hh-summary-top">
                        <span>
                          <b>Mão #{s.hand}</b> · Blinds {s.sb}/{s.bb}
                        </span>
                        <span className="hh-summary-pot">Pote {fmt(pot)}</span>
                      </div>

                      {s.board.length > 0 && (
                        <div className="hh-summary-board">
                          <span className="hh-mini-row">
                            {s.board.map((c) => (
                              <MiniCard key={c} c={c} tone="core" />
                            ))}
                          </span>
                        </div>
                      )}

                      {turnPlayer && s.phase !== 'settled' && (
                        <div className="hh-now">
                          <i className="hh-now-dot" aria-hidden="true" />
                          <span>
                            Agora:{' '}
                            <b>{turnPlayer.self ? 'sua vez' : `vez de ${turnPlayer.name}`}</b>
                          </span>
                        </div>
                      )}
                    </div>

                    {handLog.length === 0 ? (
                      <p className="hh-empty">As jogadas desta mão vão aparecer aqui.</p>
                    ) : (
                      <ol className="hh-timeline">
                        {handLog.map((e) => {
                          if (e.kind === 'street') {
                            return (
                              <li key={e.seq} className="hh-street-row">
                                <span className="hh-street-tag">{STREET_LABEL[e.street]}</span>
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
                          const info = describeAction(e);
                          return (
                            <li key={e.seq} className={'hh-step tone-' + info.tone}>
                              <span className="hh-dot" aria-hidden="true" />
                              <span className="hh-step-txt">
                                <b>{e.actor}</b> {info.verb}
                                {info.value ? (
                                  <strong className="hh-step-val"> {info.value}</strong>
                                ) : null}
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </>
                ) : (
                  <div className="hh-cards">
                    {history.map((rec) => (
                      <article key={rec.hand + '-' + rec.at} className="hh-card">
                        <div className="hh-card-head">
                          <div className="hh-win-headline">
                            <span className="hh-trophy" aria-hidden="true">
                              ★
                            </span>
                            <span className="hh-win-who">
                              {rec.winners.map((w, idx) => (
                                <span key={w.uid ?? w.name}>
                                  {idx > 0 ? ' e ' : ''}
                                  <b>{seatLabel(w)}</b>{' '}
                                  <span className="hh-win-amt">+{fmt(w.amount)}</span>
                                </span>
                              ))}
                            </span>
                          </div>
                          <span className="hh-hand-num">#{rec.hand}</span>
                        </div>

                        <div className="hh-card-meta">
                          <span>
                            {rec.reveal
                              ? (rec.winners[0]?.handName ?? 'Showdown')
                              : 'Todos desistiram'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Pote {fmt(rec.pot)}</span>
                        </div>

                        {rec.board.length > 0 && (
                          <div className="hh-mini-row">
                            {rec.board.map((c) => (
                              <MiniCard key={c} c={c} tone="core" />
                            ))}
                          </div>
                        )}

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
                                key={row.uid ?? row.name}
                                className={'hh-sd-row' + (row.won ? ' is-win' : '')}
                              >
                                <span className="hh-sd-who">
                                  <b>{seatLabel(row)}</b>
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
                        {!!rec.log?.length && (
                          <button
                            type="button"
                            className="outline sm-btn history-replay-button"
                            data-replay={rec.at}
                            onClick={(event) => {
                              replayTrigger.current = event.currentTarget;
                              setReplay(rec);
                              requestAnimationFrame(() => {
                                body.current?.scrollTo(0, 0);
                                body.current?.querySelector<HTMLButtonElement>('button')?.focus();
                              });
                            }}
                          >
                            Rever mão {rec.hand}
                          </button>
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
