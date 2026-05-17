# JSON Flow SRQ-20 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SRQ-20 a dashboard-editable JSON conversation workflow consumed by the generic chatbot framework, with no questionnaire-specific screen, route, registry, or TypeScript content file.

**Architecture:** Flow content lives as JSON under `src/content/flows/*.json` and is discovered with Vite's `import.meta.glob`, so adding a new questionnaire JSON file requires no TypeScript import edit. TypeScript is only the engine, loader, validator, and UI renderer. SRQ-20 is represented as ordinary flow JSON with consent as choice nodes, scoring as option effects, threshold routing as score branches, and Q17 safety interruption as an option effect.

**Tech Stack:** React 19, React Router 7, TypeScript, Vite JSON imports, Vitest, Testing Library.

---

## Non-Negotiable Architecture

- SRQ-20 content must be a JSON file: `src/content/flows/srq20.json`.
- New questionnaire/workflow JSON files placed under `src/content/flows/*.json` must be picked up automatically.
- Do not create `src/content/flows/srq20.ts`.
- Do not create `src/features/questionnaires/Srq20Screen.tsx`.
- Do not create `/orientacao/srq20` or `routes.srq20`.
- Do not add SRQ-20-specific logic to React.
- Do not keep a separate questionnaire runtime path once SRQ-20 runs through the flow engine.
- Future dashboard editing should be able to edit the workflow JSON shape without touching TypeScript content files.

## File Structure

- Modify: `tsconfig.json`
  - Enable JSON imports with `resolveJsonModule`.
- Create: `src/domain/flow-engine/parseFlow.ts`
  - Validate unknown JSON and return a typed `GuidedFlow`.
- Modify: `src/domain/flow-engine/types.ts`
  - Add generic score and safety effects plus score-branch nodes.
- Modify: `src/domain/flow-engine/validateFlow.ts`
  - Validate JSON-shaped flow nodes, effects, and score branches.
- Modify: `src/domain/flow-engine/advanceFlow.ts`
  - Execute score effects, safety interruption effects, and score branches.
- Modify: `src/domain/flow-engine/loadFlows.ts`
  - Preserve generic runtime state, including pending safety navigation.
- Modify: `src/domain/flow-engine/resolveOptions.ts`
  - Pass option effects through runtime options.
- Create: `src/content/flows/srq20.json`
  - Dashboard-editable SRQ-20 workflow content.
- Modify: `src/content/flows/registry.ts`
  - Discover JSON workflow content with `import.meta.glob`, parse each file through `parseGuidedFlow`, and sort for deterministic registry order.
- Modify: `src/features/orientation/OrientationScreen.tsx`
  - Only handle generic `pendingNavigation`; keep UI generic.
- Modify: `src/domain/flow-engine/__tests__/flow-engine.test.ts`
  - Test JSON parsing, scoring, score branching, safety interruption, and SRQ-20 registry behavior.
- Modify: `src/features/orientation/__tests__/OrientationScreen.test.tsx`
  - Test SRQ-20 through the existing chatbot UI.
- Delete: `src/content/questionnaires/registry.ts`
- Delete: `src/content/questionnaires/srq20.ts`
- Delete: questionnaire-specific domain runtime files under `src/domain/questionnaires/*`, except `README.md`.
- Modify: `src/domain/questionnaires/README.md`
  - Document that questionnaire-like flows are JSON workflows handled by `src/domain/flow-engine`.

---

### Task 1: Enable JSON Flow Imports And Add A Typed Parser Boundary

**Files:**
- Modify: `tsconfig.json`
- Create: `src/domain/flow-engine/parseFlow.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Add failing parser tests**

Append this import to `src/domain/flow-engine/__tests__/flow-engine.test.ts`:

```ts
import { parseGuidedFlow } from '../parseFlow';
```

Append this test inside `describe('validateFlow', ...)`:

```ts
it('parses unknown JSON-shaped flow content into a typed guided flow', () => {
  const parsed = parseGuidedFlow(validFlow);

  expect(parsed.id).toBe('fixture-flow');
  expect(parsed.nodes.start.kind).toBe('choice');
});

it('rejects invalid JSON-shaped flow content at the parser boundary', () => {
  expect(() => parseGuidedFlow({ id: 'broken-flow' })).toThrow(
    'Flow entry is required. Flow nodes are required.',
  );
});
```

- [ ] **Step 2: Run parser tests and verify RED**

Run:

```bash
pnpm vitest run src/domain/flow-engine/__tests__/flow-engine.test.ts
```

Expected: FAIL because `../parseFlow` does not exist.

- [ ] **Step 3: Enable JSON imports**

Modify `tsconfig.json` and add `resolveJsonModule` inside `compilerOptions`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./src/*"
      ]
    },
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "noEmit": true
  }
}
```

- [ ] **Step 4: Create the parser boundary**

Create `src/domain/flow-engine/parseFlow.ts`:

```ts
import type { GuidedFlow } from './types';
import { validateFlow } from './validateFlow';

export function parseGuidedFlow(flow: unknown): GuidedFlow {
  const validation = validateFlow(flow);

  if (!validation.valid) {
    throw new Error(validation.errors.join(' '));
  }

  return flow as GuidedFlow;
}
```

- [ ] **Step 5: Run parser tests**

Run:

```bash
pnpm vitest run src/domain/flow-engine/__tests__/flow-engine.test.ts
```

Expected: PASS for the new parser tests.

- [ ] **Step 6: Commit Task 1**

