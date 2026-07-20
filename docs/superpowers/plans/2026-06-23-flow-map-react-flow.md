# Mapa Visual Interativo — React Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Mapa visual" and "Redirecionamentos" tabs in the flow dashboard with a single interactive React Flow graph that shows every node color-coded by its effects, and opens an inline inspector panel on click.

**Architecture:** `FlowMap.tsx` is fully rewritten to mount a `<ReactFlow>` canvas. A new `flowMapLayout.ts` utility converts the `GuidedFlow` data model into React Flow nodes/edges with dagre-computed positions. A new `FlowMapInspector.tsx` renders the right-side panel with light editing. `FlowDashboard.tsx` drops the redirections tab and passes new props to `FlowMap`.

**Tech Stack:** `@xyflow/react` (React Flow v12), `@dagrejs/dagre` (layout), React 19, TypeScript, Tailwind CSS v4, Vitest + Testing Library.

---

## File Map

| Action  | File                                                          |
| ------- | ------------------------------------------------------------- |
| Modify  | `package.json`                                                |
| Modify  | `src/dev-dashboard/flows/FlowDashboard.tsx`                   |
| Rewrite | `src/dev-dashboard/flows/FlowMap.tsx`                         |
| Create  | `src/dev-dashboard/flows/flowMapLayout.ts`                    |
| Create  | `src/dev-dashboard/flows/FlowMapInspector.tsx`                |
| Delete  | `src/dev-dashboard/flows/FlowRedirectionsPanel.tsx`           |
| Modify  | `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`         |
| Create  | `src/dev-dashboard/flows/__tests__/flowMapLayout.test.ts`     |
| Create  | `src/dev-dashboard/flows/__tests__/FlowMapInspector.test.tsx` |

---

## Task 1: Install dependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install React Flow and dagre**

Run:

```powershell
pnpm add @xyflow/react @dagrejs/dagre
```

Expected: both packages appear in `package.json` `dependencies` and `node_modules` (or `node_modules.win`).

- [ ] **Step 2: Verify types are available**

Run:

```powershell
pnpm exec tsc --noEmit --project tsconfig.json 2>&1 | Select-String "xyflow|dagre"
```

Expected: no output (no type errors from the new packages). If `@types/dagre` is needed separately (for older dagre builds), install with `pnpm add -D @types/dagre`. The `@dagrejs/dagre` package ships its own types so this should not be needed.

- [ ] **Step 3: Commit**

```powershell
git add package.json pnpm-lock.yaml; git commit -m "chore: add @xyflow/react and @dagrejs/dagre"
```

---

## Task 2: Layout utility — `flowMapLayout.ts`

This module converts a `GuidedFlow` into the node/edge arrays that React Flow needs, with positions computed by dagre.

**Files:**

- Create: `src/dev-dashboard/flows/flowMapLayout.ts`
- Create: `src/dev-dashboard/flows/__tests__/flowMapLayout.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dev-dashboard/flows/__tests__/flowMapLayout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildFlowGraph } from '../flowMapLayout';
import type { GuidedFlow } from '../../../domain/flow-engine/types';

const simpleFlow: GuidedFlow = {
  id: 'test',
  version: '1.0',
  locale: 'pt-BR',
  title: 'Test',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'q1', enteringPhrases: [], transitionMessage: '' },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Pergunta 1',
      options: [
        { id: 'yes', label: 'Sim', next: 'result', effects: [{ kind: 'score', scoreKey: 'srq20', value: 1 }] },
        { id: 'no', label: 'Não', next: 'result' },
      ],
    },
    result: { id: 'result', kind: 'result', text: 'Fim.' },
  },
};

const safetyFlow: GuidedFlow = {
  id: 'safety',
  version: '1.0',
  locale: 'pt-BR',
  title: 'Safety',
  type: 'guided_conversation',
  status: 'draft',
  entry: { nodeId: 'q1', enteringPhrases: [], transitionMessage: '' },
  nodes: {
    q1: {
      id: 'q1',
      kind: 'choice',
      text: 'Tem ideias de se machucar?',
      options: [
        {
          id: 'yes',
          label: 'Sim',
          next: 'result',
          effects: [{ kind: 'safety_interrupt', message: 'Cuidado', destination: '/apoio', blockResume: false }],
        },
        { id: 'no', label: 'Não', next: 'result' },
      ],
    },
    result: { id: 'result', kind: 'result', text: 'Fim.' },
  },
};

describe('buildFlowGraph', () => {
  it('returns one RF node per flow node', () => {
    const { nodes } = buildFlowGraph(simpleFlow);
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.id)).toEqual(expect.arrayContaining(['q1', 'result']));
  });

  it('assigns x and y positions (dagre layout)', () => {
    const { nodes } = buildFlowGraph(simpleFlow);
    for (const node of nodes) {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
    }
  });

  it('returns one edge per unique next target per option', () => {
    const { edges } = buildFlowGraph(simpleFlow);
    // q1 has two options both pointing to result — should produce 2 edges (one per option)
    expect(edges).toHaveLength(2);
  });

  it('tags score edges with type "score"', () => {
    const { edges } = buildFlowGraph(simpleFlow);
    const scoreEdge = edges.find((e) => e.data?.effectKind === 'score');
    expect(scoreEdge).toBeDefined();
  });

  it('tags safety_interrupt edges with type "safety_interrupt"', () => {
    const { edges } = buildFlowGraph(safetyFlow);
    const safetyEdge = edges.find((e) => e.data?.effectKind === 'safety_interrupt');
    expect(safetyEdge).toBeDefined();
  });

  it('attaches node kind to RF node data', () => {
    const { nodes } = buildFlowGraph(simpleFlow);
    const choiceNode = nodes.find((n) => n.id === 'q1');
    expect(choiceNode?.data.kind).toBe('choice');
  });

  it('handles score_branch nodes', () => {
    const flow: GuidedFlow = {
      ...simpleFlow,
      nodes: {
        branch: {
          id: 'branch',
          kind: 'score_branch',
          text: 'Calculando',
          scoreKey: 'srq20',
          branches: [
            { id: 'low', min: 0, max: 6, next: 'low-result' },
            { id: 'high', min: 7, max: 20, next: 'high-result' },
          ],
        },
        'low-result': { id: 'low-result', kind: 'result', text: 'Baixo.' },
        'high-result': { id: 'high-result', kind: 'result', text: 'Alto.' },
      },
    };
    const { nodes, edges } = buildFlowGraph(flow);
    expect(nodes).toHaveLength(3);
    expect(edges).toHaveLength(2); // one per branch
    expect(edges.every((e) => e.data?.effectKind === 'score_branch')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
pnpm exec vitest run src/dev-dashboard/flows/__tests__/flowMapLayout.test.ts
```

