# Mapa Visual Interativo — Flow Dashboard (React Flow)

## Background

The flow dashboard currently has two read-heavy, visually dry tabs:

- **"Mapa visual"** — a vertical list of every node showing its text and where each option leads. No indication of which options carry effects (score, safety, flow handoff).
- **"Redirecionamentos"** — a flat audit list of all effect-carrying options across the whole flow. Useful for review, but disconnected from the visual structure of the flow.

Switching between the two tabs gives no spatial intuition of the flow's shape. A developer reviewing the SRQ-20 has to mentally reconstruct the branching logic from text lists.

## What This Change Accomplishes

Replaces both tabs with a single **"Mapa visual"** tab built on [React Flow](https://reactflow.dev/) (`@xyflow/react`). The flow is rendered as an interactive top-to-bottom node graph with:

- **Color-coded nodes** that immediately surface which steps carry effects (safety interrupts, deferred safety flags, score accumulation, score branches, flow handoffs)
- **Color-coded edges** that make branching paths visible at a glance (red for safety, amber for deferred safety, blue for flow handoffs)
- **Click-to-inspect**: clicking any node opens a right-side inspector panel with the node's text (editable inline), its options, and its effects (removable inline)
- **"Editar completamente"** button in the inspector that navigates to the Editor tab with that node pre-selected

## Decisions

| Question                | Decision                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Approach                | Interactive graph (React Flow)                                                            |
| Library                 | `@xyflow/react` + `@dagrejs/dagre` for auto-layout                                        |
| Layout direction        | Top-to-bottom                                                                             |
| Tab structure           | Replace "Mapa visual" + "Redirecionamentos" with one "Mapa visual" tab                    |
| Inspector editing scope | Light: text editing + effect removal only; full editing via "Editar completamente" button |

---

## Proposed Changes

### Dependencies

#### [NEW] `@xyflow/react` and `@dagrejs/dagre`

Added to `package.json` dependencies. React Flow provides the graph canvas, zoom/pan, custom node rendering, and edge routing. Dagre provides the automatic top-to-bottom layout algorithm.

---

### `FlowDashboard.tsx`

#### [MODIFY] Tab array — remove `redirections` tab

```ts
// Before
const flowDetailTabs = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Testar conversa' },
  { id: 'map', label: 'Mapa visual' },
  { id: 'redirections', label: 'Redirecionamentos' },
];

// After
const flowDetailTabs = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Testar conversa' },
  { id: 'map', label: 'Mapa visual' },
];
```

`FlowDetailTab` type updated to `'editor' | 'preview' | 'map'`.

#### [MODIFY] Tab render — remove `FlowRedirections` render branch, update `FlowMap` props

`FlowMap` now also receives `onFlowChange` and `flowIndex` so the inspector can save inline edits.

---

### `FlowMap.tsx`

#### [MODIFY] Full rewrite

The current `FlowMap` renders a plain `<ul>` of articles. It is replaced with a React Flow canvas.

**Responsibilities:**

- Build a dagre-computed layout from the flow's nodes
- Render custom node components per `node.kind`
- Render custom edge components for special effect paths
- Mount the React Flow `<ReactFlow>` canvas with pan/zoom controls, minimap optional
- Manage `selectedNodeId` local state for the inspector
- Render `FlowMapInspector` conditionally when a node is selected

**Layout computation** (`buildFlowGraph` utility function in the same file or a colocated `flowMapLayout.ts`):

1. Iterate `flow.nodes` to create RF node objects with computed `x`/`y` via dagre
2. Iterate `flow.nodes` → options to create RF edge objects, tagged by edge type (normal, safety_interrupt, deferred_safety, flow_start)
3. Return `{ nodes, edges }` ready for `useNodesState`/`useEdgesState`

**Custom node types:**

| RF node type      | Triggers                  |
| ----------------- | ------------------------- |
| `choiceNode`      | `kind === 'choice'`       |
| `scoreBranchNode` | `kind === 'score_branch'` |
| `resultNode`      | `kind === 'result'`       |

**Node visual rules:**

| Condition                        | Node border               | Badge shown                        |
| -------------------------------- | ------------------------- | ---------------------------------- |
| Normal choice                    | `outline-variant`         | none                               |
| Has `score` effect on any option | `outline-variant`         | green `+N pts` per affected option |
| Has `deferred_safety` effect     | amber / `warning`         | `⚠` amber border                   |
| Has `safety_interrupt` effect    | `error` (red)             | `⚠` red border                     |
| `score_branch`                   | `secondary` (yellow)      | `⇄` + branch count                 |
| `result`                         | muted / `outline-variant` | `FIM` pill                         |

**Edge visual rules:**

| Edge kind                 | Style                                          |
| ------------------------- | ---------------------------------------------- |
| Normal `next`             | solid, `outline-variant` color, standard arrow |
| `safety_interrupt` branch | dashed, `error` color                          |
| `deferred_safety` path    | dashed, amber/`warning` color                  |
| `flow_start` handoff      | dashed, `primary` blue                         |

---

### `FlowMapInspector.tsx`

#### [NEW]

A right-side panel component rendered inside `FlowMap` when a node is selected.

**Props:**

```ts
interface FlowMapInspectorProps {
  node: FlowNode;
  nodes: FlowNode[]; // for resolving node titles
  flows: GuidedFlow[]; // for resolving flow_start targets
  onTextChange: (text: string) => void; // saves on blur
  onRemoveEffect: (optionId: string, effectIndex: number) => void;
  onEditFully: () => void; // triggers parent to switch to editor tab
  onClose: () => void;
}
```

**Layout:** Fixed ~320px right panel inside the map container (`absolute right-0 top-0 h-full`). The React Flow canvas has `padding-right: 320px` when the inspector is open.

**Content:**

1. Close button (`×`) top-right
2. Node title (resolved human label) + kind badge
3. `<textarea>` with node text — `onBlur` calls `onTextChange`
4. For `choice` nodes: options list
   - Each option: label, `→ {destination}`, effect chips
   - Each effect chip: colored, with `×` button calling `onRemoveEffect`
5. "Editar completamente →" button (full-width, secondary variant) at bottom

---

### `FlowRedirectionsPanel.tsx`

#### [DELETE]

No longer needed. The redirections tab is removed. The file can be deleted once `FlowDashboard.tsx` no longer imports it.

---

### `flowDisplay.ts`

No changes needed. `getFlowNodeTitle` and `getFlowStartTargetTitle` are reused in `FlowMapInspector`.

### `flowRedirections.ts`

No longer needed by the UI, but can be kept as a utility (it has no side effects). Mark for deletion only after confirming no other consumers exist.

---

## Verification Plan

### Automated Tests

- Update `dashboardRoute.test.tsx`: remove assertions about the "Redirecionamentos" tab button existing; add assertions that clicking "Mapa visual" renders the React Flow canvas container (`data-testid="flow-map-canvas"`)
- Add tests for `FlowMapInspector`: clicking "Editar completamente" calls `onEditFully`; editing text and blurring calls `onTextChange`; clicking `×` on an effect chip calls `onRemoveEffect`
- Add test for layout computation: given a known flow with N nodes and M edges, `buildFlowGraph` returns N RF nodes and M RF edges

### Manual Verification

- Open the dashboard on the SRQ-20 flow (which has score effects, deferred safety, and a score_branch node) and confirm:
  - All nodes appear with correct colors
  - Clicking a node opens the inspector with correct text
  - Editing text and blurring updates the flow (editor tab shows the new text)
  - Clicking `×` on a score effect chip removes it and the node loses its green badge
  - "Editar completamente" switches to the Editor tab with that node selected
  - Zoom, pan, and the "fit view" control work
- Confirm the "Redirecionamentos" tab no longer appears in the tab bar
- Confirm a flow with no special effects renders a plain graph with no colored borders