```bash
git add tsconfig.json src/domain/flow-engine/parseFlow.ts src/domain/flow-engine/__tests__/flow-engine.test.ts
git commit -m "feat: parse JSON guided flows"
```

---

### Task 2: Add Generic Flow Effects And Score Branch Types

**Files:**
- Modify: `src/domain/flow-engine/types.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Add failing tests for generic scored flows**

Append this fixture near the existing `validFlow` fixture in `src/domain/flow-engine/__tests__/flow-engine.test.ts`:

```ts
const scoringFlow: GuidedFlow = {
  id: 'scoring-flow',
  version: '1.0.0',
  locale: 'pt-BR',
  title: 'Fluxo com pontuação',
  type: 'guided_conversation',
  status: 'draft',
  entry: {
    nodeId: 'q1',
    enteringPhrases: ['Quero testar pontuação'],
    transitionMessage: 'Vamos testar uma pergunta com pontuação.',
  },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Você quer somar um ponto?',
      options: [
        {
          id: 'yes',
          label: 'Sim',
          next: 'score-branch',
          effects: [{ kind: 'score', scoreKey: 'fixture-score', value: 1 }],
        },
        {
          id: 'no',
          label: 'Não',
          next: 'score-branch',
        },
      ],
    },
    'score-branch': {
      id: 'score-branch',
      kind: 'score_branch',
      text: 'Calculando o melhor retorno.',
      scoreKey: 'fixture-score',
      branches: [
        { id: 'low', min: 0, max: 0, next: 'low-result' },
        { id: 'high', min: 1, max: 20, next: 'high-result' },
      ],
    },
    'low-result': {
      id: 'low-result',
      kind: 'result',
      text: 'Resultado baixo.',
    },
    'high-result': {
      id: 'high-result',
      kind: 'result',
      text: 'Resultado alto.',
    },
  },
};
```

Append these tests inside `describe('flow runtime', ...)`:

```ts
it('applies generic score effects and resolves score branches without React-specific logic', () => {
  const initialState = createInitialFlowState(scoringFlow, [scoringFlow]);
  const nextState = advanceFlow(initialState, [scoringFlow], 'Sim');

  expect(nextState.scores['fixture-score']).toBe(1);
  expect(nextState.activeNodeId).toBe('high-result');
  expect(nextState.transcript.map((message) => message.text)).toContain('Resultado alto.');
});

