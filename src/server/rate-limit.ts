declare global {
  var pfHits: Map<string, number[]> | undefined;
}
const hits = (globalThis.pfHits ??= new Map<string, number[]>());

// Janela deslizante em memória. shortcut: vale por instância do servidor (serverless pode ter várias), serve como freio básico; para limite global use Redis/Upstash.
export function allow(key: string, max: number, windowMs: number, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000)
    for (const [k, v] of hits) if (now - (v[v.length - 1] ?? 0) > windowMs) hits.delete(k);
  return true;
}
