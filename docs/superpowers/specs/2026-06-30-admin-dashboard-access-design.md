# Admin Dashboard Access Design

## Goal

Keep the public Se Cuida app focused on the user-facing experience while allowing authenticated admins to access the dashboard, preview content changes, and approve updates into the site.

## Current Context

The app currently defines a `/dashboard` route and conditionally includes a Dashboard tab when the dev dashboard is enabled. The dashboard is part of the same React app and uses the existing app shell/navigation.

## Approved UX Direction

Public users should see the existing app navigation without Dashboard. Admins should enter through a direct `/login` path that is not linked from the public app. After login, admins browse the app in an authenticated admin mode.

Responsive behavior:

- Mobile public view: show only public bottom-nav tabs.
- Mobile admin view: keep the public bottom nav unchanged and expose Dashboard through an `Admin` button or menu in the top bar.
- Desktop public view: show the normal desktop navigation without Dashboard.
- Desktop admin view: keep the current behavior, with Dashboard visible in the main desktop navigation.

This avoids crowding the mobile bottom navigation while preserving the current desktop admin workflow.

## Routes

- `/login`: Direct admin login entry. It is intentionally not discoverable from normal public navigation.
- `/dashboard`: Admin-only dashboard route.
- Existing public routes: remain available to all users, but their navigation should not expose Dashboard unless the user is authenticated as admin and the viewport/layout rules allow it.

## Admin Mode

After a successful login, the app should know the user is in admin mode. Admin mode controls only administrative access and navigation visibility; it should not change the public user experience unless a preview/draft state is intentionally added later.

Admin mode should provide:

- Access to Dashboard.
- A clear visual indication on mobile that admin mode is active.
- A way to return from Dashboard to the public preview/app.

## Approval Flow

The dashboard remains the place where admins review content changes. When an admin approves changes, approved content should go directly into the site according to the project's publishing mechanism.

For this design, the UX requirement is that approval feels immediate from the admin's perspective: after approval, the admin should be able to see the approved changes reflected in the site experience.

## Out Of Scope

- Building a separate admin application.
- Creating a public link to admin login.
- Changing the existing public information architecture.
- Designing a full role/permission system beyond admin-only dashboard access.

## Testing Expectations

Tests should cover:

- Public users do not see Dashboard in mobile or desktop navigation.
- Unauthenticated users cannot access `/dashboard`.
- Admin users see the top-bar admin entry on mobile.
- Admin users keep the current Dashboard navigation behavior on desktop.
- Login redirects admins into the intended admin-capable app state.
