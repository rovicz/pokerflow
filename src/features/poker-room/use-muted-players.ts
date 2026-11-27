'use client';
import { useCallback, useEffect, useState } from 'react';

const storageKey = (code: string) => `pf-muted:${code}`;

function readMuted(code: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(code));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// Preferência local por sala: jogadores cujos emotes o usuário optou por silenciar.
export function useMutedPlayers(code: string | undefined) {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    if (!code) {
      setList([]);
      return;
    }
    setList(readMuted(code));
  }, [code]);

  const toggleMute = useCallback(
    (uid: string) => {
      if (!code || !uid) return;
      setList((prev) => {
        const next = prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid];
        try {
          if (next.length) localStorage.setItem(storageKey(code), JSON.stringify(next));
          else localStorage.removeItem(storageKey(code));
        } catch {
          // Ignora erro de quota do localStorage
        }
        return next;
      });
    },
    [code],
  );

  const mutedUids = new Set(list);
  const isMuted = useCallback((uid: string) => list.includes(uid), [list]);

  return { mutedUids, isMuted, toggleMute };
}
