# Flow Redirections and Deferred Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the dashboard/editor UX represented in `mocks/` and change SRQ-20 Q17 so it records a safety concern, lets the questionnaire finish, then routes the user to `/apoio` after the final result.

**Architecture:** Keep score calculation and safety routing as separate domain concepts. Add a deferred safety effect to the generic flow engine, expose it in dashboard editing/auditing UI, and keep `safety_interrupt` available for true immediate exits. The dashboard should derive redirection summaries from `GuidedFlow` data instead of hardcoding SRQ-20-specific UI.

**Tech Stack:** React 19, TypeScript, React Router, Vite, Vitest, Testing Library, existing Tailwind/design-system classes, existing `src/domain/flow-engine` runtime.

---

## Source References

- Static mocks: `mocks/option-effects.html`, `mocks/score-declaration.html`, `mocks/large-flow-nav.html`, `mocks/redirections-view.html`
- Current SRQ-20 content: `src/content/flows/srq20.json`
- Flow domain types/runtime: `src/domain/flow-engine/types.ts`, `src/domain/flow-engine/advanceFlow.ts`, `src/domain/flow-engine/validateFlow.ts`
- Flow dashboard/editor: `src/dev-dashboard/flows/FlowDashboard.tsx`, `src/dev-dashboard/flows/FlowEditor.tsx`, `src/dev-dashboard/flows/FlowPreview.tsx`, `src/dev-dashboard/flows/FlowMap.tsx`, `src/dev-dashboard/flows/flowValidation.ts`
- Orientation UI navigation: `src/features/orientation/OrientationScreen.tsx`
- Existing tests: `src/domain/flow-engine/__tests__/flow-engine.test.ts`, `src/features/orientation/__tests__/OrientationScreen.test.tsx`, `src/dev-dashboard/__tests__/flowValidation.test.ts`

## File Structure

- Modify `src/domain/flow-engine/types.ts`: add a deferred safety effect and runtime state for pending post-result routing.
- Modify `src/domain/flow-engine/advanceFlow.ts`: apply the deferred safety effect without stopping the flow; trigger navigation only after a result node is reached.
- Modify `src/domain/flow-engine/validateFlow.ts`: validate deferred safety effect fields.
- Modify `src/content/flows/srq20.json`: replace Q17 immediate `safety_interrupt` with deferred safety routing, keep `next: "q18"`, and keep Q17 out of score effects.
- Modify `src/features/orientation/OrientationScreen.tsx`: surface the post-result safety message before navigation, using the runtime state produced by the engine.
- Create `src/dev-dashboard/flows/flowRedirections.ts`: derive audit rows for score effects, score branches, deferred safety routing, immediate navigation, flow starts, immediate safety interrupts, and end-flow effects.
- Create `src/dev-dashboard/flows/FlowRedirections.tsx`: render the redirections tab based on derived rows.
- Modify `src/dev-dashboard/flows/FlowDashboard.tsx`: add tab-style switching between editor, preview, map, and redirections.
- Modify `src/dev-dashboard/flows/FlowEditor.tsx`: add large-flow navigation controls, show deferred safety editor fields on options, keep score editor separate.
- Modify `src/dev-dashboard/flows/FlowPreview.tsx`: use the real engine for preview so score branches and deferred safety behave like the orientation runtime.
- Modify tests under `src/domain/flow-engine/__tests__`, `src/features/orientation/__tests__`, and `src/dev-dashboard/__tests__`.

---

### Task 1: Add Deferred Safety Domain Types

**Files:**

