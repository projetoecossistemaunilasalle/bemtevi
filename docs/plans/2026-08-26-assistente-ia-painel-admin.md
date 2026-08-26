# Assistente de IA para Painel Administrativo - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir que administradores não técnicos copiem conteúdo do painel para o ChatGPT Web (GPT na web) e colem de volta com validação, com todas instruções em PT-BR, em duas versões: global (payload completo) e por item (fluxo/material/contato isolado).

**Architecture:** Novo módulo `src/dev-dashboard/ai/` gera prompts em PT-BR com instruções e JSON. Componente global (`GlobalAiSection`) vive na aba Publicar/Exportar e opera sobre `PublishedContentPayload` completo via `parsePayload`/`validatePublicationPayload`. Componentes por item (`AiItemAssist`) vivem em cada dashboard (Fluxos, Educação, Contatos) e operam sobre um registro isolado, validando com `validateDashboardFlows`/`validateDashboardEducation`/`validateDashboardContacts`. Sem backend, sem chaves, mantém `RequireAdmin` e validação existente.

**Tech Stack:** React 19 + TypeScript, Tailwind, Clipboard API, validadores existentes (`src/app/content/publishedContent.ts`, `src/dev-dashboard/flows/flowValidation.ts`, etc.), Vitest

---

### Task 1: Criar módulo de prompts em PT-BR

**Files:**

- Create: `src/dev-dashboard/ai/aiPrompts.ts`
- Create: `src/dev-dashboard/ai/__tests__/aiPrompts.test.ts`

**Step 1: Write failing test for prompt builders**

````ts
// src/dev-dashboard/ai/__tests__/aiPrompts.test.ts
import {
  buildFullPayloadPrompt,
  buildFlowPrompt,
  buildEducationMaterialPrompt,
  buildContactPrompt,
} from '../aiPrompts';

test('buildFullPayloadPrompt contém instruções PT-BR e JSON', () => {
  const prompt = buildFullPayloadPrompt({
    flows: [],
    educationMaterials: [],
    educationGroups: [],
    contacts: [],
    locations: [],
    defaultGroupOrder: 0,
  });
  expect(prompt).toContain('Você é um assistente do BemTeVi');
  expect(prompt).toContain('fluxos');
  expect(prompt).toContain('```json');
});

test('buildFlowPrompt contém regras de id e estrutura', () => {
  const prompt = buildFlowPrompt({
    id: 'flow-1',
    title: 'Teste',
    version: '1.0.0',
    locale: 'pt-BR',
    type: 'guided_conversation',
    status: 'draft',
    entry: { nodeId: 'start', enteringPhrases: ['oi'], transitionMessage: 'olá' },
    nodes: { start: { id: 'start', kind: 'result', text: 'fim' } },
  } as any);
  expect(prompt).toContain('Não invente');
  expect(prompt).toContain('flow-1');
});
````

**Step 2: Run test to verify it fails**

Run: `pnpm test src/dev-dashboard/ai/__tests__/aiPrompts.test.ts -v`
Expected: FAIL with "Cannot find module '../aiPrompts'"

**Step 3: Write minimal implementation**

````ts
// src/dev-dashboard/ai/aiPrompts.ts
export function buildFullPayloadPrompt(payload: PublishedContentPayload): string {
  /* retorna cabeçalho PT-BR + ```json + JSON.stringify(payload, null, 2) + instruções de devolução */
}
export function buildFlowPrompt(flow: GuidedFlow): string {
  /* instruções PT-BR específicas de fluxo */
}
export function buildEducationMaterialPrompt(resource: EducationResource): string {
  /* ... */
}
export function buildContactPrompt(contact: ServiceDirectoryEntry, locations: ServiceLocation[]): string {
  /* ... */
}
export function buildLocationPrompt(location: ServiceLocation): string {
  /* ... */
}
// Helpers: INSTRUCOES_COMUNS, REGRAS_ID, EXEMPLO_RESPOSTA
````

**Step 4: Run test to verify it passes**

Run: `pnpm test src/dev-dashboard/ai/__tests__/aiPrompts.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/dev-dashboard/ai/aiPrompts.ts src/dev-dashboard/ai/__tests__/aiPrompts.test.ts
git commit -m "feat(ai): adiciona geradores de prompt PT-BR para payload completo e por item"
```

---

### Task 2: Criar componente global de assistência IA (versão 1 - payload completo)

**Files:**

- Create: `src/dev-dashboard/ai/GlobalAiSection.tsx`
- Create: `src/dev-dashboard/ai/__tests__/GlobalAiSection.test.tsx`

