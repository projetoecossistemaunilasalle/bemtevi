# Front 08A — Immediate Support Screen Breakdown

## Purpose

This document breaks down the eighth implementation task for BemTeVi.

It is derived from:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/08-immediate-support.md`
- `docs/fronts/04a-content-data-modeling-breakdown.md`
- `docs/fronts/06a-questionnaire-framework-srq20-breakdown.md`

The goal is to make `/apoio` a calm, always-available support destination that can be reached by users, navigation, global flow actions, and safety rules.

---

## Current State

The prototype has an emergency/support screen with CVV, SAMU, and Bombeiros cards. The real product needs the same directness with calmer route naming, structured content, and a breathing/grounding tool treated as first-care content.

---

## Target Content

The support screen should include:

- grounding message;
- CVV 188;
- SAMU 192;
- Bombeiros 193;
- direct call actions;
- breathing exercise;
- calm explanation of when to use each path.

Content should live under:

```txt
src/content/support/
  contacts.ts
  breathing.ts
  support-copy.ts
```

---

## System Integration

`/apoio` is both a user route and a safety destination:

- bottom navigation;
- Home or global action links;
- questionnaire safety interruption;
- guided-flow “Quero apoio agora” action.

Do not create `/crise`.

---

## Implementation Slices

### PR 08A — Complete Support Content Model

Scope:

1. verify or extract CVV/SAMU/Bombeiros content;
2. add breathing exercise content;
3. add grounding/support copy;
4. include stable IDs, phone display values, and `tel:` hrefs.

Acceptance criteria:

- support content is not hardcoded in JSX;
- phone actions keep `tel:` links;
- breathing copy is content-driven;
- no analytics or click tracking is added.

### PR 08B — Rebuild Support Screen Layout

Scope:

1. render support contacts with shared card primitives;
2. render breathing exercise with equal dignity to phone cards;
3. keep visual treatment calm and non-red-first;
4. ensure mobile call buttons are large and accessible.

Acceptance criteria:

- screen is reachable at `/apoio`;
- phone numbers are visible and tappable;
- breathing exercise is present and usable;
- no alarmist animation or copy is introduced.

### PR 08C — Wire Support As Safety Destination

Scope:

1. ensure flow global action routes to `/apoio`;
2. ensure questionnaire interruption can route/surface `/apoio`;
3. add route/render tests for support destination behavior.

Acceptance criteria:

- `Quero apoio agora` reaches `/apoio`;
- SRQ-20 safety interruption can reach `/apoio`;
- no `/crise` route or route alias is introduced.

---

## Files Expected To Change First

```txt
src/content/support/contacts.ts
src/content/support/breathing.ts
src/content/support/support-copy.ts
src/domain/support/types.ts
src/features/support/SupportScreen.tsx
src/features/support/components/BreathingExercise.tsx
src/features/support/components/SupportContactList.tsx
src/domain/flow-engine/safetyRules.ts
src/tests/support/*.test.tsx
```

---

## Risks and Guardrails

### Risk: red-first crisis design

Guardrail: use calm surfaces, green/blue emphasis, and clear phone CTAs without alarmist treatment.

### Risk: weakening immediate action clarity

Guardrail: phone numbers and call buttons must remain prominent and direct.

### Risk: treating breathing as decoration

Guardrail: breathing exercise should be structured, readable, and accessible as a first-care action.

---

## Validation Commands

```bash
npm run lint
npm run test
npm run build
```

---

## Definition of Done

Front 08A is done when `/apoio` is a content-driven, calm, accessible support destination with direct contacts, breathing guidance, and integration with navigation and flow safety rules.
