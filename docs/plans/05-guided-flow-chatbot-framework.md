# Front 05 Guided Flow Chatbot Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded orientation prototype with a deterministic, JSON-compatible guided-flow framework and constrained chat UI.

**Architecture:** TypeScript domain modules own validation and runtime behavior, content modules own flow data, and React renders only the current transcript and available options. Flow state stays in memory only; no answers, transcript, or flow state are persisted.

**Tech Stack:** React 19, React Router 7, TypeScript, Vitest, Testing Library, Tailwind CSS 4, lucide-react.

---

## File Structure

- Create: `src/domain/flow-engine/types.ts` for shared flow, option, transcript, state, and action types.
- Create: `src/domain/flow-engine/validateFlow.ts` for lightweight structural validation and invalid `next` reference checks.
- Create: `src/domain/flow-engine/loadFlows.ts` for registry validation and initial runtime state creation.
- Create: `src/domain/flow-engine/resolveOptions.ts` for current-node options, other-flow entry phrases, and global actions.
- Create: `src/domain/flow-engine/advanceFlow.ts` for deterministic state transitions.
- Create: `src/domain/flow-engine/suspendFlow.ts` and `src/domain/flow-engine/resumeFlow.ts` for in-memory flow switching support.
- Create: `src/domain/flow-engine/safetyRules.ts` for the first no-op safety gate.
- Create: `src/domain/flow-engine/__tests__/flow-engine.test.ts` for RED-GREEN coverage of validation, loading, option resolution, advancement, switching, and resume.
- Create: `src/content/flows/work-stress.ts` for the first small teacher-oriented flow.
- Create: `src/content/flows/rest-recovery.ts` for a second small teacher-oriented flow used by real flow switching.
- Modify: `src/content/flows/registry.ts` to export validated flow content instead of the placeholder array.
- Modify: `src/features/orientation/OrientationScreen.tsx` to render the constrained guided flow as a clean chat surface.
- Create: `src/features/orientation/__tests__/OrientationScreen.test.tsx` for UI constraints and route action coverage.
- Modify: `docs/plans/README.md` to include this plan.

---

### Task 1: Flow Types, Registry, And Validator

**Files:**
- Create: `src/domain/flow-engine/types.ts`
- Create: `src/domain/flow-engine/validateFlow.ts`
- Create: `src/content/flows/work-stress.ts`
- Modify: `src/content/flows/registry.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Write the failing validation tests**

```ts
import { describe, expect, it } from 'vitest';
import { validateFlow } from '../validateFlow';
import type { GuidedFlow } from '../types';

const validFlow: GuidedFlow = {
  id: 'fixture-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo de teste',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero começar o fluxo de teste'],
    transitionMessage: 'Vamos começar com calma.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que você quer testar?',
      options: [{ id: 'continue', label: 'Continuar', next: 'end' }],
    },
    end: {
      id: 'end',
      kind: 'result',
      text: 'Chegamos ao fim.',
      recommendations: ['respiracao-professores'],
    },
  },
};

