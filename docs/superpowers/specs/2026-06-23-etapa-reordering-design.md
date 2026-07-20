# Etapa Reordering in Flow Editor

## Goal

Allow users to reorder Etapas (flow nodes) in the flow editing UI using up/down buttons, making it easier to organize complex flows. This is purely cosmetic — it does not affect flow runtime behavior or navigation.

## Data Model

Add `nodeOrder?: string[]` to the `GuidedFlow` interface in `src/domain/flow-engine/types.ts`. This array stores the desired display order of node IDs.

- When `nodeOrder` is present, Etapas are rendered in that order.
- When `nodeOrder` is absent (existing flows), fall back to `Object.values(flow.nodes)` insertion order — fully backward compatible.
- New nodes not yet in `nodeOrder` are appended to the end when rendering.

## UI Changes

In `FlowEditor.tsx`, add two small icon buttons (ArrowUp, ArrowDown from `lucide-react`) to each Etapa card header, positioned between the expand toggle and the duplicate/delete buttons.

- First Etapa: ↑ button disabled
- Last Etapa: ↓ button disabled
- Buttons use minimal styling consistent with existing duplicate/delete buttons

## Reordering Logic

In `FlowEditor.tsx`, add a `handleMoveNode(nodeId: string, direction: 'up' | 'down')` function that:

1. Computes the effective `nodeOrder` (from `flow.nodeOrder ?? Object.keys(flow.nodes)`)
2. Swaps the node at the target position
3. Updates `flow.nodeOrder` via the existing `onUpdate` callback
4. The change persists through the existing localStorage draft system

## Files to Modify

1. `src/domain/flow-engine/types.ts` — Add `nodeOrder?: string[]` to `GuidedFlow`
2. `src/dev-dashboard/flows/FlowEditor.tsx` — Add reorder buttons and `handleMoveNode` logic

## Edge Cases

- Flows with a single Etapa: both buttons disabled
- Flows without `nodeOrder` (legacy): fall back to `Object.values()` order
- Adding a new Etapa: it appears at the end (appended to `nodeOrder`)
- Deleting a Etapa: it's removed from `nodeOrder` if present
