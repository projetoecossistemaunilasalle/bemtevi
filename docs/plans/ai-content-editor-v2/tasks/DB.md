# Database Tasks

Read 15 in full. Tests require a disposable branch of a dedicated test project, never production. Use 14 operation fixtures. Common commands in README apply to each task.

## DB-01: Tables And CAS

**Depends:** MERGE-02. **Unblocks:** DB-02. **Parallel:** DB lane can run beside dashboard/file/MCP after MERGE-03.
**Owns:** first two migrations in 15; neon/tests/drafts.test.ts, operations.test.ts, images.test.ts, rpc-types.ts.
Implement exact tables, audit-trigger amendment and private helpers, admin load/head/mutate. Do not add public policies granting direct new-table access. Do not apply cutover SQL. Keep absent publication error, bounded/no-op CAS and all-or-nothing operation application.
**Tests:** empty initialization fails safely, concurrent initialization one row, same-generation concurrent writers exactly one changed success, stale/no-op behavior, atomic batch rollback, SQL/TS operation fixture parity and decoded image/total byte bounds. Verify draft head omits payload.
**Commands:** common + check:db when harness available in DB-04; earlier SQL task cannot be merged as DB-complete without it.
**Acceptance:** exact schema/signature inspection assertions and mutation invariants. No claiming mocks prove RLS.

## DB-02: Delegation And Durable Exports

**Depends:** DB-01. **Unblocks:** DB-03.
**Owns:** third migration; neon/tests/capabilities.test.ts, exports.test.ts.
Implement fixed agent wrapper catalog, anonymous gateway role, decoded token hashing, current admin membership, locks, throttled last_used_at, expiry/revoke/idempotent create, owner-isolated export bases and serial five-row pruning. List/get/reference tools do not become SQL RPCs.
**Tests:** anonymous and non-admin direct reads/writes to protected tables fail; execute grants exact; valid capability read/edit; every invalid secret/lifecycle/principal case same error; one connection cannot impersonate another, create/revoke connections or read exports; concurrent export creation never >5; same admin different session can retrieve; other admin cannot; exact 14-day boundary and digest.
**Commands:** common + check:db.
**Acceptance:** no returned/persisted raw secret, no broad role grants, revoked connections retained, owner and execution actor separate.

## DB-03: Atomic Guarded Publication

**Depends:** DB-02. **Unblocks:** DB-04.
**Owns:** fourth migration, separately staged cutover revocation and disable_editorial_writes.sql from 15; neon/tests/publication.test.ts, grants.test.ts.
Implement one private publisher with admin/agent wrappers, preparation token hashes, terminal outcomes and stored result replay. Preserve existing history trigger as sole history writer.
**Tests:** same preparation concurrent publish yields one revision increment and one history row; success replay returns original result after draft changes/preparation expiry; invalid/revoked/expired capability still fails replay; stale draft/revision/digest/token failures; SQL exception rollback across history/current/draft/preparation; admin attribution and connection audit; base/live mismatch fails closed during coexistence. Test cutover grants separately after legacy direct-write coexistence assertions.
**Commands:** common + check:db.
**Acceptance:** publication cannot accept a replacement payload, preparation race/expiry correct, all public reads survive cutover. Cutover SQL not in automatic additive migration directory.

## DB-04: Actual Neon Harness And Security Gate

**Depends:** DB-03, INTEGRATION-00. **Unblocks:** INTEGRATION-01; Gate B.
**Owns:** neon/tests/{run,provision,fixtures,clients}.ts, neon/tests/vitest.config.ts, neon/tests/README.md and tests in DB-01..03. Root workflow changes remain integration-owned.

Use pinned development CLI neon@4.14.6 and pg@8.16.3 through root runner; no management credential in app/MCP. Required environment: NEON_API_KEY, NEON_TEST_PROJECT_ID, NEON_TEST_PARENT_BRANCH_ID, NEON_TEST_DATABASE, NEON_TEST_ADMIN_A_EMAIL/PASSWORD, NEON_TEST_ADMIN_B_EMAIL/PASSWORD, NEON_TEST_NONADMIN_EMAIL/PASSWORD. Parent is a dedicated sanitized fixture branch with Neon Auth enabled and these three verified test accounts; it must not be production/default. Missing variables fail immediately (no test skip).

The fixture parent contains no BemTeVi application tables/migrations, only platform Auth and the verified test accounts. This makes applying all existing non-idempotent CREATE POLICY migrations deterministic. Refuse a parent already containing published_content instead of dropping inherited tables. Map temporary NEON_AUTH_BASE_URL and NEON_DATA_API_URL to SDK config; never expose the temporary owner database URL to browser/MCP.

Provision algorithm:

1. Inspect configured parent using CLI branches get with explicit project and JSON output; reject default/protected parent. Generate name bemtevi-v2-test-<UUID>.
2. CLI branches create --project-id <project> --parent <parent> --name <name> --output json; retain returned ID. All subsequent commands use that returned ID, never current context.
3. Set one-hour expiry; inspect/get or create Data API for test database with auth-provider neon_auth, db-schemas public and no default grants. Use inherited Auth and precreated test users, not fake admin JWT claims.
4. Pull test-only URLs/connection into a temporary directory using env pull --project-id ... --branch ... --service postgres,auth,data-api --file <temp>/.env; never overwrite repository env. Parse without logging. Assert returned branch ID matches newly created branch before SQL.
5. Through pg and owner connection apply sorted existing/additive migrations, seed minimal valid publication and admin memberships for A/B, not nonadmin. Seed only test branch. Refresh Data API schema cache. Sign in separate SDK clients for A, B and nonadmin; anonymous SDK must actually obtain public anonymous JWT.
6. Run Vitest node environment against actual HTTP RPC/table access plus owner-only setup/inspection. Tests independently create/reset fixtures inside branch; no concurrent test file resets. Use actual simultaneous HTTP requests for CAS race.
7. Apply cutover separately for its grant/E2E suite. Finally delete only returned branch ID, verified name prefix and project; remove only verified temp directory. Cleanup failure fails command and reports branch ID (no credentials).

CLI reference is linked in 17; subprocesses use argument arrays, capture/redact credentials, not shell-built SQL. Persist only sanitized test results. Timeout provisioning at 120 seconds and suite at 10 minutes; finally cleanup runs on normal failure/interrupt. Automatic branch expiry is backup for process kill.

**Tests:** harness unit tests for missing credentials, parent safety, incorrect returned ID, test failure cleanup and cleanup failure. Live tests listed above cannot be replaced with owner-role SQL-only tests.
**Commands:** pnpm run check:db, common, full pnpm run check.
**Acceptance:** live anonymous/authenticated/capability cases pass without skips. Protected CI job result includes disposable branch creation and deletion; local credential-free gate remains independent.
