# Front 05 — Guided Flow / Chatbot Framework

## Goal

Create a generic, JSON-driven guided conversation framework.

The system should feel like a chat, but it is not AI and should not pretend to be AI. All user inputs are constrained to predefined options.

---

## Core Principle

TypeScript owns the engine.

JSON owns the flows.

React owns the rendering.

```txt
Flow JSON
  → schema validation
  → deterministic runtime engine
  → UI adapter
  → chat screen
```

---

## Flow File Model

Each flow should be a standalone JSON-compatible document.

Example:

```json
{
  "id": "work-stress",
  "version": "1.0.0",
  "locale": "pt-BR",
  "title": "Estresse no trabalho",
  "type": "guided_conversation",
  "status": "draft",
  "entry": {
    "node_id": "start",
    "entering_phrases": [
      "Estou sobrecarregado no trabalho",
      "Tenho muito estresse na escola",
      "Não estou dando conta das demandas"
    ],
    "transition_message": "Entendi. Vamos olhar para essa sobrecarga com calma."
  },
  "nodes": {
    "start": {
      "kind": "choice",
      "text": "O que mais tem pesado para você no trabalho?",
      "options": [
        {
          "id": "too-many-tasks",
          "label": "Muitas tarefas ao mesmo tempo",
          "next": "tasks-response"
        }
      ]
    }
  }
}
```

Flows may optionally declare a `purpose` field to distinguish neutral routing flows from regular content flows:

```ts
type FlowPurpose = 'orientation_entry' | 'post_flow_routing';
```

- `orientation_entry` — broad, low-pressure flows that help users choose a more specific path.
- `post_flow_routing` — a calm next-step router offered after regular flow result nodes.
- `undefined` (omitted) — regular content flows (work-stress, rest-recovery, SRQ-20, etc.).

---

## Entering Phrases

Each flow declares its own public entry phrases.

The engine should not infer production entry phrases from internal options.

A development audit script may suggest missing or duplicate phrases, but editorial control should stay explicit.

Autocomplete should merge:

```txt
current node options
+ entering phrases from other flows
+ global support/navigation actions
```

The visible UI should still feel like a conversation, not like a searchable form. In the Orientation screen, current node options appear as floating answer bubbles above the composer. Clicking one of these bubbles immediately sends the answer and advances the flow. The send button becomes active only when the composer text exactly matches one available option/action, so arbitrary text cannot be submitted without adding warning copy. When the input strictly matches an option label, the suggestion list hides automatically — the user has already found their answer. If the input changes (e.g., trailing space), suggestions reappear.

---

## Flow Switching

If the user selects an entering phrase from another flow:

1. Current flow is suspended.
2. Current progress remains in memory.
3. New flow starts from its entry node.
4. Bot emits the target flow transition message.
5. When the new flow ends, the app may gently offer to resume the previous flow, unless a safety rule prevents it.

### Neutral Flow Handoff (flow_start)

If the user selects a curated option with a `flow_start` effect:

1. User message is appended to the transcript.
2. Target flow starts immediately with `createInitialFlowState`.
3. The previous flow is **not** suspended — neutral routing flows are stepping stones, not resumable tasks.
4. The target flow's entry transition and first node appear in the same transcript.

### Navigation Handoff (navigate)

If the user selects an option with a `navigate` effect:

1. User message is appended to the transcript.
2. Active flow is cleared.
3. `pendingNavigation` is set to the destination (`/apoio`, `/contatos`, or `/educacao`).
4. The UI navigates to the route after message reveal.

### Flow End (end_flow)

If the user selects an option with an `end_flow` effect:

1. User message is appended to the transcript.
2. The effect's `message` is appended as a bot message.
3. Active flow and node are cleared — the flow is over.
4. Global actions become the available options.

### Post-Flow Routing

After a regular flow reaches a result node (`purpose === undefined`), `resolveOptions` offers a calm next-step option:

```ts
{
  kind: 'flow_start',
  id: 'post-flow-next-step-start',
  label: 'Escolher o que fazer agora',
  flowId: 'post-flow-next-step'
}
```

This option does not appear inside orientation or post-flow neutral flows themselves, preventing recursive routing loops.

---

## Global Actions

Global actions should always be available in the option system, but not necessarily visually dominant.

Examples:

```txt
Quero apoio agora
Ver contatos
Ver materiais educativos
Encerrar por enquanto
```

The route target for immediate support should be `/apoio`, not `/crise`.

Global actions may be available through the constrained autocomplete, but they should not visually crowd the default answer choices. The default empty-composer view should prioritize the current node's conversational answers.

---

## Orientation Chat UI Contract

The Orientation route should render as a clean chat surface:

- no extra page title or explanatory panel above the chat;
- BemTeVi messages stay on the left, with the chat icon next to the `BemTeVi` sender label;
- user-selected messages stay on the right;
- option bubbles float on the right above the composer;
- clicking an option bubble immediately sends the answer and advances the flow;
- the fixed composer sits above the mobile bottom navigation;
- the send button uses the `Send` icon and is disabled unless the input exactly matches an available option;
- the suggestion list hides when the input strictly matches an option label and reappears when it no longer does;
- the transcript is the only scrollable area on mobile, preventing competing page/chat scroll behavior.

---

## Engine Modules

```txt
src/domain/flow-engine/
  types.ts
  loadFlows.ts
  validateFlow.ts
  resolveOptions.ts
  advanceFlow.ts
  suspendFlow.ts
  resumeFlow.ts
  safetyRules.ts
  parseFlow.ts
```

`validateFlow` performs exhaustive effect-kind checking — unknown effect kinds produce validation errors rather than being silently ignored.

---

## Runtime State

```ts
type FlowRuntimeState = {
  activeFlowId?: string;
  activeNodeId?: string;
  transcript: ChatMessage[];
  suspendedFlows: Record<string, SuspendedFlowState>;
  answers: Record<string, unknown>;
  scores: Record<string, number>;
  safetyFlags: Record<string, boolean>;
  pendingNavigation?: '/apoio' | '/contatos' | '/educacao';
};
```

Privacy decisions may later restrict whether this can be stored beyond memory.

Until Privacy/LGPD verification, treat this as in-memory session state only.

---

## Acceptance Criteria

- A new flow can be added without editing React components.
- Flow switching works through `entering_phrases`.
- Current node options and flow entry options appear together in autocomplete.
- Clicking a suggestion bubble immediately sends the answer and advances the flow.
- The composer send action is disabled unless the input exactly matches an available option/action.
- The suggestion list hides when the input strictly matches an option label and reappears when it no longer does.
- The engine has no React dependency.
- Invalid flow JSON fails validation before runtime.
- Future dashboard can edit the same shape.
- Neutral flows route users to specific flows via `flow_start` effects without suspending the source flow.
- `navigate` effects hand off directly to app destinations.
- `end_flow` effects clear the active flow and emit a sign-off message.
- Post-flow routing offers a calm next-step option after regular result nodes.
- Unknown effect kinds fail validation.
