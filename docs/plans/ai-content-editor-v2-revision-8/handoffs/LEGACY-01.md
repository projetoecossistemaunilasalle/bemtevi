# LEGACY-01 Handoff - Remove Local Product Architecture

**Task ID:** LEGACY-01 (remaining-work bundle revision 3)
**Starting HEAD:** `a90788a` (LEGACY-00 committed green)
**Ending HEAD:** task commit created after this handoff (hash reported to dispatcher)
**Worktree before:** dirty with the pre-applied LEGACY-01 deletion batch; no unrelated edits were reverted.
**Status:** GREEN.

## Inventory

### Exact deletion allowlist

Deleted the complete `scripts/content-agent/**`, `scripts/agent-bridge/**`, and
`src/dev-dashboard/draft-sync/**` subtrees; the listed legacy AI files/tests,
browser-canonical storage files/tests, and `publishing/legacyPublication.ts`
plus its dedicated test. `src/dev-dashboard/ai/__tests__/agentSetup.test.ts`
was absent at the audited base and was not invented or deleted.

### Change-control extension and consumer edits

| Path                                                               | Action                        | Scope and reason                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/dev-dashboard/DashboardRoute.tsx`                             | V2-only plus candidate wiring | Removed the legacy branch/imports; editor tabs now render the canonical candidate, mutation controllers transform the current candidate, validation is derived from the existing flow/education/contact validators, publication stays disabled while dirty/invalid/read-only, and validation review buttons navigate to the failing tab. |
| `src/dev-dashboard/DashboardTabContent.tsx`                        | V2-only plus candidate prop   | Removed legacy props/branch; added `draftContent` for the three editors and kept `liveContent` as the publication baseline.                                                                                                                                                                                                              |
| `src/dev-dashboard/dashboardContactMutations.ts`                   | Removal-only decoupling       | Removed `DashboardWorkspaceUpdater` and implemented shipped-service removal through `DashboardDraftUpdater`, retaining ID/index checks and clearing stale patches. Added-contact removal does not create a tombstone.                                                                                                                    |
| `src/dev-dashboard/__tests__/dashboardMutationControllers.test.ts` | Consumer tests                | Removed deleted workspace/publication-adapter imports and covered shipped-service ID/index safety and tombstoning.                                                                                                                                                                                                                       |
| `src/dev-dashboard/publishing/PublishDashboard.tsx`                | V2-only                       | Removed legacy mode/useLegacy path and pragmas; validation errors independently disable review/publication actions and the existing controller-owned review surface remains.                                                                                                                                                             |
| `src/dev-dashboard/publishing/__tests__/PublishDashboard.test.tsx` | V2 tests                      | Replaced legacy-mode assertions with diff, validation blocking, read-only, review, and controller status coverage.                                                                                                                                                                                                                       |
| `src/dev-dashboard/__tests__/dashboardRouteTestHarness.tsx`        | Canonical test harness        | Removed deleted AI/workspace mocks and models the canonical candidate in memory without browser-draft persistence.                                                                                                                                                                                                                       |
| `src/dev-dashboard/__tests__/dashboardRoute.coexistence.test.tsx`  | V2-only tests                 | Rewritten to prove the sole V2 route and retain read-only publication/assistant kill-flag coverage.                                                                                                                                                                                                                                      |
| `src/dev-dashboard/__tests__/dashboardRoute.publishing.test.tsx`   | V2 tests                      | Removed legacy publication cases and retained guarded surface, controller ownership, and payload-warning coverage.                                                                                                                                                                                                                       |
| `src/dev-dashboard/__tests__/dashboardRoute.contacts.test.tsx`     | V2 test adaptation            | Kept shipped edit, local add/edit/remove, shipped removal, location tombstone, validation, publication, and remount coverage; removed only recovered/duplicate/shared-ID cases tied to the deleted localStorage workspace.                                                                                                               |
| `src/dev-dashboard/__tests__/useDraftWorkspace.test.ts`            | V2 tests                      | Replaced legacy workspace lifecycle/recovery cases with canonical inert-state and browser-storage non-consumption coverage. Dedicated canonical coordinator and legacy-recovery suites remain green.                                                                                                                                     |
| `src/dev-dashboard/draft-storage/useDraftWorkspace.ts`             | V2 hook                       | Removed the legacy hook and all deleted storage/workspace imports; retained canonical coordinator, cache, recovery, undo, and principal lifecycle behavior.                                                                                                                                                                              |
| `src/dev-dashboard/dashboardDerivedContent.ts`                     | Deleted                       | Dead legacy-only shim after the route's real candidate validation wiring.                                                                                                                                                                                                                                                                |
| `src/dev-dashboard/dashboardImportRestore.ts`                      | Deleted                       | Dead legacy-only file restore shim.                                                                                                                                                                                                                                                                                                      |
| `src/dev-dashboard/dashboardPublication.ts`                        | Deleted                       | Dead publication adapter after V2 controller ownership; its obsolete adapter test block was removed.                                                                                                                                                                                                                                     |
| `scripts/architecture-pragma-ban.mjs`                              | Pragma cleanup                | Removed the zero-count entries for `DashboardRoute.tsx`, `DashboardTabContent.tsx`, `useDraftWorkspace.ts`, and `PublishDashboard.tsx`.                                                                                                                                                                                                  |
| `scripts/__tests__/check-architecture.test.ts`                     | Test-only consumer adaptation | Updated stale pragma-ban fixtures to exercise the still-allowlisted `saveCoordinator.ts` limit (19), with no production behavior change.                                                                                                                                                                                                 |

The remaining route editor suites were not weakened: after the canonical
candidate wiring, the flow, education, contact, validation, and reorder cases
remain green. All of the above extension paths were explicitly authorized by
the dispatcher during execution.

## Verification

- Focused Vitest: **14 files, 111 tests passed**.
- `pnpm run typecheck`: **exit 0**.
- `pnpm run check`: **exit 0**; 125 files / 1,155 tests, architecture 512 source files, production build, and MCP 12 files / 120 tests/build all passed.
- `pnpm run check:db`: **exit 0**; live DB-01..03 suites 128 passed / 2 skipped, grants cutover 6 passed / 2 skipped, disposable branch cleaned up.
- `git diff --check`: clean.
- Prettier: all touched files formatted; the four owned grandfathered files now have zero `prettier-ignore` entries and their pragma-ban entries are removed.

## Required grep classification

The required repository grep was rerun live. No surviving production import or
runtime consumer references the deleted local architecture. Remaining matches
are:

- `.codex/config.toml`, `.cursor/mcp.json`, `.mcp.json`, `package.json`, `scripts/run-project-command.mjs`, `scripts/__tests__/check-architecture.test.ts`, `scripts/architecture-baseline.json`, and `scripts/architecture-import-boundaries.mjs`: LEGACY-02-owned operational/config/test/baseline references.
- `docs/**`, `task-500-line-remediation.md`, and `walkthrough-500-line-remediation.md`: documentation/history excluded by the bundle or scheduled for LEGACY-02 notices.
- `src/app/content/publishedContentRepository.ts`, `src/dev-dashboard/dashboardDraftMerge.ts`, `src/dev-dashboard/dashboardDraftState.ts`, and `src/dev-dashboard/draft-storage/dashboardTabStorage.ts`: stale explanatory comments only; no imports, requests, or runtime consumers. They are not changed here because the literal LEGACY-01 source allowlist does not own these files.
- `src/dev-dashboard/draft-storage/legacyRecovery.ts`: surviving historical-recovery decoder and allowed legacy-key compatibility surface.

## Deviations and downstream

The worktree was already dirty at dispatch with the deletion batch; this task
preserved that work and disclosed every additional path above. No root config,
Neon schema, or product publication protocol was redesigned. LEGACY-02 may now
remove the dangling scripts/config/docs references and simplify `editorFlags`.
