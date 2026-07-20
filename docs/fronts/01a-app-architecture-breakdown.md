# Front 01A — App Architecture Breakdown

## Purpose

This document breaks down the first implementation task for the BemTeVi frontend architecture.

It is derived from the current repository state on the `develop` branch and from the following project documents:

- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/fronts/README.md`
- `docs/fronts/01-app-architecture-pwa.md`

The goal is to turn the current static React/Vite prototype into a route-based, mobile-first PWA foundation without introducing persistence, backend behavior, accounts, analytics, or privacy-sensitive storage.

---

## Current State

The current app is a static frontend prototype.

It currently has:

- React with Vite;
- TypeScript/TSX;
- Tailwind CSS v4;
- `motion/react` for animation;
- `lucide-react` for icons;
- no backend;
- no authentication;
- no persistence layer;
- no analytics;
- no routing system;
- no automated tests currently visible in the repo.

The app currently uses a single local state variable in `src/App.tsx` to switch between views:

```ts
'HOME' | 'EMERGENCY' | 'ASSESSMENT' | 'NETWORK';
```

This works for a prototype, but it prevents stable URLs, browser navigation, deep linking, route-level organization, and clean expansion into future product screens.

---

## Target Architecture

The first architecture step should move the app from this shape:

```txt
single App.tsx
  → local currentView state
  → conditional view rendering
```

To this shape:

```txt
PWA app shell
  → React Router routes
  → stable screens
  → reusable navigation
  → safe mobile-first layout
```

This should be done without changing the core product behavior yet.

---

## Route Model

Recommended public routes:

```txt
/
/orientacao
/apoio
/contatos
/educacao
/educacao/:resourceId
```

Initial implementation should add all public routes listed above. Existing screens should be wired where they already exist, and the remaining routes can use simple temporary placeholder screens until their dedicated fronts are implemented.

| Route                   | Existing View         | Purpose                                       |
| ----------------------- | --------------------- | --------------------------------------------- |
| `/`                     | `HomeView`            | Home, trust-building, entry actions           |
| `/orientacao`           | `AssessmentView`      | Current guided orientation prototype          |
| `/apoio`                | `EmergencyView`       | Immediate support screen                      |
| `/contatos`             | `NetworkView`         | Local support directory                       |
| `/educacao`             | Temporary placeholder | Education library route reserved for Front 10 |
| `/educacao/:resourceId` | Temporary placeholder | Resource detail route reserved for Front 10   |
| `/privacidade`          | Temporary placeholder | Privacy route reserved for Front 11           |

Important: avoid `/crise` as a public route. Use `/apoio` for the immediate support path.

---

## Proposed Folder Structure

Create an app-level architecture folder:

```txt
src/app/
  App.tsx
  router.tsx
  routes.ts
  providers.tsx
  shell/
    AppShell.tsx
    BottomNav.tsx
    TopBar.tsx
    RouteTransition.tsx