**Step 1: Write failing test**

```ts
// Testa que o componente renderiza botões Copiar/Colar e instruções passo a passo
test('GlobalAiSection renderiza instruções PT-BR e botões', async () => {
  render(<GlobalAiSection draft={mockPayload} onApply={vi.fn()} />);
  expect(screen.getByText(/Como usar com o ChatGPT/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Copiar conteúdo para a IA/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Colar conteúdo da IA/ })).toBeInTheDocument();
});
```

**Step 2: Run test**

Run: `pnpm test src/dev-dashboard/ai/__tests__/GlobalAiSection.test.tsx -v`
Expected: FAIL

**Step 3: Implement component**

```tsx
// src/dev-dashboard/ai/GlobalAiSection.tsx
// Props: { draft: PublishedContentPayload, onApply: (payload: PublishedContentPayload) => void }
// Estado: pasteOpen, pasteText, copiarFeedback, erroValidacao, preview
// Funções:
// - handleCopy(): buildFullPayloadPrompt(draft) + navigator.clipboard.writeText + fallback textarea
// - handlePasteApply(): JSON.parse -> parsePayload -> onApply -> fecha modal
// UI: Section com <ol> 1.Clique Copiar 2.Cole no ChatGPT 3.Copie resposta 4.Cole aqui 5.Revise e publique
// Modal com textarea, botão Validar, área de erros (usa PublishedContentValidationError), preview de changeSummary
```

**Step 4: Run test PASS**

**Step 5: Commit**

---

### Task 3: Integrar seção global na aba Publicar/Exportar

**Files:**

- Modify: `src/dev-dashboard/publishing/PublishDashboard.tsx:169-293`
- Modify: `src/dev-dashboard/export/ExportDashboard.tsx:129-225`
- Modify: `src/dev-dashboard/DashboardRoute.tsx:1006-1041`

**Step 1: Write failing test (integração)**

```ts
// src/dev-dashboard/__tests__/dashboardRoute.test.tsx - novo teste
it('exibe seção de IA na aba Publicar com botões de copiar/colar', async () => {
  // render DashboardRoute em modo database, verifica GlobalAiSection presente
});
```

**Step 2: Run test FAIL**

**Step 3: Modify PublishDashboard.tsx - adicionar GlobalAiSection antes da seção Publicar**

```tsx
import { GlobalAiSection } from '../ai/GlobalAiSection';
// Dentro do PublishDashboard, antes de <section>Publicar conteúdo
<GlobalAiSection
  draft={draft}
  onApply={(next) => {
    /* opcional: callback para DashboardRoute aplicar via setDraftState merge */
  }}
/>;
// Se onApply não existir, GlobalAiSection chama diretamente parse e mostra instruções para colar manualmente? Melhor: expõe onApply que DashboardRoute implementa convertendo payload em drafts via diff.
```

Alternative simpler: GlobalAiSection apenas copia e valida, mas não aplica automaticamente - mostra "Conteúdo válido! Agora publique". Para aplicar de verdade, DashboardRoute precisa converter payload em DashboardDraftState.

Para MVP: GlobalAiSection faz validação e ao aplicar, chama `onApplyPayload` que DashboardRoute implementa como:

```ts
function handleAiApplyPayload(nextPayload: PublishedContentPayload) {
  // Calcula patches comparando shipped vs nextPayload e converte em DashboardDraftState
  // Simplificação: reset drafts e recria via merge inverso, ou usa saveDashboardDrafts com payload convertido
  // Para primeira versão: apenas mostra JSON válido e instrui a usar colar manual por item; ou mostra botão "Aplicar no rascunho" que faz setDraftState com added/patches recalculados
}
```

**Step 4: Run test PASS / manual verify**

**Step 5: Commit**

---

### Task 4: Criar componente reutilizável por item (versão 2)

**Files:**

- Create: `src/dev-dashboard/ai/AiItemAssist.tsx`
- Create: `src/dev-dashboard/ai/__tests__/AiItemAssist.test.tsx`

**Step 1: Test**

```ts
test('AiItemAssist copia prompt do item e valida colagem', async () => {
  render(<AiItemAssist kind="flow" data={flow} onApply={vi.fn()} />);
  expect(screen.getByRole('button', { name: /Copiar.*IA/ })).toBeInTheDocument();
});
```

**Step 2: Implement**

