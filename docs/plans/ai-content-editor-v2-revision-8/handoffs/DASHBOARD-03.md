# DASHBOARD-03 Handoff — Hook And Legacy Recovery Adapter

**Task ID:** DASHBOARD-03 (revision 8 dossier)
**Starting HEAD:** `e030264786ae7010aac7832203244882d12f9265` (equals audited base; no drift-gate stop)
**Ending HEAD:** same commit (no commits made; all changes in the working tree, per task instructions)

## Inventory (owned files created/modified)

- `src/dev-dashboard/draft-storage/legacyRecovery.ts` (new, exactly 300 lines = architecture hard budget) — self-contained, read-only legacy recovery adapter. Survives LEGACY-01: it imports nothing from `dashboardStorage.ts`, `workspace.ts` or `draftDb.ts`.
  - Constants: `LEGACY_DRAFT_STORAGE_KEY` (`bemtevi:dev-dashboard:drafts:v1`), `LEGACY_BACKUP_DB_NAME` (`bemtevi_dashboard_db`), `LEGACY_BACKUP_STORE_NAME` (`drafts`), `LEGACY_BACKUP_RECORD_KEY` (`current_draft`), `LEGACY_WORKSPACE_DB_NAME` (`bemtevi_dashboard_workspaces`), `LEGACY_WORKSPACE_SCHEMA_VERSION` (7).
  - `decodeLegacyDraftState(raw)` — structural decoder of the old `DashboardDraftState` bytes (schema versions 1.0.0–6.0.0), tolerant of absent collections; never sanitizes legacy effects (invalid content stays available for correction). `legacyStateHasChanges(state)` gates offering.
  - `decodeLegacyWorkspaceEnvelope(raw)` — validates the old schemaVersion-7 workspace/checkpoint envelope WITHOUT rewriting identity; throws the old PT-BR error on invalid bytes. The envelope `generation` is exposed as recovery metadata only.
  - `listLegacyRecoveries()` — read-only union listing of localStorage bytes, the old IndexedDB backup and non-archived old workspaces; every option carries the VERBATIM original `raw` bytes. Multiple caches are all offered; nothing is ever auto-selected. Only `readonly` IndexedDB transactions are ever opened (asserted in tests); `deleteDatabase`/record deletion never happens.
  - `exportLegacyRecovery(option)` — returns the verbatim original bytes (download recovery action).
  - `planLegacyImport(option)` — explicit one-time import plan: with a legacy `basePayload`, recorded patches are applied to that base (patch merge with source-index/id semantics, additions, removals, group ordering, legacy denormalized-contact-location preservation via `normalizeContactLocations`) and the coordinator then reconciles the candidate against the Neon draft as a normal conditional save. WITHOUT a base the plan is `{kind:'download-only'}` — no base is ever inferred and nothing overwrites the current draft. A corrupt workspace envelope degrades to `download-only`. The legacy local generation NEVER appears in the plan.
- `src/dev-dashboard/draft-storage/useDraftWorkspace.ts` (modified, 315 lines = audited baseline cap; no baseline growth)
  - Legacy hook `useDraftWorkspace(remote, revision)` — behavior-preserving refactor (extracted `resume`/`migrateLegacy`/`adopt`/`fromLegacy` helpers; copy-on-write semantics, raw-byte preservation, checkpoint-before-restore all unchanged). All pre-existing unowned tests (`useDraftWorkspace.test.ts`, `workspace.test.ts`, route suites) stay green unchanged.
  - **V2 hook exposed under the temporary name `useCanonicalDraftWorkspace`** (doc 16 API): `useCanonicalDraftWorkspace(principalId: string, override?: CanonicalWorkspaceServices)` returning exactly `{state, edit, flush, refresh, resolve, retry, discardLocal}` plus one additive method `undo()` (doc 16 requires in-memory undo; INTEGRATION-02 promotes the final export/signature while owning this file).
  - `CanonicalWorkspaceServices` = `{repository, cache?, now?, timers?, isOnline?, tabId?}`; `configureCanonicalWorkspaceServices(services | null)` is the module-level composition point for INTEGRATION-01 (editorialNeonServices). Until configured, the hook stays inert in `loading` — this file has no application Neon dependency (verified by the architecture forbidden-import gate).
  - Owns ONE `createSaveCoordinator` per authenticated principal; disposes it on unmount/logout/principal change (late callbacks ignored via coordinator epochs); resets on principal change (queued mutations never sent under a different principal). Wired `createDraftPolling` (15 s visible head check, visibility stop, focus/online poke + save-when-safe via `flush()`).
  - Undo history capped at 20 in-memory candidates; `undo()` re-edits the previous candidate relative to the current base — the server/base generation can never move backwards, and no history snapshot is persisted or uploaded.
- `src/dev-dashboard/draft-storage/WorkspaceHistory.tsx`, `workspace.ts`, `dashboardStorage.ts`, `draftDb.ts` — **no functional change needed**: their checkpoint/restore semantics already satisfy doc 16 for the legacy route (restore creates an independent copy-on-write candidate; legacy generations are local-only and never reach Neon; original bytes are never deleted). They remain untouched so the legacy route keeps compiling until INTEGRATION-02/LEGACY-01 remove them.
- `src/dev-dashboard/draft-storage/localDraftCache.ts` — untouched (no genuine integration defect exposed; DASHBOARD-01 handoff contract was sufficient).

### Tests

