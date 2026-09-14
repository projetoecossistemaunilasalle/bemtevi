# Remaining-Work Execution Bundle — LEGACY-00 → LEGACY-02 → INTEGRATION-04

**Status:** `EXECUTION_READY`
**Bundle revision:** 3 (post-INTEGRATION-03, LEGACY-00 change-control alignment)
**Repository base:** `cc61a67fd99a70ff83be0ae7b7f4665027ac565d` (INTEGRATION-03 and its DB-04 Auth-URL harness handback are committed on `main`; the working tree was clean when this alignment was authored)
**Provenance:** written and realigned by the orchestrator agent that completed INTEGRATION-01/02/03 and the prettier-ignore architecture ban. Revision 3 closes a discovered LEGACY-01 ownership contradiction without weakening the required deletion: surviving V2 draft-model helpers move out of `dashboardStorage.ts`, and the public education UI stops reading browser-local dashboard drafts, before LEGACY-01 deletes the old storage module. This bundle is for a **faster, weaker executor agent**: every decision is pre-made here. Execute remaining tasks in the serial order below. Do not reinterpret; when reality differs from this document, STOP that slice and report the exact mismatch with evidence.

## Ground rules (apply to every task)

1. **Preflight per task:** `git rev-parse HEAD` must print `cc61a67fd99a70ff83be0ae7b7f4665027ac565d` (or a descendant commit that you created yourself via Ground rule 8, including the commit that contains this bundle revision). Record `git status --short` (expected CLEAN at start) before and after each task; the tree must be clean again once your task's commit lands. Never stash, push, or revert unrelated changes. The original dossier audited base `e030264…` is history: all prior V2 tasks were verified against it and committed; treat `cc61a67…` as the implementation base and do NOT run the old drift gate against `e030264…`.
2. **Ownership is a literal allowlist.** Files not named by the task are not touched. A needed fix outside the allowlist is a change-control report, never an edit.
3. **`// prettier-ignore` is BANNED.** The architecture gate rejects it: `PRETTIER_IGNORE_BANNED` for any new production file using it, `PRETTIER_IGNORE_GREW` if an allowlisted file's count grows. When a file would exceed its size budget (300 `ts`, 320 `tsx`, 320 `mjs`, 500 `test`, 500 global), **decompose** — extract a sibling module inside the task's allowed paths. Never compress lines, never chain statements, never suppress formatting.
4. **Gates per task (unless narrowed):** `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:architecture`, `pnpm run format:check` (prettier --write only owned files), focused `pnpm exec vitest run <owned tests>`, then full `pnpm run check`. Live gate `pnpm run check:db` requires credentials from `~/.config/bemtevi-db04/neon-test.env` (already present on this machine; missing credentials = FAIL, never a skip). `pnpm run check:mcp-package` is the packed-artifact gate (~25 s warm).
5. **Handoffs:** after each task, write `docs/plans/ai-content-editor-v2-revision-8/handoffs/<TASK-ID>.md` (task ID; starting/ending HEAD; worktree before/after; files changed with line counts; commands + exact results; deviations; skipped gates + why; downstream unblocked). Run `pnpm exec prettier --write <handoff file>` so `format:check` stays green.
6. Focused test note: on this runner `pnpm run test:unit -- <path>` executes the whole suite; use `pnpm exec vitest run <paths>` for focused runs.
7. PT-BR for user-facing UI text; English for engineering docs/comments.
8. **Commits:** after a task's full gate set is green, commit its owned files (plus its handoff) with a PT-BR conventional message citing the task ID (follow the style of `git log e030264..91d3efe`). Never commit secrets, lockfile noise, or files outside the task allowlist; never push. If a task ends with an unresolved STOP, commit nothing for that slice.

## Known-good current state (verified by the orchestrator, at base `cc61a67…`)

