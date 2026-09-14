# MERGE-03 Handoff — Preserve Semantic Reconciliation

**Task:** MERGE-03 (specification revision 8) — move the semantic compare/reconcile implementation into `@bemtevi/content-core` while preserving export names, canonical conflict IDs/fingerprints and behavior; dashboard files become thin facades.

**Status:** Complete.

**HEAD at execution:** `e030264786ae7010aac7832203244882d12f9265` (audited base; working tree also carries uncommitted MERGE-01/MERGE-02 artifacts — nothing committed or pushed by this task).

## Inventory (files touched by MERGE-03)

Canonical implementation (new, under owned path `packages/content-core/src/content-reconciliation/`):

- `types.ts` — `ValueSlot`, `PathSegment`, `ContentPath`, `SemanticChange`, `SemanticConflict`, `ConflictDecisions`, `ComparisonResult`, `SemanticMerge`, plus `contentIdentity` and the (previously module-private) `fingerprint`, shared helpers (`slot`, `equal`, `keyed`, `mapById`, `idsOf`, ...).
- `compare.ts` — `assertComparable`, `compareContent` (byte-identical logic to the legacy dashboard implementation; `JsonValue` now imported from `contracts/operations`, whose definition is textually identical to the former local alias).
- `merge.ts` — `reconcileContent` + `combineOrder` (identical logic, including conflict-ID construction `JSON.stringify(path) + ':' + fingerprint([base, local, remote])`).
- `safe.ts` — the validate-then-run wrapper (`invalid_input` / `comparison_failed` mapping), shared by compare and reconcile.
- `describePath.ts` — `describePath` with the canonical PT-BR label table.
- `semanticDiff.ts` — public hub re-exporting the original surface.

Decomposition into focused modules was required by the architecture hard budget (300 lines for `.ts`; the monolithic moved file was 354 lines).

Twin re-pointing:

- `packages/content-core/src/digest.ts` — `sameContent` now imports `contentIdentity` from `./content-reconciliation/semanticDiff` (MERGE-01 structural twin re-pointed to the canonical implementation).
- `packages/content-core/src/contracts/errors.ts` — `SemanticConflict` re-export re-pointed to the canonical type.
- `packages/content-core/src/index.ts` — exports the full reconciliation surface (`assertComparable`, `compareContent`, `contentIdentity`, `describePath`, `reconcileContent` and all associated types, including `JsonValue`); `SemanticConflict` is exported exactly once (from the canonical module) to avoid a duplicate identifier while keeping `contracts/errors` re-pointed.

Compatibility facades (owned audited paths; thin only):

- `src/dev-dashboard/publishing/semanticDiff.ts` — pure re-export of the 5 functions + 9 types from `@bemtevi/content-core`.
- `src/dev-dashboard/publishing/mergePublishedContent.ts` — unchanged legacy flattened adapter; only a comment updated to note the canonical location. No behavior change.

Tests (new, owned):

- `packages/content-core/src/__tests__/reconciliation.test.ts` — node-environment Vitest suite covering: `contentIdentity` order sensitivity and null/missing distinction; edited-scalar canonical path ID; added/removed changes; ordering (`moved`) change; `invalid_input` fail-closed (duplicate IDs handled by model constraints, cyclic inputs); distinct-field three-way merge (complete); overlapping value conflict (preview keeps local, exact conflict ID pinned via canonical `fingerprint`); delete/edit conflict at record level (canonical, matching `semanticDiff.test.ts`); incompatible bilateral reorder conflict; decision reuse invalidated by overlapping remote edit (fingerprint changes); null-as-value vs missing-as-absence; remove-vs-null conflict; one-sided add/delete taking the unchanged side; canonical PT-BR `describePath` labels.

## Fingerprint / behavior preservation evidence

- The moved implementation body was diffed against `git show HEAD:src/dev-dashboard/publishing/semanticDiff.ts`: identical except the `JsonValue` alias, now imported from `contracts/operations` with a textually identical definition.
- Conflict-ID format preserved exactly: `JSON.stringify(path)` + `:` + `fingerprint([base, local, remote])` where `fingerprint` is the FNV-style 32-bit pair over `contentIdentity` (`${length}:${a>>>0}:${b>>>0}`). The core test suite pins exact IDs computed through a canonical mirror of `fingerprint`.
- Existing dashboard suites (`semanticDiff.test.ts`, `mergePublishedContent.test.ts`, `PublishDashboard.test.tsx`, `changeSummary.test.ts`, `publishMode.test.ts`) run unchanged and pass — behavioral parity at the consumer boundary.

## Commands and results (all run on Windows, Git Bash)

| Command                                                                    | Result                                                                                                                                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`                                                       | PASS (exit 0)                                                                                                                            |
| `pnpm run lint`                                                            | PASS (exit 0, no warnings)                                                                                                               |
| `pnpm run format:check`                                                    | PASS ("All matched files use Prettier code style!")                                                                                      |
| `pnpm run check:architecture`                                              | PASS — "Architecture check passed (452 source files)"                                                                                    |
| `pnpm run test:unit -- packages/content-core src/dev-dashboard/publishing` | PASS — 116 test files, **999/999 tests passed** (note: `test:unit` runs the full suite; this is full-suite evidence, not a filtered run) |
| `pnpm run validate:flows`                                                  | PASS — "Flow/content validation passed for 8 flow(s)"                                                                                    |

`pnpm run check` was not executed as a single command; every constituent gate above was run individually and is green (build not run separately — it is the only envelope member not listed in the task command set; typecheck/lint/format/architecture/tests/flows all pass).

## Gate A (doc 09)

Gate A — "shared contracts: MERGE-03 + architecture green" — **is satisfied**: MERGE-03's command envelope is green and `check:architecture` passes with no new baseline exceptions.

## Deferred gates / not owned here

- Publishing UI/controller migration to the core API is INTEGRATION-02's ownership; the dashboard facades and controllers were intentionally left behaviorally untouched.
- `check:db` / `v2-database` are DB-01+ gates, deferred.
- Nothing committed or pushed, per task instructions.

## Downstream unblocked

- **DASHBOARD-01** — can import reconciliation from `@bemtevi/content-core` with no UI dependency.
- **AI-FILE-01** — same.
- **MCP-01** — same.
