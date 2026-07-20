# Front 04A — Content/Data Modeling Breakdown

## Purpose

This document breaks down the fourth implementation task for BemTeVi.

It is derived from the current repository state on the `develop` branch and from the following project documents:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/README.md`
- `docs/fronts/04-content-data-modeling.md`
- `docs/fronts/02a-folder-structure-breakdown.md`

The goal is to move reviewed product content out of React components and into typed, JSON-compatible data structures without introducing a backend, persistence, analytics, or a dashboard.

---

## Current State

The current prototype embeds product content directly in JSX:

- Home trust copy and entry labels live in the Home screen.
- CVV, SAMU, and Bombeiros content lives in the support screen.
- Canoas service names, addresses, phones, and hours live in the contacts screen.
- Orientation prototype questions and result material copy live in the orientation screen.

This is acceptable for a prototype, but it makes product, design, clinical, and client review harder. It also makes future dashboard readiness more expensive.

---

## Target Content Structure

Create JSON-compatible TypeScript content modules first. Plain `.ts` files exporting typed objects are acceptable in this phase as long as the data remains serializable and dashboard-ready.

Target folders:

```txt
src/content/
  copy/
    home.ts
    privacy.ts
  support/
    contacts.ts
  services/
    canoas-services.ts
  resources/
    resources.ts
  flows/
    registry.ts
```

JSON files can replace `.ts` modules later when validation scripts are introduced. For development, typed `.ts` content keeps imports simple while still separating data from JSX.

Deferred content files:

```txt
src/content/support/breathing.ts
src/content/services/national-services.ts
```

These should be added when the breathing exercise and national service content are actually implemented or extracted. They are not first-change files for this front.

---

## Metadata Model

Every content collection should include metadata:

```ts
export const homeCopy = {
  id: 'home-copy',
  version: '0.1.0',
  status: 'draft',
  locale: 'pt-BR',
  ...
} as const;
```

Clinically or editorially reviewed content should include review metadata:

```ts
review: {
  status: 'pending_review',
  reviewed_by: null,
  reviewed_at: null,
  notes: '',
}
```

Use stable IDs. Avoid names such as `card1`, `new-resource`, or `final-copy`.

---

## Initial Content Types

Front 04A should extract currently visible content first:

| Content Type                    | Source Screen      | New Content File                          |
| ------------------------------- | ------------------ | ----------------------------------------- |
| Home copy and action labels     | Home               | `src/content/copy/home.ts`                |
| Immediate support contacts      | Support            | `src/content/support/contacts.ts`         |
| Local service directory         | Contacts           | `src/content/services/canoas-services.ts` |
| Initial resource recommendation | Orientation result | `src/content/resources/resources.ts`      |

Defer complete guided flow and SRQ-20 modeling to Fronts 05 and 06. This front can prepare `src/content/flows/registry.ts`, but it should not define the full flow schema yet.

---

## Type Ownership

Add domain types close to their product meaning:

```txt
src/domain/content/types.ts
src/domain/copy/types.ts
src/domain/resources/types.ts
src/domain/services/types.ts
src/domain/support/types.ts
```

`src/domain/content/types.ts` owns shared base types such as `ContentMetadata`, `ContentStatus`, `ContentLocale`, and review metadata. The per-domain type files import or extend those shared types for their own shapes.

Minimum type examples:

```ts
export type ContentStatus = 'draft' | 'pending_review' | 'approved' | 'archived';

