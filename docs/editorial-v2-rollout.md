# Editorial V2 Rollout — Staged Release Sequence And Evidence

**Status:** staged (V2-only code is not production-deployed, the direct-write cutover is not applied in production, the MCP is not npm-published, and production approval is pending).
**Owner actions still required before production approval:** deploy the V2-only app, apply the production cutover artifact, refresh the production Data API schema, publish the MCP package, and approve the cutover. These are owner-authorized and out of scope for the live suites.
**Never** write credentials into this document.

## Fixed rollout sequence

Recorded verbatim from `docs/plans/ai-content-editor-v2-revision-8/tasks/INTEGRATION.md` (INTEGRATION-03):

1. additive migrations;
2. V2 code deployed with `VITE_EDITOR_V2_ENABLED=false`;
3. disposable-branch E2E and installed-tarball live test green;
4. verify initialized draft `baseRevision` equals live revision;
5. authorized deploy/enable V2 with exact `'true'` flag;
6. separately apply direct-write cutover artifact;
7. refresh Data API schema;
8. verify old direct write denied and prepared admin/MCP publication succeeds;
9. only then permit LEGACY-01.

**Post-LEGACY-02 state:** The sequence above is retained as the historical coexistence sequence proven by INTEGRATION-03. `VITE_EDITOR_V2_ENABLED` and the legacy editor branch have since been removed. The production action is now a reviewed deploy of the V2-only app; there is no V2 enablement flag to flip.

## Dashboard browser smoke procedure

Recorded separately from API tests (execution pending an authorized disposable/test environment; do not fake results):

1. Start the V2-only app against a disposable-branch environment with `VITE_EDITOR_READ_ONLY=false`.
2. Open `/bemtevi/dashboard` in **two independent authenticated test sessions** (two browsers or two isolated profiles; two distinct verified admin accounts).
3. In session A: edit a draft field, save, reload — the page must resume the **canonical Neon draft** (not local storage).
4. In session B: observe the same canonical draft state after refresh (no divergent local drafts).
5. Exercise **file-first export/import preview**: export a selection, re-import the envelope, confirm the preview matches without publishing.
6. In the V2 branch, open the network panel and confirm **no legacy bridge/sync request** (`localhost:4318`, content-agent sync, draft-sync endpoints) occurs.
7. Use only disposable/test credentials. Never write credentials into this document.

## Rollback

- Set the emergency UI kill flag `VITE_EDITOR_READ_ONLY=true` (read-only UI: reads/diff/recovery download remain; mutations and publication are blocked in the browser).
- Apply the database kill artifact `neon/cutover/disable_editorial_writes.sql` (operator-invoked only).
- **Never** regrant legacy direct `published_content` publication.
- **Never** flip V2 back to legacy editing after cutover.
- **Never** overwrite the canonical draft as recovery.
- Restore only by an owner-reviewed regrant of the exact V2 wrapper signatures.

Full kill-artifact linearization verification (no new DB write after `disable_editorial_writes.sql` is linearized) is the **cutover phase**: the DB-04 harness re-runs only `grants.test.ts` with `NEON_TEST_CUTOVER_APPLIED=true` (phase-2 file list is hardcoded; editorial-e2e does not run in phase 2). The weak revocation fact (already-loaded client gets `invalid_capability` after revoke) is proven in `editorial-e2e.test.ts` and is sufficient for Gate C/D/E-live.

## Current staged status (evidence table)

| Sequence step                                    | State                                                            | Evidence                                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1. additive migrations                           | Proven on disposable branches                                    | DB-04 harness applies migrations every `pnpm run check:db` run                                           |
| 2. V2-only code staged                           | Code present, not production-deployed                            | INTEGRATION-02 implementation, followed by LEGACY-02 removal of the coexistence flag and branch          |
| 3. disposable-branch E2E green                   | Proven — editorial E2E and installed-tarball live test green     | `pnpm run check:db`: 10 files, 128 passed, 2 skipped                                                     |
| 4. initialized baseRevision == live              | Proven                                                           | `editorial-e2e.test.ts` — "initializes the draft with baseRevision equal to the live published revision" |
| 5. authorized production deployment              | **Not done** — owner action; no V2 enablement flag remains       | —                                                                                                        |
| 6. cutover artifact                              | **Not done** on production; applied only inside check:db phase 2 | DB-04 / grants cutover phase                                                                             |
| 7. refresh Data API schema                       | Part of check:db harness                                         | `run.ts`                                                                                                 |
| 8. old direct write denied; admin/MCP publish OK | Proven on the disposable branch                                  | grants cutover phase + editorial E2E + installed MCP package live test                                   |
| 9. legacy removal                                | Complete                                                         | LEGACY-00, LEGACY-01, LEGACY-02 and PRAGMA-STRIP handoffs are green                                      |

## Final Gate F - INTEGRATION-04

