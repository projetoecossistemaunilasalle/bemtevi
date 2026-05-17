# SeCuida-Prototipo — AI Agent Repository Context

> Purpose: Give an AI coding/review agent enough current repository context to work safely, recognize architectural drift, and evaluate code changes without relying on tribal knowledge.
>
> Scope: This guide describes the repository as it exists now. It is descriptive, not a refactor plan.
>
> Last audited: 2026-05-16.

---

## 1. Product Frame

**SeCuida** is a front-end prototype for educator mental-health support in Portuguese. The experience presents itself as:

- a safe, anonymous-by-default support space;
- a fast path for immediate distress support;
- a deterministic guided orientation flow;
- curated educational resources;
- a local support network view for Canoas, RS;
- a privacy explanation surface.

The current app is best understood as a routed, content-driven front-end prototype rather than a production service. There is no repository-visible backend, API integration, authentication, analytics provider, saved questionnaire history, saved chat transcript, or location access.

Privacy caveat: first-visit onboarding completion is currently remembered with `localStorage` in `src/features/home/firstVisit.ts`. This is not sensitive answer storage, but it is still persistence and should be reviewed under the Privacy/LGPD front before stronger privacy claims are made.

---

## 2. Runtime and Tooling

| Concern | Current shape |
|---|---|
| App framework | React with Vite |
| Language | TypeScript/TSX |
| Routing | React Router |
| Styling | Tailwind CSS v4 through `@tailwindcss/vite`, plus custom design tokens |
| Animation | `motion/react` |
| Icons | `lucide-react` |
| Unit/component tests | Vitest, Testing Library, jsdom |
| Entry command | `pnpm run dev` |
| Type/lint command | `pnpm run lint`, implemented as `tsc --noEmit` |
| Test command | `pnpm run test` |
| Build command | `pnpm run build` |
| Deployment hint | Vite `base` is `/SeCuida-Prototipo/`, suggesting GitHub Pages/subpath deployment |

The package is private, named `react-example`, and uses pnpm. A GitHub Pages deployment workflow exists under `.github/workflows/deploy.yml`.

---

## 3. Top-Level Structure

```txt
.
├── README.md
├── index.html
├── package.json
├── public
│   ├── icon.svg
│   ├── hands_holding_plant.png
│   └── manifest.webmanifest
├── docs
├── src
│   ├── app
│   ├── content
│   ├── design-system
│   ├── domain
│   ├── features
│   ├── lib
│   ├── test
│   ├── main.tsx
│   └── index.css
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

### Root files

| File | Role |
|---|---|
| `README.md` | Product summary, current architecture summary, and local commands. |
| `package.json` | Scripts and dependency surface. |
| `vite.config.ts` | Vite config, React plugin, Tailwind plugin, root alias, and subpath base. |
| `vitest.config.ts` | Vitest/jsdom test configuration. |
| `tsconfig.json` | TypeScript compiler behavior. Uses bundler resolution, JSX React transform, no emit, and root alias mapping. |
| `index.html` | Root HTML shell with `#root`, `lang="pt-BR"`, theme color, and manifest link. |
| `public/manifest.webmanifest` | Basic PWA manifest scoped to `/SeCuida-Prototipo/`. |

---

## 4. Source Structure

| Folder | Role |
|---|---|
| `src/app` | App providers, error boundary, route constants, router, and shell. |
| `src/app/shell` | Top bar, bottom navigation, route transition, scroll restoration, shell layout. |
| `src/features` | Product screens grouped by feature: home, orientation, support, contacts, education, privacy. |
| `src/content` | Structured product content for copy, flows, questionnaires, resources, services, and support contacts. |
| `src/domain` | React-independent domain types and logic. |
| `src/design-system` | Reusable UI primitives and design-system styles. |
| `src/lib` | Reserved/shared utilities such as geo and validation notes. |
| `src/test` | Test setup. |

Current public routes are centralized in `src/app/routes.ts`:

```txt
/
/orientacao
/apoio
/contatos
/educacao
/educacao/:resourceId
/privacidade
```

When adding a new top-level screen, update route constants, router wiring, shell navigation if user-facing, and any global actions that should point to it.

---

## 5. Navigation and App Shell

The app uses `BrowserRouter` with `basename={import.meta.env.BASE_URL}` so the GitHub Pages subpath works locally and in production builds.

The shell owns:

- desktop top navigation;
- mobile bottom navigation;
- route transitions;
- scroll-to-top behavior;
- shared layout around routed screens.

The old local `currentView` model has been replaced by route state. Avoid reintroducing custom screen-state navigation for top-level screens.

---

## 6. Feature Responsibilities

### Home

Files:

- `src/features/home/HomeScreen.tsx`
- `src/features/home/OnboardingScreen.tsx`
- `src/features/home/firstVisit.ts`
- `src/content/copy/home.ts`

Primary role: trust-building entry point and app-style onboarding. Home should remain actionable and avoid duplicating a visible "Como funciona" section when onboarding already carries the explanation layer.