export interface ContentMetadata {
  id: string;
  version: string;
  status: ContentStatus;
  locale: 'pt-BR';
}
```

Keep types lightweight. Avoid a full schema validation framework until Front 13.

---

## Data Rules

Content should be:

- serializable;
- stable-ID based;
- Portuguese-first;
- free of personally identifiable user data;
- easy to review without reading JSX;
- not mixed with click handlers or React components.

Phone numbers should keep both display and link values:

```ts
{
  phoneDisplay: '188',
  phoneHref: 'tel:188'
}
```

External links should include source metadata and review status before they are treated as production resources.

---

## Implementation Slices

### PR 04A — Add Shared Content Types And Folders

Scope:

1. create lightweight content metadata types;
2. create support, services, resources, and copy type files;
3. create content folder modules with metadata placeholders;
4. keep all data JSON-compatible.

Acceptance criteria:

- shared content metadata type exists;
- per-domain content types import or extend the shared metadata type rather than duplicating it;
- content modules compile with TypeScript;
- no content module imports React;
- no persistence or backend behavior is introduced.

### PR 04B — Extract Home And Support Content

Scope:

1. move Home headings, trust copy, and action labels into `src/content/copy/home.ts`;
2. move CVV, SAMU, and Bombeiros contact content into `src/content/support/contacts.ts`;
3. update Home and Support screens to render from content modules;
4. keep route behavior and visual design unchanged.

Acceptance criteria:

- Home screen no longer hardcodes primary copy or action labels;
- Support screen no longer hardcodes support contact cards;
- all support phone links still work as `tel:` anchors;
- content includes stable IDs and metadata.

### PR 04C — Extract Contacts And Resource Content

Scope:

1. move Canoas service directory entries into `src/content/services/canoas-services.ts`;
2. move the current orientation result resource into `src/content/resources/resources.ts`;
3. update Contacts and Orientation screens to render from content modules;
4. keep resource/detail route placeholders intact until Front 10.

Acceptance criteria:

- Contacts screen renders service cards from structured content;
- Orientation result references a resource by stable ID or renders from resource content;
- service and resource entries include metadata/review fields where appropriate;
- no location sorting, analytics, or dashboard editing is introduced.

### PR 04D — Prepare Flow Registry Placeholder

Scope:

1. create `src/content/flows/registry.ts`;
2. define a minimal registry placeholder with metadata;
3. document that full guided-flow schema belongs to Front 05.

Acceptance criteria:

- `flows/registry.ts` exists and is explicitly non-final;
- no fake SRQ-20 implementation is added;
- no scoring or safety-rule behavior is implemented in this front.

---

## Files Expected To Change First

```txt
src/domain/content/types.ts
src/domain/copy/types.ts
src/domain/resources/types.ts
src/domain/services/types.ts
src/domain/support/types.ts
src/content/copy/home.ts
src/content/support/contacts.ts
src/content/services/canoas-services.ts
src/content/resources/resources.ts
src/content/flows/registry.ts
src/features/home/HomeScreen.tsx
src/features/support/SupportScreen.tsx
src/features/contacts/ContactsScreen.tsx
src/features/orientation/OrientationScreen.tsx
```

---

## Risks and Guardrails

### Risk: designing the final dashboard schema too early

Guardrail: keep content JSON-compatible and stable-ID based, but do not build dashboard-specific behavior.

### Risk: accidentally implementing Front 05 or 06

Guardrail: do not add guided-flow runtime, SRQ-20 scoring, interruption rules, or validation scripts in this front.

### Risk: losing clinical/editorial review context

Guardrail: include review metadata on support, service, and resource content where appropriate.

### Risk: content modules becoming React helpers

Guardrail: content modules should export plain data only.

### Risk: changing visible behavior during extraction

Guardrail: keep rendered copy and links equivalent unless a correction is explicitly required.

---

## Validation Commands

Run before merging:

```bash
npm run lint
npm run test
npm run build
```

Current `npm run lint` is TypeScript checking through `tsc --noEmit`, not ESLint. `npm run test` is expected after Front 02D introduces the minimal test harness.

---

## Definition of Done

Front 04A is done when:

- visible Home, support, contacts, and current resource recommendation content is no longer embedded directly in JSX;
- content modules are JSON-compatible and typed;
- each content collection has stable metadata;
- support/service/resource content includes review metadata where appropriate;
- React screens render from content modules;
- no persistence, analytics, backend behavior, flow engine, SRQ-20 scoring, or dashboard editing is introduced.
