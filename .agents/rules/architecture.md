# Arquitetura do PokerFlow

```text
Navegador: app/page → features/poker-room → POST /api/game
Servidor:  app/api/game → poker + server/room-store
                                server/room-store → Supabase ou memória local
```

- `app/` contém os pontos de entrada do Next.js. A rota da sala valida o pedido,
  autoriza a operação, chama o motor e projeta o estado público antes de responder.
- `src/poker/` contém regras, avaliação de mãos e tipos do jogo. Mantenha o motor
  independente de React, Next.js e armazenamento. O código do navegador pode
  importar tipos e módulos de apresentação compartilhados, como nomes de mãos e
  avatares. O motor e a projeção de estado privado são executados no servidor.
- `src/server/` contém a persistência e o acesso à configuração de servidor. O
  armazenamento da sala expõe criação, leitura e atualização por versão. Preserve
  a comparação de versão na mesma atualização que grava o estado. `timeouts.ts` (em `src/poker/`) aplica prazos vencidos e a rota o chama em toda requisição. `room-notify`
  publica no Supabase Realtime Broadcast só a versão da sala; nunca publique estado.
- `src/features/poker-room/` contém a tela da sala, mesa, diálogo de campeão,
  avatares e som. Mantenha o estado da interface próximo da tela que o coordena e
  extraia partes com responsabilidade clara para a própria pasta da funcionalidade.
- `src/styles/` contém o CSS global e o tema Tailwind. Mantenha CSS específico
  ao lado da funcionalidade. `tests/` exercita o motor e os módulos do projeto,
  e `supabase/` contém o esquema SQL.

As dependências apontam dos pontos de entrada para a funcionalidade e para os
módulos que ela usa. Evite ciclos e camadas que só repassam chamadas. Ao criar
uma funcionalidade independente, adicione uma pasta em `src/features/`.

Formate com `npm run format`. Antes de publicar, rode `npm run format:check`,
`npm run typecheck`, `npm test` e `npm run build`.
