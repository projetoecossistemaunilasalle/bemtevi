# Map-First Flow Editing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the destination map the primary editing surface for guided flows: a structured side panel edits any selected element, the canvas always mirrors live structure, and the legacy form editor becomes a fallback.

**Architecture:** Pure mutation functions (`flowMutations.ts`) produce new `GuidedFlow` values; the existing pure topology engine (`flowTopology.ts`) recomputes and re-renders the map. A `NodeEditorPanel` (evolution of `FlowMapInspector`) and a `FlowSettingsPanel` are the only editors. Validation deep-links retarget from legacy-editor aria-labels to `{flowId, nodeId, section}`.

**Tech Stack:** React 19 + TypeScript, `@xyflow/react`, Vitest + Testing Library, pnpm. UI strings pt-BR; code comments English (match repo style).

**Design doc:** `docs/plans/2026-08-25-map-first-flow-editing-design.md`

---

## Ground rules for every task

- Run targeted tests with `pnpm vitest run <path>`; expect FAIL before implementing, PASS after.
- After each task also run `pnpm typecheck` — it must stay at **0 errors**.
- Commit after every task with the given message.
- **Invariant you must never break:** in a `GuidedFlow`, every node object's `id` equals its key in the `flow.nodes` record (`validateFlow` rejects mismatches: "A chave do nó … deve ser igual ao ID do nó …"). Every mutation copies the flow deeply along changed paths; never mutate inputs.
- Allowed navigation destinations for `navigate` / `safety_interrupt.destination` / `deferred_safety.destination` / branch `navigation`: exactly `/apoio`, `/contatos`, `/educacao`.
- Effect shapes (from `src/domain/flow-engine/types.ts`):
  - `{kind:'score', scoreKey:string, value:number}`
  - `{kind:'safety_interrupt', message:string, destination:string, blockResume:boolean}`
  - `{kind:'deferred_safety', flagKey:string, message:string, destination:string}`
  - `{kind:'navigate', destination:string}`
  - `{kind:'flow_start', flowId:string}`
  - `{kind:'end_flow', message:string}`
- Fixture helpers worth copying come from `src/dev-dashboard/flows/__tests__/flowTopology.test.ts` (`flow()`, `choice()`, `result()`).

---

### Task 1: `flowMutations.addNode`

**Files:**

- Create: `src/dev-dashboard/flows/flowMutations.ts`
- Test: `src/dev-dashboard/flows/__tests__/flowMutations.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { addNode } from '../flowMutations';

function baseFlow(nodes: GuidedFlow['nodes']): GuidedFlow {
  return {
    id: 'f',
    version: '1.0',
    locale: 'pt-BR',
    title: 'F',
    type: 'guided_conversation',
    status: 'draft',
    entry: { nodeId: Object.keys(nodes)[0], enteringPhrases: ['oi'], transitionMessage: '' },
    nodes,
  };
}

describe('addNode', () => {
  it('appends a unique step-N node and links an origin option when requested', () => {
    const flow = baseFlow({
      q1: { id: 'q1', kind: 'choice', text: 'Q1', options: [{ id: 'yes', label: 'Sim', next: 'done' }] },
      done: { id: 'done', kind: 'result', text: 'Fim' },
    });
    const { flow: linked, nodeId } = addNode(flow, { kind: 'result', connectFrom: { nodeId: 'q1', optionId: 'yes' } });
    expect(nodeId).toBe('step-3');
    expect(linked.nodes['step-3'].kind).toBe('result');
    expect(linked.nodes.q1.options[0].next).toBe('step-3');
    expect(flow.nodes['step-3']).toBeUndefined(); // input untouched

    const { flow: plain } = addNode(flow, { kind: 'choice' });
    expect(plain.nodes['step-3']).toBeDefined();
    expect(Object.keys(plain.nodes)).toHaveLength(3);
  });

  it('keeps nodeOrder in sync when the flow already has one', () => {
    const flow = { ...baseFlow({ q1: { id: 'q1', kind: 'choice', text: 'Q', options: [] } }), nodeOrder: ['q1'] };
    const { flow: next } = addNode(flow, { kind: 'result' });
    expect(next.nodeOrder).toEqual(['q1', 'step-2']);
  });

  it('never collides with existing ids', () => {
    const flow = baseFlow({
      'step-2': { id: 'step-2', kind: 'choice', text: 'X', options: [] },
      q9: { id: 'q9', kind: 'choice', text: 'Q', options: [] },
    });
    const { nodeId } = addNode(flow, { kind: 'result' });
    expect(nodeId).toMatch(/^step-/);
    expect(flow.nodes[nodeId]).toBeUndefined();
  });
});
```

