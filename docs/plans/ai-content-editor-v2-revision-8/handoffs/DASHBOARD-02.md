# DASHBOARD-02 Handoff — Save Coordinator

**Task ID:** DASHBOARD-02 (revision 8 dossier)
**Starting HEAD:** `e030264786ae7010aac7832203244882d12f9265` (equals audited base; no drift-gate stop)
**Ending HEAD:** same commit (no commits made; all changes in the working tree, per task instructions)

## Inventory (owned files created/modified)

- `src/dev-dashboard/drafts/saveTransitions.ts` (293 lines) — pure state machine: frozen `TIMINGS` (250/750/5000/15000 ms), `SaveState`/`SavePhase`, `initializedState`, `saveStatusLabel` (exact PT-BR labels + cache-failure override), transition builders (`toDirty/toSaving/toClean/toConflict/toError`), `mergeOutcome`, `applyRemote`, `acknowledgeMutation`, `staleRebase`, `failureDecision`, `sameHead`, `SaveCycle`/`RemoteDraft` types and the doc-16 `SaveCoordinatorOptions`/`SaveCoordinator` contracts.
- `src/dev-dashboard/drafts/saveCoordinator.ts` (298 lines, architecture hard budget) — `createSaveCoordinator(options)`: orchestration only; every state decision delegated to the pure helpers in `saveTransitions`. Instance-scoped state (no module globals), lifecycle-epoch guards (`alive(e)`) after every await, `disposed` flag.
- `src/dev-dashboard/drafts/draftPolling.ts` (151 lines) — `createDraftPolling` (15 s visible head check, no overlapping reads, poke serialization, visibility stop, dispose epoch) plus `createAutosaveScheduler` (750 ms trailing + one-shot 5 s maximum-wait deadline that is never pushed forward by later edits) and `createDebounceScheduler` (250 ms recovery-cache write).
- `src/dev-dashboard/drafts/recoveryCoordinator.ts` (113 lines) — pure record functions + `createRecoveryCoordinator` (own-tab save/clear/list) and `createRecoveryRecorder` (fire-and-forget record lifecycle: cache-write failure marks `cacheAvailable=false`; clean-record removal re-written when late edits arrive).
- Tests: `__tests__/saveCoordinator.test.ts` (485 lines, 25 tests), `__tests__/saveTransitions.test.ts` (180, 11), `__tests__/draftPolling.test.ts` (170, 7), `__tests__/recoveryCoordinator.test.ts` (129, 6) — 49 tests in the drafts lane; full root suite 123 files / 1082 tests green.

## State machine design (doc 16, "State Transitions")

- **load** — `initializeDraft` (DASHBOARD-01) does load/verify/cache check; `unavailable` → `error`/`offline` preserving any retained base/local and the cache; `cache_conflict` → `conflict` (`retry_required`); ready+resumed record → `dirty` with autosave armed; ready clean → `clean` (`local: null`; clean means fully synced).
- **edit (clean/dirty/saving)** — local updated immediately. During an in-flight mutation only `state.local` moves (captured B/C untouched, phase stays `saving`); otherwise `dirty` with 750 ms trailing autosave re-armed and the 5 s maximum-wait deadline set **once** on the clean→dirty transition (scheduler in `draftPolling`). A 250 ms trailing cache write is re-scheduled per edit.
- **save trigger (timer/flush)** — snapshot B and C, `encodeOperations`; invalid → `error`; **zero operations → `clean` without RPC** and own recovery record removed; else one in-flight `mutate(expectedGeneration: B.generation)`.
- **successful save** — `acknowledgeMutation(current, head, state.local)`: if `state.local` is the same reference captured at send time (no edits during the request) the acknowledged content is latest → clean + record removal; otherwise reconcile `{base: C, local: L, remote: sentPayload}` so later edits are carried forward; incomplete rebase → `conflict` (candidate never persisted, remote retained); complete rebase → `dirty` with the remaining delta saved immediately (timer 0) after the in-flight request completes.
- **stale_generation** — full remote read (digest-verified via `verifySnapshot`), reconcile `{base: B, local: C, remote: R}`; complete → **exactly one** CAS retry (`beginSend(..., retryUsed: true)`); second stale in the same cycle → `conflict`/`retry_required` retaining local/base and the latest remote; **no timer-driven loop**.
- **ambiguous network outcome** (`unavailable` on mutate) — full remote read; if `sameContent(remote.payload, sentPayload)` → acknowledged as saved at the remote head; otherwise reconcile from the original B and one conditional retry; exhausted budget → `error`/`offline`. Never assumes rollback or blindly increments generation.
- **offline / error** — browser-offline (injected `isOnline`) → `offline`, otherwise `error`; local/base preserved; all autosave, cache and max-wait timers suspended in terminal phases (`settle`); no retry loop.
- **online/focus/poll** — `draftPolling` pokes → `refresh(saveIfDirty)`: head read; unchanged → save-if-dirty only; changed → full read, `applyRemote` (clean adopt / reconcile / conflict); refresh during a mutation is queued once and runs after it settles. `flush()` drives the loop until not saving and reports `phase === 'clean'`.
- **resolve(decisions)** — re-fetch head; if changed fetch remote and recompute conflicts (decision ids fingerprint inputs, so only matching ids survive); all resolved → one conditional save against the fetched remote with one automatic retry budget.
- **retry** — new bounded save cycle after a full refresh; never a force overwrite; load failure falls back to re-`load`.
- **discardLocal** — canonical full read replaces local/base, current-tab recovery record removed; the Neon draft is never reset.
- **dispose / principal change** — `load(principalId)` bumps the epoch (late callbacks from the previous principal are dropped and no queued mutation is sent under the new principal); `dispose` cancels timers, wakes `flush` waiters (which return `false`) and ignores every late callback.