- INTEGRATION-01/02 complete, green and COMMITTED: `src/app/neon/database.ts` typed V2 catalog; `src/dev-dashboard/editorialNeonServices.ts` composition; `editorFlags.ts` exact-`'true'` parsing; V2/legacy route coexistence (`DashboardRoute.tsx` branches on `v2Enabled`, legacy hook renamed `useLegacyDraftWorkspace`); read-only `PublishedContentRepository`/provider; `usePublicationController` V2 prepare/publish; temporary `publishing/legacyPublication.ts` (the ONLY direct-write path, legacy branch only); drafts components `DraftWorkspaceSection`/`DraftSaveStatus`/`DraftConflictDialog`.
- INTEGRATION-03 is complete and COMMITTED: DB-04 harness handback `6f64794` exports the already-provisioned disposable Auth URL; INTEGRATION-03 `cc61a67` adds the live editorial and installed-package proof plus rollout evidence. Do not re-execute or amend INTEGRATION-03.
- Full suite at base: **144 files / 1269 tests** green; MCP suite **12 files / 120 tests** green; `pnpm run check` exit 0; `pnpm run check:db` exit 0 (**10 files / 128 passed / 2 skipped**, cutover **6 passed / 2 skipped**, disposable branch deleted); `pnpm run check:mcp-package` exit 0. The working tree is CLEAN.
- Architecture gate: **565 source files**, composed of `check-architecture.mjs` (orchestrator) + `architecture-file-scanner.mjs`, `architecture-import-boundaries.mjs`, `architecture-size-budgets.mjs`, `architecture-pins-secrets.mjs`, `architecture-pragma-ban.mjs`. Do NOT re-merge these modules.
- Baseline file `scripts/architecture-baseline.json` contains legacy entries (e.g. `scripts/content-agent/draftStore.ts: 419`, `src/dev-dashboard/ai/DirectAgentSection.tsx: 500`, `src/dev-dashboard/draft-storage/dashboardStorage.ts: 475`) that become **stale after LEGACY-01 deletes those files** — cleaning them is authorized in LEGACY-02 (see its allowlist).
- The architecture-pragma-ban module allowlists 7 grandfathered files with frozen counts: DashboardRoute.tsx:40, DashboardTabContent.tsx:12, AiFileArchiveSection.tsx:48, legacyRecovery.ts:29, useDraftWorkspace.ts:34, saveCoordinator.ts:19, PublishDashboard.tsx:41 (and the ban module itself: 1). These counts may ONLY shrink; LEGACY-01/02 must drive them to zero and then delete the entries (see LEGACY-01 step 5).

---

## COMPLETED TASK INTEGRATION-03 — Live Replacement And Deployment Proof (Gates C, D, E-live)

**Status:** committed as `cc61a67` after the DB-04 handback `6f64794`; retained below as evidence only. The remaining executor must not repeat or amend this task.

**Depends on:** INTEGRATION-02 (done), DB-04 (done), MCP-04 (done).
**Owns exactly (create ONLY these):** `neon/tests/editorial-e2e.test.ts`, `neon/tests/mcp-package-live.test.ts`, `docs/editorial-v2-rollout.md`.
**Forbidden:** editing `neon/tests/run.ts`/`provision.ts`/`fixtures.ts`/`clients.ts`/`vitest.config.ts` (DB-04-owned; both new test files are auto-discovered by the existing `**/*.test.ts` include — verified), editing `.github/workflows/ci.yml`, editing MCP package sources.

### Step-by-step

**3.1 Read first:** `docs/plans/ai-content-editor-v2-revision-8/tasks/INTEGRATION.md` (INTEGRATION-03 section), `15-database-contract.md`, `04-agent-auth-and-mcp.md`, `handoffs/DB-04.md` (harness contract), `handoffs/MCP-04.md` (pack/install/spawn mechanics + the npm-not-pnpm note), and the existing suites `neon/tests/drafts.test.ts`, `capabilities.test.ts`, `publication.test.ts`, `exports.test.ts`, `operations.test.ts`, `images.test.ts`, `grants.test.ts` — copy their conventions exactly (env fail-closed `requireEnv`, `callRpc` envelope decode, FK-safe reset ordering: delete `published_content`/`published_content_history` BEFORE `content_agent_connections`, single reused `clock_timestamp()` for connection `created_at`/`expires_at`, token = 32 random bytes → 43-char base64url, hash = `sha256(decoded bytes)`).

