# Handoff: tratamento de erros do painel

## Pedido

Melhorar o tratamento de erros do painel administrativo. Nenhum texto visível deve ficar em inglês. Os erros devem explicar a correção e, sempre que possível, oferecer um botão que abra o registro e leve o foco ao campo exato.

## Implementado

- Resumo de validação redesenhado com explicação, separação entre erros/avisos e botões de navegação por problema.
- Navegação precisa por `data-validation-path`, com seleção do registro, expansão da seção/bloco, rolagem, foco e destaque temporário.
- Contatos, locais, materiais, grupos e blocos de conteúdo receberam caminhos de validação e ações como `Ir ao contato`, `Ir ao local`, `Ir ao material` e `Ir ao grupo`.
- Fluxos já tinham navegação profunda pelo mapa; mensagens e rótulos técnicos visíveis foram traduzidos/localizados.
- Abas exibem contagem de erros.
- Publicação e exportação bloqueadas mostram erros agrupados por área e botões `Revisar N erros em ...`.
- Falhas de publicação, exportação, estatísticas, upload de imagem e armazenamento local agora mantêm o rascunho, explicam o ocorrido e oferecem tentativa novamente quando aplicável.
- Conflitos de publicação não expõem caminhos internos como `contacts[id].name`; exibem localização legível e botão para abrir a área.
- Exclusão da única etapa de um fluxo foi desabilitada com explicação, removendo o `window.alert`.
- Textos visíveis encontrados na revisão do navegador foram localizados: `Dashboard` -> `Painel`, `Score` -> `pontuação`, `Tags` -> `Marcadores`, `badges` -> `selos`.

## Arquivos novos

- `src/dev-dashboard/components/BlockingValidationNotice.tsx`
- `src/dev-dashboard/validation/validationNavigation.ts`

## Validação já executada

- `pnpm exec tsc --noEmit --pretty false`: passou antes dos últimos ajustes somente de texto/testes.
- `pnpm exec eslint src/dev-dashboard src/app/__tests__/routes.test.tsx`: passou.
- Suíte completa: `55` arquivos e `702` testes passaram antes dos últimos ajustes de rótulos.
- Testes novos confirmam que os botões de validação selecionam o registro correto e focam o campo inválido em contatos e materiais.
- Revisão visual no navegador local em desktop e `390x844`: layout sem overflow ou quebra aparente.
- Detector Impeccable foi executado uma vez. Único aviso: `border-l-4` preexistente em `src/dev-dashboard/flows/FlowEditor.tsx:522` (`side-tab`). Não foi alterado por ser parte do padrão visual existente.

## Falta fazer

1. Rodar após os últimos ajustes de texto:
   - `pnpm exec tsc --noEmit --pretty false`
   - `pnpm exec eslint src/dev-dashboard src/app/shell/TopBar.tsx src/app/shell/__tests__/navigation.test.tsx src/app/__tests__/routes.test.tsx`
   - `pnpm exec vitest run --reporter=dot`
2. Verificar `rg -n "Dashboard|Ações/Score|Pontuação \\(Score\\)|badges|\\bTags\\b|Digite uma tag" src/app/shell src/dev-dashboard --glob '!**/__tests__/**'`; a última varredura não retornou textos visíveis restantes.
3. Revisar `git diff` e entregar resumo. Não criar commit sem pedido.

## Atenção ao worktree

Já havia alterações do usuário antes desta tarefa em arquivos do mapa de fluxos, especialmente `FlowDashboard.tsx`, `FlowDestinationMap.*`, `FlowMap.tsx`, `FlowOverviewMap.*` e testes correspondentes. Não reverta nem reformate em massa esses arquivos. Nesta tarefa, em arquivos previamente alterados, só foram feitas pequenas traduções visíveis em `FlowDestinationMap.tsx` e `FlowOverviewMap.tsx`; preserve o restante.

Também existem itens não relacionados e não rastreados, incluindo `.impeccable/` e `Documento sem título.md`. Não remova.

Um servidor Vite foi iniciado em `http://localhost:3001/bemtevi/` com autenticação simulada e pode ainda estar ativo (sessão de terminal `70113`).
