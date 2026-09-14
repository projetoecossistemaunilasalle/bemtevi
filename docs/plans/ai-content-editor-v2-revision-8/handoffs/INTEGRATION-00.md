# INTEGRATION-00 Handoff — Adopt And Verify Workspace/Gates

**Task ID:** INTEGRATION-00 (revision 8 dossier)
**Starting HEAD:** `e030264786ae7010aac7832203244882d12f9265`
**Ending HEAD:** `e030264786ae7010aac7832203244882d12f9265` (no commits made)

## Classification

All 21 allowlist files were inspected and classified **adopt/verify, conforming — unchanged**:

- `pnpm-workspace.yaml` — glob `packages/*`.
- `packages/content-core/package.json` — `@bemtevi/content-core`, `private: true`, `1.0.0`, `type: module`, export `.` -> `./src/index.ts`.
- `packages/content-core/tsconfig.json` — strict.
- `packages/content-core/src/index.ts` — empty package entry point (`export {};`), as expected at audited base.
- `packages/content-mcp/package.json` — name/version `@bemtevi/content-mcp@1.0.0`, bin `bemtevi-content-mcp: dist/index.js`, engines node >=20, deps exactly `@modelcontextprotocol/server: 2.0.0` + `@neondatabase/neon-js: 0.6.2-beta`, `@bemtevi/content-core: workspace:*` as devDependency (bundled, not shipped).
- `packages/content-mcp/tsconfig.json` — strict, node types.
- `package.json` — app dependency `@bemtevi/content-core: workspace:*`; `packageManager: pnpm@10.14.0`; dev pins `esbuild: 0.25.12`, `neon: 4.14.6`, `pg: 8.16.3`, `@types/pg: 8.15.5`; `test:unit` goes through `scripts/run-project-command.mjs` which forwards trailing args to vitest.
- `pnpm-lock.yaml` — all four dev pins present.
- `tsconfig.json` — current root inclusion (src via default include, excludes worktrees/installs/dist).
- `vite.config.ts` — `@bemtevi/content-core` in `optimizeDeps.exclude` (workspace source bundled directly).
- `vitest.config.ts` — excludes `**/neon/tests/**` and `**/packages/content-mcp/**`.
- `eslint.config.js` — current config.
- `scripts/run-project-command.mjs` — `test:unit` forwards trailing args; `test:mcp`, `build:mcp`, `check:mcp-package`, `check:db` each fail closed (exit 1) when their prerequisite (`packages/content-mcp/vitest.config.ts`, `build.mjs`, `tarball-smoke.mjs`, `neon/tests/run.ts`) is absent; `check` conditionally appends MCP steps only when prerequisites exist.
- `.github/workflows/ci.yml` — `v2-database` job: `environment: v2-database`, trusted-refs-only `if` condition (push / same-repo PR / workflow_call), explicit missing-credential loop that exits 1, runs `pnpm run check:db`.
- `AGENTS.md` — distinguishes credential-free `pnpm run check` (mandatory pre-push) vs live `pnpm run check:db` (`v2-database` job) and `check:mcp-package` gates; legacy instructions retained.
- `scripts/check-architecture.mjs` — current rules per doc 10: core/MCP/frontend forbidden-import lists (incl. legacy content-agent/agent-bridge, `node:child_process`, `fs`/git in MCP), 500-line enormous-file ceiling, baseline-growth (shrink only), MCP pin/runtime-workspace-dep checks, secret scan.
- `scripts/__tests__/check-architecture.test.ts` — 19 tests, pass.
- `scripts/__tests__/run-project-command.test.ts` — 8 tests, pass.
- `scripts/architecture-baseline.json` — byte-identical to dossier `architecture-baseline.json` (verified via `diff`, no revision-5 values restored).
- `neon/tests/vitest.config.ts` — node environment, `include: ['**/*.test.ts']`, excluded from root credential-free suite; DB-04/INTEGRATION-03 live files will be discovered without a CI edit.

**Changed files:** none. No nonconformance was found; no patch was required.

## Commands executed (exact results)

| Command                                                                                                            | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm run test:unit -- scripts/__tests__/check-architecture.test.ts scripts/__tests__/run-project-command.test.ts` | PASS — 109 test files, 907 tests passed (vitest did not narrow to the two named files, so the whole credential-free suite ran; the two named files were also run focused: 2 files, 27 tests, PASS)                                                                                                                                                                                                                                                                                                                                                                                         |
| `pnpm run check:architecture`                                                                                      | PASS — `Architecture check passed (390 source files).`, exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `pnpm run typecheck`                                                                                               | PASS — exit 0 (root + content-core; content-mcp typecheck skipped because `src/index.ts` absent, per runner design)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm run lint`                                                                                                    | PASS — exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `pnpm run check`                                                                                                   | **FAIL at step 4 (format:check), exit 1** — 18 files fail Prettier, ALL inside the pre-existing untracked `docs/plans/ai-content-editor-v2-revision-8/` dossier docs tree (00, 08, 09, 10, 11, 12, 14, 17, 20, REVISION-8-MANIFEST, tasks/AI-FILE-UX, tasks/DASHBOARD-DRAFTS, tasks/DB, tasks/INTEGRATION, tasks/LEGACY-CLEANUP, tasks/MCP, tasks/MERGE, tasks/README). No allowlist file fails. Steps 5–7 were proven individually instead: `validate:flows` PASS (8 flows), `test` PASS (same 907-test suite), `check:architecture` PASS (390 files), `build` PASS (PWA dist generated). |
| `pnpm run check:db`                                                                                                | FAILS CLOSED, exit 1 — "requires the Neon live harness (neon/tests/run.ts) from DB-04 and credentials"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `pnpm run check:mcp-package`                                                                                       | FAILS CLOSED, exit 1 — "requires packages/content-mcp/scripts/tarball-smoke.mjs from MCP-04"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm run build:mcp`                                                                                               | FAILS CLOSED, exit 1 — "not available until MCP-01 lands"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `pnpm run test:mcp`                                                                                                | FAILS CLOSED, exit 1 — "requires packages/content-mcp/vitest.config.ts (landed with MCP-01)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Deferred gates and owners

- `check:db` — DB-04 owns `neon/tests/run.ts` harness; first task allowed to claim Gate B.
- `test:mcp` / `build:mcp` — MCP-01.
- `check:mcp-package` — MCP-04.
- `pnpm run check` full-green — blocked ONLY by Prettier formatting of the 18 revision-8 dossier markdown files, which are outside the INTEGRATION-00 allowlist (they are this task's own specification). Formatting them is documentation hygiene, routed to the dossier owner / change control; no code or scaffold issue is involved.

## Drift / change control

- Preflight drift gate: HEAD equals audited base; working tree contains pre-existing deletions of `docs/plans/ai-content-editor-v2/**` (revision-5 docs) and the untracked `docs/plans/ai-content-editor-v2-revision-8/` tree — preserved untouched.
- No drift-sensitive path was modified. Nothing committed or pushed.

## Downstream unblocked

- MERGE-01 (focused gate green on all scaffold checks; the only red is the documentation-formatting issue above).
- DB-04 harness work (neon/tests/vitest.config.ts discovery contract verified; CI `v2-database` already calls `check:db`, so INTEGRATION-03 needs no CI edit).
