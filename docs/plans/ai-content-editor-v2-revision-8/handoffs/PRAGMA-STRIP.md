# PRAGMA-STRIP Handoff - Final Pragma Removal

**Task ID:** PRAGMA-STRIP (remaining-work bundle revision 3)
**Starting HEAD:** `c50876c23a2a4137f3a222202f36a7b4a44b502d` (LEGACY-02)
**Ending HEAD:** task commit created after this handoff (hash reported by the executor)
**Worktree before:** dirty with the paused WIP implementation; no unrelated changes were reverted.
**Status:** GREEN.

## Implementation

- Removed every `// prettier-ignore` from the three owned production targets.
- Extracted `ImportPreviewPanel.tsx` from the file-first AI section, preserving the
  exact visible `images/. A IA` handoff copy and adding focused component coverage.
- Extracted the legacy byte decoders into `legacyDecoders.ts`, while keeping all
  decoder functions, the schema constant, and the three public type re-exports
  available from `legacyRecovery.ts`.
- Completed `saveCoordinatorInternals.ts`: action ownership now includes refresh,
  `queueRefresh` is wired to the coordinator lifecycle, and `saveCoordinator.ts`
  is 288 lines without compressed statements. Resolve/retry read the latest state
  after awaited repository work and preserve nullable-local remote application.
- Kept offline read failures mapped through `errorState(error, !isOnline())`.
- Reduced the pragma-ban allowlist and limits to the detector module's single
  detection token. The architecture tests enforce that invariant. No baseline
  increase or architecture-baseline change was made.
- Added focused concurrency coverage for held `head()`/`load()` calls, retained
  candidates, and nullable-local retry adoption.

## Files and line counts after formatting

| Path                                                                    | Lines | Action                                      |
| ----------------------------------------------------------------------- | ----: | ------------------------------------------- |
| `scripts/architecture-pragma-ban.mjs`                                   |    56 | Allowlist/limit cleanup                     |
| `scripts/__tests__/check-architecture.test.ts`                          |   334 | Invariant fixture updates                   |
| `src/dev-dashboard/ai/AiFileArchiveSection.tsx`                         |   205 | Pragma removal and extraction consumer      |
| `src/dev-dashboard/ai/ImportPreviewPanel.tsx`                           |   239 | New extracted UI components                 |
| `src/dev-dashboard/ai/__tests__/ImportPreviewPanel.test.tsx`            |    35 | Focused UI coverage                         |
| `src/dev-dashboard/draft-storage/legacyRecovery.ts`                     |   293 | Decoder extraction and compatibility facade |
| `src/dev-dashboard/draft-storage/legacyDecoders.ts`                     |   142 | New decoder module                          |
| `src/dev-dashboard/draft-storage/__tests__/legacyDecoders.test.ts`      |    69 | Focused decoder coverage                    |
| `src/dev-dashboard/drafts/saveCoordinator.ts`                           |   288 | Coordinator composition and pragma removal  |
| `src/dev-dashboard/drafts/saveCoordinatorInternals.ts`                  |   171 | Extracted coordinator actions               |
| `src/dev-dashboard/drafts/__tests__/saveCoordinatorConcurrency.test.ts` |   194 | New concurrency regression coverage         |

The temporary `PRAGMA-STRIP-WIP.md` is closed by this handoff and points to the
final evidence; it is retained as a pause record.

## Verification

- Focused Vitest command covering the six existing suites, the architecture
  suite, and the new concurrency suite: **7 files / 78 tests passed**.
- `pnpm run typecheck`: **PASS**.
- `pnpm run lint`: **PASS**.
- `pnpm run format:check`: **PASS**.
- `pnpm run check:architecture`: **PASS**, 518 source files.
- `pnpm run check`: **PASS**, 128 files / 1,169 tests; production build passed;
  MCP suite 12 files / 120 tests and MCP build passed.
- `git diff --check`: **PASS**.
- `git grep -nE 'prettier-ignore'` over `src` and `scripts`: only the detector
  regex in `scripts/architecture-pragma-ban.mjs` remains in production source.
- `pnpm run check:db`: not run; this task changes no database schema, migration,
  repository transport, or database-facing behavior.
- `pnpm run check:mcp-package`: not run; PRAGMA-STRIP changes no standalone MCP
  package code, and the root check's MCP tests/build passed.

## Downstream

PRAGMA-STRIP is complete and unblocks INTEGRATION-04. No push was performed.
