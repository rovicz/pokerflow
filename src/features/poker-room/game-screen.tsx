'use client';
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { GameOperation, Hand, Payment, PublicPlayer, Room } from '../../poker/game-types.ts';
import type { EmoteId } from '../../poker/emotes.ts';
import { HAND_RANKINGS, analyzeShowdown, describeHand } from '../../poker/hands.ts';
import type { ActionStatus, SendExtra } from './use-room.ts';
import Table, { fmt } from './table';
import EmotePicker from './emote-picker';
import BanVoteBanner from './ban-vote-banner';
import HandHistory from './hand-history';
import Avatar from './avatar';
import { hasPotDetails, PotBreakdown } from './hand-result';
import { ActionButton, matchesSeat, MiniCard } from './ui';
import { sfx } from './sound';

type Props = {
  game: Room;
  now: number;
  pending: boolean;
  error: string;
  actionStatus: ActionStatus | null;
  retryAction: () => void;
  send: (op: GameOperation, extra?: SendExtra) => void;
  sendEmote: (e: EmoteId) => void;
  emotesMuted: boolean;
  onToggleEmotesMute: () => void;
  mutedUids: Set<string>;
  onTogglePlayerMute: (uid: string) => void;
  onLeave: () => void;
};

// Mesa e dock de controles (ações, aposta, resultado do showdown). Espectadores veem a mesa sem controles.
export default function GameScreen({
  game,
  now,
  pending,
  error,
  actionStatus,
  retryAction,
  send,
  sendEmote,
  emotesMuted,
  onToggleEmotesMute,
  mutedUids,
  onTogglePlayerMute,
  onLeave,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [choice, Choose] = useState({ key: '', amount: 0 });
  const [toast, setToast] = useState('');
  const [openedPots, setOpenedPots] = useState<string | null>(null);
  const potPanelId = useId();
  const s = game.state;
  const watching = s.role === 'spectator';
  const wantsToPlay = !!s.spectators.find((q) => q.self)?.wantsToPlay;
  const p = s.players.find((q) => q.self);
  const mine = !!s.players[s.turn]?.self;
  const live = !['waiting', 'settled'].includes(s.phase);
  const left = s.deadline ? Math.max(0, Math.ceil((s.deadline - now) / 1000)) : 0;
  const pot = s.players.reduce((a, q) => a + q.total, 0) || 0;
  const due = p ? Math.max(0, (s.current || 0) - p.bet) : 0;
  const max = p ? p.bet + p.stack : 0;
  const min = Math.min(max, (s.current || 0) + (s.minRaise || s.bb || 20));
  const actionUnconfirmed = actionStatus === 'checking' || actionStatus === 'retry';
  const canTakeTurn = live && mine && (left > 0 || s.guided);
  const canAct = canTakeTurn && !pending && !actionUnconfirmed;
  const raiseAllowed =
    !!p &&
    s.current != null &&
    s.minRaise != null &&
    max > s.current &&
    (p.actedAt == null || s.current - p.actedAt >= s.minRaise) &&
    s.players.some((q) => !q.self && !q.fold && q.cards?.length && q.stack > 0);
  const canRaise = canAct && raiseAllowed;
  const canAllIn = canAct && (raiseAllowed || (due > 0 && max <= (s.current ?? 0)));
  const key = [game.code, s.hand, s.phase, s.turn, min, max].join('/');
  const amount = choice.key === key ? Math.min(max, Math.max(min, choice.amount)) : min;
  const rangePct =
    max > min ? Math.min(100, Math.max(0, ((amount - min) / (max - min)) * 100)) : 100;
  const nextLeft = Math.max(0, Math.ceil(((s.nextHandAt ?? now) - now) / 1000));
  const readyPlayersCount = s.players.filter(
    (q) => !q.kicked && !q.left && !q.sittingOut && q.stack > 0,
  ).length;
  const remainingChipsCount = s.players.filter((q) => !q.kicked && !q.left && q.stack > 0).length;
  // jogo solo contra bots: o anfitrião pode pular a espera entre as mãos
  const soloVsBots =
    s.players.every((q) => q.self || q.bot || q.kicked || q.left) && s.players.some((q) => q.bot);
  const hasNext = readyPlayersCount >= 2;
  const waitingForAway = !hasNext && remainingChipsCount >= 2;
  const rematchSeats = s.players.filter((q) => !q.kicked && !q.left).length;
  const canShowMuck =
    !watching && s.phase === 'settled' && !s.reveal && !!p && !p.fold && p.cards.length === 2;
  const shownCount = p?.shown?.length ?? 0;
  const awards = new Map<string, Payment>();
  for (const payment of s.result) {
    const id = payment.uid ?? payment.name;
    awards.set(id, { ...payment, amount: (awards.get(id)?.amount ?? 0) + payment.amount });
  }
  const winners = [...awards.values()];
  const hand = s.phase === 'settled' ? s.history?.at(-1) : undefined;
  const handKey = hand && `${game.code}/${hand.hand}/${hand.at}`;
  const potsVisible = !!handKey && openedPots === handKey;
  const potToggle = handKey && hand && hasPotDetails(hand) && (
    <button
      type="button"
      className="outline sm-btn pot-details-toggle"
      aria-expanded={potsVisible}
      aria-controls={potsVisible ? potPanelId : undefined}
      onClick={() => setOpenedPots(potsVisible ? null : handKey)}
    >
      {potsVisible ? 'Ocultar potes' : 'Ver potes'}
    </button>
  );
  const multiplePots = (hand?.pots?.length ?? 0) > 1;
  const waitingSpectators = s.spectators.filter((q) => q.wantsToPlay);
  const choose = (v: number) =>
    Choose({ key, amount: Math.round(Math.min(max, Math.max(min, v))) });
  const timePct = s.seconds ? Math.min(100, (left / s.seconds) * 100) : 0;
  const turnPlayer = live ? s.players[s.turn] : null;
  const showdownRows = s.reveal
    ? s.players
        .filter((q): q is PublicPlayer & { hand: Hand } => q.hand != null)
        .sort((a, b) => b.hand.score - a.hand.score)
    : [];
  const winnerRows = showdownRows.filter((q) => winners.some((w) => matchesSeat(w, q)));
  const mainPot = hand?.pots?.[0];
  const runnerUpRow = showdownRows.find(
    (q) =>
      !winners.some((w) => matchesSeat(w, q)) &&
      (!mainPot || mainPot.eligible.some((seat) => matchesSeat(seat, q))),
  );
  const showdown =
    s.reveal && !multiplePots
      ? analyzeShowdown(winnerRows, runnerUpRow)
      : { headline: '', decisiveIndex: null };
  const winRankSet = new Set(winnerRows.map((q) => q.hand.rank));
  const otherRankSet = new Set(
    showdownRows.filter((q) => !winRankSet.has(q.hand.rank)).map((q) => q.hand.rank),
  );
  const wonPotTotal = winners.reduce((a, w) => a + w.amount, 0);
  const winnerNames = winners.map((w) => w.name).join(' e ');
  const guidedHint = mine
    ? due > 0
      ? `Pague ${fmt(Math.min(due, p?.stack ?? 0))} fichas para continuar. Você também pode aumentar a aposta ou desistir.`
      : 'Passe a vez para continuar sem apostar, ou aposte para colocar mais fichas no pote.'
    : 'O bot está jogando. As cartas comunitárias ficam no centro e todos podem usá-las.';

  useEffect(() => {
    if (mine && live && left > 0 && left <= 5) sfx.tick();
  }, [left, mine, live]);

  // Aviso de resultado da votação de expulsão.
  useEffect(() => {
    const vn = s.voteNotice;
    if (!vn || now - vn.at > 8000) return;
    setToast(
      vn.kind === 'banned'
        ? `${vn.targetName} foi expulso da sala por votação.`
        : vn.kind === 'rejected'
          ? `A votação para expulsar ${vn.targetName} foi rejeitada.`
          : `A votação para expulsar ${vn.targetName} expirou.`,
    );
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [s.voteNotice?.seq]);

  // Aviso de eventos da sala (transferência de anfitrião, saída da mesa).
  useEffect(() => {
    const rn = s.roomNotice;
    if (!rn || now - rn.at > 8000) return;
    setToast(rn.text);
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [s.roomNotice?.seq]);

  useEffect(() => {
    if (actionStatus !== 'expired') return;
    setToast('O turno terminou sem que a sua jogada fosse registrada.');
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [actionStatus]);

  // Atalhos de teclado na vez do jogador (F = Fold, C = Check/Call, R = Raise/Bet, A = All-in)
  useEffect(() => {
    if (!canAct) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (document.querySelector('dialog[open], .history-panel')) return;
      const k = e.key.toLowerCase();
      if (k === 'f') {
        e.preventDefault();
        send('action', { type: 'fold' });
      } else if (k === 'c') {
        e.preventDefault();
        send('action', { type: due ? 'call' : 'check' });
      } else if (k === 'r' && canRaise) {
        e.preventDefault();
        send('action', { type: 'raise', amount });
      } else if (k === 'a' && canAllIn) {
        e.preventDefault();
        send('action', { type: max <= (s.current ?? 0) ? 'call' : 'raise', amount: max });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canAct, canRaise, canAllIn, due, amount, max, s.current]);

  return (
    <div className="arena">
      <div className="table-area">
        <BanVoteBanner
          vote={s.banVote}
          now={now}
          pending={pending}
          onVote={(targetUid, vote) => send('vote_kick', { targetUid, vote })}
        />
        <Table
          s={s}
          pot={pot}
          winners={winners}
          left={left}
          emotesMuted={emotesMuted}
          mutedUids={mutedUids}
          onTogglePlayerMute={onTogglePlayerMute}
          onStartVoteKick={
            !watching ? (targetUid) => send('vote_kick', { targetUid, vote: 'yes' }) : undefined
          }
          onShowCard={canShowMuck ? (idx) => send('show_cards', { indices: [idx] }) : undefined}
          pending={pending}
        />
        {toast && (
          <p className="toast" role="status">
            {toast}
          </p>
        )}
        <HandHistory s={s} />
        {!watching && !s.guided && (
          <EmotePicker onSend={sendEmote} muted={emotesMuted} onToggleMute={onToggleEmotesMute} />
        )}
      </div>

      {watching ? (
        <section className="dock is-waiting spectator-dock">
          <div className="dock-head">
            <div className="dock-status">
              <div className="turn-pill is-other">
                <span className="turn-dot" aria-hidden="true" />
                <strong>
                  {live ? 'Vez de ' + (turnPlayer?.name || '…') : 'Aguardando a próxima mão'}
                </strong>
              </div>
              <div className="dock-metrics">
                <span className="metric">
                  Você está assistindo · Pote <b>{fmt(hand?.pot ?? pot)}</b>
                </span>
              </div>
            </div>
            <div className="dock-head-right">
              {potToggle}
              <button
                type="button"
                className="outline sm-btn"
                aria-pressed={wantsToPlay}
                disabled={pending}
                onClick={() => send('want_to_play', { active: !wantsToPlay })}
              >
                {wantsToPlay ? 'Interesse registrado' : 'Quero jogar a próxima'}
              </button>
              <button type="button" className="outline sm-btn" onClick={onLeave}>
                Sair da sala
              </button>
            </div>
          </div>
          {potsVisible && hand && <PotBreakdown id={potPanelId} hand={hand} />}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      ) : (
        <section
          className={'dock ' + (mine && live ? 'your-turn' : !live ? 'is-settled' : 'is-waiting')}
        >
          {/* Barra superior do Dock: durante a mão = turno + métricas + timer; no showdown = manchete única clara */}
          {live ? (
            <div className="dock-head">
              <div className="dock-status">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mine ? 'mine' : 'turn-' + s.turn}
                    className={'turn-pill ' + (mine ? 'is-mine' : 'is-other')}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    <span className="turn-dot" aria-hidden="true" />
                    <strong>
                      {mine ? 'Sua vez de agir' : 'Vez de ' + (turnPlayer?.name || '…')}
                    </strong>
                  </motion.div>
                </AnimatePresence>

                <div className="dock-metrics">
                  <span className="metric">
                    Fichas <b>{fmt(p?.stack)}</b>
                  </span>
                  <span className="metric-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="metric">
                    Pote <b>{fmt(pot)}</b>
                  </span>
                  {due > 0 && mine && (
                    <>
                      <span className="metric-sep" aria-hidden="true">
                        ·
                      </span>
                      <span className="metric call-due">
                        Para pagar <b>{fmt(Math.min(due, p?.stack ?? 0))}</b>
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="dock-head-right">
                {!p?.sittingOut && !s.guided && (
                  <button
                    type="button"
                    className="outline sm-btn sitout-btn"
                    disabled={pending}
                    onClick={() => send('sit_out', { active: true })}
                  >
                    Ficar ausente
                  </button>
                )}
                {s.guided ? (
                  <span className="metric">Treino sem cronômetro</span>
                ) : (
                  <div className={'timer' + (left <= 5 ? ' urgent' : left <= 10 ? ' warn' : '')}>
                    <div className="timer-row">
                      <small>Tempo</small>
                      <b>{left}s</b>
                    </div>
                    <div className="track">
                      <div style={{ width: timePct + '%' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="dock-head showdown-head">
              <div className="showdown-headline">
                <span className="sh-win">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                  </svg>
                  <strong>{winnerNames || 'Fim da mão'}</strong>
                  {winners.length > 0 && (
                    <span>
                      {multiplePots
                        ? 'receberam ao todo'
                        : winners.length > 1
                          ? 'dividiram'
                          : 'venceu'}{' '}
                      <b>+{fmt(wonPotTotal)}</b>
                    </span>
                  )}
                </span>
                <span className="sh-reason">
                  {multiplePots
                    ? 'Resultado por pote'
                    : showdown.headline || 'Vitória por desistência'}
                </span>
              </div>
              <div className="dock-head-right">
                <span className="metric sh-stack">
                  Suas fichas <b>{fmt(p?.stack)}</b>
                </span>
                {potToggle}
              </div>
            </div>
          )}

          {potsVisible && hand && <PotBreakdown id={potPanelId} hand={hand} />}
          {!live && s.host && waitingSpectators.length > 0 && (
            <div className="game-context">
              <span>
                {waitingSpectators.map((q) => q.name).join(', ')}{' '}
                {waitingSpectators.length === 1 ? 'quer' : 'querem'} jogar a próxima partida.
              </span>
            </div>
          )}
          {s.guided && live && (
            <p className="game-coach" role="status">
              {guidedHint}
            </p>
          )}
          {actionStatus === 'retry' && (
            <div className="game-context" role="status">
              A jogada ainda não aparece na mesa.
              <button
                type="button"
                className="outline sm-btn"
                disabled={pending}
                onClick={retryAction}
              >
                Reenviar a jogada
              </button>
            </div>
          )}
          {/* Barra de estado Ausente (Sit Out) */}
          {p?.sittingOut && (
            <div className="sitout-bar" role="status">
              <span>Você está ausente — pulando as mãos sem perder suas fichas.</span>
              <button
                type="button"
                className="primary sm-btn"
                disabled={pending}
                onClick={() => send('sit_out', { active: false })}
              >
                Voltar para o jogo
              </button>
            </div>
          )}

          {/* Corpo do Dock */}
          <AnimatePresence mode="wait">
            {live ? (
              <motion.div
                key="live-controls"
                className="dock-body"
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
              >
                <div className="actions">
                  <ActionButton
                    label="Desistir"
                    sub="Fold"
                    hotkey="F"
                    kind="fold-btn"
                    desc="Abandone esta mão e preserve suas fichas restantes."
                    disabled={!canAct}
                    onClick={() => send('action', { type: 'fold' })}
                  />
                  <ActionButton
                    label={due ? 'Pagar ' + fmt(Math.min(due, p?.stack ?? 0)) : 'Passar a vez'}
                    sub={due ? 'Call' : 'Check'}
                    hotkey="C"
                    kind="call-btn"
                    desc={
                      due
                        ? 'Iguale a aposta até o limite das suas fichas.'
                        : 'Continue sem colocar fichas no pote.'
                    }
                    disabled={!canAct}
                    onClick={() => send('action', { type: due ? 'call' : 'check' })}
                  />
                  <ActionButton
                    label={(s.current ? 'Aumentar ' : 'Apostar ') + fmt(amount)}
                    sub={s.current ? 'Raise' : 'Bet'}
                    hotkey="R"
                    kind="raise-btn"
                    desc={
                      raiseAllowed
                        ? 'Confirme o valor total selecionado abaixo.'
                        : 'Não é possível aumentar neste momento.'
                    }
                    disabled={!canRaise}
                    onClick={() => send('action', { type: 'raise', amount })}
                  />
                </div>

                <div className={'bet-panel' + (canTakeTurn && raiseAllowed ? '' : ' is-disabled')}>
                  <div className="bet-left">
                    <span className="bet-title">Aposta total </span>
                    <input
                      type="number"
                      aria-label="Valor total da aposta"
                      min={min}
                      max={max}
                      value={amount}
                      disabled={!canRaise}
                      onChange={(e) => choose(+e.target.value)}
                    />
                  </div>

                  <div className="bet-slider-wrap">
                    <input
                      className="range"
                      aria-label="Ajustar aposta"
                      type="range"
                      min={min}
                      max={max}
                      value={amount}
                      disabled={!canRaise}
                      style={{ '--pct': rangePct + '%' } as CSSProperties}
                      onChange={(e) => choose(+e.target.value)}
                    />
                    <div className="range-limits">
                      <span>Mín {fmt(min)}</span>
                      <span>Máx {fmt(max)}</span>
                    </div>
                  </div>

                  <div className="presets">
                    {[
                      ['Mín', min],
                      ['½ pote', (p?.bet ?? 0) + due + Math.ceil((pot + due) / 2)],
                      ['Pote', (p?.bet ?? 0) + due + pot + due],
                      ['Máx', max],
                    ].map(([n, v]) => (
                      <button
                        key={n}
                        type="button"
                        disabled={!canRaise}
                        onClick={() => choose(Number(v))}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="allin"
                      disabled={!canAllIn}
                      onClick={() =>
                        send('action', {
                          type: max <= (s.current ?? 0) ? 'call' : 'raise',
                          amount: max,
                        })
                      }
                    >
                      All-in
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="settled-controls"
                className="dock-end"
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: reducedMotion ? 0 : 0.22 }}
              >
                {s.reveal && showdownRows.length > 0 ? (
                  <>
                    <div className="showdown-grid">
                      {showdownRows.map((q, i) => {
                        const isWinner = winners.some((w) => matchesSeat(w, q));
                        const tied = hand?.pots
                          ? hand.pots.some(
                              (pot) =>
                                pot.awards.length > 1 && pot.awards.some((w) => matchesSeat(w, q)),
                            )
                          : winners.length > 1;
                        const coreCount = q.hand.coreCount ?? 5;
                        const hasTiebreak = showdown.decisiveIndex != null;
                        return (
                          <motion.div
                            key={q.uid}
                            className={'sd-card' + (isWinner ? ' is-winner' : '')}
                            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.25 }}
                          >
                            <div className="sd-who">
                              <Avatar a={q.avatar} name={q.name} size={30} />
                              <div className="sd-meta">
                                <b>
                                  {q.name}
                                  {isWinner && (
                                    <span className="sd-badge">{tied ? 'Empate' : 'Vencedor'}</span>
                                  )}
                                </b>
                                <small>{describeHand(q.hand)}</small>
                              </div>
                            </div>
                            <div
                              className="sd-cards"
                              aria-label={`Sequência de 5 cartas: ${describeHand(q.hand)}`}
                            >
                              {q.hand.cards.map((c, ci) => {
                                const tone = hasTiebreak
                                  ? ci === showdown.decisiveIndex
                                    ? isWinner
                                      ? 'decisive'
                                      : 'compared'
                                    : 'neutral'
                                  : ci < coreCount
                                    ? 'core'
                                    : 'kicker';
                                return <MiniCard key={ci} c={c} tone={tone} />;
                              })}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Régua compacta de força: Mais forte (1º) -> Mais fraca (10º) */}
                    <div
                      className="rank-ruler"
                      role="list"
                      aria-label="Força das mãos de 1º (mais forte) a 10º (mais fraca)"
                    >
                      <span className="ruler-edge">Mais forte</span>
                      <div className="ruler-steps">
                        {HAND_RANKINGS.map((item) => {
                          const isWinR = winRankSet.has(item.rank);
                          const isOtherR = otherRankSet.has(item.rank);
                          const showName = isWinR || isOtherR;
                          return (
                            <span
                              key={item.rank}
                              role="listitem"
                              className={
                                'ruler-step' +
                                (isWinR ? ' is-win-rank' : isOtherR ? ' is-other-rank' : '')
                              }
                            >
                              <i>{item.ordinal}</i>
                              {showName && <span>{item.name}</span>}
                            </span>
                          );
                        })}
                      </div>
                      <span className="ruler-edge">Mais fraca</span>
                    </div>
                  </>
                ) : null}

                {/* Show / Muck opcional quando o jogador vence por desistência */}
                {canShowMuck && (
                  <div className="show-muck-bar">
                    <div className="sm-copy">
                      <strong>
                        {shownCount >= 2
                          ? 'Cartas reveladas na mesa'
                          : shownCount === 1
                            ? '1 carta revelada na mesa'
                            : 'Você venceu sem showdown'}
                      </strong>
                      {shownCount < 2 && (
                        <small>Mostre sua mão ou clique em uma carta para revelar só ela.</small>
                      )}
                    </div>
                    {shownCount < 2 ? (
                      <button
                        type="button"
                        className="outline sm-btn show-cards-btn"
                        disabled={pending}
                        onClick={() => send('show_cards', { indices: [0, 1] })}
                      >
                        {shownCount === 1 ? 'Mostrar a outra' : 'Mostrar cartas'}
                      </button>
                    ) : (
                      <span className="sm-done-tag">✓ Reveladas</span>
                    )}
                  </div>
                )}

                <div className="end-footer">
                  {s.guided ? (
                    <>
                      <span className="end-note">
                        Treino concluído.{' '}
                        {s.reveal
                          ? 'As cinco cartas destacadas formam cada mão.'
                          : 'Ao desistir, você deixa de disputar o pote.'}
                      </span>
                      <div className="end-footer-btns">
                        <button
                          type="button"
                          className="outline sm-btn"
                          disabled={pending}
                          onClick={() => send('rematch', { mode: 'start' })}
                        >
                          Treinar outra mão
                        </button>
                        <button
                          type="button"
                          className="primary sm-btn"
                          disabled={pending}
                          onClick={() =>
                            send('create', { name: p?.name, bots: 1, botDifficulty: 'easy' })
                          }
                        >
                          Jogar contra bots
                        </button>
                      </div>
                    </>
                  ) : waitingForAway ? (
                    <span className="end-note">
                      Aguardando jogadores ausentes voltarem para iniciar a próxima mão…
                    </span>
                  ) : !hasNext ? (
                    <>
                      <span className="end-note">
                        {s.host
                          ? 'Partida encerrada · Inicie uma revanche com os mesmos jogadores.'
                          : 'Partida encerrada · Aguardando o anfitrião iniciar a revanche…'}
                      </span>
                      {s.host && (
                        <div className="rematch-actions">
                          {rematchSeats >= 2 && (
                            <button
                              type="button"
                              className="primary sm-btn"
                              disabled={pending}
                              onClick={() => send('rematch', { mode: 'start' })}
                            >
                              Revanche agora ↻
                            </button>
                          )}
                          <button
                            type="button"
                            className="outline sm-btn"
                            disabled={pending}
                            onClick={() => send('rematch', { mode: 'lobby' })}
                          >
                            Voltar ao Lobby
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="end-note">
                        {s.pausedFor != null ? (
                          'Intervalo pausado pelo anfitrião'
                        ) : s.nextHandAt == null ? (
                          'Preparando próxima mão…'
                        ) : nextLeft ? (
                          <>
                            Próxima mão em <b>{nextLeft}s</b>
                          </>
                        ) : (
                          'Distribuindo a próxima mão…'
                        )}
                      </span>
                      <div className="end-footer-btns">
                        {!p?.sittingOut && (
                          <button
                            type="button"
                            className="outline sm-btn sitout-btn"
                            disabled={pending}
                            onClick={() => send('sit_out', { active: true })}
                          >
                            Ficar ausente
                          </button>
                        )}
                        {s.host && soloVsBots && (
                          <button
                            type="button"
                            className="primary sm-btn"
                            disabled={pending}
                            onClick={() => send('interval', { type: 'skip' })}
                          >
                            Próxima mão agora
                          </button>
                        )}
                        {s.host && (
                          <button
                            type="button"
                            className="outline sm-btn"
                            disabled={pending || (s.pausedFor == null && !nextLeft)}
                            onClick={() =>
                              send('interval', { type: s.pausedFor != null ? 'resume' : 'pause' })
                            }
                          >
                            {s.pausedFor != null ? 'Retomar contagem' : 'Pausar intervalo'}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
