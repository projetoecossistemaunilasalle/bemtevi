# Neutral Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded orientation intro routing with deterministic neutral router flows and offer a calm post-flow next-step route after regular flow results.

**Architecture:** Neutral flows remain normal `guided_conversation` flows with optional `purpose` metadata, so the existing engine, parser, registry, and UI patterns continue to apply. Direct curated handoffs use a new `flow_start` effect/runtime option that starts another flow without suspending the neutral or completed flow.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing BemTeVi flow-engine modules.

---

## File Structure

- Modify: `src/domain/flow-engine/types.ts`
  - Add `FlowPurpose`, `FlowStartFlowEffect`, `NavigateFlowEffect`, and `RuntimeFlowStartOption`.
  - Extend `GuidedFlow`, `FlowEffect`, `RuntimeOptionKind`, and `RuntimeOption`.
- Modify: `src/domain/flow-engine/validateFlow.ts`
  - Validate optional `purpose`.
  - Validate `flow_start` and `navigate` effect shapes.
- Modify: `src/domain/flow-engine/loadFlows.ts`
  - Validate cross-flow `flow_start` targets in `validateRegisteredFlows`.
- Modify: `src/domain/flow-engine/advanceFlow.ts`
  - Handle runtime `flow_start` options.
  - Handle node options with `flow_start` effects without suspending current flow.
- Modify: `src/domain/flow-engine/resolveOptions.ts`
  - Add post-flow routing option on regular result nodes.
  - Prevent `post-flow-next-step` from offering itself.
- Modify: `src/domain/flow-engine/__tests__/flow-engine.test.ts`
  - Cover metadata, validation, direct flow starts, and post-flow routing.
- Create: `src/content/flows/neutral.ts`
  - Add orientation neutral flows and post-flow router content.
- Modify: `src/content/flows/registry.ts`
  - Register neutral flows alongside existing TypeScript and JSON flows.
- Modify: `src/content/__tests__/content.test.ts`
  - Assert new flow IDs and purpose metadata.
- Modify: `src/features/orientation/OrientationScreen.tsx`
  - Replace intro starters with neutral-flow starter mappings.
- Modify: `src/features/orientation/__tests__/OrientationScreen.test.tsx`
  - Update intro-copy expectations and add neutral routing coverage.

## Task 1: Add Flow Purpose And Flow Start Types

**Files:**

- Modify: `src/domain/flow-engine/types.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Write failing type/validation tests**

Add these tests inside the existing `describe('validateFlow', ...)` block in `src/domain/flow-engine/__tests__/flow-engine.test.ts`:

```ts
it('accepts optional neutral flow purpose metadata', () => {
  const neutralFlow: GuidedFlow = {
    ...validFlow,
    id: 'neutral-flow',
    purpose: 'orientation_entry',
  };

  expect(validateFlow(neutralFlow)).toEqual({ valid: true, errors: [] });
});

it('rejects unknown flow purpose metadata', () => {
  const invalidFlow = {
    ...validFlow,
    purpose: 'diagnostic_router',
  };

  expect(validateFlow(invalidFlow).errors).toContain(
    'Flow fixture-flow purpose must be one of orientation_entry, post_flow_routing.',
  );
});

