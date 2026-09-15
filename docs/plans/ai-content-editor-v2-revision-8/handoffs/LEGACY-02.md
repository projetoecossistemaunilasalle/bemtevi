# LEGACY-02 Handoff - Config, Scripts And Operational Docs

**Task ID:** LEGACY-02 (remaining-work bundle revision 3)
**Starting HEAD:** `b6dd8a09dea122b961cc31208e8e985177c5fdf2` (LEGACY-01)
**Ending HEAD:** task commit created after this handoff (hash reported to the dispatcher)
**Worktree before:** clean.
**Status:** GREEN.

## Implementation

- Removed the five legacy root scripts from `package.json` and their runner
  switch cases from `scripts/run-project-command.mjs`.
- Added subprocess coverage proving `agent:bridge` and all four
  `content-agent:*` commands are rejected as unknown commands.
- Removed the `bemtevi-content` host entry from `.mcp.json` and
  `.cursor/mcp.json`; the Neon entries remain. `.vscode/mcp.json` was not
  changed.
- Removed all legacy bridge/content-agent examples and `VITE_EDITOR_V2_ENABLED`
  from `.env.example`. `VITE_EDITOR_READ_ONLY=false` remains the only editor
  flag example.
- Simplified `EditorFlags` and its tests to the exact-string read-only flag.
  The V2 enablement branch was already absent after LEGACY-01; its stale route
  wording was removed without changing route behavior.
- Replaced `docs/ai-agent-connector.md` and `docs/mcp-content-agent.md` with
  superseded notices pointing editorial users to the dashboard file-first /
  connected-assistant flow and developers to the V2 dossier and standalone
  MCP package.
- Removed stale architecture-baseline entries for the seven deleted legacy
  files. No dependency became unused, so `pnpm-lock.yaml` was unchanged.
- Updated only the legacy-operational wording in `README.md` and `AGENTS.md`.
  `docs/README.md`, `docs/Project-Context.md`, and `docs/PRD.md` had no stale
  bridge/content-agent instructions and were preserved.

## Authorized change-control extensions

- `.codex/config.toml`: removed only `[mcp_servers.bemtevi-content]`; the Neon
  server remains.
- `iniciar-assistente-ia.cmd`: deleted because it exclusively launched the
  removed local agent bridge.
- `src/dev-dashboard/__tests__/dashboardRoute.coexistence.test.tsx`: removed
  the stale `v2Enabled` field from the already V2-only flag mock.
- `src/app/content/publishedContentRepository.ts`: updated only the stale
  deleted-adapter/coexistence comment; runtime code is unchanged.

## Files and line counts after formatting

| Path                                                              |   Lines | Action                 |
| ----------------------------------------------------------------- | ------: | ---------------------- |
| `.codex/config.toml`                                              |       2 | modified               |
| `.cursor/mcp.json`                                                |       7 | modified               |
| `.env.example`                                                    |      22 | modified               |
| `.mcp.json`                                                       |       8 | modified               |
| `AGENTS.md`                                                       |     118 | modified               |
| `README.md`                                                       |      84 | modified               |
| `docs/ai-agent-connector.md`                                      |       9 | replaced               |
| `docs/mcp-content-agent.md`                                       |       9 | replaced               |
| `iniciar-assistente-ia.cmd`                                       | deleted | deleted                |
| `package.json`                                                    |      91 | modified               |
| `scripts/__tests__/run-project-command.test.ts`                   |      95 | modified               |
| `scripts/architecture-baseline.json`                              |      19 | modified               |
| `scripts/run-project-command.mjs`                                 |     253 | modified               |
| `src/app/content/publishedContentRepository.ts`                   |     163 | comment-only extension |
| `src/dev-dashboard/DashboardRoute.tsx`                            |     221 | comment-only cleanup   |
| `src/dev-dashboard/__tests__/dashboardRoute.coexistence.test.tsx` |      81 | mock-only extension    |
| `src/dev-dashboard/__tests__/editorFlags.test.ts`                 |      36 | modified               |
| `src/dev-dashboard/editorFlags.ts`                                |      26 | modified               |

## Verification

- `pnpm exec vitest run scripts/__tests__/run-project-command.test.ts src/dev-dashboard/__tests__/editorFlags.test.ts src/dev-dashboard/__tests__/dashboardRoute.coexistence.test.tsx` - PASS, 3 files / 26 tests.
- `pnpm run typecheck` - PASS (included in final full check).
- `pnpm run lint` - PASS (included in final full check).
- `pnpm run format:check` - PASS (included in final full check).
- `pnpm run check:architecture` - PASS, 512 source files (included in final full check).
- `pnpm run check` - PASS, 125 files / 1,160 tests; MCP 12 files / 120 tests; production build and MCP build passed.
- `git diff --check` - PASS.
- `rg -n "v2Enabled|VITE_EDITOR_V2_ENABLED" src .env.example` - no matches.
- `pnpm run check:db` - not run; this task changes no Neon schema, migration, client, or database-facing behavior. The bundle explicitly marks the DB gate as not required for LEGACY-02.

## Search classification

The required command/config search has no remaining runtime command or host
configuration. The remaining `content-agent:*` matches are the negative
subprocess assertions in `scripts/__tests__/run-project-command.test.ts`.
The remaining `bemtevi-content` matches are the frozen standalone MCP server
identity, package bin, and protocol/live tests; they are unrelated to the
deleted local root host entry. Architecture denylist strings in
`scripts/architecture-import-boundaries.mjs` and its tests are intentional
historical guard fixtures. Historical `docs/superpowers/**` references and
the staged `docs/editorial-v2-rollout.md` references remain untouched by this
task; the latter is owned by INTEGRATION-04. No production import, request, or
configuration points to the removed local architecture.

## Downstream

LEGACY-02 is complete and unblocks PRAGMA-STRIP and INTEGRATION-04. No push was
performed. The task commit must include this handoff and all listed owned or
authorized files only.
