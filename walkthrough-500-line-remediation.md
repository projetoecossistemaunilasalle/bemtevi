# Walkthrough: Remediação Arquitetural do Limite de 500 Linhas

Remediação completa executada com base no plano em [`docs/plans/2026-09-12-500-line-architecture-remediation.md`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/docs/plans/2026-09-12-500-line-architecture-remediation.md) para adequar o repositório ao novo limite máximo de 500 linhas físicas por arquivo (`scripts/check-architecture.mjs`).

---

## 1. Resumo do Trabalho

Todos os 8 arquivos que ultrapassavam 500 linhas foram decompostos em módulos focados e de responsabilidade única. Suas entradas de exceção legadas em `scripts/architecture-baseline.json` foram removidas sem a introdução de nenhuma nova exceção. O repositório agora passa 100% no portão completo de CI (`pnpm run check`).

Nenhum comportamento em tempo de execução, exportação pública, estrutura de dados, ordenação de serviços, textos em PT-BR ou chave de storage foi alterado.

---

## 2. Detalhamento por Workstream

### 1. `documentFlows.ts` (de 642 linhas para 15 linhas)

- **[`src/content/flows/documentFlows.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/documentFlows.ts)**: Reduzido a agregador do record `documentFlows`.
- **[`src/content/flows/document/documentFlowBuilders.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/document/documentFlowBuilders.ts)** (19 linhas): Construtores reutilizáveis `close()` e `ending()`.
- **[`src/content/flows/document/understandFeelings.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/document/understandFeelings.ts)** (167 linhas): Fluxo `understand-feelings`.
- **[`src/content/flows/document/organizeExperience.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/document/organizeExperience.ts)** (182 linhas): Fluxo `organize-experience`.
- **[`src/content/flows/document/nextCareStep.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/document/nextCareStep.ts)** (119 linhas): Fluxo `next-care-step`.
- **[`src/content/flows/document/calmMoment.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/document/calmMoment.ts)** (123 linhas): Fluxo `calm-moment`.
- **[`src/content/flows/document/postFlowNextStep.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/document/postFlowNextStep.ts)** (50 linhas): Fluxo `post-flow-next-step`.

### 2. `neutral.ts` (de 566 linhas para 15 linhas)

- **[`src/content/flows/neutral.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/neutral.ts)**: Reduzido a agregador do record `neutralFlows`.
- **[`src/content/flows/neutral/understandFeelings.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/neutral/understandFeelings.ts)** (264 linhas): Fluxo `understand-feelings`.
- **[`src/content/flows/neutral/talkThroughExperience.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/neutral/talkThroughExperience.ts)** (86 linhas): Fluxo `talk-through-experience`.
- **[`src/content/flows/neutral/nextCareStep.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/neutral/nextCareStep.ts)** (82 linhas): Fluxo `next-care-step`.
- **[`src/content/flows/neutral/calmMoment.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/neutral/calmMoment.ts)** (55 linhas): Fluxo `calm-moment`.
- **[`src/content/flows/neutral/postFlowNextStep.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/flows/neutral/postFlowNextStep.ts)** (90 linhas): Fluxo `post-flow-next-step`.

### 3. `canoas-services.ts` (de 647 linhas para 24 linhas)

- **[`src/content/services/canoas-services.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/services/canoas-services.ts)**: Agregador de `canoasServices` que preserva rigorosamente a ordem canônica do array de serviços exigida pelas snapshots de publicação e testes de storage.
- **[`src/content/services/canoas/pendingReview.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/services/canoas/pendingReview.ts)** (11 linhas): Metadados constantes `pendingReviewMetadata`.
- **[`src/content/services/canoas/canoas.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/services/canoas/canoas.ts)** (183 linhas): Emergências, CAPS e clínicas de psicologia de Canoas.
- **[`src/content/services/canoas/saoLeopoldo.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/services/canoas/saoLeopoldo.ts)** (67 linhas): Serviços de São Leopoldo.
- **[`src/content/services/canoas/novoHamburgo.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/services/canoas/novoHamburgo.ts)** (112 linhas): Serviços de Novo Hamburgo.
- **[`src/content/services/canoas/esteioSapucaia.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/services/canoas/esteioSapucaia.ts)** (112 linhas): Serviços de Esteio e Sapucaia do Sul.
- **[`src/content/services/canoas/portoAlegre.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/content/services/canoas/portoAlegre.ts)** (187 linhas): Serviços de Porto Alegre.

### 4. `ContactsDashboard.tsx` (de 618 linhas para 236 linhas)

