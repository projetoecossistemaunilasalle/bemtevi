# Canonical Dashboard Draft Tasks

Read 14 and 16. Consume repositories through fakes until live Gate B is green. No route/publication composition edits in these tasks.

## DASHBOARD-01: Repository And Cache

**Depends:** MERGE-03. **Unblocks:** DASHBOARD-02. **Parallel:** dashboard lane only.
**Owns:** src/dev-dashboard/drafts/{draftTypes,draftRepository,draftInitialization}.ts; draft-storage/localDraftCache.ts; adjacent tests.
draftTypes re-exports core, not duplicate schemas. Implement repository signatures and exact RPC argument mapping from 16/15, strict Result decoding and digest verification. Cache database/store/key/principal isolation exactly as 16. No direct table writes or second Neon client singleton.
**Tests:** all RPC mappings, permission/transport failures, corrupt digest/JSON responses, principal-separated cache, storage denial, two tabs do not overwrite cache, no secret fields persisted.
**Commands:** common plus focused new drafts/cache paths.
**Acceptance:** transport and cache independently testable; failed read never initializes from bundle.

## DASHBOARD-02: Save Coordinator

**Depends:** DASHBOARD-01. **Unblocks:** DASHBOARD-03.
**Owns:** drafts/saveCoordinator.ts, drafts/recoveryCoordinator.ts, drafts/saveTransitions.ts, drafts/draftPolling.ts and their tests.
Implement exact 16 transition table and API. Separate state changes from timer/network effects; capture B/C and later L explicitly. Coordinator owns one automatic merge-and-CAS retry per cycle, including ambiguous result handling. Validation issues do not erase structurally valid local edits or block autosave.
**Tests:** fake timers for 250/750/5000/15000 ms, one in-flight/coalescing, edits during successful/merged saves retained, duplicate callbacks ignored after dispose, no payload fetch for unchanged poll, hidden polling stopped, overlapping conflict/second race, ambiguous success by semantic equality, offline/reconnect, storage failure, explicit retry/discard.
**Commands:** common and focused drafts tests.
**Acceptance:** every state-table row covered; no retry loop, lost local keystroke, false Saved indicator or local last-write-wins.

## DASHBOARD-03: Hook And Legacy Recovery Adapter

**Depends:** DASHBOARD-02. **Unblocks:** INTEGRATION-01.
**Owns:** draft-storage/useDraftWorkspace.ts, localDraftCache.ts, legacyRecovery.ts, WorkspaceHistory.tsx, workspace.ts, dashboardStorage.ts, draftDb.ts, `src/dev-dashboard/__tests__/{useDraftWorkspace,workspace,dashboardStorage,draftDb}.test.ts`.
Rewrite hook to 16 API. Keep old stores read-only for explicit one-time recovery; stop creating independent canonical workspaces. Preserve original bytes; missing old base permits download only. Adapt undo/history to create current-generation candidates. Keep compatibility exports needed by old route temporarily; the old UI is still wired until INTEGRATION-02, so expose V2 hook as useCanonicalDraftWorkspace during this task and promote to useDraftWorkspace in INTEGRATION-02.
**Tests:** real hook lifecycle with fakes, restored older cache merges, wrong principal cache never shown, old workspace generation not treated as Neon generation, failed import retains original, multiple caches explicit selection, logout late response ignored, checkpoint restore cannot decrement server generation.
**Commands:** common plus listed existing tests, full check at Gate C integration.
**Acceptance:** no hidden automatic legacy overwrite; state-machine behavior independent of React, hook below budget. Temporary exports explicitly removed by LEGACY-01, not permanent alternate persistence.
