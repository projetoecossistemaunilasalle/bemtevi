# Admin Dashboard Access Design

## Goal

Keep the public Se Cuida app focused on the user-facing experience while allowing authenticated admins to access the dashboard, preview content changes, and approve updates into the site.

## Current Context

The app currently defines a `/dashboard` route and conditionally includes a Dashboard tab when the dev dashboard is enabled. The dashboard is part of the same React app and uses the existing app shell/navigation.

`VITE_ENABLE_DEV_DASHBOARD` should remain as a build-time master kill switch for the dashboard bundle and admin routes. Runtime authentication controls who can use admin mode only when this flag is enabled. If `VITE_ENABLE_DEV_DASHBOARD` is not `true`, `/login` and `/dashboard` should not expose admin functionality and should redirect to `/`. Production or staging builds that need prototype admin access must set `VITE_ENABLE_DEV_DASHBOARD=true`.

The current dashboard stores editor drafts in browser `localStorage`, previews drafts inside dashboard tools, validates them, and exports reviewable JSON/assets for repository merge. V1 admin access should preserve this model rather than turning public app routes into a draft-content overlay.

## Approved UX Direction

Public users should see the existing app navigation without Dashboard. Admins should enter through a direct `/login` path that is not linked from the public app. After login, admins browse the app in an authenticated admin mode.

Responsive behavior:

- Mobile public view: show only public bottom-nav tabs.
- Mobile admin view: keep the public bottom nav unchanged and expose Dashboard through an `Admin` button or menu in the top bar.
- Desktop public view: show the normal desktop navigation without Dashboard.
- Desktop admin view: keep the current behavior, with Dashboard visible in the main desktop navigation, and add a visible admin indicator/menu in the top bar for session actions.

This avoids crowding the mobile bottom navigation while preserving the current desktop admin workflow.

## Routes

- `/login`: Direct admin login entry. It is intentionally not discoverable from normal public navigation. If an authenticated admin visits `/login`, redirect them to `/dashboard`. If the dashboard feature flag is off, redirect to `/`.
- `/dashboard`: Admin-only dashboard route. If an unauthenticated user visits `/dashboard`, redirect to `/` rather than `/login` so the app does not reveal the login entry from guessed dashboard URLs. If the dashboard feature flag is off, redirect to `/`.
- Existing public routes: remain available to all users, but their navigation should not expose Dashboard unless the user is authenticated as admin and the viewport/layout rules allow it.

## Login Mechanism

The prototype login should require a simple admin passphrase to avoid accidental admin entry in staging or test builds. The passphrase may be configured through a Vite-exposed environment variable such as `VITE_ADMIN_PASSPHRASE`, with a clearly documented local fallback for development.

This passphrase is not a production security boundary because Vite-exposed values are available to client code. If the dashboard becomes available to real production administrators, this mechanism should be replaced by backend-backed authentication.

## Admin Mode

After a successful login, the app should know the user is in admin mode. Admin mode controls only administrative access and navigation visibility; it should not change the public user experience unless a preview/draft state is intentionally added later.

Admin mode should provide:

- Access to Dashboard.
- A clear visual indication in the top bar that admin mode is active on both mobile and desktop.
- An admin menu in the top bar with session actions.
- Mobile admin menu contents: Dashboard, public app navigation/preview, and Logout.
- Desktop admin menu contents: public app navigation/preview and Logout. Dashboard should remain in the existing desktop navigation only, avoiding duplicate Dashboard links in the same top bar.
- A way to return from Dashboard to the public preview/app.
- A Logout action that clears admin mode and removes admin navigation immediately.

For the prototype, admin mode should be stored in browser `localStorage` under a Se Cuida namespace, matching the dashboard's existing storage pattern and allowing admin state to survive page reloads and separate tabs in the same browser profile. A future backend-backed auth provider can replace this storage without changing the navigation contract.

## Approval Flow

The dashboard remains the place where admins review content changes. In V1, admins preview drafts inside the dashboard's existing preview/editing tools, not by overlaying draft content onto public routes such as `/orientacao` or `/educacao`.

Approval should mark validated dashboard drafts as ready for the existing export/repository-merge publishing flow. The approved changes become part of the public site only after they are exported, merged into shipped content, and deployed through the project's publishing mechanism. This avoids changing the public app data loaders for an admin-only draft overlay in this scope.

If a future requirement needs admins to browse public routes with locally approved draft content overlaid, that should be designed as a separate preview-mode feature with explicit content-loader changes and tests.

## Out Of Scope

- Building a separate admin application.
- Creating a public link to admin login.
- Changing the existing public information architecture.
- Designing a full role/permission system beyond admin-only dashboard access.
- Overlaying dashboard drafts onto public app routes.

## Testing Expectations

Tests should cover:

- Public users do not see Dashboard in mobile or desktop navigation.
- Unauthenticated users attempting to access `/dashboard` are redirected to `/` without exposing `/login`.
- Any user attempting to access `/login` or `/dashboard` while `VITE_ENABLE_DEV_DASHBOARD` is off is redirected to `/`.
- Authenticated admins attempting to access `/login` are redirected to `/dashboard`.
- Invalid passphrase attempts do not enable admin mode.
- Admin users see the top-bar admin entry on mobile.
- Admin users see an admin mode indicator and Logout action on mobile and desktop.
- Admin users keep the current Dashboard navigation behavior on desktop.
- Desktop admins do not see duplicate Dashboard links in both the desktop nav and the admin menu.
- Admins can log out, clearing admin mode and removing admin navigation.
- Admin session state persists across page reloads and separate tabs in the same browser profile.
- Login redirects admins into the intended admin-capable app state.

Implementation should introduce a small admin auth module, for example `src/app/auth/adminSession.ts`, that centralizes `isAdminMode()`, `loginAdmin()`, `logoutAdmin()`, and test-only reset behavior. Tests should reset this module/storage state in `beforeEach` to avoid leakage between route and navigation cases.
