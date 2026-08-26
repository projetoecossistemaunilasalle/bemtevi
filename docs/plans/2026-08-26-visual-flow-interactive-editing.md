# Interactive Visual Flow Editing Implementation Plan

> **Goal:** Transform the visual destination map from a static layout viewer into a direct, interactive visual editor: add contextual `(+)` creation on options/branches/freeText, support terminal effects vs local node creation semantically, display disconnected nodes in a canvas lane, enable `onConnect` drag-to-connect, and smooth viewport focusing.

---

## Technical Summary & Architecture

### 1. Connection Source & Targets

- **ConnectionSource**:
  ```ts
  export type ConnectionSource =
    | { kind: 'option'; nodeId: string; optionId: string }
    | { kind: 'free_text'; nodeId: string }
    | { kind: 'branch'; nodeId: string; branchId: string };
  ```
- **Local Targets vs Terminal Destinations**:
  - _Local Node Creation_: creates a `FlowNode` (`choice`, `result`, `score_branch`) and sets origin `next` to `newNodeId`.
  - _Internal Area Navigation_: `/apoio`, `/contatos`, `/educacao`. For `option`: sets `effects: [{ kind: 'navigate', destination }]`. For `branch`: sets `navigation: destination`.
  - _Handoff to Another Flow_: sets `effects: [{ kind: 'flow_start', flowId }]` (supported by `option`).
  - _End Flow_: sets `effects: [{ kind: 'end_flow', message }]` (supported by `option`).
  - _Connecting to existing node_: updates `next` on the origin to the target `nodeId`.

### 2. Disconnected Sub-Graphs in the Canvas

- Disconnected / unreachable nodes (`reachable === false`) are rendered in a distinct bottom region of the ReactFlow canvas, retaining their internal connections.
- The global toolbar button is labeled `+ Criar sem conectar`.

### 3. Quick Action Menu on `(+)`

Contextual popover at each option/branch/freeText output:

- **Continuar com:**
  - 💬 Pergunta com opções (`choice`)
  - 🏁 Resultado final (`result`)
  - 🔀 Ramificação por pontuação (`score_branch`)
- **Direcionar ou encerrar:**
  - 🏥 Abrir área do BemTeVi (`/apoio`, `/contatos`, `/educacao`)
  - 🔄 Iniciar outro fluxo (seletor de fluxos)
  - ⏹️ Encerrar conversa

### 4. Interactive `onConnect`

- Dragging from an option/branch handle to a target node handle sets the connection (`next` or destination effect) directly.

---

## Tasks Breakdown

### Task 1: Pure Mutations Layer (`flowMutations.ts`)

- Upgrade `AddNodeInput` with discriminated `connectFrom: ConnectionSource`.
- Add `connectSource(flow, source, targetNodeId)` supporting options, branches, free-text.
- Add `applyTerminalEffect(flow, source, effectOrNavigation)` with strict support guards.
- Add comprehensive unit tests in `flowMutations.test.ts`.

### Task 2: Contextual `(+)` Quick-Creation on Node Cards

- Update `NodeCard` in `FlowDestinationMap.tsx` to render a `(+)` button next to each option, score branch, and free-text output.
- Implement contextual popover with "Continuar com" (local node creation) and "Direcionar ou encerrar" (effects/navigation).
- Rename global add button to `+ Criar sem conectar`.
- Update tests.

### Task 3: Disconnected Sub-Graphs Layout in Canvas

- Update `createPresentation` in `FlowDestinationMap.tsx` to compute layout for unreachable nodes placed in a dedicated lower lane (`y` offset below main DAG), preserving edges between unreachable nodes.
- Remove old external "Fora da entrada" strip since they now live inside the canvas.
- Update tests.

### Task 4: React Flow `onConnect` & Interactive Linking

- Wire `onConnect` callback in `ReactFlow`.
- Parse `sourceHandle` to determine `ConnectionSource` and update target `nodeId`.
- Highlight valid drop targets on drag.
- Update tests.

### Task 5: Compact Sequences & Viewport Focus

- Support `(+)` on linear sequence cards when single exit exists; expand + focus last node when multiple exits exist.
- Smoothly focus new node after creation.
- Run typecheck and full test suite.
