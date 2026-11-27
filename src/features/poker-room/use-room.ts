'use client';
import { useEffect, useRef, useState } from 'react';
import type { BlindMode, BotDifficulty, GameOperation, Room } from '../../poker/game-types.ts';
import type { AvatarStyle } from '../../poker/avatars.ts';
import type { EmoteId } from '../../poker/emotes.ts';
import { useRoomChannel } from './use-room-channel.ts';

export type SendExtra = {
  code?: string;
  name?: string;
  stack?: number;
  bb?: number;
  seconds?: number;
  bots?: number;
  botDifficulty?: BotDifficulty;
  blindsMode?: BlindMode;
  blindsEvery?: number;
  version?: number;
  type?: string;
  amount?: number;
  seat?: number;
  targetUid?: string;
  vote?: 'yes' | 'no';
  indices?: number[];
  mode?: 'start' | 'lobby';
  active?: boolean;
  avatar?: { style: AvatarStyle; seed: string };
};
export type Connection = 'ok' | 'offline';

const newToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, '0'),
  ).join('');
const errorOf = (body: unknown, fallback: string) =>
  body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
    ? body.error
    : fallback;

// Tudo o que fala com o servidor: sessão, envio de operações, sincronização em tempo real, relógio do servidor e estados de erro.
export function useRoom() {
  const [game, G] = useState<Room | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, P] = useState(false);
  const [conn, setConn] = useState<Connection>('ok');
  const [now, T] = useState(Date.now());
  const token = useRef('');
  const latest = useRef<Room | null>(null);
  const mutating = useRef(false);
  const polling = useRef(false);
  const again = useRef(false);
  const epoch = useRef(0);
  const offset = useRef(0); // relógio do servidor − relógio local
  const failures = useRef(0);
  const coolUntil = useRef(0);
  const asked = useRef(0);

  useEffect(() => {
    let t = localStorage.getItem('pf-token');
    if (!t) {
      t = newToken();
      localStorage.setItem('pf-token', t);
    }
    token.current = t;
    const timer = setInterval(() => T(Date.now() + offset.current), 200);
    return () => clearInterval(timer);
  }, []);

  function exit(message = '') {
    history.replaceState(null, '', location.pathname);
    epoch.current++;
    latest.current = null;
    G(null);
    setError('');
    setNotice(message);
    setConn('ok');
    failures.current = 0;
    localStorage.removeItem('pf-room');
  }

  async function send(op: GameOperation, extra: SendExtra = {}, quiet = false) {
    if (
      !token.current ||
      mutating.current ||
      (quiet && (polling.current || Date.now() < coolUntil.current))
    )
      return;
    const ep = epoch.current,
      prevGame = latest.current,
      t0 = Date.now();
    if (quiet) polling.current = true;
    else {
      mutating.current = true;
      P(true);
      setError('');
    }
    try {
      const r = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op,
          token: token.current,
          code: prevGame?.code,
          version: prevGame?.version,
          ...extra,
        }),
      });
      const body: unknown = await r.json().catch(() => null);
      failures.current = 0;
      setConn('ok');
      if (ep !== epoch.current) return;
      if (r.status === 429) {
        coolUntil.current = Date.now() + 3000; // respeita o limite do servidor
        if (!quiet) setError(errorOf(body, 'Muitas requisições. Aguarde alguns segundos.'));
        return;
      }
      if (prevGame && op === 'state') {
        if (r.status === 404)
          return exit('Esta sala não existe mais. Ela pode ter expirado por inatividade.');
        if (r.status === 403)
          return exit(
            body && typeof body === 'object' && 'banned' in body && body.banned
              ? 'Você foi expulso desta sala por votação.'
              : body && typeof body === 'object' && 'removed' in body
                ? 'Você foi removido da sala pelo anfitrião.'
                : 'Você não está mais nesta sala.',
          );
      }
      if (!r.ok) throw Error(errorOf(body, 'Não foi possível concluir.'));
      const x = body as Room;
      if (latest.current?.code === x.code && latest.current.version > x.version) return;
      if (typeof x.now === 'number') offset.current = x.now - (t0 + (Date.now() - t0) / 2);
      latest.current = x;
      G(x);
      localStorage.setItem('pf-room', x.code);
      if (extra.name) localStorage.setItem('pf-name', extra.name);
    } catch (e) {
      if (e instanceof TypeError) {
        // falha de rede (fetch rejeitado): sinaliza depois de duas tentativas seguidas
        if (++failures.current >= 2) setConn('offline');
        if (!quiet && ep === epoch.current)
          setError('Sem conexão com o servidor. Verifique sua internet e tente de novo.');
      } else if (!quiet && ep === epoch.current)
        setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
    } finally {
      if (quiet) polling.current = false;
      else {
        mutating.current = false;
        P(false);
      }
      if (again.current) {
        again.current = false;
        void send('state', {}, true);
      }
    }
  }

  // Aviso do canal em tempo real: busca o estado agora (ou logo após a chamada em andamento).
  const socket = useRoomChannel(game?.channel, () => {
    if (mutating.current || polling.current) again.current = true;
    else void send('state', {}, true);
  });

  // Sincronização: com o socket conectado o polling vira reserva (10 s). O servidor resolve prazos vencidos
  // ao receber qualquer requisição, então basta pedir o estado logo depois do vencimento (sem "gap" de vez).
  useEffect(() => {
    if (!game) return;
    let n = 0;
    const onVisible = () => document.visibilityState === 'visible' && void send('state', {}, true);
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => {
      const g = latest.current;
      if (!g) return;
      const t = Date.now() + offset.current;
      const s = g.state;
      const dueCandidates = [
        s.botActAt,
        s.deadline,
        s.banVote?.expiresAt,
        s.phase === 'settled' &&
        s.pausedFor == null &&
        s.players.filter((q) => !q.kicked && !q.left && !q.sittingOut && q.stack > 0).length >= 2
          ? s.nextHandAt
          : null,
      ].filter((v): v is number => typeof v === 'number');
      const due = dueCandidates.length ? Math.min(...dueCandidates) : null;
      if (!socket.current || ++n % 20 === 0) void send('state', {}, true);
      else if (due != null && t >= due + 80 && Date.now() - asked.current > 450) {
        asked.current = Date.now();
        void send('state', {}, true);
      }
    }, 500);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [!!game]);

  async function sendEmote(emote: EmoteId) {
    const cur = latest.current;
    if (!token.current || !cur) return;
    const ep = epoch.current;
    try {
      const r = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'emote', token: token.current, code: cur.code, emote }),
      });
      if (!r.ok) return;
      const x = (await r.json()) as Room;
      if (
        ep !== epoch.current ||
        (latest.current?.code === x.code && latest.current.version > x.version)
      )
        return;
      latest.current = x;
      G(x);
    } catch {
      // Falha silenciosa em rede instável para não interromper o jogo
    }
  }

  // Jogador ou espectador avisa o servidor ao sair (transfere anfitrião e libera o assento com segurança).
  async function leave() {
    const cur = latest.current;
    if (cur && token.current) {
      try {
        await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            op: 'leave',
            token: token.current,
            code: cur.code,
            version: cur.version,
          }),
        });
      } catch {
        // Sai localmente mesmo sem rede
      }
    }
    exit();
  }

  return {
    game,
    error,
    setError,
    notice,
    setNotice,
    conn,
    pending,
    now,
    send,
    sendEmote,
    exit,
    leave,
  };
}
