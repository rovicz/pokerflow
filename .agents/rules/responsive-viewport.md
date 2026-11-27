---
trigger: always_on
---

# Responsividade 100% Fluida à Viewport

Todas as telas do PokerFlow (entrada, sala de espera/lobby e mesa de jogo) devem se adaptar integralmente ao tamanho da tela (largura e altura da viewport), seguindo o mesmo padrão fluido da tela de jogo:

1. **Preenchimento proporcional da viewport (`100dvh`)**:
   - Em desktop e telas widescreen, as telas de aplicativo (como Lobby e Mesa) devem usar `width: 100%` e `height: 100dvh` com `display: flex; flex-direction: column; overflow: hidden;` (sem `max-width` estreitos deixando faixas vazias desproporcionais nas laterais e sem scroll vertical desnecessário).
   - Usar áreas flexíveis (`flex: 1 1 auto; min-height: 0;`) e grids proporcionais (`minmax(0, 1fr)`) para que cards, grades de assentos, seletores e controles escalem suavemente entre resoluções (ex.: `1280×720`, `1366×768`, `1920×1080`, ultrawide).
2. **Topbar unificada e compacta**:
   - Consolidar marca, metadados contextuais (código da sala, fase, jogadores, blinds) e ações de utilidade em uma única barra superior compacta, maximizando o espaço útil da tela.
3. **Degradação graciosa em telas menores e mobile**:
   - Em tablets, celulares ou viewports com altura reduzida, adaptar colunas, esconder rótulos secundários quando necessário e liberar `overflow-y: auto` (`height: auto; min-height: 100dvh;`) para que nenhum conteúdo ou botão seja cortado ou espremido.
4. **Tipografia, espaçamentos e animações fluidas**:
   - Preferir `clamp()` para tipografia, paddings e gaps.
   - Manter animações suaves com `motion` respeitando `prefers-reduced-motion`.
