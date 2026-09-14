# Canonical Dashboard Draft Tasks

**Specification revision: 8.**

Read 14 and 16. Consume repositories through fakes until live Gate B. No route/tab/publication composition edits in these tasks. The path patterns below are allowlists; do not modify other dashboard files to “make wiring easier”.

## DASHBOARD-01: Repository And Cache

**Depends:** MERGE-03.  
**Unblocks:** DASHBOARD-02.

**Owns exactly:**

- `src/dev-dashboard/drafts/draftTypes.ts`
- `src/dev-dashboard/drafts/draftRepository.ts`
- `src/dev-dashboard/drafts/draftInitialization.ts`
- `src/dev-dashboard/drafts/__tests__/draftRepository.test.ts`
- `src/dev-dashboard/drafts/__tests__/draftInitialization.test.ts`
- `src/dev-dashboard/draft-storage/localDraftCache.ts`
- `src/dev-dashboard/draft-storage/__tests__/localDraftCache.test.ts`

`draftRepository.ts` owns `DraftRepository`, the narrow structural `DraftRpcTransport`, and `createDraftRepository(transport)`. It maps only the fixed draft/publication RPCs from 15/16 and is tested with fakes in this lane. It MUST NOT import `src/app/neon/database.ts`, `BemTeViNeonClient`, `defaultNeonClient`, create another Neon client, or use `any`/double-casts to bypass missing V2 RPC typings. INTEGRATION-01 later registers the handwritten Database types and supplies the existing authenticated client structurally.

Implement exact `Result`-decoding RPC mapping, initialization handling and principal/tab-isolated IndexedDB recovery. No direct table writes or second Neon client. Repository methods and snake_case parameter keys are exactly those in 16/15.

**Tests:** every repository RPC maps exact method/arguments/result/error with a fake transport; initialization unavailable/conflict behavior; recovery cache key/principal/tab isolation; digest/base fields retained; no token/preparation secret written to cache.

**Commands:** common + the exact DASHBOARD-01 test files above.

**Acceptance:** repository/cache can be consumed without React or app Neon types and do not invent transport/auth behavior.

## DASHBOARD-02: Save Coordinator

**Depends:** DASHBOARD-01.  
**Unblocks:** DASHBOARD-03.

**Owns exactly:**

- `src/dev-dashboard/drafts/saveCoordinator.ts`
- `src/dev-dashboard/drafts/recoveryCoordinator.ts`
- `src/dev-dashboard/drafts/saveTransitions.ts`
- `src/dev-dashboard/drafts/draftPolling.ts`
- `src/dev-dashboard/drafts/__tests__/saveCoordinator.test.ts`
- `src/dev-dashboard/drafts/__tests__/recoveryCoordinator.test.ts`
- `src/dev-dashboard/drafts/__tests__/saveTransitions.test.ts`
- `src/dev-dashboard/drafts/__tests__/draftPolling.test.ts`

Implement every state transition in 16. One in-flight request, 250/750/5000/15000 timings, one automatic stale merge/CAS retry, ambiguous outcome read/compare/reconcile, no retry loop. Inject repositories/cache/clock/timers; no module-global draft state.

**Tests:** typing during save preserves later edits; first stale safe rebase, second stale conflict; ambiguous success via full read; ambiguous conflict; offline/error timer suspension; focus/online/poll serialization; clean no-op skips mutation; cache-write failure never claims local save; dispose epoch ignores late callbacks.

**Commands:** common + the four exact DASHBOARD-02 test files above.

**Acceptance:** state machine is deterministic/non-React and no code outside the allowlist is required to exercise it.

## DASHBOARD-03: Hook And Legacy Recovery Adapter

**Depends:** DASHBOARD-02.  
**Unblocks:** INTEGRATION-01.

**Owns production exactly:**

- `src/dev-dashboard/draft-storage/useDraftWorkspace.ts`
- `src/dev-dashboard/draft-storage/localDraftCache.ts` (handoff from DASHBOARD-01)
- new `src/dev-dashboard/draft-storage/legacyRecovery.ts`
- `src/dev-dashboard/draft-storage/WorkspaceHistory.tsx`
- `src/dev-dashboard/draft-storage/workspace.ts`
- `src/dev-dashboard/draft-storage/dashboardStorage.ts`
- `src/dev-dashboard/draft-storage/draftDb.ts`

**Owns tests exactly:**

- `src/dev-dashboard/__tests__/dashboardStorage.lifecycle.test.ts`
- `src/dev-dashboard/__tests__/dashboardStorage.migrations.test.ts`
- `src/dev-dashboard/__tests__/dashboardStorage.merge.test.ts`
- `src/dev-dashboard/__tests__/dashboardStorageTestFixtures.ts`
- new tests under `src/dev-dashboard/draft-storage/__tests__/**`

The old monolithic `src/dev-dashboard/__tests__/dashboardStorage.test.ts` is already removed at `e030264786ae7010aac7832203244882d12f9265`. **Do not recreate it.** No other `src/dev-dashboard/__tests__` file is owned in this task.

Rewrite hook to the 16 API. Keep old stores read-only for explicit one-time recovery and preserve original bytes. Existing legacy route still needs compatibility until INTEGRATION-02; expose V2 hook under temporary `useCanonicalDraftWorkspace`, then INTEGRATION-02 promotes the final export/signature while it owns `useDraftWorkspace.ts`.

Checkpoint restore creates a new candidate relative to current base; never decrements server generation. Legacy local generations are recovery metadata only, never Neon CAS generations.

**Tests:** restored-cache merge; principal/tab isolation; old generation not reused as Neon generation; failed import preserves original; multiple caches require explicit selection; logout/principal switch ignores late response; checkpoint cannot decrement generation; legacy bytes remain downloadable; no automatic legacy overwrite.

**Commands:** common + the listed `dashboardStorage.*` suites + every new file under `src/dev-dashboard/draft-storage/__tests__/**`.

**Acceptance:** no hidden legacy overwrite, state machine independent of React, current split storage tests stay split and green; pre-integration feature source has no application Neon client/type dependency or cast escape hatch.
