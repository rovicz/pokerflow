---
trigger: always_on
---

# Integridade Visual de Viewport e Fundo Contínuo

Para evitar faixas vazias, cortes de gradiente ou elementos saltando para fora da tela em qualquer resolução:

1. **Continuidade obrigatória de fundo (`html`, `body`)**:
   - `html` e `body` devem sempre garantir `min-height: 100dvh`.
   - Todo `background-image` com gradientes no `body` ou containers raiz deve declarar `background-repeat: no-repeat` (e `background-attachment: fixed` quando global) para nunca criar linhas horizontais de repetição/costura abaixo do conteúdo.
2. **Proibição de vazios mortos nas telas principais**:
   - Todas as telas raiz (`Landing`, `Lobby`, `Mesa`) devem usar `display: flex; flex-direction: column; min-height: 100dvh;` com a seção principal em `flex: 1 1 auto;`.
   - Evitar alturas arbitrárias soltas (como `min-height: 78vh`) que deixam faixas vazias na base em monitores Full HD ou widescreen.
3. **Checklist obrigatório de verificação visual**:
   - Antes de concluir mudanças de UI, verificar estruturalmente os 3 estados (`Landing`, `Lobby`, `Mesa`) em desktop (`1366×768`, `1920×1080`) e mobile garantindo:
     - Fundo contínuo do topo à base sem degraus ou repetições.
     - Nenhum elemento cortado nas bordas da viewport ou pela topbar.
     - Nenhum vazio desproporcional abaixo ou nas laterais do conteúdo.