it('resolves score branches using zero when the score key has not been set', () => {
  const initialState = createInitialFlowState(scoringFlow, [scoringFlow]);
  const nextState = advanceFlow(initialState, [scoringFlow], 'Não');

  expect(nextState.scores['fixture-score']).toBeUndefined();
  expect(nextState.activeNodeId).toBe('low-result');
  expect(nextState.transcript.map((message) => message.text)).toContain('Resultado baixo.');
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
pnpm vitest run src/domain/flow-engine/__tests__/flow-engine.test.ts
```

Expected: FAIL because `score_branch` and `effects` are not valid flow types yet.

- [ ] **Step 3: Extend generic flow types**

In `src/domain/flow-engine/types.ts`, update the node and option types to include generic effects and score branches:

```ts
export type FlowType = 'guided_conversation';
export type FlowNodeKind = 'choice' | 'result' | 'score_branch';
export type ChatMessageSender = 'bot' | 'user';
export type RuntimeOptionKind = 'node_option' | 'entry_phrase' | 'global_action' | 'resume_flow';
export type GlobalActionTarget = '/apoio' | '/contatos' | '/educacao' | 'end';

export interface ScoreFlowEffect {
  kind: 'score';
  scoreKey: string;
  value: number;
}

export interface SafetyInterruptFlowEffect {
  kind: 'safety_interrupt';
  message: string;
  destination: Exclude<GlobalActionTarget, 'end'>;
  blockResume: boolean;
}

export type FlowEffect = ScoreFlowEffect | SafetyInterruptFlowEffect;

export interface FlowOption {
  id: string;
  label: string;
  next: string;
  effects?: FlowEffect[];
}

export interface ScoreBranch {
  id: string;
  min: number;
  max: number;
  next: string;
}

export interface ScoreBranchFlowNode {
  id: string;
  kind: 'score_branch';
  text: string;
  scoreKey: string;
  branches: ScoreBranch[];
}

export type FlowNode = ChoiceFlowNode | ResultFlowNode | ScoreBranchFlowNode;
```

Also add `pendingNavigation` and effects to runtime state/options:

```ts
export interface FlowRuntimeState {
  activeFlowId?: string;
  activeNodeId?: string;
  transcript: ChatMessage[];
  suspendedFlows: Record<string, SuspendedFlowState>;
  answers: Record<string, string>;
  scores: Record<string, number>;
  safetyFlags: Record<string, boolean>;
  pendingNavigation?: Exclude<GlobalActionTarget, 'end'>;
}

export interface RuntimeNodeOption {
  kind: 'node_option';
  id: string;
  label: string;
  flowId: string;
  next: string;
  effects?: FlowEffect[];
}
```

- [ ] **Step 4: Run focused test**

Run:

```bash
pnpm vitest run src/domain/flow-engine/__tests__/flow-engine.test.ts
```

Expected: still FAIL because validation/runtime do not handle the new generic flow capabilities yet.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/domain/flow-engine/types.ts src/domain/flow-engine/__tests__/flow-engine.test.ts
git commit -m "test: define generic JSON flow effects"
```

---

### Task 3: Validate JSON Effects And Score Branch Nodes

**Files:**
- Modify: `src/domain/flow-engine/validateFlow.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Add failing validation tests**

Append these tests inside `describe('validateFlow', ...)`:

```ts
it('rejects score branch nodes with broken next references', () => {
  const invalidFlow: GuidedFlow = {
    ...scoringFlow,
    nodes: {
      ...scoringFlow.nodes,
      'score-branch': {
        id: 'score-branch',
        kind: 'score_branch',
        text: 'Calculando.',
        scoreKey: 'fixture-score',
        branches: [{ id: 'broken', min: 0, max: 1, next: 'missing-result' }],
      },
    },
  };

  expect(validateFlow(invalidFlow)).toEqual({
    valid: false,
    errors: ['Flow scoring-flow score branch score-branch branch broken points to missing node missing-result.'],
  });
});

it('rejects score effects without a score key', () => {
  const invalidFlow: GuidedFlow = {
    ...scoringFlow,
    nodes: {
      ...scoringFlow.nodes,
      q1: {
        id: 'q1',
        kind: 'choice',
        text: 'Pergunta inválida.',
        options: [
          {
            id: 'bad',
            label: 'Inválida',
            next: 'score-branch',
            effects: [{ kind: 'score', scoreKey: '', value: 1 }],
          },
        ],
      },
    },
  };

  expect(validateFlow(invalidFlow)).toEqual({
    valid: false,
    errors: ['Flow scoring-flow option bad score effect must include scoreKey and numeric value.'],
  });
});
```

- [ ] **Step 2: Run validation tests and verify RED**

Run:

```bash
pnpm vitest run src/domain/flow-engine/__tests__/flow-engine.test.ts
```

Expected: FAIL because score branches and effects are not validated.

- [ ] **Step 3: Update validation imports**

In `src/domain/flow-engine/validateFlow.ts`, update the type import:

```ts
import type { ChoiceFlowNode, FlowEffect, FlowNode, FlowValidationResult, ScoreBranchFlowNode } from './types';
```

- [ ] **Step 4: Add score-branch and effect validation**

In `src/domain/flow-engine/validateFlow.ts`, replace the current `validateNode` and `validateChoiceNode` helpers with:

```ts
function validateNode(flowLabel: string, nodeKey: string, nodeValue: unknown, nodeIds: Set<string>, errors: string[]) {
  if (!isRecord(nodeValue)) {
    errors.push(`Flow ${flowLabel} node ${nodeKey} must be an object.`);
    return;
  }

  const node = nodeValue as unknown as FlowNode;

  if (!hasText(node.id)) {
    errors.push(`Flow ${flowLabel} has a node without an id.`);
  } else if (nodeKey !== node.id) {
    errors.push(`Flow ${flowLabel} node key ${nodeKey} must match node id ${node.id}.`);
  }

  if (!hasText(node.text)) {
    errors.push(`Flow ${flowLabel} node ${String(node.id)} must include text.`);
  }

  if (node.kind === 'choice') {
    validateChoiceNode(flowLabel, node, nodeIds, errors);
    return;
  }

  if (node.kind === 'score_branch') {
    validateScoreBranchNode(flowLabel, node, nodeIds, errors);
  }
}

function validateChoiceNode(flowLabel: string, node: ChoiceFlowNode, nodeIds: Set<string>, errors: string[]) {
  if (node.options.length === 0) {
    errors.push(`Flow ${flowLabel} choice node ${node.id} must include options.`);
  }

  node.options.forEach((option) => {
    if (!hasText(option.id)) {
      errors.push(`Flow ${flowLabel} node ${node.id} has an option without an id.`);
    }

    if (!hasText(option.label)) {
      errors.push(`Flow ${flowLabel} option ${option.id} must include a label.`);
    }

    if (!nodeIds.has(option.next)) {
      errors.push(`Flow ${flowLabel} option ${option.id} points to missing node ${option.next}.`);
    }

    option.effects?.forEach((effect) => validateEffect(flowLabel, option.id, effect, errors));
  });
}
```

Then add these helpers below them:

```ts
function validateScoreBranchNode(flowLabel: string, node: ScoreBranchFlowNode, nodeIds: Set<string>, errors: string[]) {
  if (!hasText(node.scoreKey)) {
    errors.push(`Flow ${flowLabel} score branch ${node.id} must include a scoreKey.`);
  }

  if (!Array.isArray(node.branches) || node.branches.length === 0) {
    errors.push(`Flow ${flowLabel} score branch ${node.id} must include branches.`);
    return;
  }

  node.branches.forEach((branch) => {
    if (!hasText(branch.id) || typeof branch.min !== 'number' || typeof branch.max !== 'number') {
      errors.push(`Flow ${flowLabel} score branch ${node.id} has an invalid branch.`);
      return;
    }

    if (!nodeIds.has(branch.next)) {
      errors.push(`Flow ${flowLabel} score branch ${node.id} branch ${branch.id} points to missing node ${branch.next}.`);
    }
  });
}

function validateEffect(flowLabel: string, optionId: string, effect: FlowEffect, errors: string[]) {
  if (effect.kind === 'score') {
    if (!hasText(effect.scoreKey) || typeof effect.value !== 'number') {
      errors.push(`Flow ${flowLabel} option ${optionId} score effect must include scoreKey and numeric value.`);
    }
    return;
  }

  if (effect.kind === 'safety_interrupt') {
    if (!hasText(effect.message) || !hasText(effect.destination) || typeof effect.blockResume !== 'boolean') {
      errors.push(`Flow ${flowLabel} option ${optionId} safety interrupt effect must include message, destination, and blockResume.`);
    }
  }
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm vitest run src/domain/flow-engine/__tests__/flow-engine.test.ts
```

Expected: validation tests PASS; runtime tests may still FAIL.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/domain/flow-engine/validateFlow.ts src/domain/flow-engine/__tests__/flow-engine.test.ts
git commit -m "feat: validate JSON flow effects"
```

---

### Task 4: Execute Generic Effects And Score Branches

**Files:**
- Modify: `src/domain/flow-engine/advanceFlow.ts`
- Modify: `src/domain/flow-engine/loadFlows.ts`
- Modify: `src/domain/flow-engine/resolveOptions.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Add failing safety interruption test**

Append this test inside `describe('flow runtime', ...)`:

```ts
it('handles safety interruption as a generic JSON option effect', () => {
  const safetyFlow: GuidedFlow = {
    ...scoringFlow,
    id: 'safety-flow',
    title: 'Fluxo com segurança',
    entry: {
      nodeId: 'q1',
      enteringPhrases: ['Quero testar segurança'],
      transitionMessage: 'Vamos testar segurança.',
    },
    nodes: {
      q1: {
        id: 'q1',
        kind: 'choice',
        text: 'Você precisa de apoio agora?',
        options: [
          {
            id: 'yes',
            label: 'Sim',
            next: 'high-result',
            effects: [
              {
                kind: 'safety_interrupt',
                message: 'Vamos te direcionar para apoio imediato.',
                destination: '/apoio',
                blockResume: true,
              },
            ],
          },
          { id: 'no', label: 'Não', next: 'low-result' },
        ],
      },
      'low-result': {
        id: 'low-result',
        kind: 'result',
        text: 'Seguimos com calma.',
      },
      'high-result': {
        id: 'high-result',
        kind: 'result',
        text: 'Este texto não deve aparecer antes do apoio.',
      },
    },
  };

  const nextState = advanceFlow(createInitialFlowState(safetyFlow, [safetyFlow]), [safetyFlow], 'Sim');

  expect(nextState.pendingNavigation).toBe('/apoio');
  expect(nextState.activeFlowId).toBeUndefined();
  expect(nextState.activeNodeId).toBeUndefined();
  expect(nextState.safetyFlags['block-resume:safety-flow']).toBe(true);
  expect(nextState.transcript.map((message) => message.text)).toContain('Vamos te direcionar para apoio imediato.');
  expect(nextState.transcript.map((message) => message.text)).not.toContain('Este texto não deve aparecer antes do apoio.');
});
```

- [ ] **Step 2: Run runtime tests and verify RED**

Run:

```bash
pnpm vitest run src/domain/flow-engine/__tests__/flow-engine.test.ts
```

Expected: FAIL because option effects and score branches are not executed.

- [ ] **Step 3: Pass option effects through runtime options**

In `src/domain/flow-engine/resolveOptions.ts`, add `effects` when mapping current node options:

```ts
          effects: option.effects,
```

- [ ] **Step 4: Initialize pending navigation**

In `src/domain/flow-engine/loadFlows.ts`, update the `createInitialFlowState` return object:

```ts
  return {
    activeFlowId: flow.id,
    activeNodeId: flow.entry.nodeId,
    transcript: [
      createMessage('bot', flow.entry.transitionMessage, flow.id, flow.entry.nodeId),
      createMessage('bot', node.text, flow.id, node.id),
    ],
    suspendedFlows: {},
    answers: {},
    scores: {},
    safetyFlags: {},
    pendingNavigation: undefined,
  };
```

- [ ] **Step 5: Execute option effects and score branches**

In `src/domain/flow-engine/advanceFlow.ts`, update imports:

```ts
import type { FlowEffect, FlowNode, FlowRuntimeState, GuidedFlow, RuntimeOption } from './types';
```

Replace the final node-option handling block with:

```ts
  const activeFlow = getActiveFlow(state, flows);
  const currentNodeId = state.activeNodeId ?? activeFlow.entry.nodeId;
  const currentNode = activeFlow.nodes[currentNodeId];
  const matchingOption =
    currentNode.kind === 'choice'
      ? currentNode.options.find((option) => option.id === selectedOption.id)
      : undefined;

  if (!matchingOption) {
    throw new Error(`Selection ${selectedLabel} is not available for node ${currentNodeId}.`);
  }

  const userMessage = createMessage('user', selectedOption.label, activeFlow.id, currentNodeId);
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
    matchingOption.effects ?? [],
  );

  if (effectedState.pendingNavigation) {
    return effectedState;
  }

  return advanceToNode(effectedState, activeFlow, matchingOption.next);
```

Add these helpers at the bottom of the file:

```ts
function applyOptionEffects(
  state: FlowRuntimeState,
  flowId: string,
  effects: FlowEffect[],
): FlowRuntimeState {
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

    return {
      ...nextState,
      activeFlowId: undefined,
      activeNodeId: undefined,
      pendingNavigation: effect.destination,
      safetyFlags: {
        ...nextState.safetyFlags,
        ...(effect.blockResume ? { [`block-resume:${flowId}`]: true } : {}),
      },
      transcript: [
        ...nextState.transcript,
        createMessage('bot', effect.message, flowId, nextState.activeNodeId),
      ],
    };
  }, state);
}