```tsx
// Props discriminated union: {kind: 'flow', data: GuidedFlow, onApply: (patch: Partial<GuidedFlow>) => void} | {kind: 'education', ...} | {kind: 'contact', ...} | {kind: 'location', ...}
// Botões: [Copiar para IA] [Colar da IA]
// Lógica copiar: switch kind -> buildFlowPrompt / buildEducationMaterialPrompt etc. -> clipboard
// Lógica colar: modal textarea -> JSON.parse -> validação específica (validateFlow, parsePayload para o tipo) -> onApply(patch)
// Mensagens de erro em PT-BR
```

**Step 3: Test PASS**

**Step 4: Commit**

---

### Task 5: Integrar IA por item em FlowDashboard

**Files:**

- Modify: `src/dev-dashboard/flows/FlowDashboard.tsx:200-460`

**Step 1: Add AiItemAssist ao lado do título do fluxo selecionado e no header da lista**

```tsx
import { AiItemAssist } from '../ai/AiItemAssist';
// No FlowDashboard, ao lado do botão do fluxo ou dentro do detalhe:
<AiItemAssist
  kind="flow"
  data={selectedFlow}
  onApply={(patch) => onFlowChange(effectiveIndex, selectedFlow.id, patch)}
/>;
```

**Step 2: Manual test: copiar fluxo -> colar JSON modificado -> verifica que onFlowChange é chamado e validação atualiza**

**Step 3: Commit**

---

### Task 6: Integrar IA por item em EducationDashboard

**Files:**

- Modify: `src/dev-dashboard/education/EducationDashboard.tsx:372-750`

**Step 1: Add AiItemAssist ao lado de "Dados principais" e para cada bloco? Melhor apenas por material completo**

```tsx
<AiItemAssist
  kind="education"
  data={selectedResource}
  onApply={(patch) => onResourceChange(effectiveIndex, selectedResource.id, patch)}
/>
```

**Step 2: Commit**

---

### Task 7: Integrar IA por item em ContactsDashboard

**Files:**

- Modify: `src/dev-dashboard/contacts/ContactsDashboard.tsx:328-375`

**Step 1: Add AiItemAssist para contato selecionado e para cada local na gestão de locais**

```tsx
<AiItemAssist kind="contact" data={selectedService} locations={locations} onApply={changeService} />;
// Para locais:
{
  locations.map((loc) => (
    <AiItemAssist kind="location" data={loc} onApply={(patch) => onLocationChange(index, loc.id, patch)} />
  ));
}
```

**Step 2: Commit**

---

### Task 8: Polir instruções PT-BR e acessibilidade

**Files:**

- Modify: `src/dev-dashboard/ai/aiPrompts.ts` (ajustar textos com revisão de UX writer)
- Modify: `src/dev-dashboard/ai/GlobalAiSection.tsx` (adicionar aria-live para feedback de cópia, mensagens de erro em PT-BR)
- Create: `docs/ai-assist-guia-admin.md` (guia de 1 página para admins: passo a passo com screenshots descritos)

**Step 1: Teste de acessibilidade manual + axe**

**Step 2: Commit**

---

### Task 9: Testes de validação e integração final

**Files:**

- Create: `src/dev-dashboard/ai/__tests__/aiIntegration.test.ts` (testa fluxo completo copiar->parse->validar->aplicar sem quebrar validadores)
- Modify: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx` (adiciona cenários de colagem inválida: JSON quebrado, id duplicado, locationId inexistente)

**Step 1: Escrever testes de integração que simulam colagem do ChatGPT com JSON levemente malformatado (```json wrapper, comentários)**

````ts
function extractJsonFromAiResponse(text: string): string {
  /* remove ```json wrapper */
}
````

**Step 2: Rodar todos os testes `pnpm test src/dev-dashboard/ai -v` e `pnpm test src/dev-dashboard/__tests__/dashboardRoute.test.tsx -v`**

**Step 3: Commit**

---

## Notas de implementação

- Reuso obrigatório: `src/app/content/publishedContent.ts:284` `parsePayload`, `src/domain/flow-engine/validateFlow.ts`, `src/dev-dashboard/education/educationValidation.ts`, `src/dev-dashboard/contacts/contactsValidation.ts`
- Prompt deve instruir GPT a devolver APENAS JSON puro dentro de ```json, sem explicações extras, mantendo ids e estrutura.
- Clipboard: usar `navigator.clipboard.writeText` com fallback para `document.execCommand('copy')` via textarea temporário para navegadores antigos.
- Todos textos visíveis em PT-BR, sem inglês. Botões: "Copiar para a IA", "Colar da IA", "Validar", "Aplicar no rascunho".
- Manter `RequireAdmin` - nenhuma rota nova exposta publicamente.
