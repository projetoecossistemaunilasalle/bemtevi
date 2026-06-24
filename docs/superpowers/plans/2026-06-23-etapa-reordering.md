# Etapa Reordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add up/down buttons to reorder Etapas in the flow editor UI.

**Architecture:** Add a `nodeOrder?: string[]` field to `GuidedFlow` for explicit display ordering. `FlowEditor` renders Etapas in that order, with ↑/↓ buttons to swap positions. Backward compatible — flows without `nodeOrder` fall back to `Object.values()` insertion order.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, lucide-react (ArrowUp/ArrowDown icons)

---

## Task 1: Add `nodeOrder` to GuidedFlow type

**Files:**

- Modify: `src/domain/flow-engine/types.ts:102-112`

- [ ] **Step 1: Add the `nodeOrder` field**

In `src/domain/flow-engine/types.ts`, add `nodeOrder?: string[]` to the `GuidedFlow` interface after the `nodes` field:

```typescript
export interface GuidedFlow {
  id: string;
  version: string;
  locale: ContentLocale;
  title: string;
  type: FlowType;
  purpose?: FlowPurpose;
  status: ContentStatus;
  entry: FlowEntry;
  nodes: Record<string, FlowNode>;
  nodeOrder?: string[];
}
```

- [ ] **Step 2: Verify type compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/domain/flow-engine/types.ts
git commit -m "feat: add nodeOrder field to GuidedFlow type"
```

---

## Task 2: Add reorder logic and buttons to FlowEditor

**Files:**

- Modify: `src/dev-dashboard/flows/FlowEditor.tsx`

- [ ] **Step 1: Add ArrowUp/ArrowDown imports**

At the top of `FlowEditor.tsx`, add to the existing imports:

```typescript
import { ArrowUp, ArrowDown } from 'lucide-react';
```

- [ ] **Step 2: Add `getOrderedNodes` helper and `handleMoveNode` function**

Inside the `FlowEditor` component, after the existing `const nodes = Object.values(flow.nodes);` (line 40), add:

```typescript
function getOrderedNodes(): FlowNode[] {
  if (flow.nodeOrder) {
    const nodeMap = flow.nodes;
    const ordered = flow.nodeOrder.filter((id) => nodeMap[id]).map((id) => nodeMap[id]);
    Object.values(nodeMap).forEach((node) => {
      if (!flow.nodeOrder?.includes(node.id)) {
        ordered.push(node);
      }
    });
    return ordered;
  }
  return Object.values(flow.nodes);
}

function handleMoveNode(nodeId: string, direction: 'up' | 'down') {
  const currentOrder = getOrderedNodes().map((n) => n.id);
  const currentIndex = currentOrder.indexOf(nodeId);
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

  const newOrder = [...currentOrder];
  [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]];
  onChange({ nodeOrder: newOrder });
}
```

- [ ] **Step 3: Replace `nodes` usage with ordered nodes**

Replace the line `const nodes = Object.values(flow.nodes);` (line 40) with:

```typescript
const nodes = getOrderedNodes();
```

- [ ] **Step 4: Add reorder buttons to the Etapa card header**

In the `<div className="flex items-center gap-2 shrink-0">` block (line 391), before the `{isSelected && (` block, add the up/down buttons. Note: disabled state uses `nodes` (full ordered list) not `visibleNodes` (filtered), so filtering doesn't break first/last detection:

```typescript
const globalIndex = nodes.findIndex((n) => n.id === node.id);
const isFirst = globalIndex === 0;
const isLast = globalIndex === nodes.length - 1;

// ... inside the <div className="flex items-center gap-2 shrink-0">, before {isSelected && (:
<div className="flex items-center gap-1 shrink-0">
  <button
    type="button"
    disabled={isFirst}
    onClick={(e) => {
      e.stopPropagation();
      handleMoveNode(node.id, 'up');
    }}
    aria-label={`Mover ${stepTitle} para cima`}
    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
  >
    <ArrowUp size={16} />
  </button>
  <button
    type="button"
    disabled={isLast}
    onClick={(e) => {
      e.stopPropagation();
      handleMoveNode(node.id, 'down');
    }}
    aria-label={`Mover ${stepTitle} para baixo`}
    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
  >
    <ArrowDown size={16} />
  </button>
</div>
```

- [ ] **Step 5: Verify type compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Verify app builds**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/dev-dashboard/flows/FlowEditor.tsx
git commit -m "feat: add up/down reorder buttons for Etapas in flow editor"
```
