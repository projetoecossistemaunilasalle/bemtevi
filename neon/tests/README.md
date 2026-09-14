# Neon live harness (`check:db`) — DB-04

This directory contains the DB-04 harness that executes the DB-01..03 live
suites against a real Neon project. `pnpm run check:db` runs
`neon/tests/run.ts`, which provisions a disposable branch, applies every
additive migration, seeds the fixture, runs the accumulated Vitest live suites
serially, applies the direct-write cutover artifact for the grants cutover
phase, and deletes the disposable branch in a `finally` block. Missing
credentials fail immediately — there is no skip path.

## Required environment

| Variable                            | Meaning                                     |
| ----------------------------------- | ------------------------------------------- |
| `NEON_API_KEY`                      | Management API key (dev harness only)       |
| `NEON_TEST_PROJECT_ID`              | Dedicated test project (never production)   |
| `NEON_TEST_PARENT_BRANCH_ID`        | Dedicated sanitized fixture branch          |
| `NEON_TEST_DATABASE`                | Database exposed through the Data API       |
| `NEON_TEST_ADMIN_A_EMAIL/PASSWORD`  | Verified Neon Auth account, seeded as admin |
| `NEON_TEST_ADMIN_B_EMAIL/PASSWORD`  | Verified Neon Auth account, seeded as admin |
| `NEON_TEST_NONADMIN_EMAIL/PASSWORD` | Verified Neon Auth account, no membership   |

Local runs load these values from an **untracked file outside the repository**:
`%USERPROFILE%\.config\bemtevi-db04\neon-test.env` (POSIX:
`~/.config/bemtevi-db04/neon-test.env`). A different file can be selected with
`BEMTEVI_DB04_ENV_FILE`. The file is never read, written or logged by any
repository tooling beyond this loader; the harness never prints credentials.

## One-time fixture setup (documented, not automated)

The fixture lives in a dedicated test project on the authenticated Neon
account, **not** in the production project:

1. `npx neon@4.14.6 projects create --name "BemTeVi V2 Test"` — record the
   project id into the outside-repo env file.
2. `branches create --name fixture-parent` off the default branch — record its
   branch id as `NEON_TEST_PARENT_BRANCH_ID`. It is a non-default, unprotected
   branch whose name is not `main`/`master`/`production`/`prod`, and it contains
   no BemTeVi tables (the harness refuses a parent that already has
   `public.published_content`).
3. `neon neon-auth enable --branch <fixture-parent>` — enables Neon Auth on the
   fixture parent; every disposable child branch inherits it.
4. `neon data-api create --branch <fixture-parent> --database neondb
--auth-provider neon_auth --db-schemas public` (no `--add-default-grants`).
5. Create three password accounts through the Neon Auth (better-auth) HTTP API
   of the fixture branch — `POST <NEON_AUTH_BASE_URL>/sign-up/email` with an
   `origin` header — and store their emails/passwords in the outside-repo env
   file. Sign-in through the pulled auth URL is the verification. The accounts
   sync into `neon_auth."user"` on every child branch.

## Per-run provisioning (automated by `neon/tests/provision.ts`)

Only the CLI command shapes frozen by dossier revision 8 are used, always with
argument arrays, `shell: false`, captured/redacted output and the exact
`neon@4.14.6` version gate — plus one additional read-only call,
`neon connection-string <parent> --role-name neondb_owner`, whose sole purpose
is the mandated step-1 owner inspection of the parent. Before any branch is
created, the parent owner connection runs `to_regclass('public.published_content')`;
a parent that already carries the editorial tables is refused. The disposable
branch `bemtevi-v2-test-<uuid>` is created with a one-hour expiry from the
fixture parent, the Data API is verified (public schema only, anonymous role, no
default grants), env vars are pulled into a process-owned temp directory
outside the repo, migrations/admins/publication are seeded through the owner
connection, and the three principals plus the public anonymous JWT are signed
in through the pulled auth URL. Cleanup re-verifies project id and branch name
before deleting only the retained branch; a cleanup failure fails `check:db`
with sanitized ids.

## Deviations / integration notes

- The pinned `@neondatabase/neon-js` 0.6.2-beta cannot retain the better-auth
  session cookie between requests in Node, so `neon/tests/clients.ts` performs
  the SDK's own endpoints explicitly (`sign-in/email` -> session cookie ->
  `/token` JWT; `/token/anonymous` for the public anonymous JWT) and verifies
  the JWT role/subject claims. Browser app code is unaffected.
- The Neon Data API's first request on a fresh pooled backend can resolve
  `auth.user_id()` before request-scoped claims are visible; the harness warms
  the pool with authorized RPC bursts until a full burst is clean.
- Harness unit tests (`harness.test.ts`) are offline and run inside this
  config; the DB-01..03 suites run serially (`fileParallelism: false`) so
  fixture resets never race.
