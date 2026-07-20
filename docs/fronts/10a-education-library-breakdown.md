# Front 10A — Education Library Breakdown

## Purpose

This document breaks down the tenth implementation task for BemTeVi.

It is derived from:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/10-education-library.md`
- `docs/fronts/04a-content-data-modeling-breakdown.md`
- `docs/fronts/05a-guided-flow-chatbot-framework-breakdown.md`

The goal is to create a curated, structured education library for teachers and make flow recommendations resolve to stable resource IDs.

---

## Current State

The current prototype has a recommendation card in the orientation flow but no real education library, resource detail route, search/filter UI, or reviewed resource model.

Routes should already exist after Front 01A:

```txt
/educacao
/educacao/:resourceId
```

---

## Resource Model

Resources should live under:

```txt
src/domain/resources/types.ts
src/content/resources/resources.ts
```

Each resource should include stable ID, title, source, description, tags, audience, content type, body or external URL, review metadata, version, status, and locale metadata.

---

## Flow Integration

Flow result nodes should reference resources by stable IDs, not by embedded card copy.

```txt
flow result recommendation_id
  → resource lookup
  → resource card or detail route
```

Missing recommendation IDs should fail validation once validation tooling exists.

---

## Implementation Slices

### PR 10A — Finalize Resource Data Model

Scope:

1. refine resource types;
2. add initial reviewed/draft resources;
3. include review status and source metadata;
4. add resource lookup helpers.

Acceptance criteria:

- resources are structured and serializable;
- stable IDs are used;
- external/PDF resources are clearly labeled in data;
- lookup helpers are React-free.

### PR 10B — Build Education Library Screen

Scope:

1. render resource cards from content;
2. add basic tag/source display;
3. add simple in-memory search/filter if useful;
4. link cards to detail routes or external URLs.

Acceptance criteria:

- `/educacao` renders real structured resources;
- filters do not require persistence;
- external resources are visibly external.

### PR 10C — Build Resource Detail Screen

Scope:

1. resolve `:resourceId` from route params;
2. render in-app article/summary body when available;
3. show external/PDF action when needed;
4. handle unknown IDs with a calm not-found state.

Acceptance criteria:

- `/educacao/:resourceId` works for known resources;
- unknown resource IDs do not crash;
- review/source context is available where appropriate.

### PR 10D — Connect Flow Recommendations To Resources

Scope:

1. update flow result rendering to resolve recommendation IDs;
2. validate that referenced resources exist;
3. add tests for resource recommendation lookup.

Acceptance criteria:

- flow results do not duplicate resource card content;
- broken recommendation IDs are caught by tests or validation;
- resource links remain stable.

---

## Files Expected To Change First

```txt
src/domain/resources/types.ts
src/domain/resources/resourceLookup.ts
src/content/resources/resources.ts
src/features/education/EducationLibraryScreen.tsx
src/features/education/ResourceDetailScreen.tsx
src/features/education/components/ResourceCard.tsx
src/features/education/components/ResourceFilters.tsx
src/features/orientation/OrientationScreen.tsx
src/tests/resources/*.test.ts
src/tests/education/*.test.tsx
```

---

## Risks and Guardrails

### Risk: publishing unreviewed clinical content as final

Guardrail: represent review status and keep draft/pending content distinguishable in the model.

### Risk: hardcoding recommendation cards

Guardrail: flow results should reference resource IDs and let the resource layer render cards.

### Risk: fragile external resources

Guardrail: label external/PDF links clearly and include source metadata.

---

## Validation Commands

```bash
npm run lint
npm run test
npm run build
```

---

## Definition of Done

Front 10A is done when `/educacao` and `/educacao/:resourceId` render structured resource content, resources include source/review metadata, and guided-flow recommendations resolve through stable resource IDs instead of embedded JSX copy.
