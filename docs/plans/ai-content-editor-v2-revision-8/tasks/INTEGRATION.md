# Integration And Release Tasks

**Specification revision: 8.**

Integration owns only the exact hot files named below. All integration tasks are serial. Feature tasks hand off stable interfaces; integration composes them without re-owning their implementations.

## INTEGRATION-00: Adopt And Verify Workspace/Gates

**Depends:** Stage 0 revision 8 ready.  
**Unblocks:** MERGE-01 and DB harness work.

### Current-state classification at audited base

**Adopt/verify first; patch only if a frozen requirement below is violated:**

- `pnpm-workspace.yaml`
- `packages/content-core/package.json`
- `packages/content-core/tsconfig.json`
- `packages/content-core/src/index.ts`
- `packages/content-mcp/package.json`
- `packages/content-mcp/tsconfig.json`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`
- `eslint.config.js`
- `scripts/run-project-command.mjs`
- `.github/workflows/ci.yml`
- `AGENTS.md`
- `scripts/check-architecture.mjs`
- `scripts/__tests__/check-architecture.test.ts`
- `scripts/__tests__/run-project-command.test.ts`
- `scripts/architecture-baseline.json`
- `neon/tests/vitest.config.ts`

**Implement later, not in this task:**

- MCP `build.mjs` and production source: MCP-01.
- DB live harness `run.ts`/`provision.ts`/clients: DB-04.

### Requirements

Verify the existing scaffold satisfies:

- workspace packages glob `packages/*`;
- `@bemtevi/content-core`, private 1.0.0, type module, workspace source export;
- app dependency `workspace:*`;
- MCP manifest name/version/bin/runtime pins exactly as 04;
- root packageManager `pnpm@10.14.0`;
- dev pins `esbuild@0.25.12`, `neon@4.14.6`, `pg@8.16.3`, `@types/pg@8.15.5`;
- strict package TS configs and current root inclusion;
- `test:unit` forwards trailing args;
- `test:mcp`, `build:mcp`, `check:mcp-package`, `check:db`, `check:architecture` fail closed when their implementation prerequisite is absent rather than fake-pass;
- current architecture checker rules from 10;
- current `scripts/architecture-baseline.json` equals dossier `architecture-baseline.json`;
- CI `v2-database` job is credentialed/trusted-ref only, runs `pnpm run check:db`, and missing credentials fail the job;
- root Vitest excludes `neon/tests/**` while DB-specific `neon/tests/vitest.config.ts` includes `**/*.test.ts`, so later DB-04/INTEGRATION-03 live files are discovered without a CI edit;
- AGENTS distinguishes credential-free and live gates without prematurely removing legacy instructions.

Patch only a discovered nonconformance in the allowlist above. Do not restore revision-5 baseline values, recombine decomposed source/tests, create DB-04 harness stubs, or add fake-success MCP build scripts.

### Tests/commands

```text
pnpm run test:unit -- scripts/__tests__/check-architecture.test.ts scripts/__tests__/run-project-command.test.ts
pnpm run check:architecture
pnpm run typecheck
pnpm run lint
pnpm run check
```

Record actual results. If a current baseline test fails, diagnose; do not weaken it to declare INTEGRATION-00 complete.

### Acceptance

- scaffold contract verified;
- current baseline matches dossier;
- no unnecessary rewrites;
- no source behavior changes except a narrowly required scaffold fix;
- current CI/DB-test discovery contract recorded so INTEGRATION-03 has no conditional CI ownership;
- MERGE-01 starts only after the focused gate is green or an explicitly scoped preexisting failure is routed for repair.

## INTEGRATION-01: Typed RPC And Authenticated Neon Composition

**Depends:** DB-04, DASHBOARD-03, AI-FILE-02, MCP-03.  
**Unblocks:** INTEGRATION-02.

**Owns exactly:**

- `src/app/neon/database.ts`
- new `src/app/neon/__tests__/databaseV2Contract.test.ts`
- new `src/dev-dashboard/editorialNeonServices.ts`
- new `src/dev-dashboard/__tests__/editorialNeonServices.test.ts`

Feature-owned `drafts/draftRepository.ts`, `ai/files/exportRepository.ts`, `ai/connections/connectionRepository.ts`, `AiArchiveSection.tsx`, route/tab composition and root lockfile/config are **not** owned here.

First register the exact V2 tables/functions Args/Returns and publication/history audit columns from 15 in the handwritten `src/app/neon/database.ts`. Only after those typings compile, implement `editorialNeonServices.ts` to pass the existing authenticated `defaultNeonClient` structurally into `createDraftRepository`, `createExportRepository`, and `createConnectionRepository`.

`editorialNeonServices.ts` exports one immutable composition object containing exactly `{draftRepository, exportRepository, connectionRepository}`. It does not render UI, own auth state, create another Neon client, reimplement repository methods, or expose raw table clients. Do not use `any`, double-casts, untyped RPC name strings outside the three feature repository transports, production stubs, secret row fields, or caller-supplied actor identity.

**Tests:** `databaseV2Contract.test.ts` asserts the handwritten function names/argument keys/return shapes against a compile-time fixture transcribed from 15; `editorialNeonServices.test.ts` proves the authenticated client satisfies all three structural transports and that the resulting repositories call the exact admin RPCs without extra identity parameters. Also cover management success/revoke/list/error, lost-create replay wiring, cross-session export retrieval wiring and raw token absence from metadata/storage.

**Commands:** common commands, the two focused tests above, and `pnpm run check:db` because DB-04 is now available.

**Acceptance:** no mock/stub production transport; actors server-derived; feature repository modules remain Neon-client/Database independent; `editorialNeonServices.ts` is the sole browser location constructing the three real V2 repositories.

## INTEGRATION-02: Canonical Dashboard And Publication Cutover Code

**Depends:** INTEGRATION-01.  
**Unblocks:** INTEGRATION-03.

**Owns exactly:**

- `.env.example`
- `src/dev-dashboard/editorFlags.ts`
- new `src/dev-dashboard/__tests__/editorFlags.test.ts`
- `src/dev-dashboard/DashboardRoute.tsx`
- `src/dev-dashboard/DashboardTabContent.tsx`
- `src/dev-dashboard/__tests__/dashboardRouteTestHarness.tsx`
- existing/new `src/dev-dashboard/__tests__/dashboardRoute.*.test.tsx`
- new `src/dev-dashboard/drafts/DraftWorkspaceSection.tsx`
- new `src/dev-dashboard/drafts/DraftSaveStatus.tsx`
- new `src/dev-dashboard/drafts/DraftConflictDialog.tsx`
- new tests under `src/dev-dashboard/drafts/__tests__/**`
- `src/dev-dashboard/draft-storage/useDraftWorkspace.ts`
- `src/dev-dashboard/publishing/usePublicationController.ts`
- `src/dev-dashboard/publishing/PublishDashboard.tsx`
- `src/dev-dashboard/publishing/ContentComparison.tsx`
- new temporary `src/dev-dashboard/publishing/legacyPublication.ts`
- tests under `src/dev-dashboard/publishing/__tests__/**`
- `src/app/content/PublishedContentContext.ts`
- `src/app/content/PublishedContentProvider.tsx`
- `src/app/content/publishedContentRepository.ts`
- tests under `src/app/content/__tests__/**`

No root package/runner/CI/lockfile ownership is granted in this task. `editorialNeonServices.ts` is consumed, not modified. AI-FILE components/repositories are consumed through their handed-off props/interfaces, not modified.

Keep `DashboardRoute.tsx` composition-only and use `DashboardTabContent.tsx` as the current tab-composition seam; do not inline its contents back into the route. Implement the exact state/repository API from 16 and adapt existing field callbacks to candidates preserving untouched fields.

### Exact feature-flag behavior

Create `editorFlags.ts` exactly as 16 specifies. Only the string `'true'` enables a flag. Add to `.env.example`:

```text
VITE_EDITOR_V2_ENABLED=false
VITE_EDITOR_READ_ONLY=false
```

Tests must prove `undefined`, `'false'`, `'TRUE'`, `'1'`, `''`, `true` and `false` do not enable either flag. Before cutover, `v2Enabled=false` renders only legacy editing and `v2Enabled=true` renders only V2; never instantiate both persistence systems in one dashboard render. `readOnly=true` disables browser mutation/publication/connection-create actions in whichever branch is selected while retaining reads/diff/recovery download.

### Exact publication coexistence handoff

Move the existing direct `published_content` insert/update implementation into the temporary `publishing/legacyPublication.ts`; do not duplicate it. During coexistence only the `v2Enabled=false` branch may import/use that adapter.

For the V2 branch:

- `PublishedContentRepository` becomes read-only (`loadPublishedContent` only);
- `PublishedContentContextValue`/`PublishedContentProvider` no longer expose a public arbitrary `publish(payload, publisherId, expectedRevision)` method;
- `usePublicationController` uses the V2 `DraftRepository.prepare()` + `DraftRepository.publish()` protocol from 16/15, with fresh UUID/token, exact clean generation/digest/live revision, explicit review and refresh after result;
- no V2 error path calls `legacyPublication.ts` or direct table insert/update;
- public application read/fallback/offline behavior remains through the existing provider/repository read path.

The temporary adapter remains until LEGACY-01 and is the only direct-publication code path allowed during coexistence.

### UI/state requirements

Use 16 save labels and conflict/recovery behavior. Wire the real repositories from `editorialNeonServices.ts` through route/tab composition into V2 draft/file/connection/publication surfaces. File-first UI stays before connections. All editor callbacks preserve unrelated fields. A preview becomes stale and closes if generation/live revision changes. Publication is disabled while dirty/offline/conflict/error/invalid/read-only.

**Tests:** current split route CRUD suites for flows/education/groups/contacts/export plus focused V2 draft/save/conflict/read-only/flag/publication tests; typed-during-save; two fake-client concurrency; explicit file apply; post-publish query refresh; direct legacy adapter reachable only when flag false; V2 path has no direct provider/table write; public PWA read/offline tests remain green. Do not recreate a removed monolithic dashboard test.

**Commands:** common commands, all owned dashboard/publication/content tests, full `pnpm run check`, and `pnpm run check:db` for publication integration.

**Acceptance:** Gate C/D component/integration behavior; no production content change; V2 has one canonical Neon draft and guarded publication only; legacy direct publisher is isolated in the named temporary file; current decomposed hot files stay within architecture limits.

## INTEGRATION-03: Live Replacement And Deployment Proof

**Depends:** INTEGRATION-02, DB-04.  
**Unblocks:** LEGACY-01 jointly with MCP-04.

**Owns exactly:**

- new `neon/tests/editorial-e2e.test.ts`
- new `neon/tests/mcp-package-live.test.ts`
- new `docs/editorial-v2-rollout.md`

No root CI/runner/package/lockfile ownership. The audited protected `v2-database` job already calls `check:db`, and DB-04's test config/runner must discover both new `neon/tests/*.test.ts` files. If either test is not discovered, fix DB-04-owned discovery under an explicit DB-04 handback or enter change control; do not edit CI here.

Use two real authenticated admin clients plus standalone capability on the DB-04 disposable branch. Prove distinct-field merge, overlapping/delete/order conflict, same-generation one-winner CAS, image/file roundtrip, cross-session export retrieval, revoked capability denial, aligned base/live revision, guarded admin publication, and guarded MCP publication.

`mcp-package-live.test.ts` must build/pack/install the same MCP tarball outside the repository and exercise that installed bin through real test Auth/Data API capability edit plus prepare/publish. Reuse the DB-04 provisioning/client harness; do not create a second Neon provisioning system.

Record in `docs/editorial-v2-rollout.md` the fixed rollout sequence:

1. additive migrations;
2. V2 code deployed with `VITE_EDITOR_V2_ENABLED=false`;
3. disposable-branch E2E and installed-tarball live test green;
4. verify initialized draft `baseRevision` equals live revision;
5. authorized deploy/enable V2 with exact `'true'` flag;
6. separately apply direct-write cutover artifact;
7. refresh Data API schema;
8. verify old direct write denied and prepared admin/MCP publication succeeds;
9. only then permit LEGACY-01.

Dashboard browser smoke is recorded separately from API tests: `/bemtevi/dashboard` in two independent authenticated test sessions, edit/save/reload resumes canonical draft, file-first export/import preview works, and no legacy bridge/sync network request occurs in the V2 branch. Use only disposable/test credentials and never write them into the rollout document.

Rollback is read-only UI plus `neon/cutover/disable_editorial_writes.sql`; never regrant legacy publication, flip V2 back to legacy editing after cutover, or overwrite canonical draft. Prove an already-loaded browser cannot make a new DB mutation after the database kill artifact is linearized.

**Commands:** `pnpm run check`, `pnpm run check:db`, `pnpm run check:mcp-package`, plus the recorded dashboard smoke against the disposable/test environment.

**Acceptance:** Gates C/D/E-live replacement evidence complete before deletion; deployed versus staged status reported truthfully. If production enablement is not owner-authorized, stop at staged release evidence.

## INTEGRATION-04: Final Gate And Signoff

**Depends:** LEGACY-02.  
**Unblocks:** release signoff only.

**Owns exactly:** `docs/editorial-v2-rollout.md` for final evidence/status updates only. No production source, migration, runner, package, lockfile or CI ownership is granted here.

This is verification, not a late fix task. If any gate fails because a source/config file is wrong, return the failure to the task that owns that file (or change control if the owner is ambiguous); do not redesign it inside INTEGRATION-04.

Run, in this order:

```text
pnpm run check
pnpm run check:db
pnpm run check:mcp-package
pnpm run test:unit -- src/app/content src/features
pnpm run validate:flows
git diff --check
git status --short
```

Then verify:

- exact package/SDK/protocol pins;
- `.env.example` retains `VITE_EDITOR_READ_ONLY=false` and no longer contains `VITE_EDITOR_V2_ENABLED` after LEGACY-02;
- no operational production import/request/config reference to legacy bridge/content-agent/draft-sync paths outside explicitly historical documentation/recovery decoders;
- `content:pull` remains one-way read-only fallback mirroring;
- packed installed MCP has no repository/runtime workspace dependency;
- required environment-dependent gates actually ran and were not skipped;
- rollout document distinguishes staged, enabled, cutover-applied, npm-published and production-approved states truthfully.

**Acceptance:** all gates actually green, no skipped credential jobs, no unpublished runtime dependency, no dangling legacy operational path, and no source/config edits performed merely to force signoff.
