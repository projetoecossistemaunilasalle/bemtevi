# Front 01 — App Architecture & PWA

## Goal

Transform BemTeVi from a local-state demo into a real mobile-first Progressive Web App with stable routing, app shell, navigation, and deployable structure.

The whole app should be treated as the PWA, not a partial feature.

---

## Current Situation

The current demo uses a single React state variable to switch between views. This works for a prototype, but it does not provide stable URLs, browser navigation, route-level organization, or a clean foundation for future screens.

The prototype currently has core views for home, orientation, emergency support, and local network, but the navigation model should be replaced before the app grows further.

---

## Decisions

- Official product name: **BemTeVi**.
- Use **React Router**.
- PWA applies to the whole app.
- Avoid route path `/crise`; prefer a calmer support route such as `/apoio`.
- Saving/persistence features are postponed until Privacy/LGPD decisions are validated.

---

## Recommended Routes

```txt
/
 /orientacao
 /apoio
 /contatos
 /educacao
 /educacao/:resourceId
```

Optional later routes:

```txt
/sobre
/privacidade
/termos
```

---

## App Shell Responsibilities

The app shell should own:

- persistent bottom navigation;
- optional top header;
- safe-area padding for mobile;
- route transition wrapper;
- app-wide layout width;
- PWA install behavior if used;
- global providers.

Suggested structure:

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

---

## PWA Requirements

Minimum PWA setup:

```txt
public/
  manifest.webmanifest
  icons/
    icon-192.png
    icon-512.png
    maskable-icon-512.png
```

Add:

- app name: BemTeVi;
- short name: BemTeVi;
- theme color aligned with primary green;
- background color white or app background;
- display: standalone;
- start URL: `/`;
- scope: full app.

Service worker strategy should be conservative at first:

- cache app shell and static assets;
- avoid caching sensitive session state;
- avoid caching questionnaire answers;
- avoid offline behavior that implies saved progress unless privacy allows it.

---

## Key Implementation Notes

React Router should become the only screen navigation source. Avoid mixing router state with custom `currentView` state.

Bottom navigation should use route matching, not manual active state.

Example route object:

```ts
export const routes = {
  home: '/',
  orientation: '/orientacao',
  support: '/apoio',
  contacts: '/contatos',
  education: '/educacao',
};
```

---

## Risks

- PWA caching can accidentally preserve more than intended.
- Offline behavior can imply persistence.
- Route names can affect user perception.
- Browser history can expose screen names.

---

## Acceptance Criteria

- App has React Router.
- Bottom nav reflects current route.
- PWA manifest exists.
- App can be installed as a standalone PWA.
- No sensitive user answers are cached or persisted.
- `/apoio` or another neutral support route is used instead of `/crise`.
- `html lang` is set to `pt-BR`.
