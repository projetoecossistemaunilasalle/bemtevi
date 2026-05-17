# Frontend Foundation Critique

Original review of the state after commit `87234c9` (Fronts 01-04 implementation).

Current status refreshed during the 2026-05-16 documentation audit.

---

## Status Summary

| # | Issue | Current status | Current difficulty |
|---|---|---|---|
| 1 | "Como funciona" duplicated onboarding | Resolved in current `HomeScreen` | Easy if it regresses |
| 2 | Missing Portuguese special characters | Mostly resolved in source content; manifest description still has `Orientacao` | Easy |
| 3 | Immediate support action uses alarming icon | Still open: Home uses `AlertCircle` with amber treatment | Easy |
| 4 | Breathing exercise lacks visual treatment | Resolved: dedicated animated `BreathingExercise` exists | Medium if redesigned |
| 5 | Chat input floats mid-screen | Resolved: composer is fixed near viewport bottom | Medium if layout changes |
| 6 | Education tab missing from bottom nav | Resolved: `Estudos` tab exists in bottom navigation | Easy if route/nav changes |

---

## 1. "Como funciona" section duplicated onboarding

**Original file:** `src/features/home/HomeScreen.tsx`

**Current status:** Resolved.

The current Home screen keeps the page focused on trust, the privacy reassurance, and three main action paths. The app-style starting screen remains the explanation layer.

Guardrail: do not reintroduce a regular visible "Como funciona" section on Home while onboarding exists as the first-run explanation.

---

## 2. Missing special characters across Portuguese text

**Original files:** `src/content/copy/home.ts`, `src/content/support/contacts.ts`, `src/content/services/canoas-services.ts`, `src/features/support/SupportScreen.tsx`, `src/features/orientation/OrientationScreen.tsx`, `src/features/education/EducationLibraryScreen.tsx`, `src/features/privacy/PrivacyScreen.tsx`

**Current status:** Mostly resolved.

The source content and visible screen copy now use PT-BR accents in the inspected files. One remaining small issue is `public/manifest.webmanifest`, whose description still says `Orientacao` without accent.

Recommended next action: fix manifest description when touching PWA metadata.

---

## 3. "Não estou bem agora" button uses an alarming icon

**File:** `src/features/home/HomeScreen.tsx`

**Current status:** Open.

The immediate support action still uses an `AlertCircle` icon with an amber fill. That symbol can feel more like danger/alert than warm support.

Recommended next action: switch to a calmer icon/treatment, such as a heart/helping-hands style already consistent with the support route. Also reconsider whether the action label should remain as direct as it is or become softer.

---

## 4. "Respire por um momento" section lacks visual treatment

**Original file:** `src/features/support/SupportScreen.tsx`

**Current status:** Resolved.

The support screen now uses `src/design-system/components/BreathingExercise.tsx`, with animated breathing phases, countdown, and start/stop behavior.

Guardrail: keep breathing as a first-care action with clear instructions, not decorative filler.

---

## 5. Chat input floats in the middle of the screen

**Original file:** `src/features/orientation/OrientationScreen.tsx`

**Current status:** Resolved.

The composer is now fixed near the bottom of the viewport, with suggestions positioned above it. This matches the intended chat surface better than the previous flex/sticky behavior.

Guardrail: if the orientation layout changes, verify desktop and mobile viewport behavior.

---

## 6. "Estudos" tab missing from bottom navigation

**Original file:** `src/app/shell/BottomNav.tsx`

**Current status:** Resolved.

The bottom navigation now has five items: Início, Orientação, Estudos, Contatos, Apoio.

Guardrail: keep `/educacao` reachable from primary navigation unless product/design intentionally changes the information architecture.

---

## Open Follow-Ups

- Replace or soften the Home immediate-support icon treatment.
- Align privacy copy with the onboarding `localStorage` flag.
- Fix the manifest description accent.
- Keep seed support, service, and education content marked as reviewable until clinical/editorial review is complete.
