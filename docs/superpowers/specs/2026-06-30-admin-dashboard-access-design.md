# Admin Dashboard Access Design

## Goal

Keep the public Se Cuida app focused on the user-facing experience while allowing authenticated admins to access the dashboard, preview content changes, and approve updates into the site.

## Current Context

The app currently defines a `/dashboard` route and conditionally includes a Dashboard tab when the dev dashboard is enabled. The dashboard is part of the same React app and uses the existing app shell/navigation.

`VITE_ENABLE_DEV_DASHBOARD` should remain as a build-time master kill switch for the dashboard bundle and admin routes. Runtime authentication controls who can use admin mode only when this flag is enabled. If `VITE_ENABLE_DEV_DASHBOARD` is not `true`, `/login` and `/dashboard` should not expose admin functionality and should behave as unavailable routes. Production builds that need admin access must set `VITE_ENABLE_DEV_DASHBOARD=true`.

## Approved UX Direction

Public users should see the existing app navigation without Dashboard. Admins should enter through a direct `/login` path that is not linked from the public app. After login, admins browse the app in an authenticated admin mode.

Responsive behavior:

- Mobile public view: show only public bottom-nav tabs.
- Mobile admin view: keep the public bottom nav unchanged and expose Dashboard through an `Admin` button or menu in the top bar.
- Desktop public view: show the normal desktop navigation without Dashboard.
- Desktop admin view: keep the current behavior, with Dashboard visible in the main desktop navigation, and add a visible admin indicator/menu in the top bar for session actions.

This avoids crowding the mobile bottom navigation while preserving the current desktop admin workflow.

## Routes

- `/login`: Direct admin login entry. It is intentionally not discoverable from normal public navigation. If an authenticated admin visits `/login`, redirect them to `/dashboard`.
- `/dashboard`: Admin-only dashboard route. If an unauthenticated user visits `/dashboard`, do not redirect them to `/login`; render a not-found/unavailable route or redirect to `/` so the app does not reveal the login entry from guessed dashboard URLs.
- Existing public routes: remain available to all users, but their navigation should not expose Dashboard unless the user is authenticated as admin and the viewport/layout rules allow it.

## Admin Mode

After a successful login, the app should know the user is in admin mode. Admin mode controls only administrative access and navigation visibility; it should not change the public user experience unless a preview/draft state is intentionally added later.

Admin mode should provide:

- Access to Dashboard.
- A clear visual indication in the top bar that admin mode is active on both mobile and desktop.
- An admin menu in the top bar with Dashboard access, public preview navigation, and Logout.
- A way to return from Dashboard to the public preview/app.
- A Logout action that clears admin mode and removes admin navigation immediately.

For the prototype, admin mode should be stored in browser session state so it survives page reloads but does not imply a production-grade credential system. A future backend-backed auth provider can replace this storage without changing the navigation contract.

## Approval Flow

The dashboard remains the place where admins review content changes. When an admin approves changes, approved content should go directly into the site according to the project's publishing mechanism.

For this design, the UX requirement is that approval feels immediate from the admin's perspective: after approval, the admin should be able to see the approved changes reflected in their current browser session. This does not require instant production deployment for public users if the project still depends on static publishing or an external build pipeline.

## Out Of Scope

- Building a separate admin application.
- Creating a public link to admin login.
- Changing the existing public information architecture.
- Designing a full role/permission system beyond admin-only dashboard access.

## Testing Expectations

Tests should cover:

- Public users do not see Dashboard in mobile or desktop navigation.
- Unauthenticated users attempting to access `/dashboard` are redirected to `/` or shown a not-found/unavailable route without exposing `/login`.
- Authenticated admins attempting to access `/login` are redirected to `/dashboard`.
- Admin users see the top-bar admin entry on mobile.
- Admin users see an admin mode indicator and Logout action on mobile and desktop.
- Admin users keep the current Dashboard navigation behavior on desktop.
- Admins can log out, clearing admin mode and removing admin navigation.
- Admin session state persists across page reloads.
- Login redirects admins into the intended admin-capable app state.
