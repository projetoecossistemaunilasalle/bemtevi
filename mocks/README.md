# Mocks — UI de redirecionamentos e edição de fluxos

Estes arquivos são **mocks estáticos de HTML/CSS**, fora de `src/` e **não fazem parte do build**.
Servem apenas para validar visualmente, com os tokens reais do design (`src/index.css`), as ideias
do plano de UI/UX para o dashboard de fluxos antes de implementar.

> ⚠️ Nada aqui é funcional. Botões, selects e o "editor" não persistem nada — alguns têm um pouco
> de JavaScript só para demonstrar a interação (alternar entre tipos de ação, buscar/filtrar etapas).

## Como ver

Abra `index.html` no navegador (ou qualquer um dos `.html` diretamente). Eles compartilham `mock-styles.css`
e têm uma navegação no topo para pular entre os quatro.

## Os quatro mocks

| # | Arquivo | O que mostra |
|---|---------|--------------|
| 1 | `option-effects.html` | Editor de opção cobrindo os **5 tipos de ação/redirecionamento** que o motor já suporta (`next`, `flow_start`, `navigate`, `end_flow`, `safety_interrupt`) + seção de pontuação. Hoje o editor só faz `next` e `flow_start`. |
| 2 | `score-declaration.html` | O painel **opt-in de pontuação** no topo do editor. Mostra os dois estados: desativado (work-stress, nada de score) e ativado (SRQ-20, com identificador / nome de exibição / pontuação máxima). |
| 3 | `large-flow-nav.html` | Resposta ao "SRQ-20 é difícil de editar": contagem, **busca**, **filtros por tipo/redirecionamento**, **recolher/expandir tudo** e um **mini-outline lateral clicável** com badges. Renderiza as 22 etapas reais do SRQ-20. |
| 4 | `redirections-view.html` | Nova aba **"Redirecionamentos"** listando, num só lugar, todos os redirecionamentos do fluxo (segurança, ramificação por pontuação, pontuações, navegações, inícios de fluxo, encerramentos) — cada item clicável leva à etapa de origem. Mostra também o estado vazio (work-stress). |

## Contexto do plano

- SRQ-20 (`src/content/flows/srq20.json`) é o único fluxo que usa `score`, `safety_interrupt` e
  `score_branch` — todos definidos em `src/domain/flow-engine/types.ts` e avaliados em `advanceFlow.ts`,
  mas **sem UI de criação/edição** hoje.
- Outros fluxos (work-stress, rest-recovery, neutral) são árvores `choice → next → result`.
- "Adicionar redirecionamentos a outros fluxos" = construir editores para esses capabilities,
  com pontuação **opt-in por fluxo** (declaração explícita).

Veja o plano completo na conversa onde estes mocks foram gerados.