function advanceToNode(state: FlowRuntimeState, flow: GuidedFlow, nodeId: string): FlowRuntimeState {
  const node = flow.nodes[nodeId];

  if (node.kind === 'score_branch') {
    return advanceToNode(state, flow, resolveScoreBranchNextNode(state, node));
  }

  return {
    ...state,
    activeNodeId: node.id,
    transcript: [...state.transcript, createMessage('bot', node.text, flow.id, node.id)],
  };
}

function resolveScoreBranchNextNode(state: FlowRuntimeState, node: Extract<FlowNode, { kind: 'score_branch' }>) {
  const score = state.scores[node.scoreKey] ?? 0;
  const branch = node.branches.find((candidate) => score >= candidate.min && score <= candidate.max);

  if (!branch) {
    throw new Error(`No score branch found for ${node.scoreKey} score ${score}.`);
  }

  return branch.next;
}
```

- [ ] **Step 6: Run focused runtime tests**

Run:

```bash
pnpm vitest run src/domain/flow-engine/__tests__/flow-engine.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/domain/flow-engine/advanceFlow.ts src/domain/flow-engine/loadFlows.ts src/domain/flow-engine/resolveOptions.ts src/domain/flow-engine/__tests__/flow-engine.test.ts
git commit -m "feat: execute JSON flow effects"
```

---

### Task 5: Add Dynamic JSON Flow Discovery And SRQ-20 Content

**Files:**
- Create: `src/content/flows/srq20.json`
- Modify: `src/content/flows/registry.ts`
- Test: `src/domain/flow-engine/__tests__/flow-engine.test.ts`

- [ ] **Step 1: Add failing dynamic JSON registry tests**

Add this import to `src/domain/flow-engine/__tests__/flow-engine.test.ts`:

```ts
import { flowRegistry } from '../../../content/flows/registry';
```

Append these tests inside `describe('flow runtime', ...)`:

```ts
it('discovers JSON flows from the content folder without per-flow imports', () => {
  const flowIds = flowRegistry.flows.map((flow) => flow.id);

  expect(flowIds).toContain('srq20');
});

