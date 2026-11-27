import { createHmac } from 'node:crypto';

// Canal derivado do código com a chave de serviço: só quem está na sala recebe o nome do canal (o código do convite sozinho não basta).
export function roomChannel(code: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.SUPABASE_URL) return undefined;
  return 'room:' + createHmac('sha256', key).update(code).digest('hex').slice(0, 32);
}

// Avisa os clientes que a sala mudou (Supabase Realtime Broadcast, via HTTP).
// O aviso leva só a versão: cada jogador busca o próprio estado projetado e as cartas privadas nunca trafegam no canal.
export async function notifyRoom(code: string, version: number) {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const topic = roomChannel(code);
  if (!url || !key || !topic) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ topic, event: 'v', payload: { version }, private: false }],
      }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Sem o aviso o cliente ainda sincroniza pelo polling de reserva.
  }
}