it('rejects malformed flow_start and navigate effects', () => {
  const invalidFlow = {
    ...validFlow,
    nodes: {
      ...validFlow.nodes,
      start: {
        ...validFlow.nodes.start,
        options: [
          {
            id: 'bad-start',
            label: 'Começar outro fluxo',
            next: 'end',
            effects: [
              { kind: 'flow_start', flowId: '' },
              { kind: 'navigate', destination: 'end' },
            ],
          },
        ],
      },
    },
  };

  expect(validateFlow(invalidFlow).errors).toContain(
    'Flow fixture-flow option bad-start flow_start effect must include flowId.',
  );
  expect(validateFlow(invalidFlow).errors).toContain(
    'Flow fixture-flow option bad-start navigate effect must include a supported destination.',
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test src/domain/flow-engine/__tests__/flow-engine.test.ts`

Expected: FAIL because `purpose`, `flow_start`, and `navigate` validation is not implemented yet.

- [ ] **Step 3: Extend flow-engine types**

Update `src/domain/flow-engine/types.ts` with these additions:

```ts
export type FlowType = 'guided_conversation';
export type FlowPurpose = 'orientation_entry' | 'post_flow_routing';
export type FlowNodeKind = 'choice' | 'result' | 'score_branch';
export type ChatMessageSender = 'bot' | 'user';
export type RuntimeOptionKind = 'node_option' | 'entry_phrase' | 'global_action' | 'resume_flow' | 'flow_start';
export type GlobalActionTarget = '/apoio' | '/contatos' | '/educacao' | 'end';
```

Add the effect interface after `SafetyInterruptFlowEffect`:

```ts
export interface FlowStartFlowEffect {
  kind: 'flow_start';
  flowId: string;
}

export interface NavigateFlowEffect {
  kind: 'navigate';
  destination: Exclude<GlobalActionTarget, 'end'>;
}

export type FlowEffect = ScoreFlowEffect | SafetyInterruptFlowEffect | FlowStartFlowEffect | NavigateFlowEffect;
```

Add `purpose?: FlowPurpose;` to `GuidedFlow` after `type: FlowType;`.

Add the runtime option interface before `export type RuntimeOption`:

```ts
export interface RuntimeFlowStartOption {
  kind: 'flow_start';
  id: string;
  label: string;
  flowId: string;
}

export type RuntimeOption =
  | RuntimeNodeOption
  | RuntimeEntryOption
  | RuntimeGlobalAction
  | RuntimeResumeOption
  | RuntimeFlowStartOption;
```

- [ ] **Step 4: Validate purpose and flow_start shape**

Update `src/domain/flow-engine/validateFlow.ts`:

```ts
const allowedFlowPurposes = ['orientation_entry', 'post_flow_routing'];
```

Add this check inside `validateFlow` after the required `id` check:

```ts
if (flowRecord.purpose !== undefined && !allowedFlowPurposes.includes(String(flowRecord.purpose))) {
  errors.push(`Flow ${flowLabel} purpose must be one of ${allowedFlowPurposes.join(', ')}.`);
}
```

Add this case to `validateEffect`:

```ts
if (effect.kind === 'flow_start') {
  if (!hasText(effect.flowId)) {
    errors.push(`Flow ${flowLabel} option ${optionId} flow_start effect must include flowId.`);
  }
  return;
}

if (effect.kind === 'navigate') {
  if (!['/apoio', '/contatos', '/educacao'].includes(String(effect.destination))) {
    errors.push(`Flow ${flowLabel} option ${optionId} navigate effect must include a supported destination.`);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm run test src/domain/flow-engine/__tests__/flow-engine.test.ts`

Expected: PASS for the new validation tests and existing flow-engine tests.

- [ ] **Step 6: Commit**

```bash
git add src/domain/flow-engine/types.ts src/domain/flow-engine/validateFlow.ts src/domain/flow-engine/__tests__/flow-engine.test.ts
git commit -m "feat: add neutral flow metadata types"
```

## Task 2: Validate Registered Flow Start Targets

**Files:**

- Modify: `src/domain/flow-engine/loadFlows.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Write failing registry validation test**

Add this test inside `describe('flow runtime', ...)`:

```ts
it('rejects registered flow_start targets that do not exist', () => {
  const invalidFlow: GuidedFlow = {
    ...validFlow,
    nodes: {
      ...validFlow.nodes,
      start: {
        ...validFlow.nodes.start,
        options: [
          {
            id: 'missing-flow',
            label: 'Ir para outro fluxo',
            next: 'end',
            effects: [{ kind: 'flow_start', flowId: 'missing-target' }],
          },
        ],
      },
    },
  };

  expect(() => createInitialFlowStateFromRegistry([invalidFlow], 'fixture-flow')).toThrow(
    'Flow fixture-flow option missing-flow starts missing flow missing-target.',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test src/domain/flow-engine/__tests__/flow-engine.test.ts`

Expected: FAIL because cross-flow `flow_start` targets are not validated.

- [ ] **Step 3: Add registry-level target validation**

Update the imports in `src/domain/flow-engine/loadFlows.ts`:

```ts
import type { ChatMessage, FlowRuntimeState, FlowStartFlowEffect, GuidedFlow } from './types';
```

Update `validateRegisteredFlows`:

```ts
export function validateRegisteredFlows(flows: GuidedFlow[]) {
  const flowIds = new Set(flows.map((flow) => flow.id));
  const errors = [
    ...flows.flatMap((flow) => validateFlow(flow).errors),
    ...flows.flatMap((flow) => validateFlowStartTargets(flow, flowIds)),
  ];

  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}

function validateFlowStartTargets(flow: GuidedFlow, flowIds: Set<string>) {
  return Object.values(flow.nodes).flatMap((node) => {
    if (node.kind !== 'choice') return [];

    return node.options.flatMap((option) =>
      (option.effects ?? [])
        .filter((effect): effect is FlowStartFlowEffect => effect.kind === 'flow_start')
        .filter((effect) => !flowIds.has(effect.flowId))
        .map((effect) => `Flow ${flow.id} option ${option.id} starts missing flow ${effect.flowId}.`),
    );
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run test src/domain/flow-engine/__tests__/flow-engine.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/flow-engine/loadFlows.ts src/domain/flow-engine/__tests__/flow-engine.test.ts
git commit -m "feat: validate flow start targets"
```

## Task 3: Implement Direct Flow Start Runtime Behavior

**Files:**

- Modify: `src/domain/flow-engine/advanceFlow.ts`
- Modify: `src/domain/flow-engine/resolveOptions.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Write failing runtime tests**

Add this fixture near `secondFlow`:

```ts
const neutralRouterFlow: GuidedFlow = {
  id: 'neutral-router',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Roteador neutro',
  type: 'guided_conversation',
  purpose: 'orientation_entry',
  status: 'draft',
  entry: {
    nodeId: 'start',
    enteringPhrases: ['Quero escolher um caminho'],
    transitionMessage: 'Vamos escolher com calma.',
  },
  nodes: {
    start: {
      id: 'start',
      kind: 'choice',
      text: 'O que parece fazer sentido agora?',
      options: [
        {
          id: 'start-specific',
          label: 'Falar sobre sobrecarga',
          next: 'handoff',
          effects: [{ kind: 'flow_start', flowId: 'fixture-flow' }],
        },
      ],
    },
    handoff: {
      id: 'handoff',
      kind: 'result',
      text: 'Vou abrir outro caminho.',
    },
  },
};
```

Add these tests inside `describe('flow runtime', ...)`:

```ts
it('starts a target flow from a neutral flow option without suspending the neutral flow', () => {
  const state = createInitialFlowState(neutralRouterFlow, [neutralRouterFlow, validFlow]);
  const nextState = advanceFlow(state, [neutralRouterFlow, validFlow], 'Falar sobre sobrecarga');

  expect(nextState.activeFlowId).toBe('fixture-flow');
  expect(nextState.activeNodeId).toBe('start');
  expect(nextState.suspendedFlows['neutral-router']).toBeUndefined();
  expect(nextState.transcript.map((message) => message.text)).toContain('Falar sobre sobrecarga');
  // The target flow starts immediately, so its entry transition appears in the same transcript.
  expect(nextState.transcript.map((message) => message.text)).toContain(validFlow.entry.transitionMessage);
});

it('navigates directly from neutral flow options that target app destinations', () => {
  const navigationFlow: GuidedFlow = {
    ...neutralRouterFlow,
    nodes: {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'O que você quer abrir?',
        options: [
          {
            id: 'education',
            label: 'Abrir materiais educativos',
            next: 'fallback',
            effects: [{ kind: 'navigate', destination: '/educacao' }],
          },
        ],
      },
      fallback: {
        id: 'fallback',
        kind: 'result',
        text: 'Abrindo materiais educativos.',
      },
    },
  };
  const state = createInitialFlowState(navigationFlow, [navigationFlow, validFlow]);
  const nextState = advanceFlow(state, [navigationFlow, validFlow], 'Abrir materiais educativos');

  expect(nextState.activeFlowId).toBeUndefined();
  expect(nextState.activeNodeId).toBeUndefined();
  expect(nextState.pendingNavigation).toBe('/educacao');
  expect(nextState.transcript.map((message) => message.text)).toContain('Abrir materiais educativos');
});

it('offers post-flow routing after regular result nodes', () => {
  const postFlowRouter: GuidedFlow = {
    ...neutralRouterFlow,
    id: 'post-flow-next-step',
    purpose: 'post_flow_routing',
  };
  const flows = [validFlow, neutralRouterFlow, postFlowRouter];
  const state = createInitialFlowState(validFlow, flows);
  const resultState = advanceFlow(state, flows, 'Continuar');

  expect(resolveOptions(resultState, flows)).toContainEqual({
    kind: 'flow_start',
    id: 'post-flow-next-step-start',
    label: 'Escolher o que fazer agora',
    flowId: 'post-flow-next-step',
  });
});

it('does not offer post-flow routing from the post-flow router itself', () => {
  const postFlowRouter: GuidedFlow = {
    ...neutralRouterFlow,
    id: 'post-flow-next-step',
    purpose: 'post_flow_routing',
    nodes: {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'Qual próximo passo você prefere?',
        options: [
          {
            id: 'end',
            label: 'Finalizar por hoje',
            next: 'done',
          },
        ],
      },
      done: {
        id: 'done',
        kind: 'result',
        text: 'Tudo bem. Você pode voltar quando quiser.',
      },
    },
  };
  const state = createInitialFlowState(postFlowRouter, [postFlowRouter, validFlow]);
  const resultState = advanceFlow(state, [postFlowRouter, validFlow], 'Finalizar por hoje');

  expect(resolveOptions(resultState, [postFlowRouter, validFlow])).not.toContainEqual(
    expect.objectContaining({ id: 'post-flow-next-step-start' }),
  );
});

it('does not offer post-flow routing from orientation neutral flow results', () => {
  const orientationFlow: GuidedFlow = {
    ...neutralRouterFlow,
    nodes: {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'Qual próximo passo você prefere?',
        options: [
          {
            id: 'end',
            label: 'Finalizar por hoje',
            next: 'done',
          },
        ],
      },
      done: {
        id: 'done',
        kind: 'result',
        text: 'Tudo bem. Você pode voltar quando quiser.',
      },
    },
  };
  const postFlowRouter: GuidedFlow = {
    ...neutralRouterFlow,
    id: 'post-flow-next-step',
    purpose: 'post_flow_routing',
  };
  const flows = [orientationFlow, postFlowRouter, validFlow];
  const state = createInitialFlowState(orientationFlow, flows);
  const resultState = advanceFlow(state, flows, 'Finalizar por hoje');

  expect(resolveOptions(resultState, flows)).not.toContainEqual(
    expect.objectContaining({ id: 'post-flow-next-step-start' }),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test src/domain/flow-engine/__tests__/flow-engine.test.ts`

Expected: FAIL because `advanceFlow` and `resolveOptions` do not handle direct flow starts, navigation effects, or post-flow routing yet.

- [ ] **Step 3: Add direct flow-start helpers to `advanceFlow`**

Update the imports in `src/domain/flow-engine/advanceFlow.ts`:

```ts
import { createInitialFlowState, createMessage, getActiveFlow, getFlowById } from './loadFlows';
```

Update the type imports:

```ts
import type { FlowEffect, FlowNode, FlowRuntimeState, FlowStartFlowEffect, GuidedFlow, RuntimeOption } from './types';
```

Add this branch after the `resume_flow` branch:

```ts
if (selectedOption.kind === 'flow_start') {
  return startFlowWithoutSuspending(
    appendUserMessage(state, selectedOption, state.activeFlowId ?? 'global'),
    flows,
    selectedOption.flowId,
  );
}
```

Replace the existing `applyOptionEffects(...)` call with this version so `flow_start` is not treated like a safety interrupt:

```ts
const flowStartEffect = findFlowStartEffect(matchingOption.effects ?? []);
const nonStartEffects = (matchingOption.effects ?? []).filter((effect) => effect.kind !== 'flow_start');
const effectedState = applyOptionEffects(
  {
    ...state,
    transcript: [...state.transcript, userMessage],
    answers: {
      ...state.answers,
      [currentNodeId]: selectedOption.id,
    },
    pendingNavigation: undefined,
  },
  activeFlow.id,
  nonStartEffects,
);
```

Add this branch after `effectedState.pendingNavigation` handling and before `advanceToNode`:

```ts
if (flowStartEffect) {
  return startFlowWithoutSuspending(effectedState, flows, flowStartEffect.flowId);
}
```

Add helper functions before `advanceToNode`:

```ts
function findFlowStartEffect(effects: FlowEffect[]): FlowStartFlowEffect | undefined {
  return effects.find((effect): effect is FlowStartFlowEffect => effect.kind === 'flow_start');
}

function startFlowWithoutSuspending(state: FlowRuntimeState, flows: GuidedFlow[], flowId: string): FlowRuntimeState {
  const nextFlow = getFlowById(flows, flowId);
  const nextState = createInitialFlowState(nextFlow, flows);

  return {
    ...nextState,
    transcript: [...state.transcript, ...nextState.transcript],
    suspendedFlows: state.suspendedFlows,
    safetyFlags: state.safetyFlags,
  };
}
```

This helper intentionally keeps the prior transcript, suspended flows, and safety flags while using the target flow's fresh `answers` and `scores`. The existing suspend/resume model does not persist scores in `SuspendedFlowState`; future score-based resume requirements need a separate engine change.

Update `applyOptionEffects` so every effect kind is checked explicitly:

```ts
function applyOptionEffects(state: FlowRuntimeState, flowId: string, effects: FlowEffect[]): FlowRuntimeState {
  return effects.reduce((nextState, effect) => {
    if (effect.kind === 'score') {
      return {
        ...nextState,
        scores: {
          ...nextState.scores,
          [effect.scoreKey]: (nextState.scores[effect.scoreKey] ?? 0) + effect.value,
        },
      };
    }

    if (effect.kind === 'safety_interrupt') {
      return {
        ...nextState,
        activeFlowId: undefined,
        activeNodeId: undefined,
        pendingNavigation: effect.destination,
        safetyFlags: {
          ...nextState.safetyFlags,
          ...(effect.blockResume ? { [`block-resume:${flowId}`]: true } : {}),
        },
        transcript: [...nextState.transcript, createMessage('bot', effect.message, flowId, nextState.activeNodeId)],
      };
    }

    if (effect.kind === 'navigate') {
      return {
        ...nextState,
        activeFlowId: undefined,
        activeNodeId: undefined,
        pendingNavigation: effect.destination,
      };
    }

    return nextState;
  }, state);
}
```

- [ ] **Step 4: Add post-flow option resolution**

Update the import in `src/domain/flow-engine/resolveOptions.ts`:

```ts
import type { FlowRuntimeState, GuidedFlow, RuntimeFlowStartOption, RuntimeGlobalAction, RuntimeOption } from './types';
```

Add this helper near `globalFlowActions`:

```ts
const postFlowStartOption: RuntimeFlowStartOption = {
  kind: 'flow_start',
  id: 'post-flow-next-step-start',
  label: 'Escolher o que fazer agora',
  flowId: 'post-flow-next-step',
};
```

Add this block after `resumeOptions`:

```ts
const postFlowOptions: RuntimeOption[] =
  activeNode?.kind === 'result' && activeFlow.purpose === undefined
    ? flows.some((flow) => flow.id === postFlowStartOption.flowId)
      ? [postFlowStartOption]
      : []
    : [];
```

Update the return:

```ts
return [...currentNodeOptions, ...entryPhraseOptions, ...resumeOptions, ...postFlowOptions, ...globalFlowActions];
```

Do not suppress neutral flow entry phrases in this task. Existing autocomplete flow switching should continue to expose entry phrases from every other flow, including neutral flows; this is deterministic switching, not free-text understanding.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm run test src/domain/flow-engine/__tests__/flow-engine.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/flow-engine/advanceFlow.ts src/domain/flow-engine/resolveOptions.ts src/domain/flow-engine/__tests__/flow-engine.test.ts
git commit -m "feat: start flows from neutral routers"
```

## Task 4: Add Neutral Flow Content

**Files:**

- Create: `src/content/flows/neutral.ts`
- Modify: `src/content/flows/registry.ts`
- Modify: `src/content/__tests__/content.test.ts`

- [ ] **Step 1: Write failing content test**

Update the flow registry test in `src/content/__tests__/content.test.ts`:

```ts
it('contains switchable guided conversation flows', () => {
  const flowIds = flowRegistry.flows.map((flow) => flow.id);

  expect(flowRegistry.flows).toHaveLength(8);
  expect(flowIds).toEqual(
    expect.arrayContaining([
      'orientation-understand-feelings',
      'orientation-talk-through-experience',
      'orientation-next-care-step',
      'orientation-calm-moment',
      'post-flow-next-step',
      'work-stress',
      'rest-recovery',
      'srq20',
    ]),
  );
  flowRegistry.flows.forEach((flow) => {
    expect(flow.type).toBe('guided_conversation');
    expect(flow.entry.enteringPhrases.length).toBeGreaterThan(0);
  });
  expect(flowRegistry.flows.filter((flow) => flow.purpose === 'orientation_entry')).toHaveLength(4);
  expect(flowRegistry.flows.find((flow) => flow.id === 'post-flow-next-step')?.purpose).toBe('post_flow_routing');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test src/content/__tests__/content.test.ts`

Expected: FAIL because neutral flows are not registered.

- [ ] **Step 3: Create neutral flow content**

Create `src/content/flows/neutral.ts`:

The `flow_start` options below still include `next` values because `FlowOption` requires a valid local node reference. Those handoff result nodes are structural fallbacks for validation; the normal runtime path starts the target flow immediately and does not display the handoff result text.

Neutral node options intentionally stay focused on guided-flow routing, direct app destinations, and local sign-off choices. App-destination labels avoid exact duplicates of global action labels because `advanceFlow` selects by label and duplicate labels would shadow the persistent global actions.

```ts
import type { GuidedFlow } from '../../domain/flow-engine/types';

export const neutralFlows = [
  {
    id: 'orientation-understand-feelings',
    version: '1.0.0',
    locale: 'pt-BR',
    title: 'Entender como estou me sentindo',
    type: 'guided_conversation',
    purpose: 'orientation_entry',
    status: 'draft',
    entry: {
      nodeId: 'start',
      enteringPhrases: ['Quero entender como estou me sentindo'],
      transitionMessage: 'Vamos começar de um jeito simples, sem precisar fechar uma resposta agora.',
    },
    nodes: {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'Qual destas opções se aproxima mais do seu momento?',
        options: [
          {
            id: 'overload',
            label: 'Parece mais sobre sobrecarga',
            next: 'handoff-work-stress',
            effects: [{ kind: 'flow_start', flowId: 'work-stress' }],
          },
          {
            id: 'rest',
            label: 'Parece mais sobre cansaço ou descanso',
            next: 'handoff-rest',
            effects: [{ kind: 'flow_start', flowId: 'rest-recovery' }],
          },
          {
            id: 'srq20',
            label: 'Quero responder um questionário breve',
            next: 'handoff-srq20',
            effects: [{ kind: 'flow_start', flowId: 'srq20' }],
          },
          {
            id: 'calm',
            label: 'Prefiro algo mais leve agora',
            next: 'handoff-calm',
            effects: [{ kind: 'flow_start', flowId: 'orientation-calm-moment' }],
          },
        ],
      },
      'handoff-work-stress': {
        id: 'handoff-work-stress',
        kind: 'result',
        text: 'Vou abrir um caminho sobre sobrecarga.',
      },
      'handoff-rest': { id: 'handoff-rest', kind: 'result', text: 'Vou abrir um caminho sobre descanso.' },
      'handoff-srq20': { id: 'handoff-srq20', kind: 'result', text: 'Vou abrir o questionário.' },
      'handoff-calm': { id: 'handoff-calm', kind: 'result', text: 'Vou abrir um caminho mais leve.' },
    },
  },
  {
    id: 'orientation-talk-through-experience',
    version: '1.0.0',
    locale: 'pt-BR',
    title: 'Falar sobre o que estou vivendo',
    type: 'guided_conversation',
    purpose: 'orientation_entry',
    status: 'draft',
    entry: {
      nodeId: 'start',
      enteringPhrases: ['Quero falar sobre o que estou vivendo'],
      transitionMessage: 'Podemos organizar isso por partes, sem pressa.',
    },
    nodes: {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'O que mais marcou seu dia ou sua semana?',
        options: [
          {
            id: 'many-demands',
            label: 'Muitas demandas ao mesmo tempo',
            next: 'handoff-work-stress',
            effects: [{ kind: 'flow_start', flowId: 'work-stress' }],
          },
          {
            id: 'body-tired',
            label: 'Meu corpo pede descanso',
            next: 'handoff-rest',
            effects: [{ kind: 'flow_start', flowId: 'rest-recovery' }],
          },
          {
            id: 'pressure-conflict',
            label: 'Teve pressão ou conflito',
            next: 'handoff-work-stress',
            effects: [{ kind: 'flow_start', flowId: 'work-stress' }],
          },
          {
            id: 'uncertain',
            label: 'Ainda não sei nomear',
            next: 'handoff-understand',
            effects: [{ kind: 'flow_start', flowId: 'orientation-understand-feelings' }],
          },
        ],
      },
      'handoff-work-stress': {
        id: 'handoff-work-stress',
        kind: 'result',
        text: 'Vou abrir um caminho sobre sobrecarga.',
      },
      'handoff-rest': { id: 'handoff-rest', kind: 'result', text: 'Vou abrir um caminho sobre descanso.' },
      'handoff-understand': {
        id: 'handoff-understand',
        kind: 'result',
        text: 'Vou abrir um caminho para entender o momento.',
      },
    },
  },
  {
    id: 'orientation-next-care-step',
    version: '1.0.0',
    locale: 'pt-BR',
    title: 'Encontrar um próximo passo de cuidado',
    type: 'guided_conversation',
    purpose: 'orientation_entry',
    status: 'draft',
    entry: {
      nodeId: 'start',
      enteringPhrases: ['Quero encontrar um próximo passo de cuidado'],
      transitionMessage: 'Vamos escolher um próximo passo possível para agora.',
    },
    nodes: {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'Que tipo de próximo passo parece mais útil?',
        options: [
          {
            id: 'guided-reflection',
            label: 'Uma orientação guiada',
            next: 'handoff-work-stress',
            effects: [{ kind: 'flow_start', flowId: 'work-stress' }],
          },
          {
            id: 'rest-pause',
            label: 'Uma pausa de recuperação',
            next: 'handoff-rest',
            effects: [{ kind: 'flow_start', flowId: 'rest-recovery' }],
          },
          {
            id: 'questionnaire',
            label: 'Um questionário breve',
            next: 'handoff-srq20',
            effects: [{ kind: 'flow_start', flowId: 'srq20' }],
          },
          {
            id: 'app-destinations',
            label: 'Materiais, contatos ou apoio',
            next: 'app-destinations',
          },
        ],
      },
      'app-destinations': {
        id: 'app-destinations',
        kind: 'choice',
        text: 'O que você quer abrir agora?',
        options: [
          {
            id: 'education',
            label: 'Abrir materiais educativos',
            next: 'navigation-fallback',
            effects: [{ kind: 'navigate', destination: '/educacao' }],
          },
          {
            id: 'contacts',
            label: 'Abrir contatos de apoio',
            next: 'navigation-fallback',
            effects: [{ kind: 'navigate', destination: '/contatos' }],
          },
          {
            id: 'support-now',
            label: 'Abrir apoio agora',
            next: 'navigation-fallback',
            effects: [{ kind: 'navigate', destination: '/apoio' }],
          },
        ],
      },
      'handoff-work-stress': { id: 'handoff-work-stress', kind: 'result', text: 'Vou abrir uma orientação guiada.' },
      'handoff-rest': { id: 'handoff-rest', kind: 'result', text: 'Vou abrir uma pausa de recuperação.' },
      'handoff-srq20': { id: 'handoff-srq20', kind: 'result', text: 'Vou abrir o questionário.' },
      'navigation-fallback': {
        id: 'navigation-fallback',
        kind: 'result',
        text: 'Abrindo o caminho escolhido.',
      },
    },
  },
  {
    id: 'orientation-calm-moment',
    version: '1.0.0',
    locale: 'pt-BR',
    title: 'Momento mais leve',
    type: 'guided_conversation',
    purpose: 'orientation_entry',
    status: 'draft',
    entry: {
      nodeId: 'start',
      enteringPhrases: ['Preciso de um momento mais leve'],
      transitionMessage: 'Tudo bem escolher algo mais leve agora.',
    },
    nodes: {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'O que parece mais acolhedor neste momento?',
        options: [
          {
            id: 'rest',
            label: 'Uma pausa curta',
            next: 'handoff-rest',
            effects: [{ kind: 'flow_start', flowId: 'rest-recovery' }],
          },
          {
            id: 'education',
            label: 'Abrir algo educativo',
            next: 'navigation-fallback',
            effects: [{ kind: 'navigate', destination: '/educacao' }],
          },
          {
            id: 'end',
            label: 'Finalizar por hoje',
            next: 'end-result',
          },
        ],
      },
      'handoff-rest': { id: 'handoff-rest', kind: 'result', text: 'Vou abrir uma pausa curta.' },
      'navigation-fallback': {
        id: 'navigation-fallback',
        kind: 'result',
        text: 'Abrindo materiais educativos.',
      },
      'end-result': {
        id: 'end-result',
        kind: 'result',
        text: 'Tudo bem. Você pode voltar quando quiser.',
      },
    },
  },
  {
    id: 'post-flow-next-step',
    version: '1.0.0',
    locale: 'pt-BR',
    title: 'Escolher o que fazer agora',
    type: 'guided_conversation',
    purpose: 'post_flow_routing',
    status: 'draft',
    entry: {
      nodeId: 'start',
      enteringPhrases: ['Escolher o que fazer agora'],
      transitionMessage: 'Antes de encerrar, você pode escolher com calma o que faz sentido agora.',
    },
    nodes: {
      start: {
        id: 'start',
        kind: 'choice',
        text: 'Qual próximo passo você prefere?',
        options: [
          {
            id: 'another-topic',
            label: 'Conversar sobre outro tema',
            next: 'handoff-orientation',
            effects: [{ kind: 'flow_start', flowId: 'orientation-understand-feelings' }],
          },
          {
            id: 'rest',
            label: 'Tentar uma pausa de descanso',
            next: 'handoff-rest',
            effects: [{ kind: 'flow_start', flowId: 'rest-recovery' }],
          },
          {
            id: 'app-destinations',
            label: 'Materiais, contatos ou apoio',
            next: 'app-destinations',
          },
          {
            id: 'end',
            label: 'Finalizar por hoje',
            next: 'end-result',
          },
        ],
      },
      'app-destinations': {
        id: 'app-destinations',
        kind: 'choice',
        text: 'O que você quer abrir agora?',
        options: [
          {
            id: 'education',
            label: 'Abrir materiais educativos',
            next: 'navigation-fallback',
            effects: [{ kind: 'navigate', destination: '/educacao' }],
          },
          {
            id: 'contacts',
            label: 'Abrir contatos de apoio',
            next: 'navigation-fallback',
            effects: [{ kind: 'navigate', destination: '/contatos' }],
          },
          {
            id: 'support-now',
            label: 'Abrir apoio agora',
            next: 'navigation-fallback',
            effects: [{ kind: 'navigate', destination: '/apoio' }],
          },
        ],
      },
      'handoff-orientation': {
        id: 'handoff-orientation',
        kind: 'result',
        text: 'Vou abrir outro caminho de orientação.',
      },
      'handoff-rest': { id: 'handoff-rest', kind: 'result', text: 'Vou abrir uma pausa de descanso.' },
      'navigation-fallback': {
        id: 'navigation-fallback',
        kind: 'result',
        text: 'Abrindo o caminho escolhido.',
      },
      'end-result': {
        id: 'end-result',
        kind: 'result',
        text: 'Tudo bem. Você pode voltar quando quiser.',
      },
    },
  },
] satisfies GuidedFlow[];
```

The `pressure-conflict` option routes to `work-stress` because the current app has no dedicated conflict flow and `work-stress` already contains a pressure/conflict branch. If a dedicated conflict flow is added later, this option should be retargeted.

- [ ] **Step 4: Register neutral flows**

Update `src/content/flows/registry.ts`:

```ts
import { neutralFlows } from './neutral';
```

Change the `flows` array:

```ts
  flows: [...neutralFlows, workStressFlow, restRecoveryFlow, ...jsonFlows],
```

- [ ] **Step 5: Run content and flow tests**

Run: `pnpm run test src/content/__tests__/content.test.ts src/domain/flow-engine/__tests__/flow-engine.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/content/flows/neutral.ts src/content/flows/registry.ts src/content/__tests__/content.test.ts
git commit -m "feat: add neutral routing flows"
```

## Task 5: Start Orientation From Neutral Flows

**Files:**

- Modify: `src/features/orientation/OrientationScreen.tsx`
- Modify: `src/features/orientation/__tests__/OrientationScreen.test.tsx`

- [ ] **Step 1: Update failing UI tests**

In `src/features/orientation/__tests__/OrientationScreen.test.tsx`, replace intro copy expectations:

```ts
expect(
  screen.getByText('Escolha um caminho para começar. O BemTeVi vai te guiar com perguntas simples, no seu ritmo.'),
).toBeInTheDocument();
expect(screen.getByText('O que você gostaria de fazer agora?')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Quero entender como estou me sentindo' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Quero falar sobre o que estou vivendo' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Quero encontrar um próximo passo de cuidado' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Preciso de um momento mais leve' })).toBeInTheDocument();
```

Update `startOrientationWithStarter` default:

```ts
function startOrientationWithStarter(label = 'Quero entender como estou me sentindo') {
  fireEvent.click(screen.getByRole('button', { name: label }));
  advanceInitialLoad();
}
```

Add this helper for tests that still need to interact with the regular `work-stress` flow:

```ts
function routeFromNeutralToWorkStress() {
  fireEvent.click(screen.getByRole('option', { name: 'Parece mais sobre sobrecarga' }));
  advanceInitialLoad();
}
```

Update existing tests that currently assume `work-stress` starts immediately:

```ts
it('advances the flow immediately when the user clicks a bubble', () => {
  renderOrientation();
  startOrientationWithStarter();
  routeFromNeutralToWorkStress();

  fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));
  advanceInitialLoad();

  expect(screen.getByPlaceholderText('Digite ou escolha uma opção')).toHaveValue('');
  expect(
    screen.getByText('Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.'),
  ).toBeInTheDocument();
});
```

Replace these existing work-stress-assumption tests with versions that first route through the neutral flow:

```ts
it('only enables send when the input exactly matches an available option', () => {
  renderOrientation();
  startOrientationWithStarter();
  routeFromNeutralToWorkStress();

  const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
  const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

  expect(sendButton).toBeDisabled();

  fireEvent.change(input, { target: { value: 'qualquer coisa' } });
  expect(sendButton).toBeDisabled();

  fireEvent.change(input, { target: { value: 'Dificuldade para descansar' } });
  expect(sendButton).toBeEnabled();
});

it('shows matching options in an autocomplete overlay above the input', () => {
  renderOrientation();
  startOrientationWithStarter();
  routeFromNeutralToWorkStress();

  fireEvent.change(screen.getByPlaceholderText('Digite ou escolha uma opção'), {
    target: { value: 'descansar' },
  });

  expect(screen.getByRole('listbox', { name: 'Sugestões de resposta' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Dificuldade para descansar' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).not.toBeInTheDocument();
});

it('hides suggestions when input exactly matches an option label', () => {
  renderOrientation();
  startOrientationWithStarter();
  routeFromNeutralToWorkStress();

  const input = screen.getByPlaceholderText('Digite ou escolha uma opção');

  expect(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).toBeInTheDocument();

  fireEvent.change(input, { target: { value: 'Muitas tarefas ao mesmo tempo' } });

  expect(screen.queryByRole('listbox', { name: 'Sugestões de resposta' })).not.toBeInTheDocument();
});

it('shows suggestions when trailing space breaks strict match but send stays enabled', () => {
  renderOrientation();
  startOrientationWithStarter();
  routeFromNeutralToWorkStress();

  const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
  const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

  fireEvent.change(input, { target: { value: 'Dificuldade para descansar' } });
  expect(screen.queryByRole('listbox', { name: 'Sugestões de resposta' })).not.toBeInTheDocument();
  expect(sendButton).toBeEnabled();

  fireEvent.change(input, { target: { value: 'Dificuldade para descansar ' } });
  expect(screen.getByRole('listbox', { name: 'Sugestões de resposta' })).toBeInTheDocument();
  expect(sendButton).toBeEnabled();
});

it('shows user message immediately and bot response after delay when selecting a node option', () => {
  renderOrientation();
  startOrientationWithStarter();
  routeFromNeutralToWorkStress();

  fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));

  expect(screen.getByText('Muitas tarefas ao mesmo tempo')).toBeInTheDocument();
  expect(
    screen.queryByText('Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.'),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('option')).not.toBeInTheDocument();

  advanceInitialLoad();

  expect(
    screen.getByText('Quando tudo parece urgente, ajuda separar o que precisa de atenção agora do que pode esperar.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Quero pensar em uma pausa curta' })).toBeInTheDocument();
});

it('disables input and send while revealing bot messages', () => {
  renderOrientation();
  startOrientationWithStarter();
  routeFromNeutralToWorkStress();

  fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));

  const input = screen.getByPlaceholderText('Digite ou escolha uma opção');
  const sendButton = screen.getByRole('button', { name: 'Enviar opção selecionada' });

  expect(input).toBeDisabled();
  expect(sendButton).toBeDisabled();

  advanceInitialLoad();

  expect(input).not.toBeDisabled();
  expect(sendButton).toBeDisabled();
});
```

Update the initial typing indicator test to expect neutral-flow copy:

```ts
expect(
  screen.queryByText('Vamos começar de um jeito simples, sem precisar fechar uma resposta agora.'),
).not.toBeInTheDocument();
expect(screen.getByText('BemTeVi')).toBeInTheDocument();
expect(screen.getByRole('status')).toHaveTextContent('Carregando conversa');

advanceInitialLoad();

expect(
  screen.getByText('Vamos começar de um jeito simples, sem precisar fechar uma resposta agora.'),
).toBeInTheDocument();
expect(screen.getByRole('option', { name: 'Parece mais sobre sobrecarga' })).toBeInTheDocument();
```

Add this test:

```ts
it('starts the selected neutral orientation flow', () => {
  renderOrientation();
  startOrientationWithStarter('Quero encontrar um próximo passo de cuidado');

  expect(screen.getByText('Quero encontrar um próximo passo de cuidado')).toBeInTheDocument();
  expect(screen.getByText('Vamos escolher um próximo passo possível para agora.')).toBeInTheDocument();
  expect(screen.getByText('Que tipo de próximo passo parece mais útil?')).toBeInTheDocument();
});
```

Add this test to prove neutral app-destination options are exposed instead of dead-end result instructions:

```ts
it('shows neutral app-destination options', () => {
  renderOrientation();
  startOrientationWithStarter('Quero encontrar um próximo passo de cuidado');

  fireEvent.click(screen.getByRole('option', { name: 'Materiais, contatos ou apoio' }));
  advanceInitialLoad();

  expect(screen.getByRole('option', { name: 'Abrir materiais educativos' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Abrir contatos de apoio' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Abrir apoio agora' })).toBeInTheDocument();
});
```

Replace the "Outro" test with the complete neutral-flow version:

```ts
it('starts the default neutral flow from Outro without adding Outro as a conversation message', () => {
  renderOrientation();

  fireEvent.click(screen.getByRole('button', { name: 'Outro' }));
  advanceInitialLoad();

  expect(screen.queryByText(/^Outro$/)).not.toBeInTheDocument();
  expect(
    screen.getByText('Vamos começar de um jeito simples, sem precisar fechar uma resposta agora.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Parece mais sobre sobrecarga' })).toBeInTheDocument();
});
```

Update the starter-recording test to use a new intro label:

```ts
fireEvent.click(screen.getByRole('button', { name: 'Quero falar sobre o que estou vivendo' }));

expect(screen.queryByRole('heading', { name: 'Antes de começar' })).not.toBeInTheDocument();
expect(screen.queryByText('Quero falar sobre o que estou vivendo')).not.toBeInTheDocument();
expect(screen.getByText('BemTeVi')).toBeInTheDocument();

advanceInitialLoad();

expect(screen.getByText('Quero falar sobre o que estou vivendo')).toBeInTheDocument();
expect(screen.getByText('Podemos organizar isso por partes, sem pressa.')).toBeInTheDocument();
```

Add this test for curated neutral handoff:

```ts
it('routes from a neutral option into a specific guided flow', () => {
  renderOrientation();
  startOrientationWithStarter();

  fireEvent.click(screen.getByRole('option', { name: 'Parece mais sobre sobrecarga' }));
  advanceInitialLoad();

  expect(screen.getByText('Parece mais sobre sobrecarga')).toBeInTheDocument();
  expect(screen.getByText(/Vamos olhar para essa sobrecarga com calma/)).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI tests to verify they fail**

Run: `pnpm run test src/features/orientation/__tests__/OrientationScreen.test.tsx`

Expected: FAIL because the screen still uses the old starters and `work-stress` default.

- [ ] **Step 3: Replace intro starter model**

Update `INTRO_STARTERS` in `src/features/orientation/OrientationScreen.tsx`:

```ts
const INTRO_STARTERS = [
  {
    id: 'understand-feelings',
    label: 'Quero entender como estou me sentindo',
    flowId: 'orientation-understand-feelings',
    recordAsMessage: true,
  },
  {
    id: 'talk-through-experience',
    label: 'Quero falar sobre o que estou vivendo',
    flowId: 'orientation-talk-through-experience',
    recordAsMessage: true,
  },
  {
    id: 'next-care-step',
    label: 'Quero encontrar um próximo passo de cuidado',
    flowId: 'orientation-next-care-step',
    recordAsMessage: true,
  },
  {
    id: 'calm-moment',
    label: 'Preciso de um momento mais leve',
    flowId: 'orientation-calm-moment',
    recordAsMessage: true,
  },
  {
    id: 'other',
    label: 'Outro',
    flowId: 'orientation-understand-feelings',
    recordAsMessage: false,
  },
] as const;
```

Add state for starter flow ID:

```ts
const [selectedIntroFlowId, setSelectedIntroFlowId] = useState<string>(INTRO_STARTERS[0].flowId);
```

Update initial state creation:

```ts
const initialState = createInitialFlowStateFromRegistry(flows, selectedIntroFlowId);
```

Update the intro message fallback in the same hook:

```ts
                initialState.activeFlowId ?? selectedIntroFlowId,
```

Update the hook dependency array:

```ts
  }, [hasStarted, selectedIntroStarter, selectedIntroFlowId, state]);
```

Update intro message logic:

```ts
selectedIntroStarter === null;
```

stays unchanged, because `startConversation` will now set `selectedIntroStarter` only when `recordAsMessage` is true.

Update `startConversation`:

```ts
setSelectedIntroFlowId(starter.flowId);
setSelectedIntroStarter(starter.recordAsMessage ? starter.label : null);
```

Update intro copy:

```tsx
<p className="mt-2 max-w-xl font-body-md text-on-surface-variant">
  Escolha um caminho para começar. O BemTeVi vai te guiar com perguntas simples, no seu ritmo.
</p>
```

```tsx
              O que você gostaria de fazer agora?
```

- [ ] **Step 4: Run UI tests to verify they pass**

Run: `pnpm run test src/features/orientation/__tests__/OrientationScreen.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/orientation/OrientationScreen.tsx src/features/orientation/__tests__/OrientationScreen.test.tsx
git commit -m "feat: start orientation from neutral flows"
```

## Task 6: Cover Post-Flow Routing In The UI

**Files:**

- Modify: `src/features/orientation/__tests__/OrientationScreen.test.tsx`

- [ ] **Step 1: Add failing post-flow UI test**

Add this test:

```ts
it('offers a calm next-step route after a regular flow result', () => {
  renderOrientation();
  startOrientationWithStarter();

  fireEvent.click(screen.getByRole('option', { name: 'Parece mais sobre sobrecarga' }));
  advanceInitialLoad();

  fireEvent.click(screen.getByRole('option', { name: 'Muitas tarefas ao mesmo tempo' }));
  advanceInitialLoad();

  fireEvent.click(screen.getByRole('option', { name: 'Quero pensar em uma pausa curta' }));
  advanceInitialLoad();

  expect(
    screen.getByText(
      'Experimente pausar por um minuto, soltar os ombros e escolher apenas uma ação pequena para agora.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Escolher o que fazer agora' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('option', { name: 'Escolher o que fazer agora' }));
  advanceInitialLoad();

  expect(
    screen.getByText('Antes de encerrar, você pode escolher com calma o que faz sentido agora.'),
  ).toBeInTheDocument();
  expect(screen.getByText('Qual próximo passo você prefere?')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI test**

Run: `pnpm run test src/features/orientation/__tests__/OrientationScreen.test.tsx`

Expected: PASS if Tasks 3-5 fully implemented post-flow routing. If it fails, fix the implementation in `resolveOptions.ts` or `advanceFlow.ts` according to the failing assertion.

- [ ] **Step 3: Commit**

```bash
git add src/features/orientation/__tests__/OrientationScreen.test.tsx
git commit -m "test: cover post-flow neutral routing"
```

## Task 7: Final Verification

**Files:**

- No source edits expected.

- [ ] **Step 1: Run flow validation**

Run: `pnpm run validate:flows`

Expected: PASS with no validation errors.

- [ ] **Step 2: Run focused tests**

Run: `pnpm run test src/domain/flow-engine/__tests__/flow-engine.test.ts src/content/__tests__/content.test.ts src/features/orientation/__tests__/OrientationScreen.test.tsx`

Expected: PASS.

- [ ] **Step 3: Run full check**

Run: `pnpm run check`

Expected: PASS for typecheck, lint, format check, flow validation, tests, and build.

- [ ] **Step 4: Inspect git status**

Run: `git status --short`

Expected: only intentional changes are present. The pre-existing untracked concept note and `.superpowers/brainstorm/...` directory may still appear if they were not handled separately.

- [ ] **Step 5: Commit any final formatting or test-only adjustments**

If `pnpm run check` required small formatting/test adjustments, commit only those files:

```bash
git add <changed-files>
git commit -m "chore: finish neutral flow integration"
```

If there are no final adjustments, do not create an empty commit.
