# Front 03A — Design System Breakdown

## Purpose

This document breaks down the third implementation task for BemTeVi.

It is derived from the current repository state on the `develop` branch and from the following project documents:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/README.md`
- `docs/fronts/03-design-system-ui.md`
- `docs/fronts/02a-folder-structure-breakdown.md`

The goal is to preserve the current calm visual direction while extracting reusable UI primitives that reduce duplication and improve accessibility.

---

## Current State

The current prototype defines tokens in `src/index.css` and uses Tailwind utility classes directly inside screen components.

Current design assets include:

- green primary identity: `#006a43`;
- soft app background: `#f9f9ff`;
- blue secondary support color: `#425e91`;
- accessible font direction with Atkinson Hyperlegible Next and Source Sans 3;
- repeated rounded cards, action buttons, support cards, phone links, and navigation buttons.

The visual direction is usable, but repeated styles are embedded in feature screens. That makes later screens more likely to invent new card, button, spacing, and focus patterns.

---

## Target Design System

Front 03A should create a small practical design system, not a comprehensive component library.

Initial folders:

```txt
src/design-system/
  components/
  forms/
  feedback/
  styles/
```

Initial components should be extracted only from patterns already present in the app or needed immediately by routed placeholders.

---

## Token Model

Keep Tailwind v4 and the current `@theme` token approach.

Move design token organization toward:

```txt
src/design-system/styles/tokens.css
src/index.css
```

`src/index.css` should remain the global stylesheet imported by `src/main.tsx`. Before moving the Tailwind v4 `@theme` block into `tokens.css`, verify that `@theme` values are still picked up through CSS imports by the current Vite/Tailwind pipeline. If that is not verified, keep `@theme` in `src/index.css` and use `tokens.css` only for non-`@theme` notes or future custom properties.

Core token values to preserve:

```txt
--color-background: #f9f9ff
--color-primary: #006a43
--color-secondary: #425e91
--color-error: #ba1a1a
```

Do not rename tokens in a way that forces unrelated screen churn. A semantic cleanup can be incremental.

---

## Initial Component Set

Extract the smallest component set that removes real duplication:

```txt
Button
Card
Badge
Page
PageHeader
ActionCard
SupportContactCard
ServiceCard
```

Defer these until their owning fronts need them:

```txt
Combobox
OptionChip
ChatBubble
ChatTranscript
ResourceCard
BreathingExerciseCard
```

This keeps the design system grounded in actual screens and avoids speculative abstractions.

Do not create `src/design-system/chat/` in this front unless chat primitives are actually implemented. Chat UI belongs to Front 05.

---

## Component Responsibilities

| Component            | Responsibility                                                |
| -------------------- | ------------------------------------------------------------- |
| `Button`             | Shared button variants, sizes, focus states, disabled state   |
| `Card`               | Common surface, border, radius, and shadow treatment          |
| `Badge`              | Small labels such as CAPS, UBS, FEEVALE                       |
| `Page`               | Consistent page padding, max width, and mobile bottom spacing |
| `PageHeader`         | Reusable heading/subheading pattern                           |
| `ActionCard`         | Home entry path buttons/cards                                 |
| `SupportContactCard` | CVV/SAMU/Bombeiros support cards                              |
| `ServiceCard`        | Contact directory service cards                               |

Components should accept plain React children where practical and avoid encoding product content directly.

---

## Accessibility Rules

All extracted primitives should support:

- visible focus states;
- keyboard activation through native elements;
- accessible names for icon buttons and icon-leading links;
- minimum 44px touch targets for interactive controls;
- text that can wrap without overlapping icons or controls.

Icons should not be the only carrier of meaning.

---

## Visual Guardrails

Preserve the current calm direction:

- white or soft surfaces dominate;
- green is primary;
- blue supports guidance and credibility;
- immediate support does not become red-first;
- cards use restrained radius and shadows;
- no decorative gradient orbs or purely ornamental backgrounds.

Remote generated image URLs should not be expanded. Existing remote images can remain temporarily, but this front should not introduce new fragile remote image dependencies.

---

## Implementation Slices

### PR 03A — Create Tokens And Base Primitives

Scope:

1. create `src/design-system/styles/tokens.css`;
2. verify whether Tailwind v4 `@theme` works correctly across the planned CSS import boundary;
3. create `Button`, `Card`, `Badge`, `Page`, and `PageHeader`;
4. document supported variants in code comments or a small README;
5. update one low-risk screen to prove the primitives work;
6. move `@theme` tokens only if the verification passes; otherwise keep them in `src/index.css`.

Acceptance criteria:

- current colors and typography remain visually recognizable;
- Tailwind theme classes still resolve after any token organization change;
- primitives compile with TypeScript;
- focus states are visible;
- no screen loses mobile spacing or bottom navigation clearance.

### PR 03B — Extract Home And Shell Patterns

Scope:

1. refactor Home entry actions into `ActionCard`;
2. use `Page`/`PageHeader` in Home where appropriate;
3. align TopBar and BottomNav styling with shared primitives only where it reduces duplication;
4. preserve route behavior from Front 01A.

Acceptance criteria:

- Home screen no longer owns repeated action-card styling;
- entry actions still navigate to the correct routes;
- active nav state remains route-driven;
- user-facing copy does not change unless needed for accessibility.

### PR 03C — Extract Support And Contact Cards

Scope:

1. create `SupportContactCard`;
2. create `ServiceCard`;
3. refactor support and contacts screens to use the shared cards;
4. keep all phone links as real `tel:` anchors.

Acceptance criteria:

- CVV, SAMU, and Bombeiros cards use one shared card component;
- contact directory cards use one shared card component;
- phone links remain visible, large, and accessible;
- no content is moved to JSON in this PR unless Front 04A is being implemented at the same time.

---

## Files Expected To Change First

```txt
src/index.css
src/design-system/styles/tokens.css
src/design-system/components/Button.tsx
src/design-system/components/Card.tsx
src/design-system/components/Badge.tsx
src/design-system/components/Page.tsx
src/design-system/components/PageHeader.tsx
src/design-system/components/ActionCard.tsx
src/design-system/components/SupportContactCard.tsx
src/design-system/components/ServiceCard.tsx
src/features/home/HomeScreen.tsx
src/features/support/SupportScreen.tsx
src/features/contacts/ContactsScreen.tsx
```

---

## Risks and Guardrails

### Risk: overbuilding a design system before product screens exist

Guardrail: extract only repeated patterns already present in the app.

### Risk: changing the product mood

Guardrail: preserve the current green/blue/soft-surface direction and avoid red-first support treatment.

### Risk: hiding accessibility inside styling

Guardrail: primitives should use native interactive elements and expose labels where needed.

### Risk: moving content too early

Guardrail: this front may refactor visual structure, but content extraction belongs to Front 04A.

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

Front 03A is done when:

- core tokens are organized or intentionally left in `src/index.css` based on the Tailwind v4 import verification;
- base primitives exist and are used by at least one real screen;
- repeated Home, support, and contact card/button styles are reduced;
- focus and touch-target behavior are preserved or improved;
- no new fragile remote images are introduced;
- route behavior and product copy remain stable.
