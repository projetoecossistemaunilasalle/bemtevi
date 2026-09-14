# DASHBOARD-01 Handoff — Repository And Cache

**Task ID:** DASHBOARD-01 (revision 8 dossier)
**Starting HEAD:** `e030264786ae7010aac7832203244882d12f9265` (equals audited base; no drift-gate stop)
**Ending HEAD:** same commit (no commits made; all changes in the working tree, per task instructions)

## Inventory (owned files created/modified)

- `src/dev-dashboard/drafts/draftTypes.ts` (49 lines) — React-free re-export of the content-core draft contracts plus the doc-16 `DraftBaseSnapshot` (`DraftHead & { payload }`) used by the save state machine.
- `src/dev-dashboard/drafts/draftRepository.ts` (exactly 300 lines, architecture hard budget) — `DraftRpcTransport`, `DraftRpcCallResult`, `DraftRepository`, `createDraftRepository(transport)`; structural decoders `parseDraftHead`/`mapTransportError` are exported for tests.
- `src/dev-dashboard/drafts/draftInitialization.ts` (112 lines) — `initializeDraft({repository, cache, principalId, tabId})` implementing the doc-16 "load" transition: load/initialize, digest verify, own-tab recovery check.
- `src/dev-dashboard/drafts/__tests__/draftRepository.test.ts` (17 tests) — fake-transport mapping of every RPC: exact method/snake_case args, envelope success decode, domain error passthrough (with `currentHead`/`currentRevision`), transport error mapping (42501/PGRST301/401/403 → `unauthorized`, everything else → `unavailable`), malformed envelopes → `unavailable`, no raw token argument.
- `src/dev-dashboard/drafts/__tests__/draftInitialization.test.ts` (8 tests) — ready/resumed base, cache_conflict (generation/digest mismatch, record surfaced, never auto-resumed), unavailable on repository failure with cache preserved, `validation_failed` on digest mismatch (never seeds content), unavailable-cache reporting, other-tab records ignored.
- `src/dev-dashboard/draft-storage/localDraftCache.ts` (192 lines) — `DraftRecoveryRecord`, `recoveryRecordKey`, `getTabId` (sessionStorage `bemtevi:editor-v2:tab-id`), `LocalDraftCache` (`save/load/list/remove`, never throws), `createLocalDraftCache({indexedDB, sessionStorage, uuid})` over DB `bemtevi-editor-v2` v1, store `recovery` (keyPath `key`).
- `src/dev-dashboard/draft-storage/__tests__/localDraftCache.test.ts` (10 tests) — in-memory IndexedDB fake; round-trip retaining digest/base fields, secret stripping (stored record rebuilt field-by-field; extra token properties never persisted), principal/tab key isolation, principal-scoped listing, tab-scoped removal, unavailable/failed-open/failed-write paths, frozen DB name/version.

## Design summary

- **Repository:** `createDraftRepository` maps only the admin draft/publication RPCs of the frozen catalog (doc 15): `get_content_draft` (load), `get_content_draft_head` (head), `apply_content_draft_operations` (`p_expected_generation`, `p_operations`), `prepare_content_draft_publish` (`p_preparation_id`, `p_generation`, `p_expected_revision`, `p_digest`, `p_token_hash`), `publish_content_draft` (`p_preparation_id`, `p_publish_token`). The `DraftRpcTransport` is a narrow structural interface satisfied by the existing authenticated Neon client; the module imports nothing from `src/app/neon/**`, creates no client, uses no `any` and no double-casts. Success envelopes are structurally decoded (head id/schemaVersion/counters/hex-64 digest/actor, six-field payload, etc.); malformed envelopes decode to `unavailable`; unknown domain codes decode to `unavailable`; optional error fields are kept only when structurally valid.
- **Initialization:** verifies the draft's `(payload, canonicalPayload, digest)` triple with content-core `verifySnapshot` before building a base; a matching own-tab record resumes `localPayload`; a mismatching record is returned as `cache_conflict` (generation or digest reason) and never auto-merged; repository/digest failures return `unavailable` and never delete or overwrite the recovery record.
- **Cache isolation:** key `${principalId}:${tabId}`; each tab writes only its own record; `list` filters by principalId (other-tab records remain offered, never auto-applied); `remove` deletes only the current tab's record. No capability/preparation token can be persisted (stored record is rebuilt from an explicit field whitelist). IndexedDB absence or failure yields `unavailable`/`false`, never a throw, so memory stays intact (`cacheAvailable=false`).

## Commands executed (exact results, working tree at `e030264…`)

| Command                       | Result                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`          | PASS, exit 0                                                                                          |
| `pnpm run lint`               | PASS, exit 0                                                                                          |
| `pnpm run format:check`       | PASS — "All matched files use Prettier code style!" (after `prettier --write` on 4 owned files)       |
| `pnpm run check:architecture` | PASS — "Architecture check passed (472 source files)." (draftRepository.ts exactly 300 = hard budget) |
| `pnpm run test:unit`          | PASS — 119 test files, 1037 tests passed (includes the 3 owned files: 17 + 8 + 10 = 35 tests)         |
| `pnpm run validate:flows`     | PASS — "Flow/content validation passed for 8 flow(s)."                                                |

Note: initial `pnpm run test:unit -- <files>` runs the full root suite (the runner does not filter), so focused verification used `pnpm exec vitest run <files>` (38 tests, all green) plus the full suite above.

## Deferred gates

- `pnpm run check:db` (Gate B) — already green from DB-04; not re-run here (no DB changes).
- `pnpm run check` full build — not owned by this task; all owned-scope components (typecheck/lint/format/flows/tests/architecture) green.
- No publication/UI wiring: no route, tab, flag, or composition files touched (INTEGRATION-01/02 own those).

## Notes for downstream tasks

- **DASHBOARD-02 (unblocked):** consume `DraftRepository` + `LocalDraftCache` via fakes; `initializeDraft` returns the `ready`/`cache_conflict`/`unavailable` states the load transition needs. `cacheAvailable` on the `unavailable` outcome reflects a successful cache lookup (probe), per "failure preserves cache".
- **INTEGRATION-01:** the structural transport accepts `client.rpc(method, args)`-shaped clients once V2 functions are registered in `src/app/neon/database.ts`; composition must pass the existing authenticated client structurally.
- Repository tsconfig has no `strict`; literal-discriminant narrowing requires `===`/`!==` comparisons (truthiness narrowing is unreliable in this repo) — followed in all owned modules.
- Unrelated pre-existing working-tree changes (MERGE/DB lanes, old dossier deletion) were preserved untouched.