## Semantics note (deviation-free interpretation disclosed)

- `SaveState.local` is `null` when clean (doc's `local` is the unsynced candidate); the acknowledged base payload is the attempted candidate until the next full read verifies canonical text (doc 16 note — no full read after every successful save, per the payload-cost budget).
- "Reconcile {base:C, local:L, remote:A}" is applied only when edits actually happened during the request (reference comparison against the captured local). Without edits during a stale-retry the client would otherwise "delete" retry-merged items; with no edits the acknowledged content is adopted directly, which matches the doc's "If no later edits local=A".
- `saveTransitions.ts` grew to 293 lines because the pure decision core (`applyRemote`, `acknowledgeMutation`, `staleRebase`, `failureDecision`, `initializedState`) plus the coordinator contracts moved there to keep `saveCoordinator.ts` inside the 300-line architecture hard budget (final: 298). Dense `// prettier-ignore` one-line guards are used in `saveCoordinator.ts` (repo precedent: `scripts/check-architecture.mjs`). All four files respect the ts=300 / test=500 hard budgets.
- Optional injected `isOnline`/`tabId` were added to `SaveCoordinatorOptions` (doc 16 signature lists repository/cache/now/timers/onChange; the hook needs tab isolation and offline classification).

## Commands executed (exact results, working tree at `e030264…`)

| Command                       | Result                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`          | PASS, exit 0 (0 errors)                                                                            |
| `pnpm run lint`               | PASS, exit 0 (0 errors, 0 warnings)                                                                |
| `pnpm run format:check`       | PASS — "All matched files use Prettier code style!"                                                |
| `pnpm run check:architecture` | PASS — "Architecture check passed (480 source files)." (saveCoordinator.ts 298 ≤ 300; tests ≤ 500) |
| `pnpm run test:unit`          | PASS — 123 test files, 1082 tests passed (includes the 4 owned DASHBOARD-02 test files, 49 tests)  |
| `pnpm run validate:flows`     | PASS — "Flow/content validation passed for 8 flow(s)."                                             |

## Deferred gates

- `pnpm run check:db` (Gate B) — green from DB-04; not re-run here (no database changes).
- `pnpm run check` full build — not owned by this task; all owned-scope gates above are green (build not exercised).
- No UI wiring: no hook, route, flag, or composition files touched (DASHBOARD-03 / INTEGRATION-01/02 own those).

## Downstream unblocked

- **DASHBOARD-03** may consume `createSaveCoordinator` + `createDraftPolling` + `saveTransitions` helpers via fakes: `refresh()` is the plain head sync, the polling callback should call it with save-on-dirty semantics via the coordinator's public `refresh()` wiring, and `saveStatusLabel(state)` provides the exact PT-BR labels (including the cache-failure override and the beforeunload/`unsynced` semantics via `phase`).
- `SaveState.local === null` signals a fully synced draft; resumed dirty state and conflict flows surface exactly as described above.
- Unrelated pre-existing working-tree changes (old dossier deletion, MERGE/DB lane edits) were preserved untouched.