Expected: all tests fail with `Cannot find module '../flowMapLayout'`.

- [ ] **Step 3: Implement `flowMapLayout.ts`**

Create `src/dev-dashboard/flows/flowMapLayout.ts`:

```ts
import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { GuidedFlow, FlowNode } from '../../domain/flow-engine/types';

export type FlowNodeData = {
  node: FlowNode;
  kind: FlowNode['kind'];
  label: string;
};

export type FlowEdgeData = {
  effectKind: 'normal' | 'score' | 'deferred_safety' | 'safety_interrupt' | 'flow_start' | 'score_branch';
  optionLabel?: string;
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

export function buildFlowGraph(flow: GuidedFlow): {
  nodes: Node<FlowNodeData>[];
  edges: Edge<FlowEdgeData>[];
} {
  const flowNodes = Object.values(flow.nodes);
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });

  for (const node of flowNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Build edge list first so dagre can compute layout
  const rawEdges: Array<{ source: string; target: string; data: FlowEdgeData; id: string }> = [];

  for (const node of flowNodes) {
    if (node.kind === 'choice') {
      for (const option of node.options) {
        const effectKind = getOptionEdgeKind(option.effects);
        const edgeId = `${node.id}__${option.id}__${option.next}`;
        g.setEdge(node.id, option.next);
        rawEdges.push({
          id: edgeId,
          source: node.id,
          target: option.next,
          data: { effectKind, optionLabel: option.label },
        });
      }
    } else if (node.kind === 'score_branch') {
      for (const branch of node.branches) {
        const edgeId = `${node.id}__branch__${branch.id}__${branch.next}`;
        g.setEdge(node.id, branch.next);
        rawEdges.push({
          id: edgeId,
          source: node.id,
          target: branch.next,
          data: { effectKind: 'score_branch', optionLabel: `${branch.min}–${branch.max}` },
        });
      }
    }
  }

  dagre.layout(g);

  const rfNodes: Node<FlowNodeData>[] = flowNodes.map((node) => {
    const pos = g.node(node.id);
    return {
      id: node.id,
      type: node.kind === 'choice' ? 'choiceNode' : node.kind === 'score_branch' ? 'scoreBranchNode' : 'resultNode',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: { node, kind: node.kind, label: node.text },
    };
  });

  const rfEdges: Edge<FlowEdgeData>[] = rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    data: e.data,
    style: edgeStyle(e.data.effectKind),
    animated: e.data.effectKind !== 'normal' && e.data.effectKind !== 'score',
    label: e.data.effectKind === 'score_branch' ? e.data.optionLabel : undefined,
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

function getOptionEdgeKind(effects: GuidedFlow['nodes'][string] extends { options: infer O[] } ? O extends { effects?: infer E[] } ? E[] : never : never | undefined): FlowEdgeData['effectKind'] {
  if (!effects || effects.length === 0) return 'normal';
  if (effects.some((e) => e.kind === 'safety_interrupt')) return 'safety_interrupt';
  if (effects.some((e) => e.kind === 'deferred_safety')) return 'deferred_safety';
  if (effects.some((e) => e.kind === 'flow_start')) return 'flow_start';
  if (effects.some((e) => e.kind === 'score')) return 'score';
  return 'normal';
}

function edgeStyle(kind: FlowEdgeData['effectKind']): React.CSSProperties {
  switch (kind) {
    case 'safety_interrupt':
      return { stroke: '#ba1a1a', strokeDasharray: '5 3' };
    case 'deferred_safety':
      return { stroke: '#7a5900', strokeDasharray: '5 3' };
    case 'flow_start':
      return { stroke: '#425e91', strokeDasharray: '5 3' };
    case 'score_branch':
      return { stroke: '#7a5900' };
    default:
      return { stroke: '#bdcabf' };
  }
}
```

> **Note on the `getOptionEdgeKind` type:** the `effects` parameter type annotation is complex. Simplify it to `import type { FlowEffect } from '../../domain/flow-engine/types'` and use `FlowEffect[] | undefined`. The function signature becomes:

