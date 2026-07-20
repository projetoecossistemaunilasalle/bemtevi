# Front 02A — Folder Structure Breakdown

## Purpose

This document breaks down the second implementation task for the BemTeVi frontend architecture.

It is derived from the current repository state on the `develop` branch and from the following project documents:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/README.md`
- `docs/fronts/02-readable-folder-structure.md`
- `docs/fronts/01a-app-architecture-breakdown.md`

The goal is to make the source tree readable and scalable without changing product behavior, adding persistence, introducing backend behavior, or prematurely implementing later domain frameworks.

---

## Current State

The current app has a very small source tree:

```txt
src/
  App.tsx
  main.tsx
  index.css
  views/
    HomeView.tsx
    AssessmentView.tsx
    EmergencyView.tsx
    NetworkView.tsx
```

After Front 01A, the app should also have a route-based `src/app/` layer with app shell components.

This structure is workable for a prototype, but it does not make future product domains obvious. As the app grows, guided flows, questionnaire logic, content files, privacy policy rules, and reusable UI primitives need clear homes.

---

## Target Structure

Front 02A should introduce the major folders that later fronts will fill:

```txt
src/
  app/
  design-system/
  features/
  domain/
  content/
  lib/
  tests/
```

This front is mostly about creating clear ownership boundaries and moving the existing screens into feature folders. It should avoid building the full flow engine, full content model, analytics, or dashboard readiness behavior.

---

## Feature Folder Model

Use product language for user-facing feature folders:

```txt
src/features/
  home/
  orientation/
  support/
  contacts/
  education/
  privacy/
```

Initial mapping:

| Current File                   | New File                                         |
| ------------------------------ | ------------------------------------------------ |
| `src/views/HomeView.tsx`       | `src/features/home/HomeScreen.tsx`               |
| `src/views/AssessmentView.tsx` | `src/features/orientation/OrientationScreen.tsx` |
| `src/views/EmergencyView.tsx`  | `src/features/support/SupportScreen.tsx`         |
| `src/views/NetworkView.tsx`    | `src/features/contacts/ContactsScreen.tsx`       |

Temporary route placeholders from Front 01A should live in their future feature folders:

| Route                   | Temporary Screen                                    |
| ----------------------- | --------------------------------------------------- |
| `/educacao`             | `src/features/education/EducationLibraryScreen.tsx` |
| `/educacao/:resourceId` | `src/features/education/ResourceDetailScreen.tsx`   |
| `/privacidade`          | `src/features/privacy/PrivacyScreen.tsx`            |

The old `src/views/` folder should be removed once imports have been updated.

---

## Domain Folder Model

Create domain folders as placeholders only when they help later work land cleanly:

```txt
src/domain/
  content/
  copy/
  flow-engine/
  questionnaires/
  resources/
  services/
  support/
  privacy/
```

In this slice, these folders may contain lightweight `README.md` files or minimal `types.ts` placeholders only when needed. `domain/content/` is reserved for shared content metadata types, while `domain/copy/`, `domain/resources/`, `domain/services/`, and `domain/support/` are reserved for product-specific content types that can extend or import the shared metadata. Do not implement flow advancement, scoring, validation, analytics policy, or privacy logic yet.

---

## Content Folder Model

Create the top-level content folders needed by Front 04:

```txt
src/content/
  flows/
  resources/
  services/
  support/
  copy/
```

This front may add `.gitkeep` or `README.md` files to make the intended ownership visible. Actual structured content extraction belongs to Front 04A.

---

## Design-System Folder Model

Create the structure needed by Front 03:

```txt
src/design-system/
  components/
  forms/
  feedback/
  styles/
```

This front should not create a large component library. Component extraction belongs to Front 03A.

Do not create `src/design-system/chat/` yet. Chat primitives belong to the guided flow/chatbot work in Front 05 unless a future design-system slice explicitly needs them earlier.

---

## Lib Folder Model

Create generic utility folders only where expected later:

```txt
src/lib/
  validation/
  geo/
