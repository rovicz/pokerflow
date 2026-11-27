// Avisa os clientes que a sala mudou (Supabase Realtime Broadcast, via HTTP).
// O aviso leva só a versão: cada jogador busca o próprio estado projetado e as cartas privadas nunca trafegam no canal.
export async function notifyRoom(code: string, version: number) {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ topic: `room:${code}`, event: 'v', payload: { version }, private: false }],
      }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Sem o aviso o cliente ainda sincroniza pelo polling de reserva.
  }
}
