# SeCuida — Front Status Tracker

Last updated: 2026-05-16

## Legend

- **Done** — Fully implemented and tested
- **Partial** — Core functionality exists, but gaps remain
- **Shell** — Screen exists with minimal/placeholder content
- **Blocked** — Cannot proceed without external dependency
- **Not Started** — No implementation yet

---

## Completed Fronts

### 01 — App Architecture & PWA — Partial

React Router with 7 routes, AppShell (TopBar + BottomNav), PWA manifest, Vite config for GitHub Pages deployment.

**What's missing:**
- Service worker for offline support and true PWA installability (manifest exists but no `vite-plugin-pwa` or custom SW)

**Ready to start** — no blockers, can be implemented with `vite-plugin-pwa`.

### 02 — Readable Folder Structure — Done

Feature-based layout: `src/app/`, `src/features/`, `src/content/`, `src/domain/`, `src/design-system/`, `src/lib/`, `src/test/`.

### 03 — Design System & UI Primitives — Done

9 reusable components (ActionCard, Badge, BreathingExercise, Button, Card, Page, PageHeader, ServiceCard, SupportContactCard). Design tokens in `src/index.css`.

### 04 — Content/Data Modeling — Done

Domain types for content metadata, copy, support contacts, services, resources, and flow engine. All content in `src/content/`.

### 05 — Guided Flow Engine — Done

Full flow engine: `advanceFlow`, `resolveOptions`, `loadFlows`, `suspendFlow`, `resumeFlow`, `safetyRules`, `validateFlow`, `parseFlow`. 2 TS flows registered (work-stress, rest-recovery). JSON flow auto-discovery via `import.meta.glob`.

### 06 — Questionnaire Framework & SRQ-20 — Done

SRQ-20 implemented as JSON guided flow (`src/content/flows/srq20.json`). Generic effects (score, safety_interrupt, score_branch). Consent handling, Q17 safety interrupt, score branching (0-6 low, 7-20 possible distress). Adding new questionnaires = dropping a `.json` file.

### 07 — Home & Onboarding — Done

4-step swipe carousel, localStorage persistence (`secuida:onboarding-seen`), trust cards, 3 action cards on home.

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

**What exists:** 3 Canoas RS services rendered as ServiceCards (CAPS II, UBS Centro, Clinica Escola Ulbra). Responsive grid layout.

**What's missing:**
- Filtering by service type
- Search functionality
- Location-based sorting

**Blocker:** The client has not decided on the phone number strategy. Two options under consideration:
1. Direct numbers to each service location
2. Central numbers through the health secretary of each city

Cannot finalize the directory structure or filtering logic until this decision is made.

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

### 11 — Privacy & LGPD — Blocked

**What exists:** Static privacy card saying the app uses only in-memory state. Domain folder reserved with "do not touch" README.

**Known problem:** The privacy screen claims "no localStorage" but `firstVisit.ts` actually uses it (`secuida:onboarding-seen`). This contradiction is documented but unresolved.

**Blocker:** Needs legal grounding. A lawyer or LGPD specialist must review what the app can/cannot do before we implement any privacy logic, consent management, or data handling.

**Complexity:** High (depends on legal requirements)

---

### 12 — Anonymous Analytics — Blocked by 11

**What exists:** Policy document only (`docs/fronts/12b-anonymous-analytics-lgpd-policy.md`). No code.

**Blocker:** Cannot implement until Front 11 (Privacy/LGPD) is resolved. The analytics taxonomy, disclosure requirements, and consent flow all depend on the privacy framework.

**Complexity:** Medium (once unblocked)

---

## Ready to Work

### 13 — Quality, Validation & Tooling — Partial

**What exists:** Vitest configured, 4 test files (55 tests passing). Content validators in domain layer. CI runs lint + test on push.

**What's missing:**
- ESLint configuration
- Prettier configuration
- Storybook setup
- Accessibility testing (axe-core or similar)
- Repo-wide content validation CLI script

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

| Priority | Front | Rationale |
|----------|-------|-----------|
| 1 | 13 — Quality & Tooling | No blockers, improves everything else |
| 2 | 14 — Dashboard Readiness | Natural follow-up to 13 |
| 3 | 08, 09, 10 — Content-dependent fronts | Ready to implement once client provides content and decisions |
| 4 | 11 — Privacy & LGPD | Needs legal input |
| 5 | 12 — Analytics | Blocked by 11 |

---

## Open Decisions (Client Input Needed)

1. **Grounding/therapeutic content** for Fronts 08 and 10 — must come from psychology professionals
2. **Phone number strategy** for Front 09 — direct numbers vs. central health secretary numbers
3. **Legal review** for Front 11 — LGPD compliance, localStorage usage, privacy policy wording
4. **localStorage contradiction** — privacy screen says "no persistence" but onboarding uses it; needs resolution
