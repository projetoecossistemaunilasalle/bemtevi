# LEGACY-00 Handoff — Extract Surviving V2 Model And Retire Public Browser-Draft Preview

**Task ID:** LEGACY-00 (revision 8 dossier, remaining-work bundle rev 3)
**Starting HEAD:** `f54c524f4c0513d0e3e3f2b5182ebfac71355a3b` (dispatch alignment commit; tree clean)
**Ending HEAD:** same commit until this task's commit lands
**Worktree before:** clean. **Worktree after:** clean after commit.
**Status:** GREEN.

## Inventory

| Path                                                                | Action         | Notes                                                                                                                  |
| ------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/dev-dashboard/dashboardDraftState.ts`                          | created        | Pure model: schema version, patches, `DashboardDraftState`, `createEmptyDashboardDraftState`                           |
| `src/dev-dashboard/dashboardDraftMerge.ts`                          | created        | Pure `mergeDashboardDrafts` + `sanitizeFlow` + private merge helpers                                                   |
| `src/dev-dashboard/__tests__/dashboardDraftMerge.test.ts`           | created        | 17 pure merge tests migrated from `dashboardStorage.merge.test.ts` (no fixture-file import)                            |
| `src/dev-dashboard/DashboardRoute.tsx`                              | import-only    | V2 uses new pure modules                                                                                               |
| `src/dev-dashboard/DashboardTabContent.tsx`                         | import-only    |                                                                                                                        |
| `src/dev-dashboard/dashboardContactMutations.ts`                    | import-only    |                                                                                                                        |
| `src/dev-dashboard/dashboardDerivedContent.ts`                      | import-only    |                                                                                                                        |
| `src/dev-dashboard/dashboardEducationMutations.ts`                  | import-only    |                                                                                                                        |
| `src/dev-dashboard/dashboardModel.ts`                               | import-only    |                                                                                                                        |
| `src/dev-dashboard/dashboardMutationTypes.ts`                       | import-only    |                                                                                                                        |
| `src/dev-dashboard/__tests__/dashboardMutationControllers.test.ts`  | import-only    |                                                                                                                        |
| `src/dev-dashboard/__tests__/dashboardRoute.contacts.test.tsx`      | import-only    |                                                                                                                        |
| `src/dev-dashboard/__tests__/dashboardRoute.publishing.test.tsx`    | import-only    | Still imports `DASHBOARD_STORAGE_KEY` from old module (LEGACY-01 will remove that test case)                           |
| `src/features/education/educationResourcePreview.ts`                | **deleted**    | Public localStorage draft projection removed                                                                           |
| `src/features/education/__tests__/educationResourcePreview.test.ts` | **deleted**    |                                                                                                                        |
| `src/features/education/EducationLibraryScreen.tsx`                 | published-only | No draft preview warning                                                                                               |
| `src/features/education/ResourceDetailScreen.tsx`                   | published-only | No draft preview warning                                                                                               |
| `src/features/education/__tests__/educationScreensTestUtils.tsx`    | rewritten      | `renderWithContent` + `seedLegacyDashboardDraftBytes`; kept `buildDatabaseEducationPayload` for publishedContent suite |
| `src/features/education/__tests__/EducationLibraryScreen.test.tsx`  | rewritten      | Payload-based groups; one legacy-bytes regression                                                                      |
| `src/features/education/__tests__/ResourceDetailScreen.test.tsx`    | rewritten      | Payload-based blocks; one legacy-bytes regression; preview-warning cases removed                                       |
| `docs/plans/ai-content-editor-v2-revision-8/handoffs/LEGACY-00.md`  | this file      |                                                                                                                        |

**Not touched (forbidden):** `dashboardStorage.ts`, `draftDb.ts`, `workspace.ts`, `useDraftWorkspace.ts`, `legacyRecovery.ts`, Neon/MCP modules, configs/scripts.

## Required verification

1. `git grep -n "draft-storage/dashboardStorage" -- src ':!src/**/__tests__/**' ':!src/dev-dashboard/draft-storage/useDraftWorkspace.ts' ':!src/dev-dashboard/draft-storage/draftDb.ts' ':!src/dev-dashboard/ai/aiDraft.ts'` → **no matches** (exit 1).
2. `git grep -nE 'DASHBOARD_STORAGE_KEY|bemtevi:dev-dashboard:drafts:v1' -- src/features` → only the two new regression tests + test util seeder; **zero** production `src/features/**` matches.
3. Focused vitest: 6 files / **68 passed**.
4. `pnpm run check` **exit 0** — typecheck, lint, format, validate:flows (8), test **144 files / 1279 tests** (was 1269; +10 net from new merge suite / education rewrites), architecture **566** files, build, MCP 12/120.

## Deviations

1. Restored `buildDatabaseEducationPayload` in `educationScreensTestUtils.tsx` after typecheck failed on `EducationScreens.publishedContent.test.tsx` (not in allowlist; export restoration only — no behavior change to that suite).
2. `dashboardRoute.publishing.test.tsx` still needs `DASHBOARD_STORAGE_KEY` from the old module for a legacy-branch case; allowed as a temporary legacy test that LEGACY-01 removes.

## Skipped gates

- `check:db` **not run** — no database-facing code changed (justified omission per bundle).

## Downstream unblocked

- **LEGACY-01** may delete `dashboardStorage.ts` and the remaining legacy subtrees; surviving production consumers no longer import it.
