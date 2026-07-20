# Front 07A — Home, Philosophy & Onboarding Breakdown

## Purpose

This document breaks down the seventh implementation task for BemTeVi.

It is derived from:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/07-home-philosophy-onboarding.md`
- `docs/fronts/04a-content-data-modeling-breakdown.md`
- `docs/fronts/11-privacy-lgpd-session.md`

The goal is to make Home clearly explain BemTeVi's purpose, privacy posture, non-diagnostic nature, and main paths without creating persistence or a clinical intake feel.

---

## Current State

The prototype Home introduces confidentiality and three user choices. The app-style starting screen now carries the onboarding explanation, so Home should stay focused on trust and next actions instead of repeating a “Como funciona” section.

After Front 04A, Home copy may already live in `src/content/copy/home.ts`.

---

## Target Home Structure

1. warm welcome;
2. short philosophy statement;
3. privacy/trust strip;
4. three equal-weight entry paths;
5. quiet links to privacy and education content if they are distinct from onboarding.

Home should answer what BemTeVi is, whether it is anonymous, whether it is diagnostic, and what the user can do next.

Guardrail: do not add `howItWorksTitle`, `howItWorksItems`, a `HowItWorks` component, or a visible “Como funciona” Home section while the app-style starting screen exists. The starting screen already explains how BemTeVi works.

---

## Onboarding Policy

Do not implement one-time onboarding persistence in this front.

Recommended first version:

- keep onboarding in the app-style starting screen;
- do not duplicate onboarding as a regular Home section;
- no `localStorage` completion flag;
- no cookies;
- no account or backend state;
- revisit persistence only after Privacy/LGPD policy approval.

---

## Implementation Slices

### PR 07A — Revise Home Content Model

Scope:

1. expand `src/content/copy/home.ts` with philosophy, trust strip, and entry paths;
2. add metadata/review fields where appropriate;
3. keep copy Portuguese-first and non-clinical.

Acceptance criteria:

- Home copy is content-driven;
- copy does not imply diagnosis or therapy;
- privacy claims are careful and not stronger than documented policy.

### PR 07B — Rebuild Home Layout

Scope:

1. render the stronger Home structure;
2. keep three primary paths equal-weight;
3. use design-system primitives from Front 03A;
4. preserve route targets for orientation, contacts, and support access.

Acceptance criteria:

- Home explains purpose within seconds;
- entry paths remain easy to tap on mobile;
- immediate support remains available through persistent navigation;
- no alarming visual hierarchy is introduced.

### PR 07C — Keep Onboarding Explanation Out Of Home

Scope:

1. keep the onboarding explanation in the app-style starting screen;
2. do not add a duplicate “Como funciona” card/section to Home;
3. if repeat access is needed, add a separate help/onboarding route instead of crowding Home.

Acceptance criteria:

- Home has no “Como funciona” section when onboarding is enabled;
- Home copy model does not include `howItWorksTitle` or `howItWorksItems`;
- copy aligns with PRD privacy and safety principles.

---

## Files Expected To Change First

```txt
src/content/copy/home.ts
src/domain/copy/types.ts
src/features/home/HomeScreen.tsx
src/features/home/components/TrustStrip.tsx
src/features/home/components/HomeEntryPaths.tsx
src/tests/home/*.test.tsx
```

---

## Risks and Guardrails

### Risk: overstating privacy

Guardrail: say the app is designed to preserve privacy; avoid absolute claims unless backed by implemented policy.

### Risk: making support path feel hidden

Guardrail: keep immediate support persistently available and visible through bottom navigation.

### Risk: one-time onboarding persistence too early

Guardrail: do not save onboarding completion in this front.

---

## Validation Commands

```bash
npm run lint
npm run test
npm run build
```

---

## Definition of Done

Front 07A is done when Home clearly communicates BemTeVi's purpose, trust posture, non-diagnostic role, and main next steps through content-driven, mobile-first UI without introducing persistent onboarding state.
