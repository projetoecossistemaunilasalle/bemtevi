# Admin Dashboard Access Design

## Goal

Keep the public Se Cuida app focused on the user-facing experience while allowing authenticated admins to access the dashboard, preview content changes, and confirm updates into the live site.

## Current Context

The app currently defines a `/dashboard` route and conditionally includes a Dashboard tab when the dev dashboard is enabled. The dashboard is part of the same React app and uses the existing app shell/navigation.

`VITE_ENABLE_DEV_DASHBOARD` should remain as a build-time master kill switch for the dashboard bundle and admin routes. Runtime authentication controls who can use admin mode only when this flag is enabled. If `VITE_ENABLE_DEV_DASHBOARD` is not `true`, `/login` and `/dashboard` should not expose admin functionality and should redirect to `/`. Production or staging builds that need prototype admin access must set `VITE_ENABLE_DEV_DASHBOARD=true`.

The current dashboard stores editor drafts in browser `localStorage`, previews drafts inside dashboard tools, validates them, and exports reviewable JSON/assets for repository merge. The new dashboard direction changes that model: confirmed dashboard changes should be saved to a database-backed content source and become live for all users without requiring export, repository merge, or redeploy as the primary publishing path.

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

## Authentication And Authorization

Admin access must use Neon Auth email/password accounts. There is no public sign-up route: accounts are created through the Neon Auth administration surface, then explicitly granted dashboard access by inserting their Neon Auth user ID into `public.admin_users`.

The browser uses only `VITE_NEON_AUTH_URL` and `VITE_NEON_DATA_API_URL`. These public endpoints do not grant administrative privileges. The application must verify the signed-in user's ID against `public.admin_users`, protected by Neon Data API Row Level Security (RLS), before rendering admin navigation or `/dashboard`.

Client route guards are a UX boundary, not the final data security boundary. Any future database writes from the dashboard must also use RLS policies that check `public.is_admin()` so a visitor cannot bypass authorization by calling the API directly.

## Admin Mode

After a successful login, the app should know the user is in admin mode. Admin mode controls administrative access and navigation visibility. It does not create a private content view for admins; once an admin confirms a valid change, that change becomes live content for normal public users too.

Admin mode should provide:

- Access to Dashboard.
- A clear visual indication in the top bar that admin mode is active on both mobile and desktop.
- An admin menu in the top bar with session actions.
- Mobile admin menu contents: Dashboard, public app navigation/preview, and Logout.
- Desktop admin menu contents: public app navigation/preview and Logout. Dashboard should remain in the existing desktop navigation only, avoiding duplicate Dashboard links in the same top bar.
- A way to return from Dashboard to the public preview/app.
- A Logout action that clears admin mode and removes admin navigation immediately.

Neon Auth owns session persistence, refresh, and cross-tab synchronization. The app must derive admin mode from the current authenticated session plus the server-authorized `admin_users` row; it must never store an independent `isAdmin` boolean in browser storage.

## Publishing Boundary

The dashboard remains the place where admins review content changes. Draft edits are not shown in public routes by default. Once an admin confirms a valid change, the dashboard should eventually write that content to a database-backed live content source.

For all users, confirmation should feel immediate: after the admin confirms a change, routes such as `/orientacao` or `/educacao` should read the live database-backed version without requiring export, repository merge, or redeploy.

Database-backed publishing is a separate implementation phase. It requires a content schema, draft/published lifecycle, atomic publishing rules, conflict handling, and RLS write policies. This access-control implementation must establish the reusable `public.is_admin()` authorization boundary but must not pretend that the current `localStorage` draft/export flow is already secure database publishing.

## Out Of Scope

- Building a separate admin application.
- Creating a public link to admin login.
- Changing the existing public information architecture.
- Designing a full role/permission system beyond admin-only dashboard access.
- Requiring repository changes, JSON export, or redeploy for normal content publishing after admin confirmation.
- Implementing database-backed content publishing in the same change as admin authentication.

## Testing Expectations

Tests should cover:

- Public users do not see Dashboard in mobile or desktop navigation.
- Unauthenticated users attempting to access `/dashboard` are redirected to `/` without exposing `/login`.
- Any user attempting to access `/login` or `/dashboard` while `VITE_ENABLE_DEV_DASHBOARD` is off is redirected to `/`.
- Authenticated admins attempting to access `/login` are redirected to `/dashboard`.
- Invalid credentials do not enable admin mode.
- Valid non-admin accounts are signed out and do not enable admin mode.
- Admin users see the top-bar admin entry on mobile.
- Admin users see an admin mode indicator and Logout action on mobile and desktop.
- Admin users keep the current Dashboard navigation behavior on desktop.
- Desktop admins do not see duplicate Dashboard links in both the desktop nav and the admin menu.
- Admins can log out, clearing admin mode and removing admin navigation.
- Neon Auth session state persists across page reloads and separate tabs in the same browser profile.
- Login redirects admins into the intended admin-capable app state.

Database-backed publishing and public-content fallback tests belong to the separate publishing implementation phase, not to the admin authentication gate.

Implementation should introduce a small admin auth service and React provider that centralize session restoration, admin authorization, login, logout, and auth-state changes. Tests should inject or mock the service instead of writing fake admin flags into browser storage.
