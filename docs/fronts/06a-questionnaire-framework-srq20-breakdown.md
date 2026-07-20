# Front 06A — Questionnaire Framework & SRQ-20 Breakdown

## Purpose

This document breaks down the sixth implementation task for BemTeVi.

It is derived from:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/06-questionnaire-framework-srq20.md`
- `docs/fronts/05a-guided-flow-chatbot-framework-breakdown.md`

The goal is to extend the guided-flow framework with generic questionnaire behavior and use SRQ-20 as the first real validation case, without hardcoding SRQ-20 into React components.

---

## Current State

After Front 05A, BemTeVi should have a generic flow schema, runtime engine, constrained chat UI, and at least one non-questionnaire flow. It still needs questionnaire-specific concepts: consent, fixed question sets, scoring, thresholds, safety interruption, and result recommendations.

---

## Target Shape

SRQ-20 is a regular registered JSON guided flow:

```txt
src/content/flows/srq20.json
  -> import.meta.glob in src/content/flows/registry.ts
  -> src/domain/flow-engine
  -> src/features/orientation/OrientationScreen.tsx
```

There is no SRQ-20 screen, no SRQ-20 route, no `srq20.ts` workflow file, no per-questionnaire TypeScript import, and no questionnaire-specific frontend state machine. The Orientation chatbot renders whatever the flow engine exposes: transcript messages, constrained options, score-driven results, and safety navigation.

---

## Questionnaire Model

Questionnaire-like flows are JSON guided-flow content executed by `src/domain/flow-engine`. There is no separate `src/domain/questionnaires/` runtime.

Questionnaire JSON content must include consent nodes, fixed question IDs, answer options with score effects, score branch thresholds, safety interrupt effects, result recommendations, and non-diagnostic result copy. All of these are generic flow engine capabilities, not questionnaire-specific types.

---

## SRQ-20 Required Behavior

- The user is clearly told this is SRQ-20.
- Consent is required before questions begin.
- There are 20 yes/no questions.
- Affirmative answers are scored.
- Score `>= 7` maps to a possible-distress support result.
- Result copy avoids diagnostic language.
- Suicidal ideation affirmative answer interrupts immediately.
- Interruption routes/surfaces immediate support at `/apoio`.
- Interrupted SRQ-20 is not offered for resumption.

---

## Implementation Slices

### PR 06A — Add Generic Questionnaire Types And Validation

Scope:

1. define questionnaire types;
2. extend flow validation for questionnaire flows;
3. require consent metadata for questionnaire flows;
4. validate fixed question IDs and next references;
5. add tests for valid and invalid questionnaire fixtures.

Acceptance criteria:

- questionnaire validation is generic;
- a questionnaire without consent fails validation;
- broken question references fail validation;
- no SRQ-20-specific React logic is introduced.

### PR 06B — Add Generic Scoring And Result Mapping

Scope:

1. implement sum-affirmative scoring;
2. implement threshold result resolution;
3. map results to resource/recommendation IDs;
4. test score bands and recommendation mapping.

Acceptance criteria:

- scoring runs outside React;
- score `>= 7` can map to a configured result;
- another questionnaire could reuse the same scoring path.

### PR 06C — Add Safety Interruption Rules

Scope:

1. implement declarative interruption rules;
2. support route/action destinations such as `/apoio`;
3. mark interrupted flows as non-resumable when configured;
4. test affirmative suicidal-ideation interruption.

Acceptance criteria:

- safety rules are declarative content;
- Q17 affirmative interrupts immediately;
- interrupted SRQ-20 is not resumable;
- no sensitive answer data is persisted.

### PR 06D — Add SRQ-20 Content And UI Integration

Scope:

1. add SRQ-20 questionnaire content as `src/content/flows/srq20.json`;
2. register it with the flow registry;
3. expose it from Orientation entry options;
4. render consent, questions, interruption, and results through existing guided-flow UI;
5. add full SRQ-20 tests.

Acceptance criteria:

- SRQ-20 is represented as structured content;
- all 20 questions are present;
- consent is required;
- score and interruption behavior matches the PRD;
- result copy is supportive and non-diagnostic.

---

## Files That Changed

```txt
src/domain/flow-engine/types.ts              — added FlowEffect, ScoreBranchFlowNode, pendingNavigation
src/domain/flow-engine/parseFlow.ts          — new: validates unknown JSON into typed GuidedFlow
src/domain/flow-engine/validateFlow.ts       — extended for score branches and effects
src/domain/flow-engine/advanceFlow.ts        — executes score effects, safety interrupts, score branches
src/domain/flow-engine/loadFlows.ts          — initializes pendingNavigation
src/domain/flow-engine/resolveOptions.ts     — passes option effects through runtime options
src/content/flows/srq20.json                 — new: SRQ-20 as JSON guided-flow content
src/content/flows/registry.ts                — dynamic JSON discovery via import.meta.glob
src/features/orientation/OrientationScreen.tsx — generic pendingNavigation effect
```

---

## Risks and Guardrails

### Risk: diagnosis language

Guardrail: use wording such as “pode indicar sofrimento emocional” and never present a diagnosis.

### Risk: hardcoding SRQ-20

Guardrail: scoring, consent, thresholds, and interruption rules must be generic domain behavior.

### Risk: unsafe persistence

Guardrail: do not save answers, scores, transcripts, or interrupted state outside the active in-memory session.

### Risk: safety destination becoming alarmist

Guardrail: route to `/apoio` and preserve calm support copy and design treatment.

---

## Validation Commands

```bash
npm run lint
npm run test
npm run build
```

---

## Definition of Done

Front 06A is done when SRQ-20 runs as structured questionnaire content through generic domain logic, has automated tests for validation, scoring, thresholds, consent, and safety interruption, and preserves BemTeVi's privacy and non-diagnostic product commitments.
