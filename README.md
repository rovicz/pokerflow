# PokerFlow

Texas Hold’em privado para 2–8 amigos. Apenas fichas virtuais.

## Executar localmente

Requisitos: Node.js 24 LTS (versão local em `.nvmrc`), npm e projeto Supabase. Execute `npm install`, copie `.env.example` para `.env.local`, configure as variáveis do seu projeto, execute `supabase/schema.sql` no SQL Editor e rode `npm run dev`. Valide com `npm test`, `npm run typecheck` e `npm run build`.

Sem `SUPABASE_URL` configurada, `npm run dev` usa um banco em memória (só para desenvolvimento; some ao reiniciar).

## Interface

Visual do [guia de marca Sacflow](https://sacflow.com.br/guia-de-marca-sacflow): SF Brand 500, SF BG Dark/Light, Inter e Behind The Nineties. Animações de cartas e fichas com [Motion](https://motion.dev) (`app/table.js`); sons sintetizados com Web Audio, sem arquivos (`lib/sound.js`), com botão de mudo no cabeçalho. A fonte Behind The Nineties é carregada direto do site da Sacflow; para produção, baixe o ZIP oficial no guia e hospede em `public/fonts`.

## Vercel

Importe o repositório como Next.js, raiz `/`, Node.js 24. Configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente de servidor. Nunca envie a chave ao GitHub ou ao cliente. Produção: https://pokerflow-theta.vercel.app

## Arquitetura

Next.js App Router, API server-side, Supabase PostgreSQL com RLS, motor de poker independente e sincronização em tempo real por Supabase Realtime Broadcast (WebSocket gratuito; o canal leva só um aviso de versão e cada jogador busca o próprio estado), com polling lento de reserva quando `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` não estão definidas. Nunca assine Postgres Changes em `poker_rooms`: o estado guarda o baralho. A sessão é um token aleatório armazenado no navegador. O estado é versionado para evitar atualizações concorrentes.

## Limitações

Protótipo v0.2.0: sem dinheiro real, sem autenticação Supabase, sem rate limiting, sem testes E2E completos. Casos complexos de poker precisam de testes adicionais. O banco não deve ser exposto diretamente ao cliente.

## Robustez

- **Prazos no servidor:** a API resolve jogadas vencidas (desistir/passar) e a próxima mão em toda requisição, então não há "gap" quando alguém perde a vez. O cliente usa o relógio do servidor (`now`) e pede o estado logo após o vencimento. No plano gratuito do Vercel não há timers abaixo de 1 dia, por isso uma sala sem ninguém conectado só avança quando alguém volta.
- **Limpeza:** `vercel.json` agenda `/api/cron/cleanup` (diário) para apagar salas sem atividade há 7 dias. Defina `CRON_SECRET` no Vercel; sem ele o endpoint responde 401.
- **Limites:** 40 requisições/10 s por sessão e 8 criações de mesa/10 min por IP (em memória, por instância).
- **Espectadores:** quem entra com a partida em andamento ou a sala cheia assiste sem ver cartas privadas e pode sentar na sala de espera se abrir lugar. Quem é removido pelo anfitrião é avisado.
- **Segurança:** cabeçalhos e CSP em `next.config.ts`; o canal de tempo real tem nome derivado do código com a chave de serviço (só membros o recebem). O token de sessão continua no `localStorage`.