**Step 2:** `pnpm vitest run src/dev-dashboard/flows/__tests__/flowMutations.test.ts` → FAIL (module missing).

**Step 3: Implement**

```ts
import type { FlowEffect, FlowNode, GuidedFlow } from '../../domain/flow-engine/types';

export interface AddNodeInput {
  kind: FlowNode['kind'];
  /** When provided, the option is repointed to the created node. */
  connectFrom?: { nodeId: string; optionId?: string };
}

/** Returns a new flow plus the generated node id. Pure: never mutates inputs. */
export function addNode(flow: GuidedFlow, input: AddNodeInput): { flow: GuidedFlow; nodeId: string } {
  const nodeId = uniqueNodeId(flow);
  const node = createNode(nodeId, input.kind, flow);
  const nodes = { ...flow.nodes, [nodeId]: node };
  let next: GuidedFlow = { ...flow, nodes };
  if (flow.nodeOrder) next = { ...next, nodeOrder: [...flow.nodeOrder, nodeId] };
  if (input.connectFrom) next = linkOption(next, input.connectFrom.nodeId, input.connectFrom.optionId, nodeId);
  return { flow: next, nodeId };
}

function uniqueNodeId(flow: GuidedFlow): string {
  let index = Object.keys(flow.nodes).length + 1;
  while (flow.nodes[`step-${index}`]) index += 1;
  return `step-${index}`;
}
```

Plus private `createNode(id, kind, flow)` producing sensible defaults:

- `choice`: `{id, kind:'choice', text:'', options:[]}`
- `result`: `{id, kind:'result', text:''}`
- `score_branch`: `{id, kind:'score_branch', text:'', scoreKey:'pontuacao', branches:[{id:`${id}-faixa-1`, min:0, max:10, next:''}]}`

And `linkOption(flow, nodeId, optionId | undefined, target)` that returns flow with that option's `next` set (when `optionId` omitted, link the **first** option).

**Step 4:** rerun test → PASS; `pnpm typecheck` → 0 errors.
**Step 5:** `git add src/dev-dashboard/flows/flowMutations.ts src/dev-dashboard/flows/__tests__/flowMutations.test.ts && git commit -m "feat(flows): pure addNode mutation"`

---

### Task 2: `duplicateNode` and `deleteNode`

Same files as Task 1.

**Tests to add (write first):**

- `duplicateNode(flow, 'q1')` → new id `q1-copy-N`; deep-copies text/options/effects with fresh **option ids** suffixed `-copy-N`; incoming edges are not duplicated (nothing else points to it); `nodeOrder` gains the copy right after the original when present.
- `deleteNode(flow, 'done')` → returns `{ flow, broken: [] }`, node removed from record **and** from `nodeOrder`.
- `deleteNode` where two options point at the target → `broken` lists `{sourceNodeId, optionId}` for each, those options keep `next` unchanged?? NO — they keep pointing to a now-missing id (that is the honest behavior the map renders as `Destino ausente`). Assert exactly that.

**Implementation notes:**

```ts
export function duplicateNode(flow: GuidedFlow, nodeId: string): { flow: GuidedFlow; newNodeId: string };
export function deleteNode(
  flow: GuidedFlow,
  nodeId: string,
): { flow: GuidedFlow; broken: Array<{ sourceNodeId: string; optionId?: string }> };
```