```

Recommended meaning of each file:

| File                                | Responsibility                                   |
| ----------------------------------- | ------------------------------------------------ |
| `src/app/App.tsx`                   | App-level composition and provider/router entry  |
| `src/app/router.tsx`                | Route definitions and route-to-view mapping      |
| `src/app/routes.ts`                 | Shared route constants                           |
| `src/app/providers.tsx`             | Future global providers; can be minimal at first |
| `src/app/shell/AppShell.tsx`        | Persistent app layout around routed screens      |
| `src/app/shell/TopBar.tsx`          | Desktop/top navigation and brand entry           |
| `src/app/shell/BottomNav.tsx`       | Mobile persistent bottom navigation              |
| `src/app/shell/RouteTransition.tsx` | Optional route transition wrapper                |

The current `src/views/*` files can remain in place during this first architecture step.

---

## Route Constants

Add route constants to avoid duplicated strings:

```ts
export const routes = {
  home: '/',
  orientation: '/orientacao',
  support: '/apoio',
  contacts: '/contatos',
  education: '/educacao',
  educationDetail: '/educacao/:resourceId',
  privacy: '/privacidade',
} as const;
```

These constants should be used by navigation components and programmatic navigation.

---

## Navigation Refactor

### Current behavior

`src/App.tsx` currently owns:

- current view state;
- desktop header;
- desktop navigation;
- mobile bottom navigation;
- conditional rendering of views.

### Target behavior

Navigation should use React Router:

- `NavLink` for active navigation state;
- `Link` for basic links;
- `useNavigate` for callback-based navigation from buttons inside views.

The app should not mix route state with custom `currentView` state.

---

## View Navigation Mapping

Current callback-style navigation should be replaced with route navigation.

| Current Action                  | Current Target | New Route     |
| ------------------------------- | -------------- | ------------- |
| Home: “Não estou bem agora”     | `EMERGENCY`    | `/apoio`      |
| Home: “Preciso de orientação”   | `ASSESSMENT`   | `/orientacao` |
| Home: “Ver rede de apoio local” | `NETWORK`      | `/contatos`   |
| Assessment handoff to network   | `NETWORK`      | `/contatos`   |
| Brand/home button               | `HOME`         | `/`           |

This means `HomeView` and `AssessmentView` should no longer receive `setView` props.

---

## App Shell Responsibilities

The app shell should own:

- persistent bottom navigation;
- optional top header;
- safe-area padding for mobile;
- route transition wrapper;
- app-wide layout width;
- global providers;
- future PWA install behavior if needed.

The app shell should not own product-specific flow state.

Flow state should stay inside the orientation/questionnaire layer until a formal flow engine is introduced.

---

## PWA Foundation

Minimum PWA files:

```txt
public/
  manifest.webmanifest
  icons/
    icon-192.png
    icon-512.png
    maskable-icon-512.png
```

Recommended manifest baseline:

```json
{
  "name": "BemTeVi",
  "short_name": "BemTeVi",
  "display": "standalone",
  "start_url": "/SeCuida-Prototipo/",
  "scope": "/SeCuida-Prototipo/",
  "theme_color": "#006a43",
  "background_color": "#f9f9ff"
}
```

The colors above match the current design tokens in `src/index.css`:

- `--color-primary: #006a43`
- `--color-background: #f9f9ff`

Use the current app icon direction for the PWA icons. The icon files should not be placeholders: officially download or export the app icon assets during this phase and commit the generated PNGs under `public/icons/`.

Because `vite.config.ts` currently sets:

```ts
base: '/SeCuida-Prototipo/';
```

PWA paths should respect GitHub Pages/subpath deployment.

Production fallback behavior for deep links is intentionally out of scope for this development slice. It can be handled when the app is prepared for production deployment.

---

## Document Metadata

Update `index.html`:

```html
<html lang="pt-BR"></html>
```

Add basic PWA metadata:

```html
<meta name="theme-color" content="#006a43" /> <link rel="manifest" href="%BASE_URL%manifest.webmanifest" />
```

Keep:

```html
<title>BemTeVi</title>
```

---

## Service Worker Strategy

Do not add complex offline behavior in this first slice.

Reason: BemTeVi has privacy-sensitive guided flows and future questionnaire behavior. PWA caching must not accidentally preserve questionnaire answers, chat transcripts, session state, location, or any other sensitive state.

First slice recommendation:

- add manifest installability first;
- avoid storing answers or flow state;
- avoid localStorage/sessionStorage for sensitive data;
- postpone service worker caching decisions until Privacy/LGPD review confirms the allowed policy.

Later, a conservative service worker may cache only static assets and the app shell.

---

## Implementation Slices

### PR 01A — Introduce Router + App Shell

Scope:

1. install `react-router-dom`;
2. create `src/app/routes.ts`;
3. create `src/app/router.tsx`;
4. create `src/app/shell/AppShell.tsx`;
5. extract `TopBar` and `BottomNav` from the current `src/App.tsx`;
6. replace `currentView` with route-based rendering;
7. update `src/main.tsx` to render the new app entry;
8. update view navigation callbacks to use routes;
9. add temporary placeholder screens for `/educacao`, `/educacao/:resourceId`, and `/privacidade`.

Acceptance criteria:

- React Router is installed;
- the app has stable routes for `/`, `/orientacao`, `/apoio`, `/contatos`, `/educacao`, `/educacao/:resourceId`, and `/privacidade`;
- direct URL access works for the implemented routes in the local development environment;
- browser back/forward works;
- bottom navigation active state reflects the current route;
- no `currentView` screen-switching state remains;
- no persistence is introduced;
- user-facing copy remains Portuguese-first and calm;
- existing visual shell remains recognizable.

### PR 01B — Add PWA Manifest + Metadata

Scope:

1. create `public/manifest.webmanifest`;
2. officially download or export the current app icon assets and save them as PNGs;
3. link the manifest from `index.html`;
4. set `html lang="pt-BR"`;
5. add theme color metadata;
6. reference the committed icons from the manifest.

Acceptance criteria:

- app has a manifest;
- app name and short name are `BemTeVi`;
- display mode is `standalone`;
- start URL and scope respect `/SeCuida-Prototipo/`;
- manifest icons point to committed PNG files under `public/icons/`;
- icons include 192px, 512px, and maskable 512px variants;
- `html lang` is `pt-BR`;
- no sensitive state is cached or persisted.

### PR 01C — Optional Route Transition Cleanup

Scope:

1. centralize route transition behavior;
2. avoid duplicated page-level transition wrappers where practical;
3. preserve current calm motion style.

Acceptance criteria:

- transitions remain subtle;
- no route transition creates confusing navigation behavior;
- reduced animation duplication where possible.

---

## Files Expected to Change First

```txt
package.json
package-lock.json
index.html
src/main.tsx
src/App.tsx
src/app/App.tsx
src/app/router.tsx
src/app/routes.ts
src/app/providers.tsx
src/app/shell/AppShell.tsx
src/app/shell/TopBar.tsx
src/app/shell/BottomNav.tsx
src/views/HomeView.tsx
src/views/AssessmentView.tsx
```

For PR 01B, also expect:

```txt
public/manifest.webmanifest
public/icons/icon-192.png
public/icons/icon-512.png
public/icons/maskable-icon-512.png
```

---

## Risks and Guardrails

### Risk: mixing router state with local screen state

Guardrail: remove `currentView` completely for top-level screen navigation.

### Risk: introducing privacy-sensitive persistence too early

Guardrail: do not add localStorage, saved progress, cached answers, or stored transcripts.

### Risk: route names affecting user perception

Guardrail: use `/apoio`, not `/crise`.

### Risk: confusing development routes with production deployment support

Guardrail: preserve the current Vite base path, but do not spend this slice on production fallback behavior or GitHub Pages deep-link compatibility. Handle that deliberately when preparing for production deployment.

### Risk: overbuilding architecture too soon

Guardrail: keep this front focused on routes, shell, PWA metadata, and clean navigation. Do not implement flow engine, content schemas, analytics, or dashboard behavior in this slice.

---

## Validation Commands

Run before merging:

```bash
npm run lint
npm run build
```

Current `npm run lint` is TypeScript checking through `tsc --noEmit`, not ESLint. After Front 02D adds the minimal test harness, also run `npm run test` for architecture changes that touch routed screens or app shell behavior.

---

## Definition of Done

Front 01A is done when:

- the app uses React Router for top-level navigation;
- stable routes exist for the current main screens;
- temporary routes exist for `/educacao`, `/educacao/:resourceId`, and `/privacidade`;
- desktop and mobile navigation use route matching;
- direct route access works in local development;
- browser navigation works;
- `currentView` is removed;
- no persistence or backend behavior is introduced;
- the app remains mobile-first;
- the code structure creates a clear foundation for later fronts.

Front 01B is done when:

- manifest exists;
- metadata is updated;
- current app icon assets are officially downloaded or exported into `public/icons/`;
- `html lang="pt-BR"` is set;
- app installability foundation is present;
- no unsafe caching or sensitive persistence is added.