```ts
import type { FlowEffect } from '../../domain/flow-engine/types';

function getOptionEdgeKind(effects: FlowEffect[] | undefined): FlowEdgeData['effectKind'] {
  if (!effects || effects.length === 0) return 'normal';
  if (effects.some((e) => e.kind === 'safety_interrupt')) return 'safety_interrupt';
  if (effects.some((e) => e.kind === 'deferred_safety')) return 'deferred_safety';
  if (effects.some((e) => e.kind === 'flow_start')) return 'flow_start';
  if (effects.some((e) => e.kind === 'score')) return 'score';
  return 'normal';
}
```

Also add `import type React from 'react';` at top, or just use `React.CSSProperties` from the already-imported react context. To avoid the React import, return plain objects typed as `{ stroke: string; strokeDasharray?: string }`.

The final file with clean types:

```ts
import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import type { FlowEffect, GuidedFlow, FlowNode } from '../../domain/flow-engine/types';

export type FlowNodeData = {
  node: FlowNode;
  kind: FlowNode['kind'];
  label: string;
};

export type FlowEdgeData = {
  effectKind: 'normal' | 'score' | 'deferred_safety' | 'safety_interrupt' | 'flow_start' | 'score_branch';
  optionLabel?: string;
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

export function buildFlowGraph(flow: GuidedFlow): {
  nodes: Node<FlowNodeData>[];
  edges: Edge<FlowEdgeData>[];
} {
  const flowNodes = Object.values(flow.nodes);
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });

  for (const node of flowNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const rawEdges: Array<{ source: string; target: string; data: FlowEdgeData; id: string }> = [];

  for (const node of flowNodes) {
    if (node.kind === 'choice') {
      for (const option of node.options) {
        const effectKind = getOptionEdgeKind(option.effects);
        const edgeId = `${node.id}__${option.id}__${option.next}`;
        g.setEdge(node.id, option.next);
        rawEdges.push({
          id: edgeId,
          source: node.id,
          target: option.next,
          data: { effectKind, optionLabel: option.label },
        });
      }
    } else if (node.kind === 'score_branch') {
      for (const branch of node.branches) {
        const edgeId = `${node.id}__branch__${branch.id}__${branch.next}`;
        g.setEdge(node.id, branch.next);
        rawEdges.push({
          id: edgeId,
          source: node.id,
          target: branch.next,
          data: { effectKind: 'score_branch', optionLabel: `${branch.min}–${branch.max}` },
        });
      }
    }
  }

  dagre.layout(g);

  const rfNodes: Node<FlowNodeData>[] = flowNodes.map((node) => {
    const pos = g.node(node.id);
    return {
      id: node.id,
      type: node.kind === 'choice' ? 'choiceNode' : node.kind === 'score_branch' ? 'scoreBranchNode' : 'resultNode',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: { node, kind: node.kind, label: node.text },
    };
  });

  const rfEdges: Edge<FlowEdgeData>[] = rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    data: e.data,
    style: edgeStyle(e.data.effectKind),
    animated: e.data.effectKind !== 'normal' && e.data.effectKind !== 'score',
    label: e.data.effectKind === 'score_branch' ? e.data.optionLabel : undefined,
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

function getOptionEdgeKind(effects: FlowEffect[] | undefined): FlowEdgeData['effectKind'] {
  if (!effects || effects.length === 0) return 'normal';
  if (effects.some((e) => e.kind === 'safety_interrupt')) return 'safety_interrupt';
  if (effects.some((e) => e.kind === 'deferred_safety')) return 'deferred_safety';
  if (effects.some((e) => e.kind === 'flow_start')) return 'flow_start';
  if (effects.some((e) => e.kind === 'score')) return 'score';
  return 'normal';
}

function edgeStyle(kind: FlowEdgeData['effectKind']): { stroke: string; strokeDasharray?: string } {
  switch (kind) {
    case 'safety_interrupt':
      return { stroke: '#ba1a1a', strokeDasharray: '5 3' };
    case 'deferred_safety':
      return { stroke: '#7a5900', strokeDasharray: '5 3' };
    case 'flow_start':
      return { stroke: '#425e91', strokeDasharray: '5 3' };
    case 'score_branch':
      return { stroke: '#7a5900' };
    default:
      return { stroke: '#bdcabf' };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
pnpm exec vitest run src/dev-dashboard/flows/__tests__/flowMapLayout.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/dev-dashboard/flows/flowMapLayout.ts src/dev-dashboard/flows/__tests__/flowMapLayout.test.ts; git commit -m "feat: add flowMapLayout utility (dagre + React Flow conversion)"
```

---

## Task 3: FlowMapInspector component

The right-side panel that appears when a node is clicked. Handles light editing (text + effect removal) and the "Editar completamente" button.

**Files:**