**3.2 `neon/tests/editorial-e2e.test.ts`** (test budget 500 lines — if it doesn't fit, the harness pattern allows a helper: keep everything in one file by extracting fixtures to a sibling `_helpers` import ONLY if you also create it under `neon/tests/` — prefer one file ≤500):

Harness contract (from DB-04 handoff, verified in source): tests receive the harness via `beforeAll` reading `NEON_TEST_*` env; see how existing suites get `owner` (pg Client), `dataApiUrl`, and signed-in JWTs (`adminA`, `adminB`, `nonadmin`, `anon`). Reuse `rpc-types.ts` types. Required cases (each an `it` with a PT-BR-free English name):

1. **Aligned base/live revision:** load draft via admin RPC `get_content_draft` (initializes); assert `baseRevision` equals the live `published_content.revision` read through the owner client (or via `agent_get_published_context`-style admin read — use the owner pg client for the live revision, that is simplest and already precedented in `publication.test.ts`).
2. **Distinct-field merge:** adminA edits field set X (e.g., a material title via `apply_content_draft_operations` update op), adminB edits disjoint field set Y (e.g., a different material) at the same expected generation → second writer gets `stale_generation`; after refetch, apply B's ops against the new head → both changes present (verify via `get_content_draft` payload).
3. **Overlapping/delete/order conflict:** two admins edit the SAME material/title (overlapping field) at the same generation → second gets `stale_generation`; then a delete+reorder scenario where reconciliation cannot auto-resolve surfaces a conflict-adjacent domain error (`invalid_operations`/`stale_generation` per the SQL; assert the actual envelope code you observe — do not invent codes).
4. **Same-generation one-winner CAS:** both prepare to publish the same generation; first `prepare_content_draft_publish` + `publish_content_draft` succeeds; the second publish attempt with the stale preparation fails (`revision_conflict` or `preparation_stale` — assert what the frozen SQL actually returns per doc 15: live/base revision mismatch after the first publish → `revision_conflict` on prepare; on publish of an already-marked-stale preparation → `preparation_stale`).
5. **Image/file roundtrip:** adminA creates an export via `create_content_edit_export` (with a selection of one material containing an image); apply an image operation (`set_material_image`-style op — see `operations.test.ts`/`images.test.ts` for the exact op shape) before export so the base payload carries image bytes; `get_content_edit_export` returns the same `baseDigest`/payload; re-import semantics are covered in `exports.test.ts` — here assert export content fidelity (baseGeneration matches the clean generation, canonicalPayload round-trips through JSON.parse stably).
6. **Cross-session export retrieval:** export created with adminA's JWT is retrievable by adminA in a "second session" (fresh `callRpc` with the same adminA JWT — trivially true, so ALSO assert the documented negative: adminB retrieving adminA's export gets `export_base_unavailable` — owner-only rule).
7. **Revoked capability denial:** create capability (adminA), agent RPC `agent_get_editor_context` succeeds; revoke via `revoke_content_agent_connection`; same agent RPC now returns `invalid_capability`.
8. **Guarded admin publication:** full happy path prepare→publish (fresh UUID + 43-char token; hash over decoded bytes); assert live revision advanced by exactly 1, draft `baseRevision` == new revision, `generation` advanced, `published_via_connection_id` IS NULL for admin publication (owner client read).
9. **Guarded MCP/agent publication:** same via agent capability RPCs `agent_prepare_publish`/`agent_publish_draft`; assert `published_via_connection_id` equals the connection id, `published_by` equals the principal admin (never the connection UUID).
10. **Post-kill linearization proof (rollback evidence):** within the E2E phase you cannot apply `disable_editorial_writes.sql` (that would break the rest of the phase) — instead assert the WEAKER live fact: after revoking the capability (case 7 style), an in-flight-already-loaded client (reuse the same anonymous Data API client that just succeeded) gets `invalid_capability` on the next call. Document in the rollout doc that full kill-artifact verification happens in the cutover phase. (If you want the strong proof, add `it.runIf(process.env.NEON_TEST_CUTOVER_APPLIED === 'true')` cases mirroring `grants.test.ts` — the harness re-runs files with that env in phase 2. Look at how `run.ts` re-runs grants.test.ts; if it re-runs ONLY grants.test.ts by filename, then your file must self-contain the strong proof under `runIf` and you must check whether run.ts's phase-2 file list includes your file — if it hardcodes grants.test.ts only, do NOT edit run.ts; instead put the strong kill-artifact assertions in `grants.test.ts`? NO — that file is DB-03-owned. STOP and record a change-control item if the phase-2 list is hardcoded. The weak proof (revocation denies subsequent calls) is sufficient for Gate C/D/E-live and the doc records the full sequence.)

**3.3 `neon/tests/mcp-package-live.test.ts`** (test budget 500):

Mechanics (copy from `packages/content-mcp/scripts/tarball-smoke.mjs` — read it fully first):

1. `node packages/content-mcp/build.mjs` (status-checked) from repo root.
2. `pnpm pack --json --pack-destination <tmpdir>/pack` executed in `packages/content-mcp` (npm-CLI fallback if pnpm spawn fails; use `process.execPath`'s bundled `npm-cli.js`, `shell:false`, delete `NODE_PATH` from spawned env — MCP-04's exact approach; npm, NOT pnpm, for the install, to keep real non-junction directories).
3. `npm install <tarball> --no-save --no-audit --no-fund --loglevel=error` into `<tmpdir>/install`.
4. Locate `<install>/node_modules/@bemtevi/content-mcp/dist/index.js`; assert realpath outside repo; spawn with `node`, cwd = install dir, env: `BEMTEVI_AUTH_URL`/`BEMTEVI_DATA_API_URL` = the disposable branch's pulled URLs (from the harness env), `BEMTEVI_CONNECTION_ID` + `BEMTEVI_AGENT_TOKEN` = a capability created in-test via the admin client (token hash = sha256 of decoded bytes — reuse the exact registration pattern from `capabilities.test.ts`).
5. Drive the installed bin over stdio with newline-delimited JSON-RPC (implement the tiny client inline, mirroring tarball-smoke): `initialize` (assert serverInfo `bemtevi-content@1.0.0`), `tools/list` (9 tools), `tools/call agent_get_editor_context` (real capability auth — succeeds), `apply_operations` (one real update op against the returned generation — assert success + new head), `prepare_publish` (fresh UUID/token, hash over decoded bytes — the SERVER does the hash comparison; you pass `p_token_hash` = sha256 hex of the 32 bytes), `publish_draft` (same preparation + raw token) — assert live revision advanced via owner client. Then revoke the capability and assert the next `agent_get_draft` call returns `isError`/`invalid_capability` envelope.
6. Assert zero stdout noise (every line parses as JSON-RPC), graceful termination (stdin EOF then kill fallback).
7. `afterAll`: remove the temp dir; the harness guarantees branch cleanup.

**3.4 `docs/editorial-v2-rollout.md`** (English engineering doc): record the FIXED sequence verbatim from `tasks/INTEGRATION.md` INTEGRATION-03 (the 9 numbered steps), the dashboard browser smoke procedure (two independent authenticated test sessions at `/bemtevi/dashboard`; edit/save/reload resumes canonical draft; file-first export/import preview; no legacy bridge/sync network request in the V2 branch), rollback (read-only UI + `neon/cutover/disable_editorial_writes.sql`; never regrant legacy publication, never flip V2 back, never overwrite canonical draft), and the CURRENT staged status: which steps are proven by the new live suites (with exact test names) and which remain owner-authorized production actions (deploy, enable flag, apply cutover artifact, npm publish). NEVER write credentials in the doc.

**3.5 Dashboard browser smoke:** if you can run it (start `pnpm run dev` against a branch env and drive a browser), record real evidence in the rollout doc; otherwise mark it "staged — procedure recorded, execution pending authorized environment" with the exact steps. Do not fake it.

**3.6 Gates:** `pnpm exec vitest run` is not enough for live files — they run under the harness. Run `pnpm run check:db` (must discover and pass both new files; total case count grows by your tests). Then `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:architecture`, `pnpm run format:check`, `pnpm run check:mcp-package`, full `pnpm run check`. Record exact outputs.

**3.7 Handoff:** `handoffs/INTEGRATION-03.md` per Ground rule 5.

---

## TASK LEGACY-00 — Extract Surviving V2 Model And Retire Public Browser-Draft Preview

**Change-control decision:** this is a mandatory implementation-alignment handback discovered after INTEGRATION-03. `dashboardStorage.ts` still mixes obsolete browser persistence with pure draft-state/merge helpers consumed by the live V2 dashboard, while `educationResourcePreview.ts` still lets public routes read the same local-storage draft. Keeping `dashboardStorage.ts` would violate LEGACY-01's literal deletion and the frozen rule that Neon published content is canonical for public reads. Deleting it immediately would break live V2 consumers. Therefore extract only the surviving pure model first and remove the public local-draft projection. Do not preserve, rename or recreate browser-canonical persistence.

**Depends on:** INTEGRATION-03 (done). **Unblocks:** LEGACY-01.

**Owns exactly:**

- Create `src/dev-dashboard/dashboardDraftState.ts`, containing `DASHBOARD_DRAFT_SCHEMA_VERSION`, `DashboardRecordPatch`, `DashboardDraftState` and `createEmptyDashboardDraftState` copied without semantic change from `draft-storage/dashboardStorage.ts`. The old module keeps its temporary copy until LEGACY-01 deletes it; do not move `hasDashboardChanges` because it belongs only to the legacy persistence path.
- Create `src/dev-dashboard/dashboardDraftMerge.ts`, containing `mergeDashboardDrafts`, `sanitizeFlow` and their private pure merge/sanitization helpers moved without semantic change from `draft-storage/dashboardStorage.ts`. It may import the state types from `dashboardDraftState.ts`; it must not import browser storage, IndexedDB or any deleted legacy module.
- Create a self-contained `src/dev-dashboard/__tests__/dashboardDraftMerge.test.ts` by migrating the still-relevant pure merge/sanitization coverage from `dashboardStorage.merge.test.ts`. Do not import `dashboardStorageTestFixtures.ts`, weaken assertions or leave permanent duplicate coverage. The old suite remains temporarily for LEGACY-01 to delete with the old module.
- Update imports only in `src/dev-dashboard/DashboardRoute.tsx`, `DashboardTabContent.tsx`, `dashboardContactMutations.ts`, `dashboardDerivedContent.ts`, `dashboardEducationMutations.ts`, `dashboardModel.ts`, `dashboardMutationTypes.ts`, `src/dev-dashboard/__tests__/dashboardMutationControllers.test.ts`, `dashboardRoute.contacts.test.tsx` and `dashboardRoute.publishing.test.tsx` so live V2 code/tests consume the extracted pure modules. No UI, mutation or merge behavior change is allowed.
- Delete `src/features/education/educationResourcePreview.ts` and `src/features/education/__tests__/educationResourcePreview.test.ts`.
- Update `src/features/education/EducationLibraryScreen.tsx` and `ResourceDetailScreen.tsx` to render only `PublishedContentContext.content`; remove the local-draft warning branches and all reads of dashboard/local storage. Preserve existing grouping, ordering, fallback, media and citation behavior.
- Update `src/features/education/__tests__/EducationLibraryScreen.test.tsx`, `ResourceDetailScreen.test.tsx` and `educationScreensTestUtils.tsx`: pass test-specific material/group payloads through `renderWithContent` instead of localStorage, delete preview-warning expectations, and add one explicit regression in each screen suite proving populated `bemtevi:dev-dashboard:drafts:v1` bytes cannot change that public screen. Keep all non-preview rendering assertions.
- Create `docs/plans/ai-content-editor-v2-revision-8/handoffs/LEGACY-00.md`.

**Forbidden:** editing or deleting `dashboardStorage.ts`, `draftDb.ts`, `workspace.ts`, `useDraftWorkspace.ts`, `legacyRecovery.ts`, any Neon/MCP module, or any config/script. LEGACY-01 owns old-store and legacy-hook deletion. Do not introduce a compatibility re-export from `dashboardStorage.ts`; surviving consumers must import the new pure modules directly.

**Required verification:**

1. `git grep -n "draft-storage/dashboardStorage" -- src ':!src/**/__tests__/**' ':!src/dev-dashboard/draft-storage/useDraftWorkspace.ts' ':!src/dev-dashboard/draft-storage/draftDb.ts' ':!src/dev-dashboard/ai/aiDraft.ts'` returns no matches. This proves every surviving production consumer has moved while allowing temporary legacy tests that LEGACY-01 removes or rewrites. Any other production match is a STOP.
2. `git grep -nE 'DASHBOARD_STORAGE_KEY|bemtevi:dev-dashboard:drafts:v1' -- src/features` returns only the new tests that prove the public UI ignores legacy bytes; production `src/features/**` has zero matches.
3. `pnpm exec vitest run src/dev-dashboard/__tests__/dashboardDraftMerge.test.ts src/dev-dashboard/__tests__/dashboardMutationControllers.test.ts src/dev-dashboard/__tests__/dashboardRoute.contacts.test.tsx src/dev-dashboard/__tests__/dashboardRoute.publishing.test.tsx src/features/education/__tests__/EducationLibraryScreen.test.tsx src/features/education/__tests__/ResourceDetailScreen.test.tsx` is green.
4. Run the common task gates and full `pnpm run check`; `check:db` is not required because this task changes no database-facing code. Record that justified omission.

**Acceptance:** all production consumers that must survive LEGACY-01 are independent of `dashboardStorage.ts`; public education screens ignore browser-local drafts and render only published context; pure draft merge behavior remains covered; no persistence semantics were moved into the new modules.

**Commit:** after green gates, commit only the owned files plus the handoff with `refactor(editor): separar modelo V2 do legado (LEGACY-00)`. Never push.

---

## TASK LEGACY-01 — Remove Local Product Architecture

**Depends on:** LEGACY-00 (INTEGRATION-03 and MCP-04 are done). Do not start until LEGACY-00 is committed and its handoff is green.
**Read first:** `docs/plans/ai-content-editor-v2-revision-8/tasks/LEGACY-CLEANUP.md` (LEGACY-01 section — the deletion lists are literal).

**Delete (exact paths):**

- Subtrees: `scripts/content-agent/**` (16 files incl. `__tests__/`), `scripts/agent-bridge/**`, `src/dev-dashboard/draft-sync/**`.
- Legacy AI files: `src/dev-dashboard/ai/{DirectAgentSection,McpDraftSection,agentBridge,agentSetup,aiDraft,aiArchive,aiPrompts,aiOperations}.tsx|.ts` and their tests in `src/dev-dashboard/ai/__tests__/`: `DirectAgentSection.test.tsx`, `McpDraftSection.test.tsx`, `agentBridge.test.ts`, `agentSetup.test.ts`, `aiDraft.test.ts`, `aiOperations.test.ts`, `aiPrompts.test.ts`, `aiArchiveV2Compatibility.test.ts` (all exist — verified). KEEP `AiArchiveSection.test.tsx`, `AiFileArchiveSection.test.tsx`, everything under `ai/connections/**`, `ai/files/**`.
- Old browser-canonical storage (LEGACY-00 has already moved every surviving V2 model consumer, while DASHBOARD-03's decoders remain self-contained in `legacyRecovery.ts`): `src/dev-dashboard/draft-storage/{WorkspaceHistory.tsx,dashboardStorage.ts,draftDb.ts,workspace.ts}` and tests `src/dev-dashboard/__tests__/{dashboardStorage.lifecycle,dashboardStorage.migrations,dashboardStorage.merge}.test.ts`, `dashboardStorageTestFixtures.ts`, plus `draftDb.test.ts` and `workspace.test.ts` (both exist in `src/dev-dashboard/__tests__/` — verified; the task text names the three dashboardStorage suites explicitly, and draftDb/workspace tests test only the deleted modules, so they go too — record this as a disclosed addition). KEEP `useDraftWorkspace.ts`, `localDraftCache.ts`, `legacyRecovery.ts`, `dashboardTabStorage.ts`, the new `dashboardDraftState.ts`/`dashboardDraftMerge.ts` and their tests.
- Temporary coexistence: `src/dev-dashboard/publishing/legacyPublication.ts` + `src/dev-dashboard/publishing/__tests__/legacyPublication.test.ts` (exists — verified).

**Removal-only consumer edits (edit ONLY to remove references):**

- `src/dev-dashboard/DashboardRoute.tsx` — delete the legacy branch (`useLegacyDraftWorkspace`, `WorkspaceHistory` import, `legacyPublication` import, the `LegacyDashboardRoute` function and the `v2Enabled` conditional: V2 becomes the only path). Keep the V2 composition identical.
- `src/dev-dashboard/DashboardTabContent.tsx` — remove `LegacyPublishFn` import, `workspaceStore` type, the legacy mode props/branch (`mode: 'legacy'` arm); V2-only.
- `src/dev-dashboard/publishing/usePublicationController.ts` — remove any legacy-mode parameter/branch introduced for coexistence.
- Focused `dashboardRoute.*.test.tsx` files and `dashboardRouteTestHarness.tsx` ONLY where a deleted fixture/component is referenced (remove/adapt those cases; keep V2 cases). The coexistence suite `dashboardRoute.coexistence.test.tsx` must be REWRITTEN to V2-only expectations (legacy branch no longer exists; keep the read-only kill-flag cases — the read-only flag survives until LEGACY-02 removes only the V2 enablement flag, NOT read-only).
- `src/dev-dashboard/__tests__/useDraftWorkspace.test.ts` — currently tests the promoted hook (post-INTEGRATION-02 rename); only remove cases that cover `useLegacyDraftWorkspace` if present.
- At task start, `dashboardStorage.ts` imports are permitted only from files in this task's deletion set or from the legacy portion of `useDraftWorkspace.ts` that this task removes. If any surviving consumer still imports it, STOP: do not keep the old file and do not broaden ownership ad hoc.
- `scripts/run-project-command.mjs` — NOT owned here (LEGACY-02 owns it). Deleting `scripts/content-agent/**` will break its switch cases and `package.json` scripts — that is LEGACY-02's scope; LEGACY-01 leaves them dangling ONLY if gates still pass. If `pnpm run check` fails because of dangling references (e.g., tsconfig include, vitest picking up `scripts/content-agent/__tests__`), the minimal compilation-preserving edit is authorized under "removal-only consumer edits" scope extension — record it as change-control disclosure. Check what breaks: root `tsconfig.json` includes `scripts/**`? Run typecheck immediately after the deletions to find the dangling set. `pnpm run check` must be green at the end of LEGACY-01.

**Pragma strip obligation (user directive):** while editing each allowlisted grandfathered file you touch (`DashboardRoute.tsx` 40, `DashboardTabContent.tsx` 12, `useDraftWorkspace.ts` 34, `PublishDashboard.tsx` 41, `saveCoordinator.ts` 19, `AiFileArchiveSection.tsx` 48, `legacyRecovery.ts` 29), REMOVE every `// prettier-ignore` and let prettier reformat; then decompose to fit budgets:

- `DashboardRoute.tsx` (baseline 320): after legacy-branch deletion it shrinks naturally; strip pragmas, run prettier, if > remaining baseline entry update `scripts/architecture-baseline.json` ONLY downward (shrinking is always allowed; growing requires change control).
- `DashboardTabContent.tsx` (hard 320, no baseline): V2-only after edit; strip 12 pragmas → reformat → if >320, extract tab-pane subcomponents into NEW files under `src/dev-dashboard/` named `<X>Tab.tsx` following the existing decomposition pattern (e.g., how `dashboardRouteTestHarness` splits concerns) — new files are creation within task scope (the task says "Do not redesign V2 UI" — pure mechanical extraction with unchanged behavior is not redesign; record each extraction in the handoff).
- `PublishDashboard.tsx` (baseline 410): strip 41 pragmas → reformat → likely fits (legacy mode was half of it; usePublicationController handles protocol). If >410 after reformat, extract the preview/confirmation dialog into `publishing/PublicationReviewDialog.tsx` + test.
- `useDraftWorkspace.ts` (baseline 315): strip 34 → reformat → if oversized, extract the legacy-recovery helpers that remain into `draft-storage/canonicalWorkspaceHelpers.ts` — but ONLY pieces that survive LEGACY-01 (the file currently still contains `useLegacyDraftWorkspace` — after LEGACY-01 removes it, re-count).
- `saveCoordinator.ts`, `AiFileArchiveSection.tsx`, `legacyRecovery.ts`: these files aren't otherwise owned by LEGACY-01. The task's allowlist does NOT include them — therefore LEGACY-01 does NOT touch them. Their pragma strip is deferred to LEGACY-02? Also not in LEGACY-02's code allowlist (only `editorFlags.ts` + enablement-branch removals). **Resolution (pre-decided change control):** add ONE new micro-task `PRAGMA-STRIP` after LEGACY-02 (allowlist: exactly `src/dev-dashboard/drafts/saveCoordinator.ts`, `src/dev-dashboard/ai/AiFileArchiveSection.tsx`, `src/dev-dashboard/draft-storage/legacyRecovery.ts`, plus deleting their entries from the ban allowlist in `scripts/architecture-pragma-ban.mjs` and adjusting `scripts/architecture-baseline.json` downward if reformatting shrinks files): strip → reformat → decompose if over budget (`AiFileArchiveSection` 319/320 will exceed after reformat: extract the import pipeline preview into a sibling component file `ai/ImportPreviewPanel.tsx`; `saveCoordinator.ts` 298/300 similar margin: extract nothing unless needed — reformat may fit; `legacyRecovery.ts` 300/300: it exceeds after reformat: extract the decoders into `draft-storage/legacyDecoders.ts` with tests). Mechanical extraction only, zero behavior change, full gates + focused suites after.

**Tests after LEGACY-01:** repository grep `git grep -nE 'content-agent|agent-bridge|draft-sync|DirectAgentSection|McpDraftSection|legacyPublication|useLegacyDraftWorkspace|WorkspaceHistory|dashboardStorage' -- ':!docs/plans/**' ':!docs/editorial-v2-rollout.md'` — every remaining match must be either (a) the historical-recovery decoder (`legacyRecovery.ts` mentions old storage keys — allowed, it's the surviving recovery adapter), (b) `editorialNeonServices`/documentation references the orchestrator approves, or (c) removed in LEGACY-02. Classify every match in the handoff. V2 publication/file/recovery/public-read suites green; the read-only legacy recovery test proves old bytes still download. Full `pnpm run check` green. `check:db` green (nothing DB-facing changed, but run it — it's cheap insurance and the rule says DB-affecting work requires it; if you changed no neon/\*\* or DB-adjacent code you may record it as "not re-run, no DB-facing change" with justification).

**Handoff:** `handoffs/LEGACY-01.md`.

---

## TASK LEGACY-02 — Config, Scripts And Operational Docs

**Depends on:** LEGACY-01.
**Read first:** `tasks/LEGACY-CLEANUP.md` LEGACY-02 section (allowlist is literal).

**Edits:**

1. `package.json` — remove scripts `agent:bridge`, `content-agent:mcp`, `content-agent:sync`, `content-agent:login`, `content-agent:logout` (verified present).
2. `scripts/run-project-command.mjs` — remove the corresponding switch cases; fail-closed behavior for unknown commands stays.
3. `scripts/__tests__/run-project-command.test.ts` — update: removed commands are REJECTED (add/adjust cases).
4. `.mcp.json` and `.cursor/mcp.json` — remove the `bemtevi-content` entry (verified present in both), keep Neon. Do NOT touch `.vscode/mcp.json`.
5. `.env.example` — remove `VITE_EDITOR_V2_ENABLED=false` (keep `VITE_EDITOR_READ_ONLY=false`).
6. `src/dev-dashboard/editorFlags.ts` + `__tests__/editorFlags.test.ts` — remove `v2Enabled` (V2 is the only editor); keep `readOnly` with exact-`'true'` parsing. Interface becomes `{ readOnly: boolean }` (+ keep `parseEditorFlag`; `getEditorFlags` reads only `VITE_EDITOR_READ_ONLY`).
7. `src/dev-dashboard/DashboardRoute.tsx` + `DashboardTabContent.tsx` — enablement-branch REMOVAL ONLY (the `v2Enabled` conditional is gone; if LEGACY-01 already collapsed it, verify and no-op).
8. Docs: replace `docs/ai-agent-connector.md` and `docs/mcp-content-agent.md` with short superseded notices (editorial users → dashboard file-first/connected-assistant workflow; developers → the V2 dossier + standalone MCP package). Update legacy-operational references only in `README.md`, `docs/README.md`, `docs/Project-Context.md`, `docs/PRD.md`, `AGENTS.md` (keep unrelated content; AGENTS keeps credential-free vs live gate distinction; remove `agent:bridge`/`content-agent:*` instructions, localhost:4318 bridge mentions, clone-repo editorial instructions).
9. `pnpm-lock.yaml` — only via pnpm if removing now-unused legacy dependencies (check: `scripts/content-agent` used only node builtins + workspace deps? If root `package.json` devDeps become unused after script removal, remove them via `pnpm remove`, never hand-edit).
10. `scripts/architecture-baseline.json` — delete entries for deleted files (LEGACY-01 deletions leave stale entries; the checker ignores missing files but hygiene requires removing them; verified stale after LEGACY-01: `scripts/agent-bridge/providers.mjs`, `scripts/content-agent/draftStore.ts`, `scripts/content-agent/server.ts`, `src/dev-dashboard/ai/DirectAgentSection.tsx`, `src/dev-dashboard/ai/aiDraft.ts`, `src/dev-dashboard/ai/aiPrompts.ts`, `src/dev-dashboard/draft-storage/dashboardStorage.ts`; shrink grown entries only downward for pragma-stripped files).
11. **Not done here:** the three untouched pragma files (see PRAGMA-STRIP micro-task below).

**Tests/commands:** `pnpm exec vitest run scripts/__tests__/run-project-command.test.ts src/dev-dashboard/__tests__/editorFlags.test.ts`; repository search for removed strings (`git grep -nE 'agent:bridge|content-agent:|bemtevi-content'` outside docs/plans and historical notices — classify); `pnpm run check` full green. `check:db` not required (no DB change) — record as not-run with justification.

**Handoff:** `handoffs/LEGACY-02.md`.

---

## TASK PRAGMA-STRIP — final pragma removal (user-directive micro-task)

**Depends on:** LEGACY-02. **Owns exactly:** `src/dev-dashboard/drafts/saveCoordinator.ts`, `src/dev-dashboard/ai/AiFileArchiveSection.tsx`, `src/dev-dashboard/draft-storage/legacyRecovery.ts`, `scripts/architecture-pragma-ban.mjs` (allowlist cleanup only), `scripts/architecture-baseline.json` (downward-only adjustments), plus NEW sibling extraction files if budgets require: `src/dev-dashboard/ai/ImportPreviewPanel.tsx` (+ test under `ai/__tests__/`), `src/dev-dashboard/draft-storage/legacyDecoders.ts` (+ test), `src/dev-dashboard/drafts/saveCoordinatorInternals.ts` (only if needed).

**Steps:** for each of the three files: delete all `// prettier-ignore` lines → `pnpm exec prettier --write <file>` → `pnpm exec vitest run <its existing suites>` green → if over budget, extract mechanically (pure move of functions/components, no behavior change, imports updated) → full focused suites + `pnpm run check` green. Then in `scripts/architecture-pragma-ban.mjs`: delete the three entries from `PRAGMA_ALLOWLIST` and `PRAGMA_LIMITS` (and the self-entry stays at 1) → `pnpm run check:architecture` green with `PRETTIER_IGNORE` count at 1 total (the ban module's own regex). Update the ban module's doc comment allowlist note accordingly.

**Handoff:** `handoffs/PRAGMA-STRIP.md`.

---

## TASK INTEGRATION-04 — Final Gate And Signoff (Gate F)

**Depends on:** LEGACY-02 + PRAGMA-STRIP. **Verification-only; owns ONLY `docs/editorial-v2-rollout.md` updates (final evidence/status).**

Run IN ORDER, record exact results:

```text
pnpm run check
pnpm run check:db
pnpm run check:mcp-package
pnpm run test:unit -- src/app/content src/features
pnpm run validate:flows
git diff --check
git status --short
```

Then verify each item (from `tasks/INTEGRATION.md` INTEGRATION-04):

- package/SDK/protocol pins exact (`@bemtevi/content-mcp@1.0.0`, `@modelcontextprotocol/server@2.0.0`) — `pnpm run check:architecture` covers pins, but state the evidence;
- `.env.example` retains `VITE_EDITOR_READ_ONLY=false` and NO `VITE_EDITOR_V2_ENABLED`;
- no operational production import/request/config referencing legacy bridge/content-agent/draft-sync outside explicitly historical docs/recovery decoders — run the greps from LEGACY-01 again and classify;
- `content:pull` remains read-only one-way mirroring (inspect; it must not have changed);
- packed installed MCP has no repository/runtime workspace dependency (from `check:mcp-package` evidence);
- environment-dependent gates actually ran (check:db, check:mcp-package) — never skipped;
- rollout document distinguishes staged/enabled/cutover-applied/npm-published/production-approved truthfully — update it with the final green-gate evidence table.

Any failure returns to the owning task (file owner per the task allowlists above) or change control; INTEGRATION-04 performs NO source/config edits.

**Handoff:** `handoffs/INTEGRATION-04.md` + final status in the rollout doc.

---

## Completion audit checklist (run at the very end)

1. All handoff files exist: INTEGRATION-01..04, LEGACY-00..02, PRAGMA-STRIP (+ all earlier ones untouched).
2. `pnpm run check` exit 0; `pnpm run check:db` exit 0; `pnpm run check:mcp-package` exit 0 — all run in INTEGRATION-04, not stale claims.
3. `git grep -nE 'prettier-ignore'` in production source → only `scripts/architecture-pragma-ban.mjs` (count 1).
4. Greps: no `content-agent|agent-bridge|draft-sync|DirectAgentSection|McpDraftSection|legacyPublication` in operational production code (outside `docs/plans/**`, historical notices, `legacyRecovery.ts` internal legacy-key constants).
5. `.env.example` has `VITE_EDITOR_READ_ONLY=false`, no `VITE_EDITOR_V2_ENABLED`.
6. Every dossier Gate: A (MERGE-03 arch), B (DB-04), C/D/E-local (INTEGRATION-02/MCP-04), E-live (INTEGRATION-03), F (this bundle's final state) — each with cited evidence.
7. Working tree CLEAN at the end of every task's commit; each remaining task committed separately with its handoff; `git log --oneline cc61a67..HEAD` shows only execution-bundle alignment and task-owned commits. No pushes.
8. All audit greps re-run live by you at the end (not quoted from earlier handoffs), with results recorded in the INTEGRATION-04 handoff.
