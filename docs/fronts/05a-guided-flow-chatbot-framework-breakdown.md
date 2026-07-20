# Front 05A — Guided Flow / Chatbot Framework Breakdown

## Purpose

This document breaks down the fifth implementation task for BemTeVi.

It is derived from the current repository state and from:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/README.md`
- `docs/fronts/05-guided-flow-chatbot-framework.md`
- `docs/fronts/04a-content-data-modeling-breakdown.md`

The goal is to replace the current hardcoded orientation prototype with a deterministic, JSON-compatible guided-flow framework. The experience may look like chat, but it must not pretend to be AI or accept unconstrained free text.

---

## Current State

The current orientation experience lives in one React screen with local step state, hardcoded questions, a slider, and a static result card.

After Front 04A, some visible content may already live under `src/content/*`, but there is still no generic flow schema, validator, runtime engine, flow registry, or constrained chat UI adapter.

---

## Target Shape

```txt
Flow content
  → schema/type validation
  → deterministic engine
  → UI adapter
  → Orientation screen
```

TypeScript owns the engine. Content files own the flows. React owns rendering only.

---

## Flow Content Model

Create the first generic flow content under:

```txt
src/content/flows/
  registry.ts
  work-stress.ts
  rest-recovery.ts
```

The first non-questionnaire flows should cover common teacher-oriented concerns such as work overload, emotional exhaustion, and rest recovery. Each flow should be small enough to validate the engine without becoming a clinical intake.

Each flow should include stable metadata, entry node, explicit `entering_phrases`, transition message, nodes, options, optional recommendations, and optional safety rules.

---

## Engine Modules

Create React-free domain modules:

```txt
src/domain/flow-engine/
  types.ts
  flowSchema.ts
  validateFlow.ts
  loadFlows.ts
  resolveOptions.ts
  advanceFlow.ts
  suspendFlow.ts
  resumeFlow.ts
  safetyRules.ts
```

Do not add questionnaire scoring in this front. `scoreFlow.ts` belongs to Front 06A unless a minimal placeholder is needed only for type compatibility.

---

## Runtime Rules

Runtime state is in memory only: active flow/node IDs, transcript messages, current answers, suspended flows, and safety flags.

Do not use `localStorage`, `sessionStorage`, indexed DB, cookies, backend sync, or analytics for flow state.

---

## Constrained Input

The UI should combine:

```txt
current node options
+ entering phrases from other flows
+ global actions
```

Typing may filter available choices, but submission must be limited to an existing option/action. No free-text user message should be treated as understood by the app.

The Orientation UI should preserve the feel of a soothing chat:

- answer options float as bubbles above the input;
- clicking a bubble immediately sends the answer and advances the flow;
- the send button is disabled until the input exactly matches one available option/action;
- the suggestion list hides when the input strictly matches an option label and reappears when it no longer does;
- current node answers appear by default, while global actions and entering phrases can appear when the user types a matching phrase;
- the composer is fixed above the bottom navigation on mobile;
- the chat transcript is the only scrollable region in the responsive layout.

Global actions should include at least `Quero apoio agora` → `/apoio`, `Ver contatos` → `/contatos`, `Ver materiais educativos` → `/educacao`, and `Encerrar por enquanto`.

---

## Implementation Slices

### PR 05A — Define Flow Types, Schema, And Registry

Scope:

1. define flow types in `src/domain/flow-engine/types.ts`;
2. add a lightweight schema/validator module;
3. create or finalize `src/content/flows/registry.ts`;
4. add at least two small non-questionnaire flows to validate real switching;
5. add validation tests for valid and invalid flow shapes.

Acceptance criteria:

- flow content is JSON-compatible;
- the registry contains switchable flows, not only test fixtures;
- invalid `next` references fail validation;
- entering phrases are explicit;
- domain modules do not import React;
- no questionnaire scoring or SRQ-20 content is added.

### PR 05B — Build Deterministic Runtime Engine

Scope:

1. implement flow loading, option resolution, and node advancement;
2. implement basic result/recommendation node handling;
3. implement global actions as explicit engine/UI actions;
4. add tests for advancement and invalid selections.

Acceptance criteria:

- a user can complete the first non-questionnaire flow;
- the engine rejects options not available at the current node;
- result nodes can reference resources by stable ID;
- runtime state remains in memory only.

### PR 05C — Add Flow Switching And Suspension

Scope:

1. allow selection of another flow's entering phrase;
2. suspend the current flow in memory;
3. start the target flow with its transition message;
4. offer resume only when no safety rule blocks it;
5. test flow switching and resume behavior.

Acceptance criteria:

- entering phrases from other flows are available;
- switching does not merge answers between flows;
- resume behavior is deterministic;
- safety-blocked flows are not offered for resumption.

### PR 05D — Replace Orientation Prototype With Guided Chat UI

Scope:

1. build constrained chat UI components under the orientation feature;
2. render bot/user messages from engine state;
3. show options as floating chat bubbles that send immediately on click;
4. wire global actions to routes;
5. remove the old step/slider prototype if fully replaced.

Acceptance criteria:

- Orientation screen runs from flow content;
- user cannot submit arbitrary free text;
- clicking a suggestion immediately sends the answer and advances the flow;
- the send button is disabled unless the input exactly matches an available option;
- the suggestion list hides when the input strictly matches an option label and reappears when it no longer does;
- the responsive layout avoids competing page and chat scroll regions;
- UI copy does not imply real AI;
- support route remains `/apoio`;
- tests, typecheck, and build pass.

---

## Files Expected To Change First

```txt
src/domain/flow-engine/types.ts
src/domain/flow-engine/flowSchema.ts
src/domain/flow-engine/validateFlow.ts
src/domain/flow-engine/loadFlows.ts
src/domain/flow-engine/resolveOptions.ts
src/domain/flow-engine/advanceFlow.ts
src/domain/flow-engine/suspendFlow.ts
src/domain/flow-engine/resumeFlow.ts
src/domain/flow-engine/safetyRules.ts
src/content/flows/registry.ts
src/content/flows/rest-recovery.ts
src/content/flows/work-stress.ts
src/features/orientation/OrientationScreen.tsx
src/features/orientation/components/ChatTranscript.tsx
src/features/orientation/components/OptionInput.tsx
src/features/orientation/components/OptionChips.tsx
src/tests/flow-engine/*.test.ts
```

---

## Risks and Guardrails

### Risk: fake-AI framing

Guardrail: use copy such as “orientação guiada” and constrained choices. Do not say the app understands arbitrary messages.

### Risk: sensitive persistence

Guardrail: keep answers, transcripts, suspended flows, and safety flags in memory only.

### Risk: overfitting to the first flow

Guardrail: tests should add at least one tiny fixture flow besides the product flow.

### Risk: implementing questionnaire behavior early

Guardrail: do not add SRQ-20 scoring, consent enforcement, or questionnaire thresholds in this front.

---

## Validation Commands

```bash
npm run lint
npm run test
npm run build
```

---

## Definition of Done

Front 05A is done when a non-questionnaire guided flow can be added as content, validated, rendered in the Orientation screen, completed through constrained choices, switched away from through entering phrases, and resumed from in-memory state without introducing persistence, backend behavior, analytics, or fake-AI claims.
