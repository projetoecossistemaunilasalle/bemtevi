# Front 14A — Dashboard Readiness Breakdown

## Purpose

This document breaks down the fourteenth implementation task for BemTeVi.

It is derived from:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/14-dashboard-readiness.md`
- `docs/fronts/04a-content-data-modeling-breakdown.md`
- `docs/fronts/05a-guided-flow-chatbot-framework-breakdown.md`
- `docs/fronts/10a-education-library-breakdown.md`

The goal is to ensure future editorial/dashboard tooling can manage flows, questionnaires, resources, services, and copy without forcing a frontend refactor. The dashboard itself remains out of scope.

---

## Current State

Earlier fronts move content into structured modules, add typed flow/questionnaire models, and validate content. Dashboard readiness makes those models consistently editable, metadata-rich, and free of executable content assumptions.

---

## Dashboard-Ready Content

Future editable records include:

- flow metadata;
- entering phrases;
- flow nodes/options;
- transition messages;
- questionnaire questions;
- scoring and result rules;
- safety rules;
- resources;
- service directory;
- home/privacy/support copy.

All records should use stable IDs and version/review metadata.

---

## Required Metadata

Each editorial record or collection should include where appropriate:

- `id`;
- `version`;
- `status`;
- `locale`;
- `created_at`;
- `updated_at`;
- review status;
- reviewed by/date fields when applicable.

Static timestamps are acceptable initially if documented as seed data metadata.

---

## No Executable Content

Dashboard-editable content must not rely on code-like strings or embedded functions.

Use declarative conditions:

```json
{
  "if": { "score_gte": 7 },
  "go_to": "possible-distress"
}
```

Do not use:

```json
{
  "next": "(score) => score > 7 ? 'high' : 'low'"
}
```

---

## Implementation Slices

### PR 14A — Audit Content Models For Metadata Consistency

Scope:

1. audit flows, questionnaires, resources, services, and copy;
2. add missing version/status/locale metadata;
3. add created/updated metadata where appropriate;
4. document which records are collection-level vs item-level.

Acceptance criteria:

- editable content has stable IDs;
- metadata shape is consistent enough for future export;
- no runtime behavior changes are introduced.

### PR 14B — Remove Hardcoded Editorial Decisions From Runtime

Scope:

1. identify text, thresholds, routes, and recommendation mappings embedded in logic;
2. move editorial values into declarative content where safe;
3. keep non-editorial algorithms in TypeScript.

Acceptance criteria:

- result thresholds and recommendation mappings are declarative;
- runtime functions interpret content rather than own editorial copy;
- no executable strings are introduced.

### PR 14C — Add Export/Validation Readiness

Scope:

1. add scripts or helpers to serialize content modules to JSON for inspection;
2. validate that exported data is serializable;
3. document expected dashboard import/export boundaries.

Acceptance criteria:

- content can be exported without React imports;
- serialization does not include functions, components, or handlers;
- validation catches non-serializable content.

### PR 14D — Document Future Dashboard Contract

Scope:

1. create `docs/dashboard/content-contract.md`;
2. document editable entities and non-editable runtime logic;
3. document review/status workflow assumptions;
4. document migration path from local content modules to backend/dashboard later.

Acceptance criteria:

- future dashboard scope is clear;
- current frontend remains backend-free;
- dashboard readiness does not imply dashboard implementation.

---

## Files Expected To Change First

```txt
docs/dashboard/content-contract.md
scripts/export-content.ts
scripts/validate-content-serializable.ts
src/domain/content/types.ts
src/content/flows/*.ts
src/content/resources/resources.ts
src/content/services/*.ts
src/content/support/*.ts
src/content/copy/*.ts
src/tests/content/*.test.ts
```

---

## Risks and Guardrails

### Risk: building the dashboard too early

Guardrail: only define contracts, metadata, validation, and export readiness. No admin UI, auth, backend, or CMS is included.

### Risk: moving algorithms into content

Guardrail: keep execution in TypeScript. Content should be declarative, not code.

### Risk: overcomplicating seed data

Guardrail: add only metadata that supports review, validation, and future editing.

---

## Validation Commands

```bash
npm run check
```

If `check` is not yet available, run:

```bash
npm run lint
npm run test
npm run build
```

---

## Definition of Done

Front 14A is done when BemTeVi's editorial content is metadata-rich, serializable, declarative, and documented well enough that a future dashboard can edit content without requiring a frontend architecture refactor.