it('registers SRQ-20 from JSON as a normal guided flow entry phrase', () => {
  const state = createInitialFlowStateFromRegistry(flowRegistry.flows, 'work-stress');
  const labels = resolveOptions(state, flowRegistry.flows).map((option) => option.label);

  expect(labels).toContain('Quero responder o SRQ-20');
});

it('runs SRQ-20 JSON through the generic flow engine and resolves possible distress at score 7', () => {
  let state = createInitialFlowStateFromRegistry(flowRegistry.flows, 'srq20');

  for (let index = 0; index < 7; index += 1) {
    state = advanceFlow(state, flowRegistry.flows, 'Sim');
  }

  for (let index = 7; index < 20; index += 1) {
    state = advanceFlow(state, flowRegistry.flows, 'Não');
  }

  expect(state.activeNodeId).toBe('possible-distress-result');
  expect(state.scores.srq20).toBe(7);
  expect(state.transcript.at(-1)?.text).toContain('não é um diagnóstico');
});

it('routes SRQ-20 Q17 affirmative through generic JSON safety interruption', () => {
  let state = createInitialFlowStateFromRegistry(flowRegistry.flows, 'srq20');

  for (let index = 0; index < 16; index += 1) {
    state = advanceFlow(state, flowRegistry.flows, 'Não');
  }

  state = advanceFlow(state, flowRegistry.flows, 'Sim');

  expect(state.pendingNavigation).toBe('/apoio');
  expect(state.safetyFlags['block-resume:srq20']).toBe(true);
  expect(state.activeFlowId).toBeUndefined();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm vitest run src/domain/flow-engine/__tests__/flow-engine.test.ts
```

Expected: FAIL because no JSON glob registry exists and `srq20` is not in `flowRegistry.flows`.

- [ ] **Step 3: Create `src/content/flows/srq20.json`**

Create `src/content/flows/srq20.json` with explicit JSON content:

```json
{
  "id": "srq20",
  "version": "1.0.0",
  "locale": "pt-BR",
  "title": "SRQ-20",
  "type": "guided_conversation",
  "status": "draft",
  "entry": {
    "nodeId": "consent",
    "enteringPhrases": [
      "Quero responder o SRQ-20",
      "Quero fazer o questionário",
      "Avaliar como estou",
      "Ver como estou me sentindo"
    ],
    "transitionMessage": "Este é o SRQ-20, um questionário de rastreio. Ele ajuda a identificar sinais de sofrimento, mas não faz diagnóstico."
  },
  "nodes": {
    "consent": {
      "id": "consent",
      "kind": "choice",
      "text": "Antes de começar: suas respostas ficam apenas nesta conversa. O SRQ-20 não substitui uma avaliação profissional. Você quer responder agora?",
      "options": [
        { "id": "accept", "label": "Quero responder", "next": "q1" },
        { "id": "decline", "label": "Agora não", "next": "declined-result" }
      ]
    },
    "q1": { "id": "q1", "kind": "choice", "text": "Você tem se sentido nervoso(a), tenso(a) ou preocupado(a) sem motivo claro?", "options": [{ "id": "yes", "label": "Sim", "next": "q2", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q2" }] },
    "q2": { "id": "q2", "kind": "choice", "text": "Você tem tido dificuldade para dormir — demora para conseguir dormir ou acorda no meio da noite?", "options": [{ "id": "yes", "label": "Sim", "next": "q3", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q3" }] },
    "q3": { "id": "q3", "kind": "choice", "text": "Você tem sentido medo ou receio de algo, mesmo sem saber bem o que é?", "options": [{ "id": "yes", "label": "Sim", "next": "q4", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q4" }] },
    "q4": { "id": "q4", "kind": "choice", "text": "Você tem sentido o estômago ruim, com dor ou mal-estar, mesmo sem ter comido nada estranho?", "options": [{ "id": "yes", "label": "Sim", "next": "q5", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q5" }] },
    "q5": { "id": "q5", "kind": "choice", "text": "Você tem tido tonturas ou sensação de cabeça leve?", "options": [{ "id": "yes", "label": "Sim", "next": "q6", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q6" }] },
    "q6": { "id": "q6", "kind": "choice", "text": "Suas mãos tremem mesmo quando você não está fazendo esforço?", "options": [{ "id": "yes", "label": "Sim", "next": "q7", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q7" }] },
    "q7": { "id": "q7", "kind": "choice", "text": "Você tem tido menos vontade de comer, mesmo quando é hora da refeição?", "options": [{ "id": "yes", "label": "Sim", "next": "q8", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q8" }] },
    "q8": { "id": "q8", "kind": "choice", "text": "Você tem chorado com mais facilidade do que antes, mesmo por coisas pequenas?", "options": [{ "id": "yes", "label": "Sim", "next": "q9", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q9" }] },
    "q9": { "id": "q9", "kind": "choice", "text": "Tem sido difícil sentir prazer ou alegria nas coisas que antes te faziam bem?", "options": [{ "id": "yes", "label": "Sim", "next": "q10", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q10" }] },
    "q10": { "id": "q10", "kind": "choice", "text": "Você tem tido dificuldade para tomar decisões, mesmo as do dia a dia?", "options": [{ "id": "yes", "label": "Sim", "next": "q11", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q11" }] },
    "q11": { "id": "q11", "kind": "choice", "text": "As tarefas do dia a dia — em casa ou no trabalho — têm parecido mais difíceis do que o normal?", "options": [{ "id": "yes", "label": "Sim", "next": "q12", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q12" }] },
    "q12": { "id": "q12", "kind": "choice", "text": "Você sente que seu trabalho não está fazendo diferença ou que não está sendo útil?", "options": [{ "id": "yes", "label": "Sim", "next": "q13", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q13" }] },
    "q13": { "id": "q13", "kind": "choice", "text": "Você tem perdido o interesse por coisas que antes considerava importantes?", "options": [{ "id": "yes", "label": "Sim", "next": "q14", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q14" }] },
    "q14": { "id": "q14", "kind": "choice", "text": "Você tem se sentido sem valor ou como se não fosse capaz?", "options": [{ "id": "yes", "label": "Sim", "next": "q15", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q15" }] },
    "q15": { "id": "q15", "kind": "choice", "text": "Você tem se sentido exausto(a), sem energia nem para as coisas básicas?", "options": [{ "id": "yes", "label": "Sim", "next": "q16", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q16" }] },
    "q16": { "id": "q16", "kind": "choice", "text": "Você tem sentido alguma sensação desagradável no estômago, como aperto, queimação ou nojo?", "options": [{ "id": "yes", "label": "Sim", "next": "q17", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q17" }] },
    "q17": { "id": "q17", "kind": "choice", "text": "Você já teve pensamentos de que seria melhor estar morto(a) ou de se machucar?", "options": [{ "id": "yes", "label": "Sim", "next": "q18", "effects": [{ "kind": "safety_interrupt", "message": "Agradecemos sua coragem em responder com sinceridade. Pensamentos assim merecem atenção e acolhimento profissional. Vamos te direcionar para recursos de apoio imediato. Você não está sozinho(a).", "destination": "/apoio", "blockResume": true }] }, { "id": "no", "label": "Não", "next": "q18" }] },
    "q18": { "id": "q18", "kind": "choice", "text": "Você tem dormido mal — acorda cansado(a) mesmo depois de ter dormido?", "options": [{ "id": "yes", "label": "Sim", "next": "q19", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q19" }] },
    "q19": { "id": "q19", "kind": "choice", "text": "Você tem se sentido preocupado(a) com coisas do dia a dia de um jeito que não consegue controlar?", "options": [{ "id": "yes", "label": "Sim", "next": "q20", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "q20" }] },
    "q20": { "id": "q20", "kind": "choice", "text": "Você se cansa com facilidade, mesmo com atividades que antes não te cansavam?", "options": [{ "id": "yes", "label": "Sim", "next": "srq20-score", "effects": [{ "kind": "score", "scoreKey": "srq20", "value": 1 }] }, { "id": "no", "label": "Não", "next": "srq20-score" }] },
    "srq20-score": {
      "id": "srq20-score",
      "kind": "score_branch",
      "text": "Vou organizar suas respostas de forma cuidadosa.",
      "scoreKey": "srq20",
      "branches": [
        { "id": "low-distress", "min": 0, "max": 6, "next": "low-distress-result" },
        { "id": "possible-distress", "min": 7, "max": 20, "next": "possible-distress-result" }
      ]
    },
    "declined-result": {
      "id": "declined-result",
      "kind": "result",
      "text": "Tudo bem. Você pode responder o SRQ-20 em outro momento ou seguir com uma orientação mais breve."
    },
    "low-distress-result": {
      "id": "low-distress-result",
      "kind": "result",
      "text": "Com base nas suas respostas, você parece estar lidando bem com as demandas do dia a dia. Isso não significa que tudo está perfeito — mas sugere que, neste momento, você tem encontrado formas de cuidar de si. Continue prestando atenção em como se sente e valorize os momentos que te fazem bem.",
      "recommendations": ["teacher-emotional-regulation-classroom"]
    },
    "possible-distress-result": {
      "id": "possible-distress-result",
      "kind": "result",
      "text": "Com base nas suas respostas, você pode estar passando por um momento de maior sofrimento. Isso não é um diagnóstico — é um sinal de que vale a pena prestar mais atenção em si mesmo(a). Muitas pessoas passam por fases assim, e buscar apoio é um ato de coragem, não de fraqueza.",
      "recommendations": ["teacher-emotional-regulation-classroom"]
    }
  }
}
```

- [ ] **Step 4: Register all JSON flows through dynamic discovery**

Modify `src/content/flows/registry.ts`:

```ts
import type { ContentMetadata } from '../../domain/content/types';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { parseGuidedFlow } from '../../domain/flow-engine/parseFlow';
import { restRecoveryFlow } from './rest-recovery';
import { workStressFlow } from './work-stress';

const jsonFlowModules = import.meta.glob('./*.json', {
  eager: true,
  import: 'default',
});

const jsonFlows = Object.entries(jsonFlowModules)
  .map(([path, flow]) => ({
    path,
    flow: parseGuidedFlow(flow),
  }))
  .sort((left, right) => left.path.localeCompare(right.path))
  .map(({ flow }) => flow);

export const flowRegistry = {
  id: 'flow-registry',
  version: '1.0.0',
  status: 'draft',
  locale: 'pt-BR',
  flows: [workStressFlow, restRecoveryFlow, ...jsonFlows],
} satisfies ContentMetadata & { flows: GuidedFlow[] };
```

This is intentionally a folder-level discovery boundary. A future dashboard export can add `src/content/flows/new-questionnaire.json`; the registry will include it without adding an import statement.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm vitest run src/domain/flow-engine/__tests__/flow-engine.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/content/flows/srq20.json src/content/flows/registry.ts src/domain/flow-engine/__tests__/flow-engine.test.ts
git commit -m "feat: discover JSON guided flows"
```

---

### Task 6: Keep Orientation Generic While Consuming JSON SRQ-20

**Files:**
- Modify: `src/features/orientation/OrientationScreen.tsx`
- Modify: `src/features/orientation/__tests__/OrientationScreen.test.tsx`

- [ ] **Step 1: Add failing chatbot tests**

Append these tests to `src/features/orientation/__tests__/OrientationScreen.test.tsx`:

```tsx
it('starts SRQ-20 through chatbot autocomplete from JSON flow content', () => {
  render(
    <MemoryRouter>
      <OrientationScreen />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByPlaceholderText('Digite ou escolha uma opção'), {
    target: { value: 'SRQ-20' },
  });

  fireEvent.click(screen.getByRole('option', { name: 'Quero responder o SRQ-20' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enviar opção selecionada' }));

  expect(screen.getByText(/Este é o SRQ-20/i)).toBeInTheDocument();
  expect(screen.getByText(/Antes de começar/i)).toBeInTheDocument();
});

it('does not render a questionnaire-specific screen entry', () => {
  render(
    <MemoryRouter>
      <OrientationScreen />
    </MemoryRouter>,
  );

  expect(screen.queryByRole('link', { name: /SRQ-20/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /Responder SRQ-20/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI tests**

Run:

```bash
pnpm vitest run src/features/orientation/__tests__/OrientationScreen.test.tsx
```

Expected: first test may PASS after Task 5; pending safety navigation is not handled yet.

- [ ] **Step 3: Add generic pending-navigation handling**

In `src/features/orientation/OrientationScreen.tsx`, add this effect after the existing scroll effect:

```tsx
  useEffect(() => {
    if (state.pendingNavigation) {
      navigate(state.pendingNavigation);
    }
  }, [navigate, state.pendingNavigation]);
```

No SRQ-20-specific JSX should be added.

- [ ] **Step 4: Run focused UI tests**

Run:

```bash
pnpm vitest run src/features/orientation/__tests__/OrientationScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add src/features/orientation/OrientationScreen.tsx src/features/orientation/__tests__/OrientationScreen.test.tsx
git commit -m "feat: consume JSON SRQ-20 in chatbot"
```

---

### Task 7: Remove The Separate Questionnaire Path

**Files:**
- Delete: `src/content/questionnaires/registry.ts`
- Delete: `src/content/questionnaires/srq20.ts`
- Delete: `src/domain/questionnaires/checkSafetyInterruption.ts`
- Delete: `src/domain/questionnaires/resolveQuestionnaireResult.ts`
- Delete: `src/domain/questionnaires/scoreQuestionnaire.ts`
- Delete: `src/domain/questionnaires/types.ts`
- Delete: `src/domain/questionnaires/validateQuestionnaire.ts`
- Delete: `src/domain/questionnaires/__tests__/questionnaire.test.ts`
- Modify: `src/domain/questionnaires/README.md`

- [ ] **Step 1: Verify separate questionnaire modules are no longer imported by app code**

Run:

```bash
rg -n "domain/questionnaires|content/questionnaires|questionnaireRegistry|srq20Questionnaire" src
```

Expected before deletion: only the files being deleted, their tests, or README references appear.

- [ ] **Step 2: Delete obsolete questionnaire runtime/content files**

Delete these files:

```txt
src/content/questionnaires/registry.ts
src/content/questionnaires/srq20.ts
src/domain/questionnaires/checkSafetyInterruption.ts
src/domain/questionnaires/resolveQuestionnaireResult.ts
src/domain/questionnaires/scoreQuestionnaire.ts
src/domain/questionnaires/types.ts
src/domain/questionnaires/validateQuestionnaire.ts
src/domain/questionnaires/__tests__/questionnaire.test.ts
```

- [ ] **Step 3: Update the questionnaire README**

Replace `src/domain/questionnaires/README.md` with:

```md
# Questionnaires

Questionnaire-like experiences are JSON guided-flow content executed by `src/domain/flow-engine`.

Do not add questionnaire-specific React screens, routes, TypeScript content files, scoring services, or persistence here. If a questionnaire needs scoring, consent copy, branching, recommendations, or safety interruption, express those requirements in JSON flow content and extend the generic flow engine only when the capability is reusable by other flows.
```

- [ ] **Step 4: Verify no stale source imports remain**

Run:

```bash
rg -n "domain/questionnaires|content/questionnaires|questionnaireRegistry|srq20Questionnaire" src
```

Expected: no matches outside `src/domain/questionnaires/README.md`.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm run test
```

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```bash
git add -A src/content/questionnaires src/domain/questionnaires
git commit -m "refactor: remove separate questionnaire runtime"
```

---

### Task 8: Sync Documentation With JSON-Editable Flow Architecture

**Files:**
- Modify: `docs/fronts/06-questionnaire-framework-srq20.md`
- Modify: `docs/fronts/06a-questionnaire-framework-srq20-breakdown.md`

- [ ] **Step 1: Update Front 06 principle**

In `docs/fronts/06-questionnaire-framework-srq20.md`, replace the `Principle` section with:

````md
## Principle

A questionnaire is represented as dashboard-editable JSON guided-flow content:

```txt
src/content/flows/*.json
  -> import.meta.glob discovery
  -> generic flow parser and validator
  -> generic flow engine
  -> generic chatbot UI
```

The app must not create a separate questionnaire screen, route, TypeScript workflow file, or questionnaire-specific runtime. SRQ-20 proves that the chatbot framework can execute structured, scored, interruptible flows from JSON-compatible content.
````

- [ ] **Step 2: Update Front 06A target shape**

In `docs/fronts/06a-questionnaire-framework-srq20-breakdown.md`, replace the `Target Shape` section with:

````md
## Target Shape

SRQ-20 is a regular registered JSON guided flow:

```txt
src/content/flows/srq20.json
  -> import.meta.glob in src/content/flows/registry.ts
  -> src/domain/flow-engine
  -> src/features/orientation/OrientationScreen.tsx
```

There is no SRQ-20 screen, no SRQ-20 route, no `srq20.ts` workflow file, no per-questionnaire TypeScript import, and no questionnaire-specific frontend state machine. The Orientation chatbot renders whatever the flow engine exposes: transcript messages, constrained options, score-driven results, and safety navigation.
````

- [ ] **Step 3: Run architecture grep**

Run:

```bash
rg -n "Srq20Screen|orientacao/srq20|src/content/flows/srq20.ts|questionnaire-specific React|dedicated SRQ-20" src docs/fronts
```

Expected: no matches.

- [ ] **Step 4: Commit Task 8**

```bash
git add docs/fronts/06-questionnaire-framework-srq20.md docs/fronts/06a-questionnaire-framework-srq20-breakdown.md
git commit -m "docs: require JSON SRQ-20 flow content"
```

---

### Task 9: Final Verification

**Files:**
- No direct source edits expected.

- [ ] **Step 1: Run full verification**

Run:

```bash
pnpm run test
pnpm run lint
pnpm run build
```

Expected:

```txt
pnpm run test  -> all test files pass
pnpm run lint  -> tsc --noEmit passes
pnpm run build -> Vite production build completes
```

- [ ] **Step 2: Verify SRQ-20 exists as JSON content only**

Run:

```bash
rg -n "srq20|SRQ-20|questionnaire" src
```

Expected source-path shape:

```txt
src/content/flows/srq20.json
src/content/flows/registry.ts
src/domain/flow-engine/__tests__/flow-engine.test.ts
src/features/orientation/__tests__/OrientationScreen.test.tsx
src/domain/questionnaires/README.md
```

There must be no `src/content/flows/srq20.ts`, no `src/content/questionnaires/srq20.ts`, and no SRQ-20 React screen.

- [ ] **Step 3: Verify registry uses dynamic JSON discovery**

Run:

```bash
rg -n "import srq20|srq20FlowJson|from './srq20.json'|import.meta.glob" src/content/flows/registry.ts
```

Expected:

```txt
src/content/flows/registry.ts:<line>:const jsonFlowModules = import.meta.glob('./*.json', {
```

There must be no direct `srq20.json` import in `registry.ts`.

---

## Self-Review Checklist

- Spec coverage:
  - SRQ-20 workflow is JSON only: Task 5.
  - Future dashboard editing is supported by content shape and dynamic discovery: Tasks 1, 5, 8, and 9.
  - Logic is decoupled from screens: Tasks 2, 3, 4, and 6.
  - No dedicated SRQ-20 screen or route: Tasks 6, 8, and 9.
  - Existing separate questionnaire path is removed: Task 7.
  - Consent, scoring, threshold result, and Q17 interruption are represented in JSON: Task 5.
- Placeholder scan:
  - No empty future implementation steps remain.
- Type consistency:
  - JSON imports are enabled before importing `srq20.json`.
  - JSON flow registry uses `import.meta.glob('./*.json')`, not per-file imports.
  - `parseGuidedFlow` validates unknown JSON before casting to `GuidedFlow`.
  - `FlowEffect` and `score_branch` are generic engine capabilities, not SRQ-20-specific types.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-16-json-flow-srq20.md`. Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using `superpowers:executing-plans`, with checkpoints.
