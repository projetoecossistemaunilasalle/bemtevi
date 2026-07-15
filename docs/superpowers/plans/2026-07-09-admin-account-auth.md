# Admin Account Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/dashboard` and all dashboard navigation available only to authenticated Neon users explicitly listed as administrators.

**Architecture:** A focused Neon Auth/Data API adapter authenticates email/password accounts and resolves authorization through an RLS-protected `admin_users` table. A React provider owns async auth state, route guards enforce access, and navigation consumes the same state. PostgreSQL RLS remains the authoritative boundary for future dashboard writes.

**Tech Stack:** React 19, React Router 7, TypeScript, Vitest, Neon Auth, Neon Data API, PostgreSQL RLS

---

### Task 1: Define The Server Authorization Boundary

**Files:**

- Create: `neon/migrations/20260709000000_admin_accounts.sql`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add the `admin_users` table and RLS policy**

Create a table keyed by `auth.users.id`, revoke mutation access from browser roles, allow authenticated users to select only their own membership row, and create `public.is_admin()` as a non-user-writable authorization predicate.

- [ ] **Step 2: Document configuration and account provisioning**

Document `VITE_NEON_AUTH_URL`, `VITE_NEON_DATA_API_URL`, feature-flag behavior, and the owner-only SQL needed to grant or revoke an existing Auth user's dashboard access.

### Task 2: Build The Admin Auth Service With TDD

**Files:**

- Create: `src/app/auth/adminAuth.ts`
- Create: `src/app/auth/neonClient.ts`
- Create: `src/app/auth/__tests__/adminAuth.test.ts`

- [ ] **Step 1: Write failing service tests**

Cover valid admin login, invalid credentials, valid non-admin rejection with sign-out, initial session restoration, missing configuration, and logout.

- [ ] **Step 2: Run the focused tests and confirm expected failures**

Run: `pnpm exec vitest run src/app/auth/__tests__/adminAuth.test.ts`

- [ ] **Step 3: Implement the minimal service**

Use `signInWithPassword`, query `admin_users` by the authenticated user's ID, sign out unauthorized accounts, and expose auth-state subscription without storing a separate admin flag.

- [ ] **Step 4: Run the focused tests and confirm they pass**

Run: `pnpm exec vitest run src/app/auth/__tests__/adminAuth.test.ts`

### Task 3: Add Provider, Login, And Route Guards With TDD

**Files:**

- Create: `src/app/auth/AdminAuthProvider.tsx`
- Create: `src/app/auth/RequireAdmin.tsx`
- Create: `src/features/admin-login/AdminLoginScreen.tsx`
- Modify: `src/app/providers.tsx`
- Modify: `src/app/router.tsx`
- Modify: `src/app/routes.ts`
- Modify: `src/app/__tests__/routes.test.tsx`

- [ ] **Step 1: Write failing route tests**

Cover feature-off redirects, unauthenticated dashboard redirects, login validation/error behavior, admin login redirect, non-admin rejection, restored admin access, and logout-driven route removal.

- [ ] **Step 2: Run the route tests and confirm expected failures**

Run: `pnpm exec vitest run src/app/__tests__/routes.test.tsx`

- [ ] **Step 3: Implement provider, login screen, and guards**

Keep a loading state while restoring the session, redirect unauthorized dashboard requests to `/`, redirect authenticated admins away from `/login`, and keep login undiscoverable from public UI.

- [ ] **Step 4: Run the route tests and confirm they pass**

Run: `pnpm exec vitest run src/app/__tests__/routes.test.tsx`

### Task 4: Make Navigation Authorization-Aware With TDD

**Files:**

- Modify: `src/app/shell/TopBar.tsx`
- Modify: `src/app/shell/BottomNav.tsx`
- Modify: `src/app/shell/__tests__/navigation.test.tsx`

- [ ] **Step 1: Write failing navigation tests**

Verify public users never see Dashboard, admins get one desktop Dashboard link plus a session menu, mobile bottom navigation remains public-only, and logout immediately removes admin UI.

- [ ] **Step 2: Run the navigation tests and confirm expected failures**

Run: `pnpm exec vitest run src/app/shell/__tests__/navigation.test.tsx`

- [ ] **Step 3: Implement admin-aware navigation**

Render the desktop Dashboard item only for authorized admins. Render an admin session control in the top bar with a mobile Dashboard link, public-app link, account label, and logout action. Remove all dashboard logic from `BottomNav`.

- [ ] **Step 4: Run the navigation tests and confirm they pass**

Run: `pnpm exec vitest run src/app/shell/__tests__/navigation.test.tsx`

### Task 5: Verify The Complete Change

**Files:**

- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Pass Neon public configuration into the Pages build**

Use GitHub repository variables for the Neon Auth Base URL and Data API URL. Do not add a database connection string, Neon API key, or admin credentials to Vite configuration.

- [ ] **Step 2: Run focused auth and UI tests**

Run: `pnpm exec vitest run src/app/auth src/app/__tests__/routes.test.tsx src/app/shell/__tests__/navigation.test.tsx`

- [ ] **Step 3: Run the complete quality gate**

Run: `pnpm run check`

- [ ] **Step 4: Review the final diff for secret leakage and authorization gaps**

Confirm no passphrase, password, database connection string, Neon API key, browser-writable admin flag, or unguarded dashboard route exists.
