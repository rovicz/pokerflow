'use client';
import './room-extras.css';
import { useEffect, useRef, useState } from 'react';
import type { LeaderboardRow } from '../../poker/leaderboard.ts';
import type { PublicState } from '../../poker/game-types.ts';
import { setMuted, unlock, playTransition, sfx } from './sound';
import { useRoom } from './use-room';
import { useMutedPlayers } from './use-muted-players';
import Topbar from './topbar';
import ChampionDialog from './champion-dialog';
import AuthModal from '../auth/auth-modal';
import EntryScreen from './entry-screen';
import LobbyScreen from './lobby-screen';
import GameScreen from './game-screen';

// Coordena a sala: sessão e rede (useRoom), preferências de som, convite, celebração e a tela certa para cada fase.
export default function Page({
  initialLeaderboard = null,
}: {
  initialLeaderboard?: LeaderboardRow[] | null;
}) {
  const {
    game,
    error,
    setError,
    notice,
    setNotice,
    conn,
    pending,
    actionStatus,
    retryAction,
    now,
    send,
    sendEmote,
    leave,
  } = useRoom();
  const { mutedUids, toggleMute: togglePlayerMute } = useMutedPlayers(game?.code);
  const [muted, setMutedState] = useState(false);
  const [emotesMuted, setEmotesMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const prev = useRef<{ code: string; s: PublicState } | null>(null);
  const celebration = useRef<HTMLDialogElement>(null);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const authDialog = useRef<HTMLDialogElement>(null);
  const celebrated = useRef('');

  useEffect(() => {
    const m = localStorage.getItem('pf-mute') === '1';
    setMutedState(m);
    setMuted(m);
    setEmotesMuted(localStorage.getItem('pf-emotes-mute') === '1');
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });

    const params = new URLSearchParams(location.search);
    const authStatus = params.get('auth');
    if (authStatus) {
      if (authStatus === 'confirmed') {
        setNotice('E-mail confirmado! Sua conta PokerFlow está ativa.');
      } else if (authStatus === 'expired') {
        setNotice('O link de confirmação expirou. Tente entrar e reenviar um novo e-mail.');
      } else if (authStatus === 'invalid') {
        setNotice('Link de confirmação inválido.');
      }
      params.delete('auth');
      const qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    }
  }, []);

  function openAuth(view: 'login' | 'register' = 'login') {
    setAuthView(view);
    authDialog.current?.showModal();
  }

  const s = game?.state;
  const inGame = !!s && s.phase !== 'waiting';
  const inLobby = !!s && s.phase === 'waiting';
  const champion =
    s?.phase === 'settled' &&
    !s.guided &&
    s.players.filter((q) => !q.kicked && !q.left && q.stack > 0).length === 1
      ? s.players.find((q) => !q.kicked && !q.left && q.stack > 0)
      : null;
  const rematchSeats = s ? s.players.filter((q) => !q.kicked && !q.left).length : 0;

  useEffect(() => {
    if (!champion || !game || !s) {
      if (celebration.current?.open) celebration.current.close();
      celebrated.current = '';
      return;
    }
    const ckey = game.code + '/' + s.hand;
    if (celebrated.current === ckey) return;
    celebrated.current = ckey;
    celebration.current?.showModal();
    sfx.champion();
  }, [game?.code, s?.hand, !!champion]);

  useEffect(() => {
    if (!game) {
      prev.current = null;
      return;
    }
    const a = prev.current;
    prev.current = { code: game.code, s: game.state };
    if (a && a.code === game.code) playTransition(a.s, game.state);
  }, [game]);

  function toggleMute() {
    const m = !muted;
    setMutedState(m);
    setMuted(m);
    localStorage.setItem('pf-mute', m ? '1' : '0');
    if (!m) sfx.chip();
  }

  function toggleEmotesMute() {
    const m = !emotesMuted;
    setEmotesMuted(m);
    localStorage.setItem('pf-emotes-mute', m ? '1' : '0');
  }

  async function invite() {
    if (!game) return;
    try {
      await navigator.clipboard.writeText(location.origin + '/?room=' + game.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copie o código da sala para compartilhar.');
    }
  }

  async function handleExit() {
    const me = s?.players.find((q) => q.self);
    const liveHand = !!s && !['waiting', 'settled'].includes(s.phase);
    if (me && liveHand && !me.fold) {
      leaveDialog.current?.showModal();
      return;
    }
    await leave();
  }

  async function confirmExit() {
    leaveDialog.current?.close();
    await leave();
  }

  function sitOutInstead() {
    leaveDialog.current?.close();
    send('sit_out', { active: true });
  }

  return (
    <main className={inGame ? 'in-game' : inLobby ? 'in-lobby' : 'in-landing'}>
      <Topbar
        s={s ?? null}
        code={game?.code}
        now={now}
        muted={muted}
        onToggleMute={toggleMute}
        copied={copied}
        onInvite={invite}
        onExit={handleExit}
        onOpenAuth={openAuth}
      />
      <AuthModal dialogRef={authDialog} initialView={authView} />
      {conn === 'offline' && (
        <p className="conn-banner" role="status">
          Sem conexão. Tentando reconectar…
        </p>
      )}
      <ChampionDialog
        celebration={celebration}
        champion={champion}
        hand={s?.hand}
        isHost={!!s?.host}
        pending={pending}
        canStartImmediately={rematchSeats >= 2}
        onRematch={(mode) => send('rematch', { mode })}
      />
      <dialog
        ref={leaveDialog}
        className="modal leave-modal"
        aria-labelledby="leave-modal-title"
        onClick={(e) => e.target === leaveDialog.current && leaveDialog.current?.close()}
      >
        <div className="lm-head">
          <span className="lm-ico" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span>
          <div>
            <h2 id="leave-modal-title">Sair da mesa agora?</h2>
            <p className="lm-desc">
              Você desistirá da mão atual e seu assento será liberado.
              {s?.host && ' O cargo de anfitrião será transferido automaticamente.'}
            </p>
          </div>
        </div>
        <div className="lm-actions">
          <button
            type="button"
            className="primary"
            autoFocus
            onClick={() => leaveDialog.current?.close()}
          >
            Continuar jogando
          </button>
          {!s?.guided && !s?.players.find((q) => q.self)?.sittingOut && (
            <button type="button" className="outline lm-away" onClick={sitOutInstead}>
              Ficar ausente
            </button>
          )}
          <button type="button" className="lm-danger" onClick={confirmExit}>
            Sair da mesa
          </button>
        </div>
      </dialog>
      {!s ? (
        <EntryScreen
          send={send}
          pending={pending}
          error={error}
          notice={notice}
          setError={setError}
          onOpenAuth={openAuth}
          initialLeaderboard={initialLeaderboard}
        />
      ) : inLobby && game ? (
        <LobbyScreen
          s={s}
          code={game.code}
          version={game.version}
          now={now}
          pending={pending}
          error={error}
          copied={copied}
          invite={invite}
          send={send}
          mutedUids={mutedUids}
          onTogglePlayerMute={togglePlayerMute}
        />
      ) : game ? (
        <GameScreen
          game={game}
          now={now}
          pending={pending}
          error={error}
          send={send}
          sendEmote={sendEmote}
          actionStatus={actionStatus}
          retryAction={retryAction}
          emotesMuted={emotesMuted}
          onToggleEmotesMute={toggleEmotesMute}
          mutedUids={mutedUids}
          onTogglePlayerMute={togglePlayerMute}
          onLeave={leave}
        />
      ) : null}
    </main>
  );
}
