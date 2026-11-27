'use client';
import { useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Assina o canal Broadcast da sala (WebSocket do Supabase Realtime). Chama onPing a cada aviso de mudança.
// Devolve uma ref que indica se o socket está conectado; sem as variáveis NEXT_PUBLIC_* ela fica false e o polling continua.
export function useRoomChannel(code: string | undefined, onPing: () => void) {
  const connected = useRef(false),
    ping = useRef(onPing);
  ping.current = onPing;
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!code || !url || !key) return;
    const client = createClient(url, key, { auth: { persistSession: false } });
    const channel = client
      .channel(`room:${code}`)
      .on('broadcast', { event: 'v' }, () => ping.current())
      .subscribe((status) => {
        connected.current = status === 'SUBSCRIBED';
        if (connected.current) ping.current(); // recupera o que mudou antes de conectar
      });
    return () => {
      connected.current = false;
      void client.removeChannel(channel);
    };
  }, [code]);
  return connected;
}
