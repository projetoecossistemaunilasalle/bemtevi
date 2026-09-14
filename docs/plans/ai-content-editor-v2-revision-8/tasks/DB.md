# Database Tasks

**Specification revision: 8.**

Read 15 in full. Tests require a disposable branch of a dedicated test project, never production. Use 14 operation fixtures. Common credential-free commands in tasks/README apply to each task.

## Live-gate sequencing rule

DB-01, DB-02 and DB-03 **author** their live Neon suites but do **not** execute `pnpm run check:db`: the command intentionally fails closed until DB-04 creates `neon/tests/run.ts`. Their task-local completion requires credential-free common/focused checks only and their handoffs MUST record `check:db deferred to DB-04 by specification`. DB-04 then executes every DB-01..03 live suite on the disposable branch and is the first task allowed to declare Gate B green.

A model MUST NOT create a temporary/fake `run.ts`, skip live cases, or weaken the runner in DB-01..03 merely to make `check:db` exit zero.

## DB-01: Tables And CAS

**Depends:** MERGE-02. **Unblocks:** DB-02. **Parallel:** DB lane can run beside dashboard/file/MCP after MERGE-03.

**Owns:**

- `neon/migrations/20260910000000_content_draft_tables.sql`
- `neon/migrations/20260910001000_content_draft_operations.sql`
- `neon/tests/drafts.test.ts`
- `neon/tests/operations.test.ts`
- `neon/tests/images.test.ts`
- `neon/tests/rpc-types.ts`

Implement exact tables, audit-trigger amendment and private helpers, admin load/head/mutate. Do not add public policies granting direct new-table access. Do not apply cutover SQL. Keep absent-publication error, bounded/no-op CAS and all-or-nothing operation application. SQL operation field/protected-image rules are the literal Revision-8 rules in 14; do not inspect the V1 compatibility facade to decide permitted keys.

**Tests:** empty initialization fails safely, concurrent initialization one row, same-generation concurrent writers exactly one changed success, stale/no-op behavior, atomic batch rollback, SQL/TS operation fixture parity and decoded image/total byte bounds. Verify draft head omits payload.

**Commands:** common credential-free commands + focused SQL/fixture static/unit tests. Do not run `check:db`; hand off the authored live suites to DB-04.

**Acceptance:** exact schema/signature inspection assertions and mutation invariants are authored; no claiming mocks prove RLS; handoff states live gate deferred to DB-04.

## DB-02: Delegation And Durable Exports

**Depends:** DB-01. **Unblocks:** DB-03.

**Owns:**

- `neon/migrations/20260910002000_content_agent_connections.sql`
- `neon/tests/capabilities.test.ts`
- `neon/tests/exports.test.ts`

Implement fixed agent wrapper catalog, anonymous gateway role, decoded token hashing, current admin membership, locks, throttled `last_used_at`, expiry/revoke/idempotent create, owner-isolated export bases and serial five-row pruning. List/get/reference tools do not become SQL RPCs.

**Tests:** anonymous and non-admin direct reads/writes to protected tables fail; execute grants exact; valid capability read/edit; every invalid secret/lifecycle/principal case same error; one connection cannot impersonate another, create/revoke connections or read exports; concurrent export creation never >5; same admin different session can retrieve; other admin cannot; exact 14-day boundary and digest.

**Commands:** common credential-free commands + focused capability/export tests that do not require live Neon. **Do not run `pnpm run check:db` in this task.** DB-04 is the first owner of an executable live harness and runs these suites there.

**Acceptance:** no returned/persisted raw secret, no broad role grants, revoked connections retained, owner and execution actor separate; handoff states live gate deferred to DB-04.

## DB-03: Atomic Guarded Publication

**Depends:** DB-02. **Unblocks:** DB-04.

**Owns:**

- `neon/migrations/20260910003000_content_draft_publication.sql`
- `neon/cutover/20260910004000_content_draft_revoke_direct_publish.sql`
- `neon/cutover/disable_editorial_writes.sql`
- `neon/tests/publication.test.ts`
- `neon/tests/grants.test.ts`

Implement one private publisher with admin/agent wrappers, preparation token hashes, terminal outcomes and stored result replay. Preserve existing history trigger as sole history writer. The separately staged direct-write cutover MUST use the literal policy names/statements in 15; do not query the database or current migration text to invent alternative policy names.

**Tests:** same preparation concurrent publish yields one revision increment and one history row; success replay returns original result after draft changes/preparation expiry; invalid/revoked/expired capability still fails replay; stale draft/revision/digest/token failures; SQL exception rollback across history/current/draft/preparation; admin attribution and connection audit; base/live mismatch fails closed during coexistence. Author cutover grant assertions separately after legacy direct-write coexistence assertions.

**Commands:** common credential-free commands + focused publication/grant static/unit tests. **Do not run `pnpm run check:db` in this task.** DB-04 executes these live cases after provisioning exists.

**Acceptance:** publication cannot accept a replacement payload, preparation race/expiry correct, all public reads survive cutover. Cutover SQL is not in automatic additive migration directory. Handoff states live gate deferred to DB-04.

## DB-04: Actual Neon Harness And Security Gate

**Depends:** DB-03, INTEGRATION-00. **Unblocks:** INTEGRATION-01, MCP-04; Gate B.

**Owns:**

- `neon/tests/run.ts`
- `neon/tests/provision.ts`
- `neon/tests/fixtures.ts`
- `neon/tests/clients.ts`
- `neon/tests/vitest.config.ts`
- `neon/tests/README.md`
- DB-01..03 live test files listed above, but only for harness integration/fixes exposed by actual Neon behavior

