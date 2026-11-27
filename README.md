# PokerFlow

Texas Hold’em privado para 2–8 amigos. Apenas fichas virtuais.

## Executar localmente

Requisitos: Node.js 22, npm e projeto Supabase. Execute `npm install`, copie `.env.example` para `.env.local`, configure as variáveis do seu projeto, execute `supabase/schema.sql` no SQL Editor e rode `npm run dev`. Testes: `npm test`. Build: `npm run build`.

Sem `SUPABASE_URL` configurada, `npm run dev` usa um banco em memória (só para desenvolvimento; some ao reiniciar).

## Interface

Visual do [guia de marca Sacflow](https://sacflow.com.br/guia-de-marca-sacflow): SF Brand 500, SF BG Dark/Light, Inter e Behind The Nineties. Animações de cartas e fichas com [Motion](https://motion.dev) (`app/table.js`); sons sintetizados com Web Audio, sem arquivos (`lib/sound.js`), com botão de mudo no cabeçalho. A fonte Behind The Nineties é carregada direto do site da Sacflow; para produção, baixe o ZIP oficial no guia e hospede em `public/fonts`.

## Vercel

Importe o repositório como Next.js, raiz `/`, Node.js 22. Configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente de servidor. Nunca envie a chave ao GitHub ou ao cliente. Produção: https://pokerflow-theta.vercel.app

## Arquitetura

Next.js App Router, API server-side, Supabase PostgreSQL com RLS, motor de poker independente e sincronização por polling de 1,5s. A sessão é um token aleatório armazenado no navegador. O estado é versionado para evitar atualizações concorrentes.

## Limitações

Protótipo v0.2.0: sem dinheiro real, sem autenticação Supabase, sem Realtime, sem rate limiting, sem testes E2E completos. Casos complexos de poker precisam de testes adicionais. O banco não deve ser exposto diretamente ao cliente.