- **[`src/dev-dashboard/contacts/ContactsDashboard.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/contacts/ContactsDashboard.tsx)**: Coordenador enxuto gerenciando estado e salvamento.
- **[`src/dev-dashboard/contacts/contactValidationNavigation.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/contacts/contactValidationNavigation.ts)** (20 linhas): Helper `focusContactField`.
- **[`src/dev-dashboard/contacts/ContactFields.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/contacts/ContactFields.tsx)** (211 linhas): Formulário de edição de serviço.
- **[`src/dev-dashboard/contacts/ContactLocationManager.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/contacts/ContactLocationManager.tsx)** (130 linhas): Gerenciador e diálogo de cidades/locais.
- **[`src/dev-dashboard/contacts/ContactDirectoryList.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/contacts/ContactDirectoryList.tsx)** (110 linhas): Lista de filtros, busca e itens de contatos.

### 5. `FlowDestinationMap.tsx` (de 648 linhas para 230 linhas)

- **[`src/dev-dashboard/flows/FlowDestinationMap.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/flows/FlowDestinationMap.tsx)**: Componente orquestrador do mapa de destinos.
- **[`src/dev-dashboard/flows/useFlowDestinationEditing.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/flows/useFlowDestinationEditing.ts)** (229 linhas): Hook de estado de edição e atalhos de teclado.
- **[`src/dev-dashboard/flows/useFlowDestinationCanvas.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/flows/useFlowDestinationCanvas.ts)** (89 linhas): Hook de layout, viewport e sincronização com ReactFlow.
- **[`src/dev-dashboard/flows/FlowDestinationToolbar.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/flows/FlowDestinationToolbar.tsx)** (117 linhas): Barra de ferramentas, busca e menu de criação de nós.
- **[`src/dev-dashboard/flows/FlowDestinationIndex.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/flows/FlowDestinationIndex.tsx)** (81 linhas): Resumo numérico e chips de destinos alcançáveis.
- **[`src/dev-dashboard/flows/FlowDestinationSelection.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/flows/FlowDestinationSelection.tsx)** (33 linhas): Banner de seleção e limpeza de destino ativo.
- **[`src/dev-dashboard/flows/FlowDestinationCanvas.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/flows/FlowDestinationCanvas.tsx)** (118 linhas): Canvas interativo do ReactFlow com painel lateral de nós.

### 6. `dashboardStorage.test.ts` (de 774 linhas para 3 suítes focadas)

- **[`src/dev-dashboard/__tests__/dashboardStorageTestFixtures.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/__tests__/dashboardStorageTestFixtures.ts)** (41 linhas): Fixtures e helpers de banco compartilhados.
- **[`src/dev-dashboard/__tests__/dashboardStorage.lifecycle.test.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/__tests__/dashboardStorage.lifecycle.test.ts)** (226 linhas, 14 testes): Ciclo de vida, leitura, salvamento e exportação/importação.
- **[`src/dev-dashboard/__tests__/dashboardStorage.migrations.test.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/__tests__/dashboardStorage.migrations.test.ts)** (201 linhas, 7 testes): Migrações de schema v1/v2/v3 e compatibilidade retroativa.
- **[`src/dev-dashboard/__tests__/dashboardStorage.merge.test.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/__tests__/dashboardStorage.merge.test.ts)** (338 linhas, 17 testes): Mesclagem semântica, prioridades de draft e snapshot publicado.

### 7. `FlowDestinationMap.test.tsx` (de 533 linhas para 3 suítes focadas)

- **[`src/dev-dashboard/flows/__tests__/FlowDestinationMapTestHarness.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/flows/__tests__/FlowDestinationMapTestHarness.tsx)** (100 linhas): Harness compartilhado com mock de ReactFlow e fluxos de teste.
- **[`src/dev-dashboard/flows/__tests__/FlowDestinationMap.navigation.test.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/flows/__tests__/FlowDestinationMap.navigation.test.tsx)** (135 linhas, 9 testes): Navegação, renderização de nós, busca e seleção de destinos.
- **[`src/dev-dashboard/flows/__tests__/FlowDestinationMap.mutations.test.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/flows/__tests__/FlowDestinationMap.mutations.test.tsx)** (179 linhas, 9 testes): Adição de nós, opções, ramificações e conexões.
- **[`src/dev-dashboard/flows/__tests__/FlowDestinationMap.focus.test.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/dev-dashboard/flows/__tests__/FlowDestinationMap.focus.test.tsx)** (129 linhas, 7 testes): Solicitações de foco e navegação entre seções.

### 8. `EducationScreens.test.tsx` (de 597 linhas para 4 suítes isoladas)

- **[`src/features/education/__tests__/EducationLibraryScreen.test.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/features/education/__tests__/EducationLibraryScreen.test.tsx)** (361 linhas, 11 testes): Tela da biblioteca, filtros e categorias.
- **[`src/features/education/__tests__/educationResourcePreview.test.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/features/education/__tests__/educationResourcePreview.test.ts)** (130 linhas, 5 testes): Formatação e pré-visualização de recursos.
- **[`src/features/education/__tests__/videoEmbeds.test.ts`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/features/education/__tests__/videoEmbeds.test.ts)** (42 linhas, 4 testes): Detecção e parsing de vídeos (YouTube/Instagram/links).
- **[`src/features/education/__tests__/ResourceDetailScreen.test.tsx`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/src/features/education/__tests__/ResourceDetailScreen.test.tsx)** (75 linhas, 3 testes): Renderização da tela de detalhes de materiais educativos.

### 9. Limpeza da Baseline de Arquitetura

- **[`scripts/architecture-baseline.json`](file:///c:/Users/Vitor/Desktop/Vinicius/Projetos/bemtevi/scripts/architecture-baseline.json)**: As 8 chaves obsoletas foram removidas. Nenhuma nova entrada foi adicionada.

---

## 3. Resultados de Validação

| Verificação                 | Comando                          | Resultado                                                             |
| --------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| **Gate Local Completo**     | `pnpm run check`                 | **Aprovado (código 0)**                                               |
| Typecheck                   | `tsc --noEmit`                   | Sem erros                                                             |
| ESLint                      | `eslint .`                       | 0 avisos / 0 erros                                                    |
| Formatação                  | `prettier --check .`             | 100% formatado                                                        |
| Validação de Fluxos         | `scripts/validate-flows.ts`      | Consistência e integridade aprovadas                                  |
| Testes Unitários/Integração | `vitest run`                     | **108 arquivos de teste aprovados (108), 894 testes aprovados (894)** |
| Gate de Arquitetura         | `scripts/check-architecture.mjs` | **Aprovado (389 source files)**                                       |
| Build de Produção           | `vite build`                     | Compilado e empacotado com sucesso (dist gerada)                      |