Root runner/workflow files are **not** owned here. The audited root `check:db` command and protected `v2-database` workflow already exist. If this task appears to require a root runner/CI change rather than a DB-04-owned harness fix, stop and route that evidence to INTEGRATION/change control.

Use pinned development CLI `neon@4.14.6` and `pg@8.16.3`; no management credential enters app/MCP code. Required environment: `NEON_API_KEY`, `NEON_TEST_PROJECT_ID`, `NEON_TEST_PARENT_BRANCH_ID`, `NEON_TEST_DATABASE`, `NEON_TEST_ADMIN_A_EMAIL/PASSWORD`, `NEON_TEST_ADMIN_B_EMAIL/PASSWORD`, `NEON_TEST_NONADMIN_EMAIL/PASSWORD`. Parent is a dedicated sanitized fixture branch with Neon Auth enabled and these three verified test accounts; it must not be production/default/protected. Missing variables fail immediately (no test skip).

The fixture parent contains no BemTeVi application tables/migrations, only platform Auth and the verified test accounts. This makes applying all existing non-idempotent CREATE POLICY migrations deterministic. Refuse a parent already containing `published_content` instead of dropping inherited tables. Map temporary `NEON_AUTH_BASE_URL` and `NEON_DATA_API_URL` to SDK config; never expose the temporary owner database URL to browser/MCP.

### Pinned CLI command contract

`provision.ts` invokes the local `neon@4.14.6` executable with `spawn`/`execFile`-style argument arrays, `shell:false`, and captured/redacted stdout/stderr. Before the first network mutation it runs the equivalent of `neon --version` and requires exactly `4.14.6`. These are the allowed management command shapes; do not substitute interactive `link`/`checkout`, context mutation, raw curl, or a second provisioning library:

```text
neon projects get <projectId> --output json
neon branches get <parentBranchId> --project-id <projectId> --output json
neon branches create --project-id <projectId> --parent <parentBranchId> --name <generatedName> --expires-at <oneHourRfc3339> --output json --no-secrets
neon data-api get --project-id <projectId> --branch <createdBranchId> --database <database> --output json
neon data-api create --project-id <projectId> --branch <createdBranchId> --database <database> --auth-provider neon_auth --db-schemas public --output json
neon env pull --project-id <projectId> --branch <createdBranchId> --service postgres --service auth --service data-api --file <verifiedTempDir>/.env
neon data-api refresh-schema --project-id <projectId> --branch <createdBranchId> --database <database>
neon branches delete <createdBranchId> --project-id <projectId>
```

For Data API creation, **absence** of `--add-default-grants` is normative; never pass it. If `data-api get` reports an already inherited/configured Data API, verify its branch/database/auth provider/exposed schema and that automatic default grants are not enabled; otherwise create with the command above. If the locally pinned `4.14.6` binary rejects any command/flag shape above, stop DB-04 and report the exact `--help` output as specification drift; do not improvise a different management path.

### Provision algorithm

1. Read project + parent with the exact read commands above. Require returned project/branch IDs to equal configured IDs. Reject parent if protected, if it is the project's default/primary branch, or if its normalized name is `main`, `master`, `production` or `prod`. Also reject if owner inspection finds `public.published_content` already present.
2. Generate `bemtevi-v2-test-<uuid>` and one-hour RFC3339 expiry. Create with the exact branch command above. Retain the returned branch ID and name; every later branch-scoped command uses that ID, never implicit context. Assert returned parent ID equals configured parent and returned name equals generated name.
3. Inspect or create Data API for `NEON_TEST_DATABASE` with auth provider `neon_auth`, exposed schema exactly `public`, and no automatic default grants. Use inherited Neon Auth and precreated test users, not fake admin JWT claims.
4. Create a process-owned temporary directory outside the repository, then run the exact `env pull` command. Never overwrite repository `.env*`. Parse without logging. Require pulled `NEON_BRANCH`/branch metadata (when emitted) to identify the newly created branch; independently retain the branch ID from create as the authoritative cleanup identifier.
5. Through `pg` and the temporary owner connection apply sorted existing/additive migrations, seed minimal valid publication and admin memberships for A/B only, then call exact `data-api refresh-schema`. Seed only the disposable branch.
6. Sign in separate SDK clients for admin A, admin B and nonadmin using pulled Auth/Data API URLs. The anonymous SDK client must actually obtain the public anonymous JWT; do not synthesize claims.
7. Run all DB-01..03 Vitest files in the DB-specific Node config against actual HTTP RPC/table access plus owner-only setup/inspection. Fixtures reset serially; no concurrent test-file reset. CAS tests use actual simultaneous HTTP requests.
8. Apply cutover artifact separately for its grant/E2E subsection. Verify direct write denial while public reads and guarded V2 publication remain functional.
9. In `finally`, delete **only** the retained created branch ID after re-reading it and verifying project ID + generated `bemtevi-v2-test-` name. Remove only the process-owned verified temp directory. Cleanup failure fails `check:db` and prints sanitized project/branch IDs, never credentials. Automatic one-hour branch expiry is backup for process kill, not successful cleanup.

Timeout provisioning at 120 seconds and the live suite at 10 minutes. Handle normal failure/interrupt through the same cleanup path. Persist only sanitized test results.

**Tests:** harness unit tests for missing credentials, CLI version mismatch, parent safety, incorrect create response, unsafe temp path, test failure cleanup and cleanup failure. Live DB-01..03 suites cannot be replaced with owner-role SQL-only tests.

**Commands:** `pnpm run check:db`, common credential-free commands, then full `pnpm run check`.

**Acceptance:** every accumulated DB-01..03 live suite executes without skips against actual anonymous/authenticated/capability Data API clients; protected CI job proves disposable branch creation and deletion; local credential-free gate remains independent; Gate B is green only here.
