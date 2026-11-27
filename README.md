# PokerFlow

Texas Hold’em privado para 2–8 amigos. Apenas fichas virtuais.

## Executar localmente

Requisitos: Node.js 22, npm e projeto Supabase. Execute `npm install`, copie `.env.example` para `.env.local`, configure as variáveis do seu projeto, execute `supabase/schema.sql` no SQL Editor e rode `npm run dev`. Testes: `npm test`. Build: `npm run build`.

## Vercel

Importe o repositório como Next.js, raiz `/`, Node.js 22. Configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente de servidor. Nunca envie a chave ao GitHub ou ao cliente. Produção: https://pokerflow-theta.vercel.app

## Arquitetura

Next.js App Router, API server-side, Supabase PostgreSQL com RLS, motor de poker independente e sincronização por polling de 1,5s. A sessão é um token aleatório armazenado no navegador. O estado é versionado para evitar atualizações concorrentes.

## Limitações

Protótipo v0.2.0: sem dinheiro real, sem autenticação Supabase, sem Realtime, sem rate limiting, sem testes E2E completos. Casos complexos de poker precisam de testes adicionais. O banco não deve ser exposto diretamente ao cliente.