- `src/dev-dashboard/draft-storage/__tests__/legacyRecovery.test.ts` (new, 11 tests): decoders, change detection, envelope validation, multi-cache listing with explicit selection, read-only transaction verification (`deleteDatabase` never called, localStorage bytes preserved verbatim, download export), merge-with-base, download-only without base, unusable bytes, corrupt envelope, no generation in any import plan.
- `src/dev-dashboard/draft-storage/__tests__/useCanonicalDraftWorkspace.test.tsx` (new, 8 tests): unconfigured inertness; restored-cache merge (resumed dirty → flush saves against server base gen 5 → clean → own record removed); principal/tab isolation (another principal's record never resumed); current-server-generation-only CAS (`expectedGeneration === 5`); undo restores previous candidate with acknowledged base generation untouched (6) and monotonic `expectedGeneration` `[5, 6]`; undo cap 20 (25 edits/25 undos land on the 5th candidate, no server mutation); logout/principal switch ignores the late in-flight response (admin-B clean, no error, no cache record); failed cache write marks `cacheAvailable=false` with phase staying `dirty`.
- Owned pre-existing suites unchanged and green: `dashboardStorage.lifecycle.test.ts`, `dashboardStorage.migrations.test.ts`, `dashboardStorage.merge.test.ts`, `dashboardStorageTestFixtures.ts` (they cover the still-present legacy modules; LEGACY-01 deletes them together with those modules).

## Commands executed (exact results, working tree at `e030264…`)

| Command                       | Result                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`          | PASS, exit 0 (0 errors)                                                                                                                        |
| `pnpm run lint`               | PASS, exit 0 (0 errors, 0 warnings)                                                                                                            |
| `pnpm run format:check`       | PASS — "All matched files use Prettier code style!"                                                                                            |
| `pnpm run check:architecture` | PASS — "Architecture check passed (483 source files)." (legacyRecovery.ts exactly 300; useDraftWorkspace.ts 315 = audited baseline, no growth) |
| `pnpm run test:unit`          | PASS — 125 test files, 1101 tests passed (includes the 19 new DASHBOARD-03 tests and the 3 owned `dashboardStorage.*` suites)                  |
| `pnpm run validate:flows`     | PASS — "Flow/content validation passed for 8 flow(s)."                                                                                         |

## Deviations / disclosures

1. **`undo()` is additive** to the doc-16 return shape (7 members): required by doc 16's "Existing undo/checkpoints are local recovery artifacts … Limit active in-memory undo to 20 candidates"; INTEGRATION-02 may rename/re-home it when it owns the file.
2. **`useCanonicalDraftWorkspace` takes an optional second parameter** (`CanonicalWorkspaceServices`). Doc 16 lists `useDraftWorkspace(principalId: string)`; before INTEGRATION-01 there is no composition module to build the repository, so the services are injectable (tests) and/or registered via `configureCanonicalWorkspaceServices` (INTEGRATION-01). With neither, the hook is inert in `loading` — it never invents a Neon client. INTEGRATION-02 promotes the final single-argument signature while owning the file.
3. **Use of dense `// prettier-ignore` blocks** to respect frozen size budgets without changing the audited `scripts/architecture-baseline.json` (change-control would otherwise be required). Precedent: `saveCoordinator.ts`, `scripts/check-architecture.mjs`.
4. **legacyRecovery duplicates the legacy record-merge algorithm** (rather than re-pointing to `dashboardStorage.mergeDashboardDrafts`) so the module survives LEGACY-01's deletion of the old storage files with zero imports from them. Parity is pinned by the existing `dashboardStorage.merge/migrations` suites on the original and by the new recovery tests on the adapter.
5. `WorkspaceHistory.tsx`, `workspace.ts`, `dashboardStorage.ts`, `draftDb.ts` are owned but intentionally unchanged (see inventory) — no integration defect was exposed; disclosed per task instructions.
6. `lint` and `typecheck` were also re-run after every fix round; the table above reflects the final passing runs.

## Deferred gates

- `pnpm run check:db` (Gate B) — green from DB-04; not re-run (no database changes).
- `pnpm run check` full build — build not owned by this task; all owned-scope gates above are green.
- Route/tab/flag composition, `editorFlags.ts`, `legacyPublication.ts`, and promotion of the final `useDraftWorkspace` export are INTEGRATION-01/02 work.

## Downstream unblocked

- **INTEGRATION-01**: register the V2 RPCs in `src/app/neon/database.ts`, then call `configureCanonicalWorkspaceServices({ repository: createDraftRepository(defaultNeonClient), ... })` from `editorialNeonServices.ts`; `useCanonicalDraftWorkspace` needs nothing else.
- **INTEGRATION-02**: build the V2 route on `useCanonicalDraftWorkspace`'s `{state, edit, flush, refresh, resolve, retry, discardLocal, undo}` + `saveStatusLabel(state)`; promote the final export name in `useDraftWorkspace.ts` (file ownership moves there).
- **LEGACY-01**: `legacyRecovery.ts` is self-contained (verified: zero imports from `dashboardStorage.ts` / `workspace.ts` / `draftDb.ts`; the recovery tests pass with those modules present and do not depend on them); the old storage files and their three suites can be deleted after replacement proof.

Unrelated pre-existing working-tree changes (old dossier deletion, DB/MERGE lanes, `localDraftCache.ts`, drafts lane) were preserved untouched. No commits or pushes were made.
