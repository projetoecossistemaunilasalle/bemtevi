# Edição de Fluxos no Mapa — Design

## Status

Aprovado em 2026-08-25. Este documento revisa o escopo do
`docs/superpowers/specs/2026-08-25-flow-destination-map-design.md`: a edição completa
deixa de ser responsabilidade do editor de formulários e passa para a superfície do mapa.
O editor existente permanece como fallback temporário.

## Contexto

O feedback sobre o editor atual é claro: ele é confuso porque a **estrutura é invisível**.
Editar uma lista plana de etapas esconde exatamente aquilo que o conteúdo é — um grafo de
decisões e destinos. O novo `Mapa por destino` já resolve a leitura dessa estrutura sobre o
motor de topologia tipado (`flowTopology.ts`). A decisão natural é tornar o mapa a
superfície de edição também.

## Decisões

| Pergunta                                          | Decisão                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| Problema central do editor atual                  | Estrutura invisível durante a edição                             |
| Modelo de edição                                  | Painel estruturado lateral; canvas somente leitura e sempre vivo |
| Destino do editor atual                           | Mantido como fallback até a paridade ser validada em uso real    |
| Configurações do fluxo (título, uso, entrada…)    | Painel aberto a partir do cabeçalho do mapa                      |
| Novos campos de conteúdo                          | Nenhum                                                           |
| Posicionamento manual salvo / arraste persistente | Continua fora de escopo                                          |

## Princípios

1. O mapa é a superfície principal e renderiza a topologia viva após cada mutação.
2. O painel é o único ponto de edição do elemento selecionado (nó, opção ou fluxo).
3. Todas as mutações escrevem campos existentes de `GuidedFlow`; nada novo é criado.
4. Mutações vivem em `flowMutations.ts` como funções puras `(flow, …) → GuidedFlow`,
   testáveis sem React — mesma filosofia de `flowTopology.ts`.
5. Quebras ficam explícitas: excluir um nó com conexões gera destinos ausentes visíveis
   no mapa e entradas na validação — nunca remoção silenciosa.
6. O editor legado continua acessível atrás de um controle secundário até a fase de remoção.

## Superfícies

### Cabeçalho

Inalterado, mais um botão ⚙️ **Configurações do fluxo** que abre `FlowSettingsPanel`:
título, uso (`purpose`), status, etapa de entrada (seletor) e frases de entrada (lista editável).

### Toolbar

Ganha **+ Etapa** com popover de tipo: Pergunta · Final · Ramificação.

### NodeEditorPanel (evolução do inspetor)

Seções, na ordem:

1. **Identidade** — tipo, número da etapa, ID (somente leitura).
2. **Texto** — área de texto com commit ao sair do campo.
3. **Opções** — por opção: rótulo, seletor de destino (etapas agrupadas por profundidade ou
   "criar novo destino" inline), construtor de efeitos tipados (`score`, `safety_interrupt`,
   `deferred_safety`, `navigate`, `flow_start`, `end_flow`) com seus campos próprios,
   remover efeito, remover opção.
4. **Resposta livre** — alternância e destino.
5. **Ramificação** — chave de pontuação e faixas (mín/máx/destino).
6. **Mídia** — vídeos (título/URL) e recomendações (finais), quando aplicável.
7. **Ações** — definir como entrada · duplicar etapa · excluir etapa (guardado) ·
   abrir no editor legado.

## Semântica das mutações

- **Adicionar**: ID único (`step-N`), anexado ao fim de `nodeOrder`; quando criado a partir
  de uma opção ("criar novo destino"), a opção já aponta para ele.
- **Duplicar**: novo ID, mesmas opções e alvos, sem conexões de entrada.
- **Excluir**: confirmado com a contagem de conexões que quebram; opções que apontavam para
  ele passam a exibir `Destino ausente` no mapa e erro na validação.
- **Definir entrada**: seletor valida existência.
- **Trocar tipo**: confirmado, pois reformula o formato do nó.

## Deep-links de validação

`resolveFlowValidationTarget` passa a produzir `{ flowId, nodeId?, section? }`. Abrir uma
pendência troca o fluxo, abre a aba do mapa, seleciona o nó e foca a seção correspondente do
painel — eliminando a busca por `aria-label` no DOM do editor legado.

## Segurança e estados

- Feedback inline reutilizando as regras de `validateFlow` (texto obrigatório, URL do
  YouTube, sanidade de faixas).
- Edições se aplicam imediatamente ao rascunho; o fluxo de publicação não muda.
- Mobile: o painel vira bottom sheet; ações estruturais pedem confirmação.

## Testes

- `flowMutations.test.ts`: adicionar, duplicar, excluir, religar, trocar tipo, configurações.
- Testes do painel por payload emitido em `onFlowChange`, cobrindo cada seção.
- Integração mapa ↔ painel: adicionar aparece conectado; exclusão guarda e explicita quebras.
- A suíte do editor legado permanece verde (fallback intacto).

## Fases

1. **Paridade** — NodeEditorPanel completo, CRUD, painel de configurações, deep-links.
2. **Refino** — clique em porta de opção foca a opção no painel; polir mobile; navegação por teclado.
3. **Remoção** — aposentar o editor legado após validação em uso real.

## Critérios de aceitação

1. Todo controle do editor legado tem equivalente no mapa/painel (checklist de paridade).
2. Qualquer edição reflete no mapa na mesma interação, sem recarregar nem "salvar".
3. Nenhuma mutação introduz campo novo nem oculta quebras de conexão.
4. O SRQ-20 permanece navegável com o painel aberto.
5. Pendências de validação pousam no campo correto sem passar pelo editor legado.
6. Os critérios de acessibilidade, contraste e movimento reduzido do spec anterior se aplicam.
