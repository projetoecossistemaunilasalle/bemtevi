# Legacy Removal Tasks

**Specification revision: 8.** Removal is last. V2 replacement proof must already exist. The dedicated read-only legacy recovery adapter survives; browser-canonical persistence, local bridges and V1 AI protocol facades do not.

## LEGACY-01: Remove Local Product Architecture

**Depends:** INTEGRATION-03 and MCP-04. **Unblocks:** LEGACY-02.

### Delete owned subtrees

- `scripts/content-agent/**`
- `scripts/agent-bridge/**`
- `src/dev-dashboard/draft-sync/**`

### Delete owned legacy AI files

- `src/dev-dashboard/ai/DirectAgentSection.tsx`
- `src/dev-dashboard/ai/McpDraftSection.tsx`
- `src/dev-dashboard/ai/agentBridge.ts`
- `src/dev-dashboard/ai/agentSetup.ts`
- `src/dev-dashboard/ai/aiDraft.ts`
- `src/dev-dashboard/ai/aiArchive.ts`
- `src/dev-dashboard/ai/aiPrompts.ts`
- `src/dev-dashboard/ai/aiOperations.ts`
- `src/dev-dashboard/ai/__tests__/DirectAgentSection.test.tsx`
- `src/dev-dashboard/ai/__tests__/McpDraftSection.test.tsx`
- `src/dev-dashboard/ai/__tests__/agentBridge.test.ts`
- `src/dev-dashboard/ai/__tests__/agentSetup.test.ts`
- `src/dev-dashboard/ai/__tests__/aiDraft.test.ts`
- `src/dev-dashboard/ai/__tests__/aiOperations.test.ts`
- `src/dev-dashboard/ai/__tests__/aiPrompts.test.ts`
- `src/dev-dashboard/ai/__tests__/aiArchiveV2Compatibility.test.ts`

If one of the explicitly listed test files is absent at the audited base, treat it as already removed; do not invent it merely to delete it. No other file under `src/dev-dashboard/ai/__tests__` is deletion-owned here.

### Delete owned old browser-canonical storage files after decoder extraction

- `src/dev-dashboard/draft-storage/WorkspaceHistory.tsx`
- `src/dev-dashboard/draft-storage/dashboardStorage.ts`
- `src/dev-dashboard/draft-storage/draftDb.ts`
- `src/dev-dashboard/draft-storage/workspace.ts`
- `src/dev-dashboard/__tests__/dashboardStorage.lifecycle.test.ts`
- `src/dev-dashboard/__tests__/dashboardStorage.migrations.test.ts`
- `src/dev-dashboard/__tests__/dashboardStorage.merge.test.ts`
- `src/dev-dashboard/__tests__/dashboardStorageTestFixtures.ts`

Before deleting these files, verify DASHBOARD-03 moved every decoder needed for one-time recovery into `src/dev-dashboard/draft-storage/legacyRecovery.ts` and its tests. Preserve original user bytes; never delete browser IndexedDB/localStorage as part of migration. `useDraftWorkspace.ts`, `localDraftCache.ts`, `legacyRecovery.ts` and `dashboardTabStorage.ts` survive.

### Delete temporary coexistence path

- `src/dev-dashboard/publishing/legacyPublication.ts`
- its dedicated test file if INTEGRATION-02 created `src/dev-dashboard/publishing/__tests__/legacyPublication.test.ts`

### Removal-only consumer edits

- `src/dev-dashboard/DashboardRoute.tsx`
- `src/dev-dashboard/DashboardTabContent.tsx`
- `src/dev-dashboard/publishing/usePublicationController.ts`
- current focused `src/dev-dashboard/__tests__/dashboardRoute.*.test.tsx` files only where a removed legacy component/fixture is referenced

Do not redesign V2 UI or state in this task. Remove imports/props/branches referring to the deleted files and prove the already-landed V2 path remains the only editing path. Do not remove `AiArchiveSection.tsx`, `AiFileArchiveSection.tsx`, `ai/connections/**`, V2 draft modules, content-core, or standalone MCP.

**Tests:** repository-wide search has no production import/request to removed bridge/sync/filesystem draft paths; V2 publication/file/recovery/public reads remain green; read-only legacy recovery test proves old bytes can still be downloaded/imported explicitly.

**Commands:** common envelope; focused dashboard/AI/publication tests; `pnpm run check`; `git grep -nE 'content-agent|agent-bridge|draft-sync|DirectAgentSection|McpDraftSection|legacyPublication' -- ':!docs/plans/**'` and classify every remaining match before advancing.

**Acceptance:** no removed local architecture has a runtime consumer; recovery decoder survives without becoming canonical persistence.

## LEGACY-02: Config, Scripts And Operational Docs

**Depends:** LEGACY-01. **Unblocks:** INTEGRATION-04.

**Owned root/config paths:**

- `package.json`
- `pnpm-lock.yaml`
- `scripts/run-project-command.mjs`
- `scripts/__tests__/run-project-command.test.ts`
- `.mcp.json`
- `.cursor/mcp.json`
- `.env.example`
- `AGENTS.md`
- `README.md`
- `docs/README.md`
- `docs/Project-Context.md`
- `docs/PRD.md`
- `docs/ai-agent-connector.md`
- `docs/mcp-content-agent.md`

**Owned final-cutover code paths:**

- `src/dev-dashboard/editorFlags.ts`
- `src/dev-dashboard/__tests__/editorFlags.test.ts`
- `src/dev-dashboard/DashboardRoute.tsx` — enablement-branch removal only
- `src/dev-dashboard/DashboardTabContent.tsx` — enablement-branch removal only

Remove `agent:bridge` and every `content-agent:*` root script plus corresponding runner switch cases. Remove the `bemtevi-content` entry from `.mcp.json` and `.cursor/mcp.json` while preserving Neon and unrelated tools. Do not modify `.vscode/mcp.json` at the audited base because it contains only the unrelated Neon tool.

Remove legacy bridge/content-agent environment examples. Remove `VITE_EDITOR_V2_ENABLED` from `.env.example` and final runtime branching: V2 is now the sole editor path. Retain `VITE_EDITOR_READ_ONLY=false` and exact-string parsing for the emergency UI kill flag. Simplify `editorFlags.ts` to expose read-only state only; do not reintroduce legacy fallback.

Replace `docs/ai-agent-connector.md` and `docs/mcp-content-agent.md` with short superseded notices pointing editorial users to the dashboard file-first/connected-assistant workflow and developers to this V2 dossier/standalone package. Update only legacy-operational references in the other owned docs/AGENTS; preserve unrelated content.

Root lockfile changes are only those produced by removing now-unused legacy package dependencies, if any. Use pnpm to update it; never hand-edit lockfile resolution data.

**Tests:** runner test proves removed commands are rejected; editor flag test proves only exact string `"true"` enables read-only; no operational clone/sync/login instructions remain; unrelated Neon MCP entries remain; full architecture/check gates green.

**Commands:** common envelope; `pnpm run test:unit -- scripts/__tests__/run-project-command.test.ts src/dev-dashboard/__tests__/editorFlags.test.ts`; `pnpm run check`; repository search for the removed command/config strings.

**Acceptance:** no dangling product route/script/config/import; no editorial instruction tells users to clone repo/run localhost sync/login CLI; no unrelated engineering config removed; no credentials added.