Final verification was run on 2026-09-15 after LEGACY-02 and PRAGMA-STRIP. The gates passed without source or configuration edits; this document is the only production-facing artifact updated by INTEGRATION-04.

| Command                                              | Result                                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm run check`                                     | PASS, exit 0: 128 files / 1,169 tests, architecture 518 files, production build, MCP 12 files / 120 tests |
| `pnpm run check:db`                                  | PASS, exit 0: 10 files / 128 passed / 2 skipped; cutover grants 6 passed / 2 skipped; branch deleted      |
| `pnpm run check:mcp-package`                         | PASS, exit 0: 49,010-byte tarball, 9 tools, two protocols, zero stdout noise, cleanup confirmed           |
| `pnpm run test:unit -- src/app/content src/features` | PASS, 16 files / 115 tests                                                                                |
| `pnpm run validate:flows`                            | PASS, 8 flows                                                                                             |
| `git diff --check`                                   | PASS                                                                                                      |
| `git status --short`                                 | Clean before the documentation update; clean again after the task commit                                  |

Final audit confirms the exact package and SDK pins, read-only `content:pull`, `VITE_EDITOR_READ_ONLY=false` with no `VITE_EDITOR_V2_ENABLED`, one production `prettier-ignore` detector token, and no operational runtime reference to the removed local architecture. Remaining search hits are intentional historical documentation, negative test fixtures, and architecture deny-lists.

### Live suite cases proven (`neon/tests/editorial-e2e.test.ts`)

| Case                                        | Test name                                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Aligned base/live revision                  | initializes the draft with baseRevision equal to the live published revision                                          |
| Distinct-field merge                        | rejects the second same-generation writer and applies the loser after refetch                                         |
| Overlapping/delete/order conflict           | gives stale_generation on overlapping fields and invalid_operations on a non-permutation reorder after delete         |
| Same-generation one-winner CAS              | lets the first prepare+publish win; the second prepare hits revision_conflict and the stale publish preparation_stale |
| Image/file roundtrip + cross-session export | captures an image-bearing material export with stable digest and owner-only retrieval                                 |
| Revoked capability denial                   | allows agent context before revoke and denies after revoke                                                            |
| Guarded admin publication                   | publishes via admin with null connection id and via agent with the delegating connection                              |
| Guarded MCP/agent publication               | (same test — agent path)                                                                                              |
| Post-kill linearization (weak)              | denies an already-loaded client after revoke and documents full kill-artifact proof as cutover-phase                  |

### Installed-tarball live test (`mcp-package-live.test.ts`) — green

The test builds and packs `@bemtevi/content-mcp@1.0.0`, installs the tarball into a temporary directory outside the repository with npm, launches that installed bin, and performs real anonymous Neon Auth acquisition plus Data API capability calls. It verifies the nine-tool catalog, edits the canonical draft, prepares and publishes revision 43, checks principal/connection attribution in Postgres, revokes the connection, and observes `invalid_capability` from the same installed process on its next fresh draft read. Temporary package directories and the disposable Neon branch are removed after the run.

**CC-I03-1 resolution:** an explicit DB-04 handback added `NEON_TEST_AUTH_URL: provisioned.authBaseUrl` to the `run.ts` suite environment. This is not a new endpoint or authority: DB-04 already pulled and used the branch Auth URL, and doc 04 already requires the standalone MCP to receive it. The handback only forwards the existing public endpoint to the live test process.

**Phase-2 hardcoding note (related):** `run.ts` phase 2 re-runs only `grants.test.ts` by filename. Strong kill-artifact assertions therefore cannot live in editorial-e2e without a run.ts edit (forbidden). Weak revocation proof in editorial-e2e is the Gate C/D/E-live substitute; full kill-artifact proof remains grants.test.ts cutover phase + this document.

## Owner-authorized production actions (not performed by live suites)

- Production deploy of the V2-only code with reviewed runtime configuration. `VITE_EDITOR_V2_ENABLED` no longer exists after LEGACY-02.
- Applying `neon/cutover/20260910004000_content_draft_revoke_direct_publish.sql` (or the emergency `disable_editorial_writes.sql`).
- Refreshing the production Data API schema after the migration/cutover operation.
- npm publish of `@bemtevi/content-mcp@1.0.0` (release prerequisite: `@bemtevi` scope permission).
- Production-approved cutover signoff.

## Change-control items (INTEGRATION-03)

| ID       | Item                                                                                                                                      | Classification                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| CC-I03-1 | Harness did not export `NEON_TEST_AUTH_URL` to suites; `mcp-package-live.test.ts` could not obtain `BEMTEVI_AUTH_URL`                     | **Resolved** — explicit one-line DB-04 suiteEnv handback; live gate green |
| CC-I03-2 | Phase-2 vitest filter hardcodes `grants.test.ts` only; strong kill-artifact proof cannot be added to editorial-e2e without editing run.ts | Disclosed — weak proof used; full proof stays in grants cutover phase     |