describe('validateFlow', () => {
  it('accepts a JSON-compatible guided flow with explicit entering phrases', () => {
    expect(validateFlow(validFlow)).toEqual({ valid: true, errors: [] });
  });

  it('rejects invalid next references before runtime', () => {
    const invalidFlow: GuidedFlow = {
      ...validFlow,
      nodes: {
        ...validFlow.nodes,
        start: {
          ...validFlow.nodes.start,
          kind: 'choice',
          options: [{ id: 'missing', label: 'Ir para lugar ausente', next: 'missing-node' }],
        },
      },
    };

    expect(validateFlow(invalidFlow)).toEqual({
      valid: false,
      errors: ['Flow fixture-flow option missing points to missing node missing-node.'],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test src/domain/flow-engine/__tests__/flow-engine.test.ts`

Expected: FAIL because `validateFlow` and flow types do not exist.

- [ ] **Step 3: Implement minimal types, validator, and content registry**

Create `types.ts` with `GuidedFlow`, `FlowNode`, `FlowOption`, `FlowRuntimeState`, `ChatMessage`, and action types. Implement `validateFlow(flow)` to return `{ valid: boolean; errors: string[] }`, checking entry node existence, non-empty `enteringPhrases`, option ids/labels, and `next` references. Add `workStressFlow` content and export it through `flowRegistry.flows`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test src/domain/flow-engine/__tests__/flow-engine.test.ts`

Expected: PASS for validation tests.

---

### Task 2: Runtime Engine

**Files:**
- Create: `src/domain/flow-engine/loadFlows.ts`
- Create: `src/domain/flow-engine/resolveOptions.ts`
- Create: `src/domain/flow-engine/advanceFlow.ts`
- Create: `src/domain/flow-engine/suspendFlow.ts`
- Create: `src/domain/flow-engine/resumeFlow.ts`
- Create: `src/domain/flow-engine/safetyRules.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Write failing runtime tests**

```ts
import { advanceFlow } from '../advanceFlow';
import { createInitialFlowState } from '../loadFlows';
import { resolveOptions } from '../resolveOptions';
import { resumeFlow } from '../resumeFlow';
import { suspendFlow } from '../suspendFlow';

it('starts a flow with the entry transition and current node prompt', () => {
  const state = createInitialFlowState(validFlow, [validFlow]);

  expect(state.activeFlowId).toBe('fixture-flow');
  expect(state.activeNodeId).toBe('start');
  expect(state.transcript.map((message) => message.text)).toEqual([
    'Vamos começar com calma.',
    'O que você quer testar?',
  ]);
});

it('advances only through currently available options', () => {
  const state = createInitialFlowState(validFlow, [validFlow]);

  expect(() => advanceFlow(state, [validFlow], 'Resposta livre')).toThrow(
    'Selection Resposta livre is not available for node start.',
  );

  const nextState = advanceFlow(state, [validFlow], 'Continuar');
  expect(nextState.activeNodeId).toBe('end');
  expect(nextState.transcript.at(-1)?.text).toBe('Chegamos ao fim.');
});

it('resolves current options and global actions', () => {
  const state = createInitialFlowState(validFlow, [validFlow]);

  expect(resolveOptions(state, [validFlow]).map((option) => option.label)).toContain('Continuar');
  expect(resolveOptions(state, [validFlow]).map((option) => option.label)).toContain('Quero apoio agora');
});

it('suspends and resumes a flow in memory', () => {
  const state = createInitialFlowState(validFlow, [validFlow]);
  const suspended = suspendFlow(state);
  const resumed = resumeFlow({ ...suspended, activeFlowId: undefined, activeNodeId: undefined }, 'fixture-flow');

  expect(resumed.activeFlowId).toBe('fixture-flow');
  expect(resumed.activeNodeId).toBe('start');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test src/domain/flow-engine/__tests__/flow-engine.test.ts`

Expected: FAIL because runtime modules do not exist.

- [ ] **Step 3: Implement minimal runtime engine**

Implement in-memory state creation, option resolution, advancement by exact label, global navigation actions, suspend, resume, and a permissive `canResumeFlow()` safety rule.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test src/domain/flow-engine/__tests__/flow-engine.test.ts`

Expected: PASS for validation and runtime tests.

---

### Task 3: Constrained Orientation UI

**Files:**
- Modify: `src/features/orientation/OrientationScreen.tsx`
- Test: `src/features/orientation/__tests__/OrientationScreen.test.tsx`

- [ ] **Step 1: Write failing UI tests**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { OrientationScreen } from '../OrientationScreen';

describe('OrientationScreen', () => {
  it('renders guided orientation without free-text submission', () => {
    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Orientação guiada' })).toBeInTheDocument();
    expect(screen.getByText('Sobrecarga na escola')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filtrar opções disponíveis')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Digite ou escolha uma resposta...')).not.toBeInTheDocument();
  });

  it('advances when the user chooses an available option', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <OrientationScreen />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Muitas tarefas ao mesmo tempo' }));

    expect(screen.getByText('Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test src/features/orientation/__tests__/OrientationScreen.test.tsx`

Expected: FAIL because the current screen is the hardcoded prototype.

- [ ] **Step 3: Replace prototype with constrained guided chat**

Render a polished, mobile-first Orientation screen from `flowRegistry.flows`, using transcript bubbles, floating option chips, and a fixed chat composer. Clicking a suggestion should only fill the composer; the user submits by pressing the `Send` icon button. Disable send unless the input exactly matches an available option/action. Keep current node answers visually dominant, surface global actions through matching autocomplete, avoid extra explanatory panels, do not persist state, and do not imply AI understanding.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test src/features/orientation/__tests__/OrientationScreen.test.tsx`

Expected: PASS for constrained UI behavior.

---

### Task 4: Browser Verification And Full Checks

**Files:**
- Modify only files surfaced by test or browser feedback.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
pnpm run test
pnpm run lint
pnpm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Start the local dev server**

Run: `pnpm run dev`

Expected: Vite serves the app at `http://localhost:3000`.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000/orientacao`, inspect desktop and mobile-ish viewports, click one suggestion and confirm it fills the input without submitting, press send and confirm the transcript advances, type a partial global action and confirm it appears through autocomplete, and use one global action. Check that the UI is beautiful, calm, readable, responsive, has only one practical scroll surface, and cannot submit arbitrary free text.

- [ ] **Step 4: Refactor only if verification surfaces issues**

Make focused fixes, then rerun the relevant test and browser check.