- Refuse to delete the last remaining node (return `{flow, broken:[], error:'last-node'}`) and refuse deleting while it is the entry **only if** it is the sole node; otherwise entry stays (validation will flag) — keep behavior explicit and simple; document via test.
- Option-id regeneration: `${option.id}-copy-N`, deduplicated the same way as node ids.

Commit: `feat(flows): duplicate and delete node mutations`

---

### Task 3: `setEntryNode`, `updateFlowSettings`, `switchNodeKind`

Same files. Write failing tests first:

- `setEntryNode(flow,'q2')` → `entry.nodeId==='q2'`, everything else identical.
- `updateFlowSettings(flow,{title, purpose, status, enteringPhrases})` → only provided keys change; `enteringPhrases` replaces the whole array (panel sends the final list).
- `switchNodeKind(flow,'q1','result')` → node becomes `{id,kind:'result',text:<same text>}`; options dropped. `switchNodeKind(flow,'r1','choice')` → gets one default option `{id:'r1-option-1', label:'', next:''}`. `switchNodeKind(...,'score_branch')` → default `scoreKey:'pontuacao'` + one branch `{min:0,max:10,next:''}`. Entry node kind switching away from `choice` is allowed but flagged by validation later — no special casing here.

Commit: `feat(flows): entry, settings and kind-switch mutations`

---

### Task 4: `NodeEditorPanel` shell — identity, text, actions footer

**Files:**

- Create: `src/dev-dashboard/flows/NodeEditorPanel.tsx`
- Test: `src/dev-dashboard/flows/__tests__/NodeEditorPanel.test.tsx`

Panel props:

```ts
export interface NodeEditorPanelProps {
  flow: GuidedFlow;
  flows: GuidedFlow[];
  nodeId: string;
  onFlowChange: (patch: Partial<GuidedFlow>) => void;
  onClose: () => void;
  onEditLegacy: () => void;
  /** Scroll the panel to a section, e.g. from validation deep-links. */
  focusSection?: string;
}
```

Render (Tailwind classes copied from current `FlowMapInspector.tsx` so visual style matches the dashboard):

- Header: kind badge (Escolha/Final/Ramificação), step number computed as index in `Object.values(flow.nodes)` order used by `stableNodes`, close button `aria-label="Fechar painel de edição"`.
- Section **Texto**: `<textarea aria-label="Texto da etapa">` local-state + commit onBlur → `onFlowChange({nodes:{...}})` (copy pattern from `FlowMapInspector` lines 49–53, 93–107 — including the `document.activeElement` guard).
- Footer buttons calling the pure mutations then `onFlowChange(resultingFlow)`:
  - `Definir como entrada` (disabled when already entry) → `setEntryNode`
  - `Duplicar etapa` → `duplicateNode`
  - `Excluir etapa` → opens `window.confirm` showing breakage count from `deleteNode`'s report before applying
  - `Abrir no editor legado` → `onEditLegacy()`
- `data-testid="node-editor-panel"`.

**Test cases (Testing Library):** renders badge+text; typing text commits on blur; duplicate adds a node and closes nothing; delete with inbound option shows confirm containing "1 conexão" and removes node on accept (mock `window.confirm`); entry button disabled on entry node.

Commit: `feat(dashboard): NodeEditorPanel shell with identity, text and node actions`

---

### Task 5: Options section with target picker

Extend `NodeEditorPanel` for `kind==='choice'`.

Per option render:

- `<input aria-label="Rótulo da opção N">` → updates `option.label`.
- Target `<select aria-label="Destino da opção N">`: one `<option value="">— sem destino —</option>`, then all nodes grouped: reachable-by-depth labels `Etapa N · <excerpt 40>` (compute cheaply: reuse `buildFlowTopology(flow, flows)` once via `useMemo`; it exposes `nodes[].stepNumber`, `depth`, `node.text`) plus current value if missing (label `Destino ausente · id`). Changing fires a patch setting `option.next`.
- Buttons: `Remover opção` (filters array), `Adicionar opção` (append `{id: uniqueOptionId(node), label:'', next:''}`; uniqueness: `${prefix}-${n}` loop like Task 1).
- Free-text block: checkbox `Aceitar resposta livre` toggling `freeText`; when on, same style target select `aria-label="Destino da resposta livre"`.