Current caution: `firstVisit.ts` persists onboarding completion with `localStorage`. This should be treated as a Privacy/LGPD decision point.

### Immediate Support

Files:

- `src/features/support/SupportScreen.tsx`
- `src/content/support/contacts.ts`
- `src/design-system/components/SupportContactCard.tsx`
- `src/design-system/components/BreathingExercise.tsx`

Primary role: calm immediate support surface with CVV, SAMU, Bombeiros, direct phone actions, and a breathing exercise. The screen should avoid red-first or alarmist visual language.

### Orientation

Files:

- `src/features/orientation/OrientationScreen.tsx`
- `src/domain/flow-engine/*`
- `src/content/flows/*`

Primary role: constrained chat-like guided orientation. The UI must not imply real AI or free-text understanding. User submission is limited to exact predefined options or global actions.

Implemented domain behavior includes:

- flow validation;
- initial flow loading;
- option resolution;
- deterministic advancement;
- flow suspension/resumption;
- safety-rule helpers;
- tests for engine behavior.

### Contacts

Files:

- `src/features/contacts/ContactsScreen.tsx`
- `src/content/services/canoas-services.ts`
- `src/domain/services/types.ts`
- `src/design-system/components/ServiceCard.tsx`

Primary role: local support directory, initially seeded for Canoas, RS. The model includes city/state and review metadata so the app should not become architecturally Canoas-only.

### Education

Files:

- `src/features/education/EducationLibraryScreen.tsx`
- `src/features/education/ResourceDetailScreen.tsx`
- `src/content/resources/resources.ts`
- `src/domain/resources/types.ts`

Primary role: curated educational resource library and detail view. Current content is early seed content and should remain reviewable.

### Privacy

Files:

- `src/features/privacy/PrivacyScreen.tsx`
- `src/domain/privacy/README.md`

Primary role: explain current session/privacy stance. The displayed claim that the app uses only in-memory state for the current interaction conflicts with the onboarding `localStorage` flag unless that flag is explicitly carved out and approved.

---

## 7. Domain and Content Model

Content is no longer hidden primarily inside JSX. The repository now has typed content collections:

| Content type | Current location |
|---|---|
| Home copy | `src/content/copy/home.ts` |
| Emergency/support contacts | `src/content/support/contacts.ts` |
| Local services | `src/content/services/canoas-services.ts` |
| Education resources | `src/content/resources/resources.ts` |
| Guided flows | `src/content/flows/*` |
| SRQ-20 questionnaire | `src/content/flows/srq20.json` |

Shared metadata appears through `src/domain/content/types.ts`, including locale, status, version, and review metadata.

Most visible health/resource/service content is still marked `draft` or `pending_review`. Treat this as intentional until clinical/editorial review says otherwise.

---

## 8. Guided Flow Framework

The guided flow framework is implemented as TypeScript data plus pure runtime helpers.

Important files:

- `src/domain/flow-engine/types.ts`
- `src/domain/flow-engine/validateFlow.ts`
- `src/domain/flow-engine/loadFlows.ts`
- `src/domain/flow-engine/resolveOptions.ts`
- `src/domain/flow-engine/advanceFlow.ts`
- `src/domain/flow-engine/suspendFlow.ts`
- `src/domain/flow-engine/resumeFlow.ts`
- `src/domain/flow-engine/safetyRules.ts`
- `src/content/flows/registry.ts`

Current product flows include `work-stress` and `rest-recovery`.

Guardrails:

- no free-text interpretation;
- no fake-AI framing;
- no saved transcripts;
- current node answers should remain visually dominant;
- global actions can exist, but should not crowd the conversational choices.

---

## 9. Questionnaire Framework

Questionnaire-specific domain logic exists under `src/domain/questionnaires`.

Implemented behavior includes:

- questionnaire types;
- validation;
- scoring;
- result resolution;
- safety interruption checks;
- tests.

`src/content/flows/srq20.json` defines the SRQ-20 questionnaire as JSON guided-flow content with consent copy, 20 questions, scoring effects, threshold score branch, result copy, and a Q17 safety interrupt effect. It is discovered dynamically by the flow registry via `import.meta.glob`.

Current limitation: SRQ-20 is modeled and tested, but should be checked in the UI before considering the questionnaire front complete.

---

## 10. Styling and Design System

Styling is split between:

- Tailwind v4 theme and utilities in `src/index.css`;
- design-system notes/styles under `src/design-system/styles`;
- reusable components under `src/design-system/components`.

Current reusable primitives include:

- `ActionCard`
- `Badge`
- `BreathingExercise`
- `Button`
- `Card`
- `Page`
- `PageHeader`
- `ServiceCard`
- `SupportContactCard`

When adding UI, prefer these primitives and semantic tokens before adding one-off card/button styles.

---

## 11. Accessibility and Semantics Inventory

Current semantic anchors:

