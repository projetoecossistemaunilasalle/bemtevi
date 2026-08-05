# BemTeVi — Front Status Tracker

Last updated: 2026-05-22

## Legend

- **Done** — Fully implemented and tested
- **Partial** — Core functionality exists, but gaps remain
- **Shell** — Screen exists with minimal/placeholder content
- **Blocked** — Cannot proceed without external dependency
- **Not Started** — No implementation yet

---

## Completed Fronts

### 01 — App Architecture & PWA — Done

React Router with 7 routes, AppShell (TopBar + BottomNav), PWA manifest, Vite config for GitHub Pages deployment. Service worker via `vite-plugin-pwa` with precache for full offline support.

### 02 — Readable Folder Structure — Done

Feature-based layout: `src/app/`, `src/features/`, `src/content/`, `src/domain/`, `src/design-system/`, `src/lib/`, `src/test/`.

### 03 — Design System & UI Primitives — Done

9 reusable components (ActionCard, Badge, BreathingExercise, Button, Card, Page, PageHeader, ServiceCard, SupportContactCard). Design tokens in `src/index.css`.

### 04 — Content/Data Modeling — Done

Domain types for content metadata, copy, support contacts, services, resources, and flow engine. All content in `src/content/`. Flow registry includes neutral routing flows (`neutral.ts`), TS flows (`work-stress.ts`, `rest-recovery.ts`), and auto-discovered JSON flows.

### 05 — Guided Flow Engine — Done

Full flow engine: `advanceFlow`, `resolveOptions`, `loadFlows`, `suspendFlow`, `resumeFlow`, `safetyRules`, `validateFlow`, `parseFlow`. 2 TS flows registered (work-stress, rest-recovery). JSON flow auto-discovery via `import.meta.glob`. Neutral routing flows with `flow_start`, `navigate`, and `end_flow` effects. Post-flow routing after regular result nodes. Exhaustive effect-kind validation.

### 06 — Questionnaire Framework & SRQ-20 — Done

SRQ-20 implemented as a JSON guided flow (`src/content/flows/srq20.json`). Generic effects include score, `deferred_safety`, and score branching. Q17 affirmative records priority support routing, allows Q18-Q20 to continue, and navigates to `/apoio` after completion. Adding new questionnaires means adding validated flow content.

### 07 — Home & Onboarding — Done

4-step swipe carousel, localStorage persistence (`bemtevi:onboarding-seen`), trust cards, 3 action cards on home.

---

## Partially Implemented / Needs Work

### 08 — Immediate Support Screen — Partial

**What exists:** Breathing exercise (animated circles, 4-2-6 timing), crisis contacts (CVV 188, SAMU 192, Bombeiros 193) with `tel:` links.

**What's missing:**

- Grounding messages / psychoeducational content
- Enhanced support paths beyond breathing + phone calls

**Blocker:** Content must come from the client (psychology professionals). We are not qualified to write grounding exercises or therapeutic guidance. Current flows are either experimental or provided by the client (e.g., SRQ-20).

**Complexity:** Medium (implementation) | Low (if client provides content)

---

### 09 — Contacts Directory — Partial

**What exists:** Published contacts render as ServiceCards with managed city grouping, manual city filtering, optional approximate on-device city lookup, responsive layout, and dashboard editing.

**What's missing:**

- Filtering by service type
- Search functionality

**Blocker:** The client has not decided on the phone number strategy. Two options under consideration:

1. Direct numbers to each service location
2. Central numbers through the health secretary of each city

The directory can evolve independently of the phone number decision; current contacts remain reviewable content.

**Complexity:** Medium

---

### 10 — Education Library — Shell

**What exists:** `EducationLibraryScreen` renders resource cards. `ResourceDetailScreen` exists but is explicitly a stub (placeholder text). 1 seed resource (FEEVALE emotional regulation guide) with a fragile external Google-hosted image URL.

**What's missing:**

- Real curated content (multiple resources across categories)
- Functional detail screen with actual resource rendering
- Local asset strategy (replace remote image dependency)

**Blocker:** Same as Front 08 — educational/psychoeducational content must come from qualified professionals. We cannot write this content ourselves.

**Complexity:** Medium-High (implementation) | Low (if client provides content)

---

## Blocked / External Dependencies

### 11 — Privacy & LGPD — Policy aligned

**What exists:** Privacy wording explains that no personal identification is requested, answers/scores/transcripts stay in memory, and `localStorage` stores only `bemtevi:onboarding-seen="true"`.

**Remaining review:** Legal/LGPD review may refine policy wording, but there is no longer a code/documentation contradiction about the onboarding preference.

**Complexity:** High (depends on legal requirements)

---

### 12 — Anonymous Analytics — Blocked by 11

**What exists:** Policy document only (`docs/fronts/12b-anonymous-analytics-lgpd-policy.md`). No code.

**Blocker:** Cannot implement until Front 11 (Privacy/LGPD) is resolved. The analytics taxonomy, disclosure requirements, and consent flow all depend on the privacy framework.

**Complexity:** Medium (once unblocked)

---

## Ready to Work

### 13 — Quality, Validation & Tooling — Partial

**What exists:** Explicit TypeScript checking, ESLint, Prettier, Vitest, content/flow validation CLI, route/content/design-system smoke coverage, and a `pnpm run check` merge gate used by CI.

**What's missing:**

- Storybook setup
- Deeper accessibility automation beyond current smoke/accessibility-oriented tests

**Blocker:** None — can be worked on now.

**Complexity:** Medium

---

### 14 — Dashboard Readiness — Not Started

**What exists:** Domain types as groundwork. Documentation only.

**What's missing:**

- Everything — this is a documentation/future-planning front
- Data export interfaces
- Admin-facing views
- Content management strategy

**Blocker:** None — logical next step after Front 13. Should be planned once quality tooling is in place.

**Complexity:** High

---

## Suggested Priority Order

| Priority | Front                                 | Rationale                                                     |
| -------- | ------------------------------------- | ------------------------------------------------------------- |
| 1        | 13 — Quality & Tooling                | No blockers, improves everything else                         |
| 2        | 14 — Dashboard Readiness              | Natural follow-up to 13                                       |
| 3        | 08, 09, 10 — Content-dependent fronts | Ready to implement once client provides content and decisions |
| 4        | 11 — Privacy & LGPD                   | Needs legal input                                             |
| 5        | 12 — Analytics                        | Blocked by 11                                                 |

---

## Open Decisions (Client Input Needed)

1. **Grounding/therapeutic content** for Fronts 08 and 10 — must come from psychology professionals
2. **Phone number strategy** for Front 09 — direct numbers vs. central health secretary numbers
3. **Legal review** for Front 11 — LGPD compliance, localStorage usage, privacy policy wording
4. **Privacy wording review** — keep future copy aligned with the documented onboarding preference and in-memory session behavior