**Tests:** change label → payload contains new label; change destination via select → `option.next` updated; add/remove option counts; free-text toggle adds/removes `freeText` keeping last target.

Commit: `feat(dashboard): option rows with target picker and free text`

---

### Task 6: Typed effects builder

Still `choice` options. Under each option, chips row (visual language copied from inspector `effectColors`/`effectLabels` maps):

- Existing effects render as removable chips (× button `aria-label="Remover efeito <kind>"` — reuse existing inspector test expectations).
- `Adicionar efeito` menu (native `<select>` is enough; custom menus are out of scope) listing kinds not yet present except `score` (multiple allowed) — on select, appends the typed default: score `{scoreKey:'pontuacao',value:1}`, safety `{message:'',destination:'/apoio',blockResume:false}`, deferred `{flagKey:'',message:'',destination:'/apoio'}`, navigate `{destination:'/apoio'}`, flow_start `{flowId: flows[0]?.id ?? ''}`, end_flow `{message:''}`.
- Expanded fields per effect with labeled inputs (`aria-label`s: `Chave de pontuação`, `Valor da pontuação`, `Mensagem da interrupção`, `Destino`, `Impede retorno` checkbox, `Chave da sinalização`, `Fluxo de destino` — a `<select>` over `flows.map(f=>f.id)` titles, etc.).

**Tests:** add each kind → default effect appended; edit score value → payload number (not string!); remove works; flow_start select lists real flows.

Commit: `feat(dashboard): typed effect builder in option rows`

---

### Task 7: Score-branch section + media

- `kind==='score_branch'`: `aria-label="Pontuação usada"` bound to `scoreKey`; branch rows `De/Até` numeric inputs + target select (same component as Task 5 — extract `TargetSelect` shared function in the same file); `Adicionar faixa` appends `{id:unique,min:0,max:0,next:''}`; remove branch button.
- Media: if node has `videos`, list title/url inputs (`aria-label="Título do vídeo N"`, `"URL do vídeo N"`), add/remove video (`{id:unique,title:'',url:''}`); `result` nodes show recommendations textarea (one per line → `string[]` split/join on `\n`).
- URL field gets light client-side hint only (non-empty and contains `youtube.com` or `youtu.be`) shown as muted text — authoritative errors remain in the validation summary (single source of truth).

**Tests:** scoreKey edits; branch add/edit/remove; video round-trip; recommendations multiline split.

Commit: `feat(dashboard): score branch ranges, videos and recommendations editing`

---

### Task 8: Wire the panel into the map; retire `FlowMapInspector`

**Files:**

- Modify: `src/dev-dashboard/flows/FlowDestinationMap.tsx`
- Delete: `src/dev-dashboard/flows/FlowMapInspector.tsx`, `src/dev-dashboard/flows/__tests__/FlowMapInspector.test.tsx`
- Modify: `src/dev-dashboard/flows/__tests__/FlowDestinationMap.test.tsx`

Steps:

1. Replace the `<FlowMapInspector …>` block with `<NodeEditorPanel flow flows nodeId={selectedNodeId} onFlowChange onClose onEditLegacy={() => onEditNode(flow.id, selectedNodeId)} />`. Keep `handleTextChange`/`handleRemoveEffect` removals (the panel patches whole nodes itself now — delete those callbacks).
2. Toolbar: add `+ Etapa` button opening a tiny inline popover with three buttons (Pergunta/Final/Ramificação) → `addNode(flow,{kind})` then select the new node so the panel opens on it. Position via existing toolbar flex layout; `aria-haspopup="true"`.
3. Update `FlowDestinationMap.test.tsx`: inspector assertions now target `node-editor-panel`; add: clicking `+ Etapa` → Pergunta adds node and opens panel; delete flow through panel removes node from stats count.
4. Delete old inspector files; ensure no imports remain (`grep -r FlowMapInspector src`).

