# Front 13A — Quality, Validation & Tooling Breakdown

## Purpose

This document breaks down the thirteenth implementation task for BemTeVi.

It is derived from:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/13-quality-validation-tooling.md`
- `docs/fronts/05a-guided-flow-chatbot-framework-breakdown.md`
- `docs/fronts/06a-questionnaire-framework-srq20-breakdown.md`

The goal is to make content-heavy, privacy-sensitive development safer through tooling, tests, validation scripts, and a single check command.

---

## Current State

The original repository has `npm run lint` implemented as `tsc --noEmit`, plus `npm run build`. Front 02D should add the minimal Vitest harness earlier so SRQ-20 and flow work can be tested before this front.

Front 13A strengthens the toolchain rather than being the first time tests appear.

---

## Target Tooling

Recommended final scripts:

```json
{
  "dev": "vite",
  "build": "vite build",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "format": "prettier --write .",
  "test": "vitest",
  "validate:flows": "tsx scripts/validate-flows.ts",
  "check": "npm run typecheck && npm run lint && npm run validate:flows && npm run test && npm run build"
}
```

If renaming the current `lint` script would create churn, add `typecheck` first and migrate carefully.

---

## Validation Scope

Flow/content validation should check schema compliance, unique IDs, entry node existence, next references, option labels, entering phrases, duplicate phrases, safety rules, recommendation IDs, questionnaire scoring rules, and SRQ-20 consent/question count.

---

## Implementation Slices

### PR 13A — Normalize Scripts And Typecheck

Scope:

1. add explicit `typecheck` script;
2. preserve or introduce `lint` with clear meaning;
3. add `check` once constituent commands exist;
4. document commands in README.

Acceptance criteria:

- command names are clear;
- existing build behavior is preserved;
- `npm run check` becomes the merge gate by the end of this front.

### PR 13B — Add ESLint And Prettier

Scope:

1. install ESLint/Prettier dependencies;
2. add practical React/TypeScript config;
3. avoid noisy stylistic rewrites outside intentional formatting;
4. add format scripts.

Acceptance criteria:

- lint runs successfully;
- formatting is deterministic;
- rules support maintainability without fighting the small prototype style.

### PR 13C — Add Content Validation Scripts

Scope:

1. add `scripts/validate-flows.ts`;
2. validate registered flows and questionnaires;
3. validate resource recommendation references;
4. fail with actionable messages.

Acceptance criteria:

- invalid flow content blocks `npm run validate:flows`;
- SRQ-20 structure is validated;
- errors identify file/ID context.

### PR 13D — Expand Test Coverage

Scope:

1. ensure flow engine tests cover switching, suspension, and invalid choices;
2. ensure questionnaire tests cover scoring and interruption;
3. add key route rendering tests;
4. add basic design-system rendering/accessibility tests.

Acceptance criteria:

- critical domain behavior is tested outside React;
- support/contact/resource screens have smoke tests;
- SRQ-20 required behaviors remain covered.

---

## Files Expected To Change First

```txt
package.json
package-lock.json
eslint.config.js
.prettierrc
scripts/validate-flows.ts
src/tests/setup.ts
src/tests/flow-engine/*.test.ts
src/tests/questionnaires/*.test.ts
src/tests/routes/*.test.tsx
src/tests/design-system/*.test.tsx
README.md
```

---

## Risks and Guardrails

### Risk: tooling PR becomes a full repo rewrite

Guardrail: separate config changes from broad formatting, or make formatting-only commits obvious.

### Risk: validation duplicates runtime logic incorrectly

Guardrail: reuse domain validators where possible; scripts should orchestrate, not redefine schemas.

### Risk: tests arrive too late

Guardrail: minimal Vitest setup belongs in Front 02D; this front expands it.

---

## Validation Commands

```bash
npm run check
```

During migration, run available commands individually:

```bash
npm run typecheck
npm run lint
npm run validate:flows
npm run test
npm run build
```

---

## Definition of Done

Front 13A is done when `npm run check` exists and passes, content validation catches invalid flows/questionnaires, SRQ-20 and flow engine behavior are tested, and code formatting/linting are reliable enough to support ongoing product work.