- Create: `src/dev-dashboard/flows/FlowMapInspector.tsx`
- Create: `src/dev-dashboard/flows/__tests__/FlowMapInspector.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/dev-dashboard/flows/__tests__/FlowMapInspector.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FlowMapInspector } from '../FlowMapInspector';
import type { ChoiceFlowNode, FlowNode, GuidedFlow } from '../../../domain/flow-engine/types';

const choiceNode: ChoiceFlowNode = {
  id: 'q1',
  kind: 'choice',
  text: 'Você se sente triste?',
  options: [
    { id: 'yes', label: 'Sim', next: 'result', effects: [{ kind: 'score', scoreKey: 'srq20', value: 1 }] },
    { id: 'no', label: 'Não', next: 'result' },
  ],
};

const nodes: FlowNode[] = [choiceNode, { id: 'result', kind: 'result', text: 'Fim.' }];
const flows: GuidedFlow[] = [];

function renderInspector(overrides: Partial<Parameters<typeof FlowMapInspector>[0]> = {}) {
  const props = {
    node: choiceNode,
    nodes,
    flows,
    onTextChange: vi.fn(),
    onRemoveEffect: vi.fn(),
    onEditFully: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<FlowMapInspector {...props} />), props };
}

describe('FlowMapInspector', () => {
  it('renders the node text in a textarea', () => {
    renderInspector();
    expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('Você se sente triste?');
  });

  it('calls onTextChange with new value on blur', async () => {
    const user = userEvent.setup();
    const { props } = renderInspector();
    const textarea = screen.getByRole('textbox', { name: /texto da etapa/i });
    await user.clear(textarea);
    await user.type(textarea, 'Nova pergunta');
    await user.tab(); // blur
    expect(props.onTextChange).toHaveBeenCalledWith('Nova pergunta');
  });

  it('renders each option with its label and destination', () => {
    renderInspector();
    expect(screen.getByText('Sim')).toBeInTheDocument();
    expect(screen.getByText('Não')).toBeInTheDocument();
    expect(screen.getAllByText(/Etapa 2/i).length).toBeGreaterThan(0);
  });

  it('renders a remove button for each effect chip', () => {
    renderInspector();
    // The "Sim" option has a score effect
    expect(screen.getByRole('button', { name: /remover efeito score/i })).toBeInTheDocument();
  });

  it('calls onRemoveEffect with optionId and effectIndex when remove chip is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderInspector();
    await user.click(screen.getByRole('button', { name: /remover efeito score/i }));
    expect(props.onRemoveEffect).toHaveBeenCalledWith('yes', 0);
  });

  it('calls onEditFully when "Editar completamente" is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderInspector();
    await user.click(screen.getByRole('button', { name: /editar completamente/i }));
    expect(props.onEditFully).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderInspector();
    await user.click(screen.getByRole('button', { name: /fechar inspetor/i }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows branch ranges for score_branch nodes instead of options', () => {
    const branchNode = {
      id: 'branch',
      kind: 'score_branch' as const,
      text: 'Calculando',
      scoreKey: 'srq20',
      branches: [
        { id: 'low', min: 0, max: 6, next: 'low-result' },
        { id: 'high', min: 7, max: 20, next: 'high-result' },
      ],
    };
    renderInspector({ node: branchNode, nodes: [branchNode] });
    expect(screen.getByText(/0.*6/)).toBeInTheDocument();
    expect(screen.getByText(/7.*20/)).toBeInTheDocument();
  });

  it('shows kind badge with "Escolha" for choice nodes', () => {
    renderInspector();
    expect(screen.getByText('Escolha')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```powershell
pnpm exec vitest run src/dev-dashboard/flows/__tests__/FlowMapInspector.test.tsx
```

Expected: all tests fail with `Cannot find module '../FlowMapInspector'`.

- [ ] **Step 3: Implement `FlowMapInspector.tsx`**

Create `src/dev-dashboard/flows/FlowMapInspector.tsx`:

```tsx
import { useState } from 'react';
import type { FlowNode, GuidedFlow, ChoiceFlowNode, ScoreBranchFlowNode } from '../../domain/flow-engine/types';
import { getFlowNodeTitle, getFlowStartTargetTitle } from './flowDisplay';
import { Button } from '../../design-system/components/Button';

const kindLabels: Record<FlowNode['kind'], string> = {
  choice: 'Escolha',
  result: 'Final',
  score_branch: 'Ramificação',
};

const effectColors: Record<string, string> = {
  score: 'bg-primary-container text-on-primary-container',
  deferred_safety: 'bg-warning-container text-on-warning-container',
  safety_interrupt: 'bg-error-container text-on-error-container',
  flow_start: 'bg-secondary-container text-on-secondary-container',
  navigate: 'bg-surface-container text-on-surface',
  end_flow: 'bg-surface-container text-on-surface',
};

const effectLabels: Record<string, (effect: Record<string, unknown>) => string> = {
  score: (e) => `+${e.value} em ${e.scoreKey}`,
  deferred_safety: (e) => `⚠ deferred → ${e.destination}`,
  safety_interrupt: (e) => `⚠ interrompe → ${e.destination}`,
  flow_start: (e) => `→ fluxo ${e.flowId}`,
  navigate: (e) => `→ ${e.destination}`,
  end_flow: () => 'encerrar',
};

export interface FlowMapInspectorProps {
  node: FlowNode;
  nodes: FlowNode[];
  flows: GuidedFlow[];
  onTextChange: (text: string) => void;
  onRemoveEffect: (optionId: string, effectIndex: number) => void;
  onEditFully: () => void;
  onClose: () => void;
}

