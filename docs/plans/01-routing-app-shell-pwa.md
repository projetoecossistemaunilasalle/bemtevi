# Routing, App Shell, And PWA Plan

## Goal

Replace top-level local view state with stable React Router routes and establish a conservative PWA foundation for the whole BemTeVi app.

## Source Context

Front 01 requires:

- React Router as the only top-level navigation source.
- Stable routes for `/`, `/orientacao`, `/apoio`, `/contatos`, `/educacao`, `/educacao/:resourceId`, and `/privacidade`.
- Persistent bottom navigation.
- `html lang="pt-BR"`.
- PWA manifest metadata.
- No persistence or service-worker caching of sensitive state.

## Current App Gap

The prototype used `currentView` in `src/App.tsx` and conditional rendering. That blocks deep links, browser navigation, route ownership, and future feature expansion.

## Target Files

```txt
src/app/App.tsx
src/app/router.tsx
src/app/routes.ts
src/app/providers.tsx
src/app/shell/AppShell.tsx
src/app/shell/TopBar.tsx
src/app/shell/BottomNav.tsx
src/app/shell/RouteTransition.tsx
src/main.tsx
index.html
public/manifest.webmanifest
public/icon.svg
```

## RED-GREEN-REFACTOR Steps

### Step 1: Router Dependency And Route Constants

**RED:** Ask a subagent to identify every hardcoded top-level screen state and list expected route constants. The failing check is that no route constants exist and `currentView` owns navigation.

**GREEN:** Ask a worker subagent to install `react-router-dom`, create `src/app/routes.ts`, and add all required public routes.

**REFACTOR:** Ask a review subagent to confirm no emotionally loaded route names such as `/crise` were introduced.

### Step 2: App Shell

**RED:** Ask a subagent to describe the expected shell contract: header, routed outlet, and mobile bottom nav must persist across route changes.

**GREEN:** Ask a worker subagent to create `AppShell`, `TopBar`, and `BottomNav`, using `NavLink` for active state.

**REFACTOR:** Ask a review subagent to inspect keyboard focus, touch target size, route active state, and duplicated nav labels.

### Step 3: Route Mapping

**RED:** Ask a subagent to map old view actions to new routes and note every button that still depends on `setView`.

**GREEN:** Ask a worker subagent to replace callback navigation with `useNavigate`, `Link`, or `NavLink`.

**REFACTOR:** Ask a review subagent to verify browser back/forward works and no custom top-level screen state remains.

### Step 4: Reserved Routes

**RED:** Ask a subagent to confirm `/educacao`, `/educacao/:resourceId`, and `/privacidade` fail because no screens are wired.

**GREEN:** Ask a worker subagent to add temporary feature-owned screens with honest placeholder copy.

**REFACTOR:** Ask a review subagent to confirm placeholders do not imply unfinished features are complete.

### Step 5: PWA Metadata

**RED:** Ask a subagent to check installability inputs: manifest, theme color, app language, app name, and icon references.

**GREEN:** Ask a worker subagent to update `index.html`, add `public/manifest.webmanifest`, and add a committed app icon asset.

**REFACTOR:** Ask a review subagent to confirm no service worker, sensitive cache, localStorage, or persisted session behavior was introduced.

## Acceptance Criteria

- Top-level navigation uses React Router.
- Bottom and top navigation use route matching.
- Required routes exist.
- `currentView` has been removed.
- `index.html` uses `pt-BR`.
- PWA manifest exists and names the app `BemTeVi`.
- No persistence, analytics, or backend behavior is introduced.