```

Do not add `src/lib/analytics/` in this front unless Front 12 has been approved. Analytics is intentionally not part of the MVP foundation yet.

---

## Import Rules

Use clear relative imports or the existing Vite alias consistently. Avoid introducing a second alias strategy.

Recommended import direction:

- `app/` may import feature screens and shell components.
- `features/` may import design-system components, domain helpers, and content.
- `domain/` should not import React components.
- `content/` should not import React components.
- `design-system/` should not import feature-specific code.
- `lib/` should not import app or feature code.

---

## Implementation Slices

### PR 02A — Move Screens Into Feature Folders

Scope:

1. create `src/features/home/`, `src/features/orientation/`, `src/features/support/`, and `src/features/contacts/`;
2. move current view components into feature folders and rename them to `*Screen.tsx`;
3. update router/app imports to the new paths;
4. remove `src/views/` after imports are clean;
5. keep user-facing behavior unchanged.

Acceptance criteria:

- current screens render from `src/features/*`;
- no top-level screen imports reference `src/views/`;
- route behavior from Front 01A remains unchanged;
- no content extraction or domain rewrite is mixed into this PR.

### PR 02B — Add Placeholder Feature Folders For Reserved Routes

Scope:

1. create `src/features/education/`;
2. create `src/features/privacy/`;
3. keep or move temporary placeholder screens for `/educacao`, `/educacao/:resourceId`, and `/privacidade` into those folders;
4. ensure placeholder copy is Portuguese-first and clearly temporary for development.

Acceptance criteria:

- reserved routes have obvious feature ownership;
- placeholders do not pretend the feature is complete;
- no fake content model is introduced.

### PR 02C — Create Domain, Content, Design-System, And Lib Boundaries

Scope:

1. create `src/domain/` subfolders listed above;
2. create `src/content/` subfolders listed above;
3. create `src/design-system/` subfolders listed above;
4. create `src/lib/validation/` and `src/lib/geo/`;
5. add short `README.md` files only where they clarify ownership.

Acceptance criteria:

- folder intent is visible from the tree;
- no empty architecture creates misleading implemented behavior;
- domain/content folders do not depend on React;
- analytics folders are not introduced yet.

### PR 02D — Add Minimal Test Harness

Scope:

1. install Vitest and React Testing Library dependencies needed for component/domain tests;
2. add an `npm run test` script;
3. create `src/tests/setup.ts`;
4. add one smoke test or configuration test so the test command proves the harness works;
5. keep test setup generic and avoid implementing SRQ-20 or flow-specific tests in this front.

Acceptance criteria:

- `npm run test` exists and passes;
- the harness can support later domain tests without rendering the whole app;
- no product behavior changes are introduced;
- future fronts can add tests without reworking project configuration.

---

## Files Expected To Change First

```txt
src/app/router.tsx
src/app/shell/AppShell.tsx
package.json
package-lock.json
src/features/home/HomeScreen.tsx
src/features/orientation/OrientationScreen.tsx
src/features/support/SupportScreen.tsx
src/features/contacts/ContactsScreen.tsx
src/features/education/EducationLibraryScreen.tsx
src/features/education/ResourceDetailScreen.tsx
src/features/privacy/PrivacyScreen.tsx
src/tests/setup.ts
src/tests/smoke.test.ts
```

Expected removals after migration:

```txt
src/views/HomeView.tsx
src/views/AssessmentView.tsx
src/views/EmergencyView.tsx
src/views/NetworkView.tsx
src/views/
```

---

## Risks and Guardrails

### Risk: moving files while changing behavior

Guardrail: keep Front 02A focused on file ownership and imports. Do not refactor screen internals unless required by the move.

### Risk: empty folders giving a false sense of completion

Guardrail: use short README files to document future ownership, and keep acceptance criteria tied to actual migrated screens.

### Risk: adding analytics too early

Guardrail: do not create analytics utilities until Front 12 is approved.

### Risk: turning domain folders into React helpers

Guardrail: domain modules should stay independent from React and UI libraries.

### Risk: test setup becoming feature work

Guardrail: add only the minimal harness and one smoke/configuration test. Product-specific tests belong to their owning fronts.

---

## Validation Commands

Run before merging:

```bash
npm run lint
npm run test
npm run build
```

Current `npm run lint` is TypeScript checking through `tsc --noEmit`, not ESLint. `npm run test` is introduced by PR 02D.

---

## Definition of Done

Front 02A is done when:

- current screens live under `src/features/*`;
- `src/views/` is removed;
- app/router imports use the new feature paths;
- reserved route placeholders have feature ownership;
- domain, content, design-system, and lib boundaries exist;
- a minimal test harness exists and `npm run test` passes;
- no persistence, analytics, backend behavior, or flow engine behavior is introduced.