Run full folder suite + typecheck. Commit: `feat(dashboard): map owns node editing; legacy inspector retired`

---

### Task 9: `FlowSettingsPanel` from header

**Files:**

- Create: `src/dev-dashboard/flows/FlowSettingsPanel.tsx` (+ test file)

Props `{flow, onFlowChange, onClose}`. Fields: `Título do fluxo` text; `Uso do fluxo` select over allowed purposes — read them from `validateFlow`'s `allowedFlowPurposes` export if exported, otherwise literal `['checkin','apoio','educacao']` matching `src/content` usage (verify in Step 1 by grepping `purpose` under `src/content/flows`); `Status` select (draft/pending_review/approved/archived with current PT labels from `STATUS_LABELS` in `FlowOverviewMap.tsx`); `Etapa de entrada` target-select reusing Task 5 component; `Frases de entrada` list editor (one input per phrase `aria-label="Frase de entrada N"`, add/remove, blank phrases stripped onBlur).
Positioning: absolute overlay top-right mirroring panel styles; `data-testid="flow-settings-panel"`; open via ⚙️ button `aria-label="Configurações do fluxo"` added next to the mode toggle in `FlowMap.tsx` (state lives in `FlowMap`, panel rendered above `FlowDestinationMap`).

**Tests:** each field round-trips a payload; phrase add/remove; entry select applies.

Commit: `feat(dashboard): flow settings panel in the map header`

---

### Task 10: Validation deep-links retarget

**Files:**

- Modify: `src/dev-dashboard/flows/FlowDashboard.tsx`, `src/dev-dashboard/flows/FlowMap.tsx`, `src/dev-dashboard/flows/FlowDestinationMap.tsx`, `ValidationSummary.tsx` only if props change
- Test: extend `FlowDestinationMap.test.tsx` + a small unit addition where `resolveFlowValidationTarget` lives (it's private in `FlowDashboard.tsx` — export it for tests as named export)

Steps:

1. Change `FlowValidationTarget` to carry `section?: 'texto'|'opcoes'|'ramificacao'|'midia'|'configuracoes'|'entrada'` derived from the same path-prefix mapping that exists today (`options→opcoes`, `branches→ramificacao`, `videos→midia`, `entry→configuracoes`, default `texto`).
2. Plumb `focusRequest: {nodeId?:string; section?:string; requestId:number} | null` down `FlowMap → FlowDestinationMap`. In the map: on change, set `selectedNodeId` (or open settings panel when absent) and pass `focusSection` to the panel; panel scrolls the section into view and focuses its first input (`useEffect` on `requestId`).
3. Keep the editor fallback behavior intact: `onEditNode` still switches tabs for people who choose the legacy route from the panel.
4. Tests: rendering `FlowDestinationMap` with `focusRequest={…}` selects the node and moves focus to the section heading (assert `document.activeElement`).

Commit: `feat(dashboard): validation issues land on the map panel section`

---

### Task 11: Parity sweep, gates, docs

1. Grep the legacy `FlowEditor.tsx` for every `aria-label` / field it manages and tick them against the new surfaces; add anything missed to Tasks 4–9 scope (expected gaps: none beyond covered ones — if found, implement + test here).
2. Full gates: `pnpm typecheck && pnpm lint && pnpm vitest run` — all green, 0 errors.
3. Update `docs/superpowers/specs/2026-08-25-flow-destination-map-design.md` status paragraph: edição agora vive no mapa conforme `docs/plans/2026-08-25-map-first-flow-editing-design.md` (fallback mantido).
4. Commit: `docs: note map-first editing phase 1 parity`

---

## Out of scope (do not build)

Option-port click-through focusing, mobile bottom-sheet polish, keyboard-audit pass, legacy-editor removal — these are Phase 2/3 per the design doc. Do not add new content fields, saved layouts, AI features, or analytics-driven styling.
