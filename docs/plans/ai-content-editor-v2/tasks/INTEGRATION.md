# Integration And Release Tasks

Integration owns hot files exclusively. All tasks serial. Feature agents submit manifest/type needs without changing root lockfile.

## INTEGRATION-00: Workspace And Gates

**Depends:** Stage 0 ready. **Unblocks:** MERGE-01 and DB harness setup.
**Owns:** pnpm-workspace.yaml; packages/content-core/package.json and tsconfig.json; initial packages/content-mcp/package.json and tsconfig.json; root package.json, pnpm-lock.yaml, tsconfig.json, vite.config.ts, vitest.config.ts, eslint.config.js, scripts/run-project-command.mjs, .github/workflows/ci.yml, AGENTS.md; scripts/check-architecture.mjs, architecture-baseline.json, `scripts/__tests__/check-architecture.test.ts`; neon/tests/vitest.config.ts skeleton.

Workspace packages glob `packages/*`. Core name @bemtevi/content-core, private true, version 1.0.0, type module, exports "." -> ./src/index.ts for workspace build. App dependency `workspace:*`. MCP skeleton name/version/bin/deps from 04, later MCP-01 owns its manifest. Build bundles core so this source export never leaks into distribution. Package TS configs use strict:true; preserve root configuration while including packages. Core libs ES2022 + DOM for Web Crypto types, no node types; MCP node types and ES2022. Both use bundler moduleResolution with noEmit for checks.

Add exact development dependencies esbuild@0.25.12, neon@4.14.6, pg@8.16.3 and @types/pg@8.15.5 for DB tooling. Keep root packageManager pnpm@10.14.0. SDK server 2.0.0 Node>=20 is verified. Don't upgrade unrelated dependencies.

Root runner retains Windows node_modules.win and existing WSL commands. Establish:

- test:unit forwards trailing args to vitest run (unlike existing test command which ignores filters).
- test:mcp runs package tests in node environment with package-specific vitest config, no app jsdom setup.
- build:mcp executes packages/content-mcp/build.mjs.
- check:mcp-package runs standalone tarball smoke test.
- check:db executes neon/tests/run.ts, never included in credential-free check.
- check:architecture executes scripts/check-architecture.mjs.
- typecheck includes app/core/MCP once modules exist; test includes app/core/MCP suites but excludes `neon/tests/**` live suite and duplicate standalone release smoke.
- check runs typecheck, lint, format:check, validate:flows, test, check:architecture, build, build:mcp. Bootstrap may register build:mcp only when MCP-01 lands; do not add a fake successful stub. Until then app gate plus architecture must work.

Architecture rules are in 10. Copy frozen baseline from docs, don't remeasure to forgive new growth. Add required protected CI job v2-database (trusted repository refs/environment approval only), with check:db credential env mapped from secrets. No pull_request_target checkout of untrusted PR code; fork PR database gate waits trusted maintainer rerun instead of leaking secrets. Missing secret/provisioning must fail, not skip. Branch protection requires both CI and v2-database for DB-affecting merge; repository owner configures that administrative setting.

AGENTS adds credential-free versus live gates and editorial/source-of-truth boundary but does not prematurely delete legacy instructions (LEGACY-02 does that). Publish/deploy still owner-authorized.

**Tests:** architecture script fails new oversized file, baseline growth, forbidden imports, runtime workspace dependency, package pin drift; ignores generated outputs and handles CRLF/LF identically. Runner tests verify test filter forwarding and correct Windows/default binaries.
**Commands:** pnpm run check and focused architecture tests; install updates lockfile through pnpm, not manual edits.
**Acceptance:** Gate scaffolding operational; no source behavior changes. Missing live DB credentials are documented external test gate, never architecture uncertainty.

## INTEGRATION-01: Typed RPC And Connection Wiring

**Depends:** DB-04, DASHBOARD-03, AI-FILE-02, MCP-03.
**Unblocks:** INTEGRATION-02.
**Owns:** src/app/neon/database.ts; src/dev-dashboard/ai/connections/connectionRepository.ts and tests; ai/AiArchiveSection.tsx composition only after AI task handoff; root lockfile coordinated updates.
Register exact new Functions Args/Returns and history/current audit columns in handwritten Database type. Do not generate from production or include secret row data as frontend list payload. Wire services from default authenticated Neon client to UI; feature modules keep no additional auth.
**Tests:** typed RPC fixture parity with 15, management success/revoke/list/error and lost-create replay, file export cross-device retrieval using two admin sessions, raw token never in metadata/storage.
**Commands:** common + check:db + focused ai tests.
**Acceptance:** no mock/stub transport in production composition; actors forced server-side.

## INTEGRATION-02: Canonical Dashboard And Publication Cutover Code

