<div align="center">
  <img src="docs/pokerflow-banner.svg" alt="PokerFlow" width="480" />

  <h1>PokerFlow</h1>

  <p><strong>Texas Hold’em privado para jogar com amigos ou treinar contra bots.</strong></p>

  <p>De 2 a 8 lugares · Fichas virtuais · Interface em português</p>

  <p><a href="https://pokerflow-theta.vercel.app"><strong>Abrir o PokerFlow</strong></a> · <a href="#rodar-localmente">Rodar localmente</a> · <a href="#arquitetura">Arquitetura</a></p>
</div>

## O jogo

Crie uma mesa, escolha as fichas iniciais, os blinds e o tempo por jogada. Compartilhe o link ou o código da sala e inicie a partida pelo lobby. Para treinar sozinho, escolha o modo **Contra bots** e configure a quantidade e a dificuldade dos adversários.

- **Sala privada.** O anfitrião gerencia os assentos antes da partida. Quem chega com a mesa cheia ou em andamento pode acompanhar como espectador, com acesso apenas às cartas públicas.
- **Mesa interativa.** Avatares personalizáveis, reações, animações de cartas e fichas, sons com opção de mudo e atalhos de teclado nos controles de aposta.
- **Resultado da mão.** No showdown, a mesa destaca as combinações reveladas, a mão vencedora e as cartas decisivas no desempate.
- **Ritmo da partida.** A próxima mão começa automaticamente após 15 segundos, com opção de pausa para o anfitrião. Ao fim da partida, o campeão aparece com avatar e troféu animado.

## Rodar localmente

Use **Node.js 24 LTS**. A versão de referência está em [`.nvmrc`](.nvmrc).

```bash
npm ci
npm run dev
```

Abra [localhost:3000](http://localhost:3000). Em desenvolvimento, sem `SUPABASE_URL`, as salas ficam em memória e são descartadas ao reiniciar o servidor.

### Persistência e tempo real

Para persistir as salas, aplique [`supabase/schema.sql`](supabase/schema.sql) no Supabase, copie [`.env.example`](.env.example) para `.env.local` e preencha as variáveis abaixo.

| Variável                                                     | Uso                                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                               | URL do projeto usada pelo servidor.                                                                                             |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | Credencial privada do servidor. Guarde-a nas variáveis de ambiente do backend.                                                  |
| `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Par opcional para atualizações via Supabase Realtime. O cliente consulta a API periodicamente quando o canal está indisponível. |
| `CRON_SECRET`                                                | Protege o endpoint de limpeza usado pelo Vercel Cron. Configure-o se usar o agendamento.                                        |

## Arquitetura

**Next.js 16 · React 19 · TypeScript 7 · Tailwind CSS 4 · Supabase · Motion**

| Pasta                                                  | Responsabilidade                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| [`app/`](app/)                                         | Pontos de entrada do Next.js, API da mesa e endpoint de limpeza.   |
| [`src/poker/`](src/poker/)                             | Motor de Texas Hold’em, avaliação de mãos, bots e regras de turno. |
| [`src/server/`](src/server/)                           | Persistência, notificações de versão e limites de requisição.      |
| [`src/features/poker-room/`](src/features/poker-room/) | Entrada, lobby, mesa, animações e sincronização da sala.           |
| [`src/styles/`](src/styles/) e [`tests/`](tests/)      | Tema global e testes do projeto, respectivamente.                  |

O servidor valida as jogadas, aplica os prazos, distribui os potes e entrega a cada jogador uma visão autorizada da mesa. As gravações verificam a versão da sala para evitar sobrescrever atualizações concorrentes. O Realtime avisa que a versão mudou e o cliente busca seu estado pela API. Use esse aviso para sincronizar a interface, pois a linha em `poker_rooms` contém o baralho e as cartas privadas.

## Desenvolvimento e deploy

Antes de alterar o projeto, leia o [BOOTSTRAP.md](BOOTSTRAP.md), o [mapa de regras](.agents/rules/rules-map.md) e a [regra de arquitetura](.agents/rules/architecture.md).

```bash
npm run format:check
npm run typecheck
npm test
npm run build
```

Use `npm run format` para aplicar o Prettier. Na Vercel, selecione **Next.js**, mantenha a raiz do projeto em `/` e configure o ambiente com **Node.js 24**. O [`vercel.json`](vercel.json) agenda a limpeza diária de salas inativas há sete dias. Uma sala sem jogadores conectados avança quando volta a receber uma requisição.

A identidade visual segue o [guia de marca Sacflow](https://sacflow.com.br/guia-de-marca-sacflow).
