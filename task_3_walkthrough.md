# Task 3: Collapsible Stage Cards in Detail Panel & Scroll-Anchoring Walkthrough

## Summary of Changes

### 1. Collapsible Initial Flow Settings in `src/dev-dashboard/flows/FlowEditor.tsx`

- Introduced a React state `initialConfigCollapsed` (defaults to `true`).
- Wrapped the flow title input, usage dropdown, entering phrases textareas, transition message, and first step selector into a single collapsible `<section>` with toggle headers.

### 2. Collapsible Stage Cards in `src/dev-dashboard/flows/FlowEditor.tsx`

- Modified the stage rendering logic to render all `visibleNodes` as collapsible cards in the detail panel.
- Kept only the active/selected card expanded (`isSelected = node.id === selectedNodeId`).
- Computed stage titles using global indices (`nodes.findIndex`) so stage titles remain consistent and stable (e.g. `Etapa 19 — Tem tido ideia de acabar com a vida?`) regardless of active node filtering.
- Rendered Duplicate and Delete buttons in the card header only when expanded. Added event propagation prevention (`e.stopPropagation()`) so clicking them does not toggle stage collapse.
- Handled node deletion with confirmation state (`confirmDeleteNodeId` state).
- Swapped DOM ordering inside the card body: rendered "Texto da etapa" label/textarea **above** the "Tipo da etapa" select.

### 3. Scroll-Anchoring in `src/dev-dashboard/flows/FlowEditor.tsx`

- Added a `useEffect` watching changes to `selectedNodeId`.
- Anchors view to the active stage card smoothly using `element.scrollIntoView`.
- Implemented defensive checking (`typeof element.scrollIntoView === 'function'`) to ensure compatibility with JSDOM / headless testing environments where `scrollIntoView` is undefined.

### 4. Test Implementation in `src/dev-dashboard/__tests__/dashboardRoute.test.tsx`

- Added the specified integration test verifying:
  - Collapsible card rendering and expansion on selection.
  - Correct swap in DOM ordering of step textarea and type selector.
  - Collapsed stages hidden initially.
  - stage deletion with double-confirmation prompt.
  - deletion updates indexes and active selected node.
- Updated previous test cases to expand the flow config panel when verifying those fields.
- Updated node-text assertions in existing tests to match the new text-based header titles and exact global indices (such as `Etapa 27 — Tem falta de apetite`).

## Verification Results

All 229 Vitest tests in the workspace pass:

```bash
 RUN  v4.1.6 C:/Users/Vitor/Desktop/Vinicius/Projetos/SeCuida-Prototipo

 Test Files  20 passed (20)
      Tests  229 passed (229)
   Start at  19:31:30
   Duration  13.73s (transform 2.97s, setup 5.98s, import 16.00s, tests 14.29s, environment 54.82s)
```