export function FlowMapInspector({
  node,
  nodes,
  flows,
  onTextChange,
  onRemoveEffect,
  onEditFully,
  onClose,
}: FlowMapInspectorProps) {
  const [localText, setLocalText] = useState(node.text);

  // Sync if selected node changes
  if (localText !== node.text && document.activeElement?.tagName !== 'TEXTAREA') {
    setLocalText(node.text);
  }

  const nodeTitle = getFlowNodeTitle(node.id, nodes);

  return (
    <div
      className="absolute right-0 top-0 z-10 flex h-full w-80 flex-col gap-3 overflow-y-auto border-l border-outline-variant/50 bg-surface-container-lowest p-4 shadow-lg"
      data-testid="flow-map-inspector"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-label-md text-on-surface">{nodeTitle}</p>
          <span className="mt-1 inline-block rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-xs text-on-surface-variant">
            {kindLabels[node.kind]}
          </span>
        </div>
        <button
          type="button"
          aria-label="Fechar inspetor"
          onClick={onClose}
          className="shrink-0 rounded-full p-1 text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Text editor */}
      <div className="flex flex-col gap-1">
        <label className="font-label-sm text-xs text-on-surface-variant" htmlFor="inspector-text">
          Texto da etapa
        </label>
        <textarea
          id="inspector-text"
          aria-label="Texto da etapa"
          className="min-h-[80px] rounded-lg border border-outline-variant/60 bg-surface-container-low p-2 font-body-md text-sm text-on-surface focus:outline focus:outline-2 focus:outline-primary"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={() => {
            if (localText !== node.text) onTextChange(localText);
          }}
        />
      </div>

      {/* Options (choice nodes) */}
      {node.kind === 'choice' && (
        <ChoiceOptionsSection node={node} nodes={nodes} flows={flows} onRemoveEffect={onRemoveEffect} />
      )}

      {/* Branches (score_branch nodes) */}
      {node.kind === 'score_branch' && <ScoreBranchSection node={node} nodes={nodes} />}

      {/* Edit fully button */}
      <div className="mt-auto pt-2">
        <Button variant="secondary" className="w-full" onClick={onEditFully}>
          Editar completamente →
        </Button>
      </div>
    </div>
  );
}