- Modify: `src/domain/flow-engine/types.ts`
- Modify: `src/domain/flow-engine/advanceFlow.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Write the failing runtime behavior test**

Add this test near the existing safety interruption tests:

```ts
it('records deferred safety routing and continues until the result node', () => {
  const deferredSafetyFlow: GuidedFlow = {
    ...scoringFlow,
    id: 'deferred-safety-flow',
    title: 'Fluxo com segurança ao final',
    nodes: {
      q1: {
        id: 'q1',
        kind: 'choice',
        text: 'Você precisa de apoio?',
        options: [
          {
            id: 'yes',
            label: 'Sim',
            next: 'q2',
            effects: [
              {
                kind: 'deferred_safety',
                flagKey: 'self_harm_ideation',
                message: 'Obrigado por responder com sinceridade. Vamos abrir a página de apoio depois do resultado.',
                destination: '/apoio',
              },
            ],
          },
          { id: 'no', label: 'Não', next: 'q2' },
        ],
      },
      q2: {
        id: 'q2',
        kind: 'choice',
        text: 'Última pergunta.',
        options: [{ id: 'finish', label: 'Finalizar', next: 'result' }],
      },
      result: { id: 'result', kind: 'result', text: 'Resultado calculado.' },
    },
  };

  let state = createInitialFlowState(deferredSafetyFlow, [deferredSafetyFlow]);
  state = advanceFlow(state, [deferredSafetyFlow], 'Sim');

  expect(state.activeNodeId).toBe('q2');
  expect(state.pendingNavigation).toBeUndefined();
  expect(state.safetyFlags.self_harm_ideation).toBe(true);
  expect(state.deferredNavigation).toEqual({
    destination: '/apoio',
    message: 'Obrigado por responder com sinceridade. Vamos abrir a página de apoio depois do resultado.',
    reason: 'self_harm_ideation',
  });

  state = advanceFlow(state, [deferredSafetyFlow], 'Finalizar');

  expect(state.activeNodeId).toBe('result');
  expect(state.pendingNavigation).toBe('/apoio');
  expect(state.transcript.map((message) => message.text)).toContain('Resultado calculado.');
  expect(state.transcript.map((message) => message.text)).toContain(
    'Obrigado por responder com sinceridade. Vamos abrir a página de apoio depois do resultado.',
  );
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm run test -- src/domain/flow-engine/__tests__/flow-engine.test.ts -t "records deferred safety routing"`

Expected: FAIL because `deferred_safety` and `deferredNavigation` are not defined.

- [ ] **Step 3: Add the domain types**

In `src/domain/flow-engine/types.ts`, add:

```ts
export interface DeferredSafetyFlowEffect {
  kind: 'deferred_safety';
  flagKey: string;
  message: string;
  destination: Exclude<GlobalActionTarget, 'end'>;
}

export interface DeferredNavigationState {
  destination: Exclude<GlobalActionTarget, 'end'>;
  message: string;
  reason: string;
}
```

Update `FlowEffect` to include `DeferredSafetyFlowEffect`, and add `deferredNavigation?: DeferredNavigationState;` to `FlowRuntimeState`.

- [ ] **Step 4: Implement runtime application of deferred safety**

In `src/domain/flow-engine/advanceFlow.ts`, update `applyOptionEffects`:

```ts
if (effect.kind === 'deferred_safety') {
  return {
    ...nextState,
    safetyFlags: {
      ...nextState.safetyFlags,
      [effect.flagKey]: true,
    },
    deferredNavigation: {
      destination: effect.destination,
      message: effect.message,
      reason: effect.flagKey,
    },
  };
}
```

Update `advanceToNode` so result nodes append the result first, then append the deferred message and set `pendingNavigation`:

```ts
function advanceToNode(state: FlowRuntimeState, flow: GuidedFlow, nodeId: string): FlowRuntimeState {
  const node = flow.nodes[nodeId];

  if (node.kind === 'score_branch') {
    return advanceToNode(state, flow, resolveScoreBranchNextNode(state, node));
  }

  const nextState = {
    ...state,
    activeNodeId: node.id,
    transcript: [...state.transcript, createMessage('bot', node.text, flow.id, node.id)],
  };

  if (node.kind !== 'result' || !nextState.deferredNavigation) return nextState;

  return {
    ...nextState,
    pendingNavigation: nextState.deferredNavigation.destination,
    transcript: [...nextState.transcript, createMessage('bot', nextState.deferredNavigation.message, flow.id, node.id)],
  };
}
```

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `pnpm run test -- src/domain/flow-engine/__tests__/flow-engine.test.ts -t "records deferred safety routing"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/flow-engine/types.ts src/domain/flow-engine/advanceFlow.ts src/domain/flow-engine/__tests__/flow-engine.test.ts
git commit -m "feat: add deferred safety routing to flow engine"
```

---

### Task 2: Validate Deferred Safety Effects

**Files:**

- Modify: `src/domain/flow-engine/validateFlow.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Write validation test**

Add this test near the existing validation tests:

```ts
it('validates deferred safety effects', () => {
  const invalidFlow: GuidedFlow = {
    ...validFlow,
    nodes: {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'Você precisa de apoio?',
        options: [
          {
            id: 'yes',
            label: 'Sim',
            next: 'end',
            effects: [
              {
                kind: 'deferred_safety',
                flagKey: '',
                message: '',
                destination: '/privacidade' as '/apoio',
              },
            ],
          },
        ],
      },
      end: { id: 'end', kind: 'result', text: 'Fim.' },
    },
  };

  expect(validateFlow(invalidFlow).errors).toContain(
    'Flow fixture-flow option yes deferred safety effect must include flagKey, message, and supported destination.',
  );
});
```

- [ ] **Step 2: Run the focused validation test to verify it fails**

Run: `pnpm run test -- src/domain/flow-engine/__tests__/flow-engine.test.ts -t "validates deferred safety effects"`

Expected: FAIL because `validateEffect` does not handle `deferred_safety`.

- [ ] **Step 3: Add validation branch**

In `src/domain/flow-engine/validateFlow.ts`, add this branch after `safety_interrupt` validation:

```ts
if (effect.kind === 'deferred_safety') {
  if (
    !hasText(effect.flagKey) ||
    !hasText(effect.message) ||
    !['/apoio', '/contatos', '/educacao'].includes(String(effect.destination))
  ) {
    errors.push(
      `Flow ${flowLabel} option ${optionId} deferred safety effect must include flagKey, message, and supported destination.`,
    );
  }
  return;
}
```

- [ ] **Step 4: Run the focused validation test to verify it passes**

Run: `pnpm run test -- src/domain/flow-engine/__tests__/flow-engine.test.ts -t "validates deferred safety effects"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/flow-engine/validateFlow.ts src/domain/flow-engine/__tests__/flow-engine.test.ts
git commit -m "test: validate deferred safety flow effects"
```

---

### Task 3: Update SRQ-20 Q17 Content

**Files:**

- Modify: `src/content/flows/srq20.json`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Replace the old SRQ-20 Q17 regression test**

Replace the current test named `routes SRQ-20 Q17 affirmative through generic JSON safety interruption` with:

```ts
it('runs SRQ-20 Q17 affirmative through deferred support routing after the final result', () => {
  let state = createInitialFlowStateFromRegistry(flowRegistry.flows, 'srq20');

  state = advanceFlow(state, flowRegistry.flows, 'Quero responder');
  state = advanceFlow(state, flowRegistry.flows, 'Continuar');

  for (let question = 1; question <= 16; question++) {
    state = advanceFlow(state, flowRegistry.flows, 'Não');
  }

  state = advanceFlow(state, flowRegistry.flows, 'Sim');

  expect(state.activeNodeId).toBe('q18');
  expect(state.pendingNavigation).toBeUndefined();
  expect(state.safetyFlags.self_harm_ideation).toBe(true);

  state = advanceFlow(state, flowRegistry.flows, 'Não');
  state = advanceFlow(state, flowRegistry.flows, 'Não');
  state = advanceFlow(state, flowRegistry.flows, 'Não');

  expect(state.activeNodeId).toBe('low-distress-result');
  expect(state.pendingNavigation).toBe('/apoio');
  expect(state.transcript.map((message) => message.text)).toContain(
    'Obrigado por responder com sinceridade. Como você marcou um sinal que merece cuidado imediato, vamos abrir a página de apoio agora. Você não está sozinho(a).',
  );
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm run test -- src/domain/flow-engine/__tests__/flow-engine.test.ts -t "SRQ-20 Q17 affirmative"`

Expected: FAIL because SRQ-20 still uses immediate `safety_interrupt`.

- [ ] **Step 3: Update Q17 in `src/content/flows/srq20.json`**

Change only the `q17.options[0]` effect from `safety_interrupt` to `deferred_safety`, keeping `next` as `q18`:

```json
{
  "id": "yes",
  "label": "Sim",
  "next": "q18",
  "effects": [
    {
      "kind": "deferred_safety",
      "flagKey": "self_harm_ideation",
      "message": "Obrigado por responder com sinceridade. Como você marcou um sinal que merece cuidado imediato, vamos abrir a página de apoio agora. Você não está sozinho(a).",
      "destination": "/apoio"
    }
  ]
}
```

Keep Q17 without a `score` effect. Q1-Q16 and Q18-Q20 remain the score-contributing SRQ-20 questions.

- [ ] **Step 4: Run flow validation and focused test**

Run:

```bash
pnpm run validate:flows
pnpm run test -- src/domain/flow-engine/__tests__/flow-engine.test.ts -t "SRQ-20 Q17 affirmative"
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/flows/srq20.json src/domain/flow-engine/__tests__/flow-engine.test.ts
git commit -m "fix: defer SRQ-20 safety routing until final result"
```

---

### Task 4: Preserve Orientation UX Until Final Message Is Visible

**Files:**

- Modify: `src/features/orientation/OrientationScreen.tsx`
- Test: `src/features/orientation/__tests__/OrientationScreen.test.tsx`

- [ ] **Step 1: Write UI regression test**

Add this test to `src/features/orientation/__tests__/OrientationScreen.test.tsx`:

```tsx
it('continues SRQ-20 after Q17 yes and navigates to apoio only after the final result', async () => {
  const user = userEvent.setup();
  renderOrientation();

  startOrientationWithStarter('Quero responder o SRQ-20');
  advanceInitialLoad();

  await user.click(screen.getByRole('option', { name: 'Quero responder' }));
  await user.click(screen.getByRole('option', { name: 'Continuar' }));

  for (let question = 1; question <= 16; question++) {
    await user.click(screen.getByRole('option', { name: 'Não' }));
  }

  await user.click(screen.getByRole('option', { name: 'Sim' }));

  expect(screen.getByText(/Você tem dormido mal/i)).toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalledWith('/apoio');

  await user.click(screen.getByRole('option', { name: 'Não' }));
  await user.click(screen.getByRole('option', { name: 'Não' }));
  await user.click(screen.getByRole('option', { name: 'Não' }));

  expect(screen.getByText(/Obrigado por responder com sinceridade/i)).toBeInTheDocument();
  expect(mockNavigate).toHaveBeenCalledWith('/apoio');
});
```

If the file uses `fireEvent`, keep the existing helper style and preserve the same assertions.

- [ ] **Step 2: Run the focused UI test**

Run: `pnpm run test -- src/features/orientation/__tests__/OrientationScreen.test.tsx -t "continues SRQ-20 after Q17 yes"`

Expected: PASS after Tasks 1-3 if `OrientationScreen` waits for visible messages before navigating. If it fails because navigation fires before the message is visible, continue to Step 3.

- [ ] **Step 3: Ensure navigation waits for reveal completion**

In `src/features/orientation/OrientationScreen.tsx`, keep this guard on pending navigation:

```ts
useEffect(() => {
  if (state && !isRevealing && state.pendingNavigation) {
    navigate(state.pendingNavigation);
  }
}, [navigate, state, isRevealing]);
```

Do not navigate immediately inside `submitOption` for deferred safety effects. Only the engine should set `pendingNavigation` after the result node is reached.

- [ ] **Step 4: Run the focused UI test again**

Run: `pnpm run test -- src/features/orientation/__tests__/OrientationScreen.test.tsx -t "continues SRQ-20 after Q17 yes"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/orientation/OrientationScreen.tsx src/features/orientation/__tests__/OrientationScreen.test.tsx
git commit -m "test: cover deferred SRQ-20 support navigation in orientation"
```

---

### Task 5: Add Flow Redirection Derivation Utility

**Files:**

- Create: `src/dev-dashboard/flows/flowRedirections.ts`
- Test: `src/dev-dashboard/__tests__/flowRedirections.test.ts`

- [ ] **Step 1: Create failing tests for derived redirection rows**

Create `src/dev-dashboard/__tests__/flowRedirections.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { getFlowRedirections } from '../flows/flowRedirections';

const flow: GuidedFlow = {
  id: 'test-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo de teste',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'q1', enteringPhrases: ['Começar'], transitionMessage: 'Olá.' },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Pergunta 1',
      options: [
        {
          id: 'yes',
          label: 'Sim',
          next: 'q2',
          effects: [
            { kind: 'score', scoreKey: 'srq20', value: 1 },
            {
              kind: 'deferred_safety',
              flagKey: 'self_harm_ideation',
              message: 'Mensagem de apoio.',
              destination: '/apoio',
            },
          ],
        },
      ],
    },
    q2: {
      id: 'q2',
      kind: 'score_branch',
      text: 'Pontuação',
      scoreKey: 'srq20',
      branches: [{ id: 'low', min: 0, max: 6, next: 'low-result' }],
    },
    'low-result': { id: 'low-result', kind: 'result', text: 'Resultado.' },
  },
};

describe('getFlowRedirections', () => {
  it('returns deferred safety, score, and score branch rows', () => {
    expect(getFlowRedirections(flow)).toEqual([
      {
        id: 'deferred-safety:test-flow:q1:yes:self_harm_ideation',
        kind: 'deferred_safety',
        nodeId: 'q1',
        optionId: 'yes',
        title: 'Encaminhamento de segurança ao final',
        summary: 'Sim marca self_harm_ideation, continua para q2 e depois abre /apoio.',
      },
      {
        id: 'score:test-flow:q1:yes:srq20',
        kind: 'score',
        nodeId: 'q1',
        optionId: 'yes',
        title: '+1 em srq20',
        summary: 'Sim soma +1 em srq20 e segue para q2.',
      },
      {
        id: 'score-branch:test-flow:q2:srq20',
        kind: 'score_branch',
        nodeId: 'q2',
        title: 'Ramificação por pontuação srq20',
        summary: '1 faixa decide o próximo resultado.',
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm run test -- src/dev-dashboard/__tests__/flowRedirections.test.ts`

Expected: FAIL because `flowRedirections.ts` does not exist.

- [ ] **Step 3: Implement `getFlowRedirections`**

Create `src/dev-dashboard/flows/flowRedirections.ts` with derived row types and ordering:

```ts
import type { FlowEffect, GuidedFlow } from '../../domain/flow-engine/types';

export type FlowRedirectionKind =
  | 'deferred_safety'
  | 'score'
  | 'score_branch'
  | 'safety_interrupt'
  | 'navigate'
  | 'flow_start'
  | 'end_flow';

export interface FlowRedirectionRow {
  id: string;
  kind: FlowRedirectionKind;
  nodeId: string;
  optionId?: string;
  title: string;
  summary: string;
}

export function getFlowRedirections(flow: GuidedFlow): FlowRedirectionRow[] {
  const rows: FlowRedirectionRow[] = [];

  Object.values(flow.nodes).forEach((node) => {
    if (node.kind === 'score_branch') {
      rows.push({
        id: `score-branch:${flow.id}:${node.id}:${node.scoreKey}`,
        kind: 'score_branch',
        nodeId: node.id,
        title: `Ramificação por pontuação ${node.scoreKey}`,
        summary: `${node.branches.length} ${node.branches.length === 1 ? 'faixa decide' : 'faixas decidem'} o próximo resultado.`,
      });
      return;
    }

    if (node.kind !== 'choice') return;

    node.options.forEach((option) => {
      option.effects?.forEach((effect) => {
        rows.push(toEffectRow(flow.id, node.id, option.id, option.label, option.next, effect));
      });
    });
  });

  return rows.sort(compareRows);
}

function toEffectRow(
  flowId: string,
  nodeId: string,
  optionId: string,
  optionLabel: string,
  nextNodeId: string,
  effect: FlowEffect,
): FlowRedirectionRow {
  if (effect.kind === 'deferred_safety') {
    return {
      id: `deferred-safety:${flowId}:${nodeId}:${optionId}:${effect.flagKey}`,
      kind: 'deferred_safety',
      nodeId,
      optionId,
      title: 'Encaminhamento de segurança ao final',
      summary: `${optionLabel} marca ${effect.flagKey}, continua para ${nextNodeId} e depois abre ${effect.destination}.`,
    };
  }

  if (effect.kind === 'score') {
    return {
      id: `score:${flowId}:${nodeId}:${optionId}:${effect.scoreKey}`,
      kind: 'score',
      nodeId,
      optionId,
      title: `${effect.value >= 0 ? '+' : ''}${effect.value} em ${effect.scoreKey}`,
      summary: `${optionLabel} soma ${effect.value >= 0 ? '+' : ''}${effect.value} em ${effect.scoreKey} e segue para ${nextNodeId}.`,
    };
  }

  if (effect.kind === 'safety_interrupt') {
    return {
      id: `safety-interrupt:${flowId}:${nodeId}:${optionId}`,
      kind: 'safety_interrupt',
      nodeId,
      optionId,
      title: 'Interrupção de segurança imediata',
      summary: `${optionLabel} interrompe o fluxo e abre ${effect.destination}.`,
    };
  }

  if (effect.kind === 'navigate') {
    return {
      id: `navigate:${flowId}:${nodeId}:${optionId}:${effect.destination}`,
      kind: 'navigate',
      nodeId,
      optionId,
      title: 'Navegação de tela',
      summary: `${optionLabel} encerra a conversa e abre ${effect.destination}.`,
    };
  }

  if (effect.kind === 'flow_start') {
    return {
      id: `flow-start:${flowId}:${nodeId}:${optionId}:${effect.flowId}`,
      kind: 'flow_start',
      nodeId,
      optionId,
      title: 'Início de outro fluxo',
      summary: `${optionLabel} começa o fluxo ${effect.flowId}.`,
    };
  }

  return {
    id: `end-flow:${flowId}:${nodeId}:${optionId}`,
    kind: 'end_flow',
    nodeId,
    optionId,
    title: 'Encerramento',
    summary: `${optionLabel} encerra a conversa com uma mensagem.`,
  };
}

function compareRows(a: FlowRedirectionRow, b: FlowRedirectionRow) {
  const order: Record<FlowRedirectionKind, number> = {
    deferred_safety: 0,
    safety_interrupt: 1,
    score_branch: 2,
    score: 3,
    navigate: 4,
    flow_start: 5,
    end_flow: 6,
  };

  return order[a.kind] - order[b.kind] || a.nodeId.localeCompare(b.nodeId) || a.id.localeCompare(b.id);
}
```

- [ ] **Step 4: Run the focused test**

Run: `pnpm run test -- src/dev-dashboard/__tests__/flowRedirections.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dev-dashboard/flows/flowRedirections.ts src/dev-dashboard/__tests__/flowRedirections.test.ts
git commit -m "feat: derive flow redirection audit rows"
```

---

### Task 6: Render Redirections Tab in Dashboard

**Files:**

- Create: `src/dev-dashboard/flows/FlowRedirections.tsx`
- Modify: `src/dev-dashboard/flows/FlowDashboard.tsx`
- Modify: `src/dev-dashboard/flows/FlowEditor.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Write dashboard UI test**

Add this test to `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`:

```tsx
it('shows deferred safety routing in the flow redirections tab', async () => {
  const user = userEvent.setup();
  render(<DashboardRoute />);

  await user.click(screen.getByRole('button', { name: 'Redirecionamentos' }));

  expect(screen.getByText('Encaminhamento de segurança ao final')).toBeInTheDocument();
  expect(screen.getByText(/continua para q18/i)).toBeInTheDocument();
  expect(screen.getByText(/depois abre \/apoio/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused dashboard test to verify it fails**

Run: `pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx -t "redirections tab"`

Expected: FAIL because the tab/component does not exist.

- [ ] **Step 3: Create `FlowRedirections.tsx`**

Create `src/dev-dashboard/flows/FlowRedirections.tsx`:

```tsx
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';
import { getFlowRedirections, type FlowRedirectionKind } from './flowRedirections';

const kindLabels: Record<FlowRedirectionKind, string> = {
  deferred_safety: 'Encaminhamento de segurança ao final',
  safety_interrupt: 'Interrupção de segurança imediata',
  score_branch: 'Ramificação por pontuação',
  score: 'Pontuação acumulada',
  navigate: 'Navegação de tela',
  flow_start: 'Início de outro fluxo',
  end_flow: 'Encerramento',
};

export function FlowRedirections({ flow, onEditNode }: { flow: GuidedFlow; onEditNode: (nodeId: string) => void }) {
  const rows = getFlowRedirections(flow);

  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <div>
        <h2 className="font-headline-sm text-on-surface">Redirecionamentos</h2>
        <p className="mt-1 font-body-md text-on-surface-variant">
          Pontuações, ramificações e encaminhamentos que precisam ficar visíveis para revisão.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-outline-variant/70 p-6 text-center">
          <p className="font-label-lg text-on-surface">Este fluxo não tem redirecionamentos</p>
          <p className="mt-1 font-body-md text-on-surface-variant">
            Todas as opções apenas avançam para a próxima etapa.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="rounded-full bg-surface px-3 py-1 font-label-sm text-on-surface-variant">
                    {kindLabels[row.kind]}
                  </span>
                  <h3 className="mt-2 font-label-lg text-on-surface">{row.title}</h3>
                  <p className="mt-1 font-body-md text-on-surface-variant">{row.summary}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => onEditNode(row.nodeId)}>
                  Editar etapa
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add tab switching in `FlowDashboard.tsx`**

Add `FlowRedirections`, `activeDetailTab`, and `focusedNodeId`. Render these tab labels: `Editor`, `Testar conversa`, `Mapa visual`, `Redirecionamentos`. Render `FlowRedirections` when `activeDetailTab === 'redirections'`, and switch back to editor with `focusedNodeId` when an audit row's `Editar etapa` button is clicked.

- [ ] **Step 5: Update `FlowEditor` props for focused node navigation**

Add props:

```ts
focusedNodeId?: string | null;
onFocusedNodeHandled?: () => void;
```

Add effect:

```ts
useEffect(() => {
  if (!focusedNodeId) return;

  setExpandedNodeIds((current) => ({
    ...current,
    [`${flow.id}:${focusedNodeId}`]: true,
  }));
  onFocusedNodeHandled?.();
}, [flow.id, focusedNodeId, onFocusedNodeHandled]);
```

Update import to `import { useEffect, useState } from 'react';`.

- [ ] **Step 6: Run dashboard tests**

Run: `pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx -t "redirections tab"`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/dev-dashboard/flows/FlowRedirections.tsx src/dev-dashboard/flows/FlowDashboard.tsx src/dev-dashboard/flows/FlowEditor.tsx src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "feat: add flow redirections dashboard tab"
```

---

### Task 7: Add Large-Flow Navigation to Flow Editor

**Files:**

- Modify: `src/dev-dashboard/flows/FlowEditor.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Write UI test for search/filter controls**

Add this test:

```tsx
it('filters large flow editor nodes by deferred safety marker', async () => {
  const user = userEvent.setup();
  render(<DashboardRoute />);

  await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
  await user.click(screen.getByRole('button', { name: 'Editor' }));
  await user.click(screen.getByRole('button', { name: /Apoio ao final/i }));

  expect(screen.getByText(/Etapa 18 — q17/i)).toBeInTheDocument();
  expect(screen.queryByText(/Etapa 19 — q18/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx -t "filters large flow editor nodes"`

Expected: FAIL because editor filters do not exist.

- [ ] **Step 3: Add editor filter state and derived nodes**

In `FlowEditor.tsx`, add:

```ts
const [nodeSearch, setNodeSearch] = useState('');
const [activeNodeFilter, setActiveNodeFilter] = useState<'all' | 'result' | 'safety' | 'branch'>('all');

function nodeHasDeferredSafety(node: FlowNode) {
  return (
    node.kind === 'choice' &&
    node.options.some((option) => option.effects?.some((effect) => effect.kind === 'deferred_safety'))
  );
}

const visibleNodes = nodes.filter((node) => {
  const normalizedSearch = nodeSearch.trim().toLocaleLowerCase('pt-BR');
  const matchesSearch =
    !normalizedSearch ||
    node.id.toLocaleLowerCase('pt-BR').includes(normalizedSearch) ||
    node.text.toLocaleLowerCase('pt-BR').includes(normalizedSearch);

  if (!matchesSearch) return false;
  if (activeNodeFilter === 'result') return node.kind === 'result';
  if (activeNodeFilter === 'branch') return node.kind === 'score_branch';
  if (activeNodeFilter === 'safety') return nodeHasDeferredSafety(node);
  return true;
});
```

Render toolbar before the `Etapas` list:

```tsx
<div className="flex flex-col gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-low p-3">
  <input
    aria-label="Buscar etapa"
    className={inputClassSm}
    placeholder="Buscar etapa..."
    value={nodeSearch}
    onChange={(event) => setNodeSearch(event.target.value)}
  />
  <div className="flex flex-wrap gap-2">
    {[
      ['all', 'Todas'],
      ['result', 'Resultado'],
      ['safety', 'Apoio ao final'],
      ['branch', 'Ramificação'],
    ].map(([filter, label]) => (
      <button
        key={filter}
        type="button"
        onClick={() => setActiveNodeFilter(filter as typeof activeNodeFilter)}
        className={`rounded-full px-3 py-1 font-label-sm ${
          activeNodeFilter === filter
            ? 'bg-secondary-container text-on-secondary-container'
            : 'bg-surface text-on-surface'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
  <p className="font-body-sm text-on-surface-variant">
    {visibleNodes.length} {visibleNodes.length === 1 ? 'etapa visível' : 'etapas visíveis'}
  </p>
</div>
```

Change the node render loop from `nodes.map` to `visibleNodes.map`.

- [ ] **Step 4: Run the focused test**

Run: `pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx -t "filters large flow editor nodes"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dev-dashboard/flows/FlowEditor.tsx src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "feat: add large flow navigation filters"
```

---

### Task 8: Add Deferred Safety Editing UI

**Files:**

- Modify: `src/dev-dashboard/flows/FlowEditor.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Write test for editing deferred safety separately from score**

Add this test:

```tsx
it('shows deferred safety editor separately from score editor on SRQ-20 Q17', async () => {
  const user = userEvent.setup();
  render(<DashboardRoute />);

  await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
  await user.click(screen.getByRole('button', { name: 'Editor' }));
  await user.click(screen.getByRole('button', { name: /Etapa 18 — q17/i }));

  expect(screen.getByText('Encaminhamento de segurança')).toBeInTheDocument();
  expect(screen.getByDisplayValue('self_harm_ideation')).toBeInTheDocument();
  expect(screen.getByText(/Q17 não soma pontos/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused test to verify it fails**

Run: `pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx -t "deferred safety editor"`

Expected: FAIL because the editor does not render deferred safety fields.

- [ ] **Step 3: Add effect helper functions in `FlowEditor.tsx`**

Add these helpers inside `FlowEditor`:

```ts
function getDeferredSafetyEffect(option: ChoiceFlowNode['options'][number]) {
  return option.effects?.find((effect) => effect.kind === 'deferred_safety');
}

function updateOptionEffects(
  node: ChoiceFlowNode,
  optionId: string,
  updater: (
    effects: NonNullable<ChoiceFlowNode['options'][number]['effects']>,
  ) => ChoiceFlowNode['options'][number]['effects'],
) {
  const option = node.options.find((item) => item.id === optionId);
  const nextEffects = updater(option?.effects ?? []);
  updateChoiceOption(node, optionId, { effects: nextEffects?.length ? nextEffects : undefined });
}
```

- [ ] **Step 4: Render deferred safety block under each option**

Inside the option card JSX for `node.kind === 'choice'`, after the primary action fields and before score UI, render controls for:

```tsx
<p className="font-label-md text-on-surface">Encaminhamento de segurança</p>
<p className="font-body-sm text-on-surface-variant">
  Marca um sinal sensível e encaminha ao apoio depois do resultado final.
</p>
```

The active deferred safety effect must edit these fields:

```tsx
<input className={inputClassSm} value={getDeferredSafetyEffect(option)?.flagKey ?? ''} />
<select className={inputClassSm} value={getDeferredSafetyEffect(option)?.destination ?? '/apoio'}>
  <option value="/apoio">/apoio — Apoio imediato</option>
  <option value="/contatos">/contatos — Contatos de apoio</option>
  <option value="/educacao">/educacao — Materiais educativos</option>
</select>
<textarea className={textareaClass} value={getDeferredSafetyEffect(option)?.message ?? ''} />
```

Use `updateOptionEffects` in each `onChange` to update only the `deferred_safety` effect. Add buttons named `Ativar` and `Remover encaminhamento`.

For SRQ-20 Q17 specifically, render this note if the option has deferred safety and no score effect:

```tsx
<p className="font-body-sm text-on-surface-variant md:col-span-3">
  Q17 não soma pontos no SRQ-20. Ela fica separada da pontuação para não esconder uma regra de segurança dentro do
  cálculo.
</p>
```

- [ ] **Step 5: Run focused test**

Run: `pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx -t "deferred safety editor"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/dev-dashboard/flows/FlowEditor.tsx src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "feat: edit deferred safety routing in flow dashboard"
```

---

### Task 9: Make Flow Preview Use Real Engine Behavior

**Files:**

- Modify: `src/dev-dashboard/flows/FlowPreview.tsx`
- Test: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Write preview behavior test**

Add this test:

```tsx
it('previews deferred safety after SRQ-20 final result', async () => {
  const user = userEvent.setup();
  render(<DashboardRoute />);

  await user.click(screen.getByRole('button', { name: 'SRQ-20' }));
  await user.click(screen.getByRole('button', { name: 'Testar conversa' }));

  await user.click(screen.getByRole('button', { name: 'Quero responder' }));
  await user.click(screen.getByRole('button', { name: 'Continuar' }));

  for (let question = 1; question <= 16; question++) {
    await user.click(screen.getByRole('button', { name: 'Não' }));
  }

  await user.click(screen.getByRole('button', { name: 'Sim' }));

  expect(screen.getByText(/Você tem dormido mal/i)).toBeInTheDocument();
  expect(screen.queryByText(/vamos abrir a página de apoio agora/i)).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Não' }));
  await user.click(screen.getByRole('button', { name: 'Não' }));
  await user.click(screen.getByRole('button', { name: 'Não' }));

  expect(screen.getByText(/vamos abrir a página de apoio agora/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused preview test to verify it fails**

Run: `pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx -t "previews deferred safety"`

Expected: FAIL because `FlowPreview` currently has simplified routing.

- [ ] **Step 3: Refactor `FlowPreview` to use the engine**

In `src/dev-dashboard/flows/FlowPreview.tsx`, import:

```ts
import { advanceFlow } from '../../domain/flow-engine/advanceFlow';
import { createInitialFlowState } from '../../domain/flow-engine/loadFlows';
import { resolveOptions } from '../../domain/flow-engine/resolveOptions';
```

Replace local active node/message state with:

```ts
const [state, setState] = useState(() => createInitialFlowState(flow, flows));
const options = resolveOptions(state, flows).filter((option) => option.kind === 'node_option');

function chooseOption(label: string) {
  setState((current) => advanceFlow(current, flows, label));
}

function clearChat() {
  setState(createInitialFlowState(flow, flows));
}
```

Render `state.transcript` and call `chooseOption(option.label)` from option buttons.

- [ ] **Step 4: Run focused preview test**

Run: `pnpm run test -- src/dev-dashboard/__tests__/dashboardRoute.test.tsx -t "previews deferred safety"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dev-dashboard/flows/FlowPreview.tsx src/dev-dashboard/__tests__/dashboardRoute.test.tsx
git commit -m "fix: preview flows through real engine"
```

---

### Task 10: Full Verification

**Files:**

- Modify only files touched by earlier tasks if verification reveals issues.

- [ ] **Step 1: Run full flow validation**

Run: `pnpm run validate:flows`

Expected: PASS with no validation errors.

- [ ] **Step 2: Run test suite**

Run: `pnpm run test`

Expected: PASS.

- [ ] **Step 3: Run type/lint check**

Run: `pnpm run lint`

Expected: PASS.

- [ ] **Step 4: Run production build**

Run: `pnpm run build`

Expected: PASS.

- [ ] **Step 5: Run full quality gate**

Run: `pnpm run check`

Expected: PASS.

- [ ] **Step 6: Commit final verification fixes if any were needed**

If earlier verification required code fixes, commit them:

```bash
git add src/domain/flow-engine src/content/flows src/features/orientation src/dev-dashboard
git commit -m "fix: stabilize flow redirections implementation"
```

If no fixes were needed, do not create an empty commit.

---

## Implementation Notes

- Keep `safety_interrupt` for immediate exits. Do not repurpose it for Q17.
- Use `deferred_safety` for Q17 so the questionnaire can continue to q18, q19, q20, and `srq20-score`.
- Keep Q17 out of the `srq20` score. The score summary should list Q1-Q16 and Q18-Q20 as the 19 scoring questions.
- The redirections tab should list score effects and score branches because they are audit-relevant, even though they are not screen navigation.
- The deferred safety message should be visible before routing to `/apoio`; preserve the existing `!isRevealing` navigation guard in orientation.
- Do not add backend persistence, analytics, saved transcripts, or answer history.

## Self-Review

- Spec coverage: Tasks 1-4 cover the new Q17 runtime behavior; Tasks 5-6 cover redirections audit UX; Tasks 7-8 cover large-flow/editor UX; Task 9 covers preview fidelity; Task 10 covers verification.
- Placeholder scan: This plan contains concrete paths, commands, and code snippets for each implementation task.
- Type consistency: The new effect is consistently named `deferred_safety`; the runtime pending object is consistently named `deferredNavigation`; the safety flag key used for SRQ-20 is `self_harm_ideation`.
