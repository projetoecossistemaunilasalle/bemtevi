# Front 09A — Contacts Directory Breakdown

## Purpose

This document breaks down the ninth implementation task for BemTeVi.

It is derived from:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/09-contacts-directory.md`
- `docs/fronts/04a-content-data-modeling-breakdown.md`
- `docs/fronts/11-privacy-lgpd-session.md`

The goal is to provide a structured support-service directory that can begin with Canoas/RS but does not hardcode the product as Canoas-only.

---

## Current State

The prototype includes a static local support network view with Canoas service cards embedded in JSX. After Front 04A, those services may already be extracted into `src/content/services/canoas-services.ts`.

---

## Target Model

Use a typed, JSON-compatible service model with stable IDs:

```txt
src/domain/services/types.ts
src/content/services/canoas-services.ts
src/content/services/national-services.ts
```

Each service should include ID, name, type, city/state, address, phone display and href, opening hours, notes, and review metadata.

Do not require latitude/longitude in the first directory version.

---

## Location Policy

Location sorting is deferred until Privacy/LGPD review approves it.

This front may prepare optional fields and pure distance utilities, but it should not request browser location permission.

---

## Implementation Slices

### PR 09A — Finalize Service Data Model

Scope:

1. refine `SupportService` type;
2. ensure city/state are required;
3. ensure phone data separates display from `tel:` href;
4. add review/status metadata;
5. validate current Canoas content against the type.

Acceptance criteria:

- service entries are typed and serializable;
- Canoas is represented as content, not architecture;
- no geolocation permission is requested.

### PR 09B — Build Directory UI From Data

Scope:

1. render contacts directory from service data;
2. use reusable service card component;
3. add basic type/city labels;
4. keep call actions as direct `tel:` anchors.

Acceptance criteria:

- directory renders from content modules;
- no service card content is hardcoded in JSX;
- phone links remain usable;
- layout works on mobile.

### PR 09C — Add Basic Non-Location Filtering

Scope:

1. add optional city/type filtering if useful with current data;
2. keep filters in memory only;
3. do not use browser location or map SDKs.

Acceptance criteria:

- full directory works without permissions;
- filters do not imply nearest-service behavior;
- no location is stored or transmitted.

### PR 09D — Prepare Deferred Location Utility Only If Needed

Scope:

1. add pure distance/sorting utilities only if service coordinates are present and privacy review has a documented path;
2. keep browser permission prompts out of this PR unless Front 11 explicitly approves them.

Acceptance criteria:

- utility functions are pure and tested;
- no runtime geolocation prompt appears;
- location sorting remains off by default.

---

## Files Expected To Change First

```txt
src/domain/services/types.ts
src/content/services/canoas-services.ts
src/content/services/national-services.ts
src/features/contacts/ContactsScreen.tsx
src/features/contacts/components/ServiceCard.tsx
src/features/contacts/components/ServiceFilters.tsx
src/lib/geo/distance.ts
src/tests/services/*.test.ts
src/tests/contacts/*.test.tsx
```

---

## Risks and Guardrails

### Risk: Canoas-only architecture

Guardrail: require city/state fields and keep content grouped in files, not view names or route names.

### Risk: premature geolocation

Guardrail: no permission prompt, location storage, or map SDK before Privacy/LGPD approval.

### Risk: unverifiable service content

Guardrail: keep service metadata and review status visible in the content model.

---

## Validation Commands

```bash
npm run lint
npm run test
npm run build
```

---

## Definition of Done

Front 09A is done when the contacts directory renders from structured service data, supports Canoas without being Canoas-only, keeps call actions accessible, and does not introduce location permission or privacy-sensitive storage.
