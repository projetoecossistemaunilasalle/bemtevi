# Legacy Removal Tasks

Read 07 and 12. Removal is last, not a shortcut to make intermediate tests pass. Existing validation facades may remain as thin re-exports; no parallel implementation may remain behind them.

## LEGACY-01: Remove Local Product Architecture

**Depends:** INTEGRATION-03 and MCP-04, Gate C/E proven.
**Unblocks:** LEGACY-02. **Parallel:** serial only.
**Delete owned paths:** `scripts/content-agent/**` (all source/tests after digest/validation extraction); `scripts/agent-bridge/**`; `src/dev-dashboard/draft-sync/**`; ai/{DirectAgentSection,McpDraftSection}.tsx; ai/{agentBridge,agentSetup,aiDraft}.ts; `ai/__tests__/{agentBridge,aiDraft,DirectAgentSection,McpDraftSection}.test.ts(x)` using their existing extensions; publishing/legacyPublication.ts.
**Modify owned paths:** ai/{aiArchive,aiPrompts,aiOperations}.ts to remove V1/bridge-only compatibility exports (V2 facade allowed); `ai/__tests__/{aiOperations,aiPrompts}.test.ts`; draft-storage/{workspace,useDraftWorkspace,dashboardStorage,draftDb,legacyRecovery}.ts and their tests; DashboardRoute.tsx removal-only after integration handoff.

Keep read-only old IndexedDB decoder and download recovery, but remove DraftStore/sync-link types and all localhost clients. Decode old JSON structurally without importing deleted draft-sync module. Remove old publication session writes and local canonical mutation paths, not old user data itself. Migrate all callers before removing exports. Do not remove semantic/publication/validation tests merely because they import an old facade; retarget them.

**Tests:** deletion search has no production import of removed paths; existing fallback/export/recovery/public read tests pass; no bridge HTTP request on dashboard mount; V2 prepared publication retained.
**Commands:** common; rg -n 'draft-sync|agent-bridge|content-agent|DirectAgentSection|McpDraftSection' src scripts; full check after root script cleanup in LEGACY-02.
**Acceptance:** no filesystem/localhost editorial architecture in product code, no loss of original local recovery bytes. Exact tests for replacement retained.

## LEGACY-02: Config, Scripts And Docs

**Depends:** LEGACY-01.
**Unblocks:** INTEGRATION-04. **Parallel:** serial.
**Owns:** package.json, pnpm-lock.yaml, scripts/run-project-command.mjs, .mcp.json, .codex/config.toml, .cursor/mcp.json, .vscode/mcp.json, AGENTS.md, README.md, docs/ai-agent-connector.md, docs/mcp-content-agent.md, docs/plans/2026-08-26-assistente-ia-painel-admin.md; DashboardRoute.tsx enablement-flag removal and associated tests.

Remove root agent:bridge and content-agent:mcp/sync/login/logout scripts and every matching switch case in both runner dispatch locations. Remove only BemTeVi editorial local MCP entries from repository coding configs; preserve unrelated Neon engineering tools/settings. Do not install new editorial capability config into Git. Replace old connector/MCP docs with short superseded notice plus V2 setup link, retaining no operational localhost instructions. Mark historical plan superseded, do not rewrite its historical decisions. AGENTS must not tell editorial users to edit generated src/content or use raw Neon SQL for editorial tasks; preserve complete quality gate and privacy rules.

Remove temporary V2 enablement flag and legacy route branch, keep emergency read-only flag. Update README verification links to Vite /bemtevi/, not 127.0.0.1:4318. Add read-only content:pull fallback explanation. Do not edit unrelated historical SRQ20 plan or dirty generated resource files.

**Tests:** root runner no dead command paths; config JSON/TOML parses; product documentation search no operational clone/sync/login instructions. V2 dossier and explicitly marked historical plans may mention forbidden legacy names as history/removal targets; don't demand empty repo-wide grep.
**Commands:** common; rg -n 'content-agent:|agent:bridge|127.0.0.1:4318|draft-sync' README.md AGENTS.md docs/ai-agent-connector.md docs/mcp-content-agent.md src scripts; git diff --check; pnpm run check.
**Acceptance:** Gate F; no dangling route/script/config/import, no removed unrelated engineering configuration, no credentials added.
