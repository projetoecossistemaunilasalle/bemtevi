# Task 3: Collapsible Stage Cards in Detail Panel & Scroll-Anchoring Plan

## Steps to Execute

1. **Step 1: Write the failing test**
   - Add the specified test to `src/dev-dashboard/__tests__/dashboardRoute.test.tsx` at the end of the file (before the last `});`).

2. **Step 2: Run test to verify it fails**
   - Execute `pnpm run test dashboardRoute` and check the error.

3. **Step 3: Modify FlowEditor.tsx layout structure**
   - Add `useEffect` from React.
   - Add state: `confirmDeleteNodeId` (`string | null`) and `initialConfigCollapsed` (`boolean`, default `true`).
   - Wrap the initial flow settings ("Dados do fluxo" and "Configuração de entrada") inside a single collapsible section using `initialConfigCollapsed`.
   - Update node looping to render ALL `visibleNodes` as collapsible cards using `flow-node-${node.id}` as element IDs.
   - Format card header correctly: `Etapa ${index + 1} — ${node.text ? getNodePreview(node.text) : node.id}` without printing node ID or preview separately.
   - Wire clicking the header to trigger `onSelectNodeId(node.id)`.
   - In the header, render options to delete or duplicate. Implement `confirmDeleteNodeId` check to show "Confirmar exclusão da etapa ⚠".
   - Stop event propagation on delete/duplicate buttons so they don't trigger node selection.
   - Implement `deleteNode(nodeId)` by removing the node from `flow.nodes` and calling `onChange({ nodes: nextNodes })`, changing the active node, and resetting `confirmDeleteNodeId`.
   - Add scroll-into-view behavior using `useEffect` observing `selectedNodeId`.
   - Swap the positioning inside the card body: render text area above the type selector.

4. **Step 4: Run test to verify it passes**
   - Run `pnpm run test dashboardRoute` and ensure all tests are green.

5. **Step 5: Commit**
   - Stage modified files and commit with the specified message.