**Depends:** INTEGRATION-01.
**Unblocks:** INTEGRATION-03.
**Owns:** DashboardRoute.tsx, new drafts/{DraftWorkspaceSection,DraftSaveStatus,DraftConflictDialog}.tsx; publishing/{usePublicationController,PublishDashboard,ContentComparison}.tsx/.ts as existing extensions; app/content/{PublishedContentContext,PublishedContentProvider,publishedContentRepository}.tsx/.ts and tests; useDraftWorkspace.ts final export handoff; root config/runner/package after package handoff.

Use 16 state API. Move route persistence/AI composition to focused modules and reduce route below its baseline; don't put SQL/merge or connection state inline. Keep old hook in legacyRecovery-only adapter until cleanup; final useDraftWorkspace is V2. All editor field callbacks produce candidates preserving other fields. Remove route draft-sync/bridge links and local canonical workspace switching.

Introduce `VITE_EDITOR_V2_ENABLED` feature flag (default false until authorized enablement) and `VITE_EDITOR_READ_ONLY` emergency kill flag (default false). Both public booleans are nonsecret. Before cutover false uses existing admin experience; true uses V2 exclusively, never both persistence systems. After cutover rollback uses read-only flag, never returns to false/legacy editing. LEGACY-02 removes enablement flag and old branch, retains emergency read-only flag. Read-only blocks new UI mutations, not a security revocation of already-issued capabilities.

Publication controller follows 16 prepare/publish flow, no direct provider publish method. Remove public context publish function after all callsites migrate; publishedContentRepository retains reads, not arbitrary writes in final code. While enablement flag false, isolate legacy publisher under `publishing/legacyPublication.ts` (temporary) so old clients keep working before revocation. Reconcile preview uses shared compare/semantic UI; admin-vs-agent conflict never hidden.

**Tests:** route CRUD each scope and defaultGroupOrder, save state, explicit file apply, two fake clients, typed-during-save, read-only mode, publication disabled if dirty/offline/conflict/invalid, preview generation changes, post-publish query refresh. Preserve public PWA read/offline behavior. Existing PublishDashboard tests adapted to RPC path, never weakened.
**Commands:** common, all dashboard/publication tests, full check.
**Acceptance:** Gate C/D via integration tests; no production content changes; large hot files shrink/no growth.

## INTEGRATION-03: Live Replacement And Deployment Proof

**Depends:** INTEGRATION-02, DB-04.
**Unblocks:** LEGACY-01 jointly with MCP-04.
**Owns:** neon/tests/editorial-e2e.test.ts, docs/editorial-v2-rollout.md; root CI composition serially.
Use disposable branch: two real authenticated admin clients plus standalone MCP capability. Prove distinct-field merge and overlapping/delete/order conflict; same-generation one winner; image/file roundtrip; cross-session export retrieval; revoked capability blocked. Smoke dashboard at /bemtevi/dashboard in two independent sessions (test fixture Auth only), file path first and reload resumes canonical draft. Keep test accounts/capabilities out of artifacts.
**Tests:** editorial-e2e.test.ts covers these cross-client scenarios against real Data API; browser smoke records session/reload/file/publication behavior separately from mock component tests.

Record release checklist: additive migrations -> V2 code disabled -> disposable branch E2E -> verify initialized draft.baseRevision equals live revision -> authorized deploy/enable V2 -> apply separately staged direct-write revocation -> refresh Data API schema -> verify direct write denied and prepared admin/MCP publication succeed on staging. Production publish of editorial changes is not a smoke test and requires separate explicit intent. Production rollout uses read-only checks where possible.

Rollback: activate emergency read-only UI and apply operator-only disable_editorial_writes.sql from 15 to revoke mutation EXECUTE and active capabilities; preserve draft/history/public reads. Test that even an already-loaded browser cannot send a new mutation after this database gate. Do not regrant legacy direct publication or overwrite canonical payload. The public frontend flag alone is not an authorization boundary.

**Commands:** pnpm run check, check:db, check:mcp-package; frontend smoke against branch Vite environment, never live secrets in committed config.
**Acceptance:** Gate C/D/E replacement evidence before deletion; report deployed versus staged status truthfully. If owner has not authorized production, stage release and report approval prerequisite, not pretend deployed.

## INTEGRATION-04: Final Gate

**Depends:** LEGACY-02.
**Owns:** final root lockfile/gate configuration and docs/editorial-v2-rollout.md evidence.
**Unblocks:** release signoff only.
Run complete gate, required disposable-Neon tests, architecture check, packed clone-free MCP smoke and public PWA smoke. Verify SDK/package pins, all config auth URLs, no dangling legacy references outside explicitly historical documents, generated fallback remains read-only content:pull.
**Tests:** rerun all unit/integration, real Data API, package/protocol and public-read regression suites; no new behavioral redesign in this task.
**Commands:** pnpm run check; pnpm run check:db; pnpm run check:mcp-package; git diff --check; git status --short.
**Acceptance:** all gates actually green, no skipped credential jobs; no unpublished dependency in tarball; external npm/deployment approval documented. No push before local check green. Never claim implementation complete from docs-only evidence.
