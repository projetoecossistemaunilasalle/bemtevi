# BemTeVi

BemTeVi is a mobile-first React/Vite prototype for educator mental-health support in Portuguese. It offers a calm, anonymous-by-default experience for guided orientation, immediate support, educational resources, and local support contacts.

The app does not diagnose, does not replace professional care, and should not collect personal identification by default.

## Current Shape

- React 19, Vite, TypeScript, Tailwind CSS v4.
- React Router routes for `/`, `/orientacao`, `/apoio`, `/contatos`, `/educacao`, and `/educacao/:resourceId`.
- PWA manifest and GitHub Pages subpath support through `/bemtevi/`.
- Feature folders under `src/features`.
- Domain logic under `src/domain`.
- Structured content under `src/content`.
- Reusable UI primitives under `src/design-system`.
- Vitest coverage for content, first-visit onboarding behavior, flow engine, orientation UI, and questionnaire logic.

## Run Locally

Prerequisite: Node.js with pnpm.

```bash
pnpm install
pnpm run dev
```

The dev server defaults to port `3000`.

## Validation

```bash
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run validate:flows
pnpm run test
pnpm run build
pnpm run check
```

`pnpm run check` is the full local quality gate and matches CI.

## Admin Dashboard

The dashboard is available only when `VITE_ENABLE_DEV_DASHBOARD=true` and a user signs in at the unlinked `/login` route with an authorized Neon Auth account. Copy `.env.example` to `.env`, then set the project's public Neon Auth Base URL and Data API URL. Never put a Neon database connection string, API key, or administrator password in a `VITE_*` variable.

Enable Neon Auth and the Neon Data API with authenticated-user grants, then apply [`neon/migrations/20260709000000_admin_accounts.sql`](neon/migrations/20260709000000_admin_accounts.sql). Create accounts through Neon Auth, then grant an existing user access from the Neon SQL editor:

```sql
insert into public.admin_users (user_id)
select id from neon_auth."user" where email = 'admin@example.com';
```

Revoke dashboard access without deleting the Auth account:

```sql
delete from public.admin_users
where user_id = (select id from neon_auth."user" where email = 'admin@example.com');
```

The `BemTeVi` Neon project is the shared backend for GitHub Pages. Configure `VITE_NEON_AUTH_URL` and `VITE_NEON_DATA_API_URL` as repository variables in `projetoecossistemaunilasalle/bemtevi`. Neon Auth must trust `https://projetoecossistemaunilasalle.github.io` (protocol included, no trailing slash). Localhost origins are preconfigured by Neon. Browser route guards protect the UI; database writes are additionally restricted by Neon Data API RLS policies based on `public.is_admin()`.

## Operations

The dashboard publishes validated drafts through the Neon Data API. Behavior:

- **Migration order:** apply `20260709000000_admin_accounts.sql` first, then the `published_content` migration. The app reads from `published_content` and falls back to bundled content when that table is empty.
- **First publication** creates revision `1` and increments on each subsequent publish.
- **Public routes** serve the current database snapshot; a new publication is visible after a page reload with no redeploy.
- **Client refresh:** open clients refresh published content on page load and on window focus; there is no realtime push.
- **Payload limits:** 1 MiB per image and 5 MiB total request payload.
- **Export recovery mode:** set `VITE_DASHBOARD_PUBLISH_MODE=export` to skip database writes and emit a ZIP for the legacy recovery/development workflow (e.g. when auth is disabled for local mock-auth work). The default `database` mode writes directly to Neon.
- **Conflicts:** a publish that fails validation or a concurrent revision conflict returns an error and retains the local draft; it does not overwrite the published snapshot.

## Documentation

- Product requirements: [`docs/PRD.md`](docs/PRD.md)
- Project fronts and milestones: [`docs/fronts/README.md`](docs/fronts/README.md)
- Implementation plans: [`docs/plans/README.md`](docs/plans/README.md)
- Current repository context: [`docs/Project-Context.md`](docs/Project-Context.md)
- Analytics/LGPD policy note: [`docs/fronts/12b-anonymous-analytics-lgpd-policy.md`](docs/fronts/12b-anonymous-analytics-lgpd-policy.md)