- routed screens generally render through page/main layout primitives;
- mobile bottom nav and desktop top nav use route links;
- support phone actions use `tel:` anchors;
- orientation history uses a `role="log"` region;
- orientation suggestions use listbox/option semantics;
- breathing exercise has explicit interactive start/stop control.

Areas to inspect carefully when changing related code:

- keyboard flow in the constrained chat composer;
- focus treatment for custom-looking controls;
- route labels and active nav state;
- support-contact call-to-action clarity;
- screen-reader text around sensitive questionnaire results;
- privacy copy that could overstate implementation guarantees.

---

## 12. PWA and Deployment

`vite.config.ts` sets:

```ts
base: '/SeCuida-Prototipo/'
```

The manifest also uses `/SeCuida-Prototipo/` for `start_url`, `scope`, and icon path.

Current PWA status:

- manifest: present;
- theme color: present;
- icon: SVG present;
- install/offline service worker strategy: not identified in the current source.

Avoid assuming root-hosted `/` deployment unless the base path is intentionally changed.

---

## 13. Validation Surface

Available repository-visible validation:

```bash
pnpm run lint
pnpm run test
pnpm run build
```

As of the 2026-05-16 audit, all three commands pass:

- 5 Vitest files;
- 53 tests;
- successful production build.

There is no obvious repo-wide content validation script yet. Domain validators exist and can be reused by future validation tooling.

---

## 14. Current Known Non-Goals and Boundaries

The current codebase does not model:

- authenticated users;
- saved answers;
- saved chat transcripts;
- server communication;
- geolocation permission or location sorting;
- analytics providers;
- push notifications;
- backend-driven content editing;
- admin dashboard implementation.

The app does include one non-sensitive persistence behavior: the onboarding-seen flag in `localStorage`. Keep this visible until Privacy/LGPD review decides whether it stays, moves to memory-only behavior, or gets explicit disclosure.

Analytics policy note: `docs/fronts/12b-anonymous-analytics-lgpd-policy.md` documents the future allowed shape for aggregate analytics and explicitly treats Google Analytics as not approved for MVP.

---

## 15. Known Open Review Items

From `docs/reviews/frontend-foundation-critique.md`, several items have been addressed, including education in bottom nav, Portuguese accents across most source content, the breathing exercise visual treatment, and the fixed orientation composer.

Open or partially open items:

- Home still uses an `AlertCircle` icon for the immediate support action, which may feel too alarming.
- `public/manifest.webmanifest` still has `Orientacao` without accent in its description.
- Privacy copy and onboarding persistence need alignment.
- Clinical/editorial review metadata is still pending for seed content.

---

## 16. Agent Change Heuristics

Before editing, classify the change by layer:

| Change type | First files to inspect |
|---|---|
| New route/top-level screen | `src/app/routes.ts`, `src/app/router.tsx`, `src/app/shell/*`, relevant `src/features/*` |
| Navigation wording or route behavior | `src/app/shell/*`, `src/app/routes.ts` |
| Home/onboarding behavior | `src/features/home/*`, `src/content/copy/home.ts` |
| Support contact or crisis copy | `src/features/support/*`, `src/content/support/contacts.ts` |
| Guided orientation flow | `src/features/orientation/*`, `src/domain/flow-engine/*`, `src/content/flows/*` |
| Questionnaire/SRQ-20 behavior | `src/domain/flow-engine/*`, `src/content/flows/srq20.json` |
| Local directory data | `src/content/services/canoas-services.ts`, `src/domain/services/types.ts` |
| Education resources | `src/content/resources/resources.ts`, `src/features/education/*` |
| Color/spacing/type changes | `src/index.css`, `src/design-system/*`, then affected JSX |
| Build/deploy path | `vite.config.ts`, `public/manifest.webmanifest`, `.github/workflows/deploy.yml` |
| Privacy/session behavior | `src/features/privacy/*`, `src/features/home/firstVisit.ts`, `src/domain/privacy/README.md` |

Before merging a change, compare it against these contracts:

1. Can the change run without a backend?
2. Does it preserve the subpath deployment assumption?
3. Does it keep the app Portuguese-first?
4. Does it respect the safety tone around mental-health support?
5. Does it preserve constrained, deterministic flow behavior?
6. Does it avoid saving sensitive answers, transcripts, location, or analytics?
7. Does it add content that should include review metadata?
8. Does it introduce a remote resource with unknown lifetime?
9. Does `pnpm run lint` still pass?
10. Do `pnpm run test` and `pnpm run build` still pass when behavior changes?

---

## 17. Mental Model for Review

Read the repository as five layers:

```txt
Vite/React bootstrap
  -> App router and shell
    -> Feature screens
      -> Typed content and domain engines
        -> Tailwind/design-system primitives
```

Code that crosses several of these layers deserves extra attention. Code that adds health, support, questionnaire, service, or resource content should be reviewed with the same care as logic, because the product's trustworthiness depends heavily on accuracy and tone.
