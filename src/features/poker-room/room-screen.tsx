'use client';
import { useEffect, useRef, useState } from 'react';
import type { PublicState } from '../../poker/game-types.ts';
import { setMuted, unlock, playTransition, sfx } from './sound';
import { useRoom } from './use-room';
import { useMutedPlayers } from './use-muted-players';
import Topbar from './topbar';
import ChampionDialog from './champion-dialog';
import EntryScreen from './entry-screen';
import LobbyScreen from './lobby-screen';
import GameScreen from './game-screen';

// Coordena a sala: sessão e rede (useRoom), preferências de som, convite, celebração e a tela certa para cada fase.
export default function Page() {
  const { game, error, setError, notice, conn, pending, now, send, sendEmote, leave } = useRoom();
  const { mutedUids, toggleMute: togglePlayerMute } = useMutedPlayers(game?.code);
  const [muted, setMutedState] = useState(false);
  const [emotesMuted, setEmotesMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const prev = useRef<{ code: string; s: PublicState } | null>(null);
  const celebration = useRef<HTMLDialogElement>(null);
  const celebrated = useRef('');

  useEffect(() => {
    const m = localStorage.getItem('pf-mute') === '1';
    setMutedState(m);
    setMuted(m);
    setEmotesMuted(localStorage.getItem('pf-emotes-mute') === '1');
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
  }, []);

  const s = game?.state;
  const inGame = !!s && s.phase !== 'waiting';
  const inLobby = !!s && s.phase === 'waiting';
  const champion =
    s?.phase === 'settled' &&
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
      const ok = window.confirm(
        'Sair da mesa agora? Você desistirá da mão atual e seu assento será liberado.',
      );
      if (!ok) return;
    }
    await leave();
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
      />
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
      {!s ? (
        <EntryScreen
          send={send}
          pending={pending}
          error={error}
          notice={notice}
          setError={setError}
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