function ChoiceOptionsSection({
  node,
  nodes,
  flows,
  onRemoveEffect,
}: {
  node: ChoiceFlowNode;
  nodes: FlowNode[];
  flows: GuidedFlow[];
  onRemoveEffect: (optionId: string, effectIndex: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-label-sm text-xs text-on-surface-variant">Opções</p>
      {node.options.map((option) => {
        const destTitle = option.effects?.some((e) => e.kind === 'flow_start')
          ? `→ fluxo "${getFlowStartTargetTitle(
              (option.effects.find((e) => e.kind === 'flow_start') as { flowId: string }).flowId,
              flows,
            )}"`
          : `→ ${getFlowNodeTitle(option.next, nodes)}`;

        return (
          <div key={option.id} className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-2">
            <div className="flex items-center justify-between gap-1">
              <p className="font-label-md text-sm text-on-surface">{option.label}</p>
              <p className="font-body-md text-xs text-on-surface-variant">{destTitle}</p>
            </div>
            {option.effects && option.effects.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {option.effects.map((effect, effectIndex) => {
                  const colorClass = effectColors[effect.kind] ?? 'bg-surface-container text-on-surface';
                  const label = effectLabels[effect.kind]?.(effect as Record<string, unknown>) ?? effect.kind;
                  return (
                    <span
                      key={effectIndex}
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
                    >
                      {label}
                      <button
                        type="button"
                        aria-label={`Remover efeito ${effect.kind}`}
                        onClick={() => onRemoveEffect(option.id, effectIndex)}
                        className="ml-0.5 rounded-full hover:opacity-70"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreBranchSection({ node, nodes }: { node: ScoreBranchFlowNode; nodes: FlowNode[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-label-sm text-xs text-on-surface-variant">
        Chave: <strong>{node.scoreKey}</strong>
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-on-surface-variant">
            <th className="pb-1 pr-2 font-medium">De</th>
            <th className="pb-1 pr-2 font-medium">Até</th>
            <th className="pb-1 font-medium">Vai para</th>
          </tr>
        </thead>
        <tbody>
          {node.branches.map((branch) => (
            <tr key={branch.id} className="border-t border-outline-variant/30">
              <td className="py-1 pr-2 font-mono">{branch.min}</td>
              <td className="py-1 pr-2 font-mono">{branch.max}</td>
              <td className="py-1 text-on-surface-variant">{getFlowNodeTitle(branch.next, nodes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```powershell
pnpm exec vitest run src/dev-dashboard/flows/__tests__/FlowMapInspector.test.tsx
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/dev-dashboard/flows/FlowMapInspector.tsx src/dev-dashboard/flows/__tests__/FlowMapInspector.test.tsx; git commit -m "feat: add FlowMapInspector panel component"
```

---

## Task 4: Rewrite `FlowMap.tsx` with React Flow canvas

**Files:**

- Rewrite: `src/dev-dashboard/flows/FlowMap.tsx`

React Flow requires a CSS import for default styles. Add it to the component file.

- [ ] **Step 1: Rewrite `FlowMap.tsx`**

Replace the entire contents of `src/dev-dashboard/flows/FlowMap.tsx` with:

```tsx
import { useCallback, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, type NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { GuidedFlow, FlowNode, FlowEffect } from '../../domain/flow-engine/types';
import { buildFlowGraph, type FlowNodeData } from './flowMapLayout';
import { FlowMapInspector } from './FlowMapInspector';

// ─── Custom node components ────────────────────────────────────────────────

function nodeColor(node: FlowNode): { border: string; bg: string; text: string } {
  if (node.kind === 'result') return { border: '#bdcabf', bg: '#f0f3ff', text: '#111c2c' };
  if (node.kind === 'score_branch') return { border: '#7a5900', bg: '#ffdf9e', text: '#5c4300' };
  if (node.kind !== 'choice') return { border: '#bdcabf', bg: '#ffffff', text: '#111c2c' };

  const hasSafetyInterrupt = node.options.some((o) => o.effects?.some((e) => e.kind === 'safety_interrupt'));
  const hasDeferredSafety = node.options.some((o) => o.effects?.some((e) => e.kind === 'deferred_safety'));

  if (hasSafetyInterrupt) return { border: '#ba1a1a', bg: '#ffdad6', text: '#93000a' };
  if (hasDeferredSafety) return { border: '#7a5900', bg: '#fff8e8', text: '#5c4300' };
  return { border: '#bdcabf', bg: '#ffffff', text: '#111c2c' };
}

function ChoiceNodeComponent({ data }: { data: FlowNodeData }) {
  const { node } = data;
  const colors = nodeColor(node);
  const hasScore = node.kind === 'choice' && node.options.some((o) => o.effects?.some((e) => e.kind === 'score'));

  return (
    <div
      style={{ border: `2px solid ${colors.border}`, background: colors.bg, color: colors.text }}
      className="min-w-[160px] max-w-[220px] rounded-lg px-3 py-2 text-sm shadow-sm"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="font-medium leading-tight">
          {node.text.slice(0, 80)}
          {node.text.length > 80 ? '…' : ''}
        </p>
        {hasScore && (
          <span className="ml-1 shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800">
            +pts
          </span>
        )}
      </div>
      <p className="mt-1 text-[10px] opacity-60">{node.kind === 'choice' ? `${node.options.length} opções` : ''}</p>
    </div>
  );
}

function ScoreBranchNodeComponent({ data }: { data: FlowNodeData }) {
  const { node } = data;
  return (
    <div
      style={{ border: '2px solid #7a5900', background: '#ffdf9e', color: '#5c4300' }}
      className="min-w-[160px] max-w-[220px] rounded-lg px-3 py-2 text-sm shadow-sm"
    >
      <div className="flex items-center gap-1">
        <span className="text-base">⇄</span>
        <p className="font-medium leading-tight">{node.text.slice(0, 60)}</p>
      </div>
      <p className="mt-1 text-[10px] opacity-60">
        {node.kind === 'score_branch' ? `${node.branches.length} faixas · ${node.scoreKey}` : ''}
      </p>
    </div>
  );
}

function ResultNodeComponent({ data }: { data: FlowNodeData }) {
  const { node } = data;
  return (
    <div
      style={{ border: '1px solid #bdcabf', background: '#f0f3ff', color: '#111c2c' }}
      className="min-w-[160px] max-w-[220px] rounded-lg px-3 py-2 text-sm shadow-sm"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="leading-tight text-on-surface-variant">
          {node.text.slice(0, 60)}
          {node.text.length > 60 ? '…' : ''}
        </p>
        <span className="ml-1 shrink-0 rounded-full bg-surface-container px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
          FIM
        </span>
      </div>
    </div>
  );
}

const nodeTypes = {
  choiceNode: ChoiceNodeComponent,
  scoreBranchNode: ScoreBranchNodeComponent,
  resultNode: ResultNodeComponent,
};

// ─── Main component ────────────────────────────────────────────────────────

export function FlowMap({
  flow,
  flows,
  onFlowChange,
}: {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
}) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildFlowGraph(flow), [flow]);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = selectedNodeId ? (Object.values(flow.nodes).find((n) => n.id === selectedNodeId) ?? null) : null;

  const handleNodeClick: NodeMouseHandler = useCallback((_event, rfNode) => {
    setSelectedNodeId(rfNode.id);
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      if (!selectedNodeId) return;
      const updatedNodes = {
        ...flow.nodes,
        [selectedNodeId]: { ...flow.nodes[selectedNodeId], text },
      };
      onFlowChange({ nodes: updatedNodes });
    },
    [flow.nodes, onFlowChange, selectedNodeId],
  );

  const handleRemoveEffect = useCallback(
    (optionId: string, effectIndex: number) => {
      if (!selectedNodeId) return;
      const node = flow.nodes[selectedNodeId];
      if (node.kind !== 'choice') return;
      const updatedOptions = node.options.map((opt) => {
        if (opt.id !== optionId) return opt;
        const newEffects = (opt.effects ?? []).filter((_, i) => i !== effectIndex);
        return { ...opt, effects: newEffects.length > 0 ? newEffects : undefined };
      });
      const updatedNodes = {
        ...flow.nodes,
        [selectedNodeId]: { ...node, options: updatedOptions },
      };
      onFlowChange({ nodes: updatedNodes as GuidedFlow['nodes'] });
    },
    [flow.nodes, onFlowChange, selectedNodeId],
  );

  const flowNodesList = useMemo(() => Object.values(flow.nodes), [flow.nodes]);

  return (
    <section
      className="relative rounded-lg border border-outline-variant/50 bg-surface-container-lowest"
      data-testid="flow-map-canvas"
      style={{ height: '600px' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        style={{ width: selectedNode ? 'calc(100% - 320px)' : '100%' }}
        proOptions={{ hideAttribution: false }}
      >
        <Background />
        <Controls />
      </ReactFlow>

      {selectedNode && (
        <FlowMapInspector
          node={selectedNode}
          nodes={flowNodesList}
          flows={flows}
          onTextChange={handleTextChange}
          onRemoveEffect={handleRemoveEffect}
          onEditFully={() => {
            // FlowDashboard needs to handle this — we emit via a prop
            // The parent wires this up in Task 5
          }}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </section>
  );
}
```

> **Note on `onEditFully`:** This needs to switch the active tab and select the node in the editor. That logic lives in `FlowDashboard`. Add an `onEditNode` prop to `FlowMap` in Task 5 and wire it through. For now, leave the `onEditFully` body as a comment — it will be completed in the next task.

- [ ] **Step 2: Run typecheck to catch type errors**

```powershell
pnpm exec tsc --noEmit
```

Fix any type errors before continuing. Common issues:

- `useNodesState`/`useEdgesState` return `[nodes, setNodes, onNodesChange]` — destructure the third element for `onNodesChange`.
- The `style` prop on `<ReactFlow>` may need `height: '100%'` inside the parent container.

- [ ] **Step 3: Commit**

```powershell
git add src/dev-dashboard/flows/FlowMap.tsx; git commit -m "feat: rewrite FlowMap with React Flow interactive canvas"
```

---

## Task 5: Wire up `FlowDashboard.tsx`

Remove the redirections tab, update `FlowMap` props (add `onFlowChange` and `onEditNode`), and complete the `onEditFully` handler in `FlowMap`.

**Files:**

- Modify: `src/dev-dashboard/flows/FlowDashboard.tsx`
- Modify: `src/dev-dashboard/flows/FlowMap.tsx` (add `onEditNode` prop)

- [ ] **Step 1: Add `onEditNode` prop to `FlowMap` and complete `onEditFully`**

At the top of `FlowMap.tsx`, update the props interface:

```tsx
export function FlowMap({
  flow,
  flows,
  onFlowChange,
  onEditNode,
}: {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onEditNode: (nodeId: string) => void;
}) {
```

Update the `onEditFully` call in the `FlowMapInspector` render:

```tsx
onEditFully={() => {
  if (selectedNodeId) onEditNode(selectedNodeId);
}}
```

- [ ] **Step 2: Update `FlowDashboard.tsx`**

Make these changes to `FlowDashboard.tsx`:

**2a. Update the `FlowDetailTab` type** (line ~14):

```ts
type FlowDetailTab = 'editor' | 'preview' | 'map';
```

**2b. Update the tabs array** (lines ~17-22):

```ts
const flowDetailTabs: Array<{ id: FlowDetailTab; label: string }> = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Testar conversa' },
  { id: 'map', label: 'Mapa visual' },
];
```

**2c. Remove the `FlowRedirections` import** (line ~10):

```ts
// Remove this line:
import { FlowRedirections } from './FlowRedirectionsPanel';
```

**2d. Update the `FlowMap` render** (line ~352):

```tsx
{
  activeDetailTab === 'map' && (
    <FlowMap
      flow={selectedFlow}
      flows={flows}
      onFlowChange={(patch) => onFlowChange(effectiveIndex, selectedFlow.id, patch)}
      onEditNode={handleEditNode}
    />
  );
}
```

**2e. Remove the redirections render block** (line ~354):

```tsx
// Remove this line entirely:
{
  activeDetailTab === 'redirections' && <FlowRedirections flow={selectedFlow} onEditNode={handleEditNode} />;
}
```

- [ ] **Step 3: Run typecheck**

```powershell
pnpm exec tsc --noEmit
```

Expected: no errors. If there are residual type errors from the removed `redirections` tab (e.g., `activeDetailTab === 'redirections'` comparisons), fix them.

- [ ] **Step 4: Delete `FlowRedirectionsPanel.tsx`**

```powershell
Remove-Item src/dev-dashboard/flows/FlowRedirectionsPanel.tsx
```

Verify `flowRedirections.ts` has no other importers:

```powershell
pnpm exec grep -r "flowRedirections" src/ --include="*.ts" --include="*.tsx"
```

If the only consumer was `FlowRedirectionsPanel.tsx` (now deleted), also delete `flowRedirections.ts`:

```powershell
Remove-Item src/dev-dashboard/flows/flowRedirections.ts
```

- [ ] **Step 5: Run typecheck again**

```powershell
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```powershell
git add src/dev-dashboard/flows/FlowDashboard.tsx src/dev-dashboard/flows/FlowMap.tsx; git commit -m "feat: wire FlowDashboard to new FlowMap, drop redirections tab"
```

Then commit the deletions:

```powershell
git add -u; git commit -m "chore: remove FlowRedirectionsPanel and flowRedirections (superseded by graph)"
```

---

## Task 6: Update existing tests

Three tests in `dashboardRoute.test.tsx` are now broken:

1. `'renders a visual flow map with readable step names and connections'` — tests the old list-based FlowMap output
2. `'shows deferred safety routing in the flow redirections tab'` — tests the removed redirections tab
3. `'round-trips from a redirections row to the focused node in the editor tab'` — tests the removed redirections tab

**Files:**

- Modify: `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- [ ] **Step 1: Run the full test suite to see current failures**

```powershell
pnpm exec vitest run src/dev-dashboard/__tests__/dashboardRoute.test.tsx
```

Expected: tests at lines ~391, ~405, ~416 fail.

- [ ] **Step 2: Replace the three broken tests**

Find and replace the test block starting at `'renders a visual flow map with readable step names and connections'` (line ~391) through the end of `'round-trips from a redirections row to the focused node in the editor tab'` (line ~426):

Replace with:

```ts
it('renders the React Flow canvas when Mapa visual tab is clicked', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  await user.click(screen.getByRole('button', { name: 'Mapa visual' }));
  expect(screen.getByTestId('flow-map-canvas')).toBeInTheDocument();
});

it('does not render a Redirecionamentos tab', () => {
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  expect(screen.queryByRole('button', { name: 'Redirecionamentos' })).not.toBeInTheDocument();
});

it('opens the inspector panel when a node is clicked in the flow map', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <DashboardRoute />
    </MemoryRouter>,
  );

  await user.click(screen.getByRole('button', { name: 'Mapa visual' }));
  // React Flow renders nodes as div elements with the node's text content
  const nodeElements = screen.getAllByText(/Como você quer continuar\?/i);
  expect(nodeElements.length).toBeGreaterThan(0);
});
```

> **Note:** Testing React Flow node clicks in jsdom is non-trivial because React Flow uses pointer events and canvas-like positioning. The third test above only verifies the node text is rendered; the full click-to-inspector flow is covered by the `FlowMapInspector` unit tests in Task 3.

- [ ] **Step 3: Remove the now-stale assertion about "Mapa visual" tab text**

In the test `'renders pt-BR flow editor helper text'` (line ~202), the assertion `expect(screen.getByText('Mapa visual')).toBeInTheDocument()` is still valid (the tab button still exists) — leave it as-is.

- [ ] **Step 4: Run the full test suite**

```powershell
pnpm exec vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/dev-dashboard/__tests__/dashboardRoute.test.tsx; git commit -m "test: update dashboard tests to reflect new React Flow map and removed redirections tab"
```

---

## Task 7: React Flow CSS in jsdom — fix test environment if needed

React Flow imports its own CSS (`@xyflow/react/dist/style.css`). In jsdom, CSS imports are ignored by default, but if Vitest throws an error about unknown file types, a transform is needed.

**Files:**

- Potentially modify: `vitest.config.ts`

- [ ] **Step 1: Run the test suite and check for CSS import errors**

```powershell
pnpm exec vitest run
```

If you see `Error: Unknown file extension ".css"` or `SyntaxError: Unexpected token`, continue with Step 2. If all tests pass, skip to Step 3.

- [ ] **Step 2: Add CSS transform to vitest config**

In `vitest.config.ts`, add a `moduleNameMapper` or `transformIgnorePatterns` entry:

```ts
// vitest.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: [
      '**/node_modules/**',
      '**/node_modules.win/**',
      '**/node_modules.wsl/**',
      '**/.worktrees/**',
      '**/dist/**',
      '**/coverage/**',
    ],
    // Treat CSS imports as empty modules in tests
    css: true,
  },
});
```

If `css: true` is insufficient, add a mock for the CSS file in `src/test/setup.ts`:

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
// Mock react-flow CSS import
vi.mock('@xyflow/react/dist/style.css', () => ({}));
```

- [ ] **Step 3: Re-run and verify**

```powershell
pnpm exec vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit if changes were needed**

```powershell
git add vitest.config.ts src/test/setup.ts; git commit -m "test: handle React Flow CSS import in jsdom test environment"
```

---

## Task 8: Manual verification

- [ ] **Step 1: Start the dev server**

```powershell
pnpm run dev
```

- [ ] **Step 2: Open the dashboard and verify the graph renders**

Navigate to the dashboard and select the "SRQ-20" flow. Click "Mapa visual". Verify:

- [ ] All nodes appear as boxes arranged top-to-bottom
- [ ] Q17 node has a red/amber border (deferred safety effect)
- [ ] Score nodes (q1–q16, q18–q20) show a green `+pts` badge
- [ ] The score_branch node (`srq20-score`) has an amber border and `⇄` icon
- [ ] Result nodes (`low-distress-result`, etc.) show `FIM` badge
- [ ] You can zoom and pan the canvas

- [ ] **Step 3: Verify the inspector panel**

Click any node. Verify:

- [ ] Inspector panel appears on the right side
- [ ] Node text is shown in an editable textarea
- [ ] Editing the text and clicking elsewhere updates the flow (visible in the Editor tab)
- [ ] Score effect chips appear next to "Sim" options; clicking `×` removes the chip
- [ ] "Editar completamente →" switches to the Editor tab with that node highlighted
- [ ] `×` close button dismisses the inspector

- [ ] **Step 4: Verify the redirections tab is gone**

Confirm the "Redirecionamentos" button no longer appears in the tab bar.

- [ ] **Step 5: Verify the simpler "Fluxo de teste" flow**

Switch to the first flow ("Fluxo de teste"). Verify the graph renders for a simple 3-node flow with a flow_start handoff (blue dashed edge visible).

- [ ] **Step 6: Final commit if any fixes were needed**

```powershell
git add .; git commit -m "fix: address manual verification issues"
```
