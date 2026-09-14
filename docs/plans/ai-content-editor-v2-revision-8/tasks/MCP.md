# Standalone MCP Tasks

**Specification revision: 8.** Read 04, 14 and 15 in full. Paths below are relative to `packages/content-mcp/` unless prefixed otherwise. No MCP task edits root config/lockfile, dashboard UI, SQL, repository-local legacy bridges, or filesystem drafts.

## MCP-01: Package And Transport

**Depends:** MERGE-03 and INTEGRATION-00. **Unblocks:** MCP-02.

**Owned production/config paths:**

- `package.json`
- `README.md`
- `build.mjs`
- `vitest.config.ts`
- `src/index.ts`
- `src/config.ts`
- `src/server/createServer.ts`
- `src/server/dispatch.ts`
- `src/server/instructions.ts`
- `src/client/dataApiClient.ts`
- `src/client/errors.ts`

**Owned tests:**

- `tests/package.test.ts`
- `tests/transport.test.ts`
- `tests/config.test.ts`
- `tests/server.test.ts`

Adopt the INTEGRATION-00-verified manifest/tsconfig skeleton. The exact dependency/version/bin/files/scripts contract required by 04 is already part of that verification, so MCP-01 MUST NOT introduce a new dependency/version that would require a root lockfile change. If the verified scaffold cannot support the implementation without such a manifest dependency change, stop as drift instead of editing `pnpm-lock.yaml`. Non-resolution metadata/script corrections inside this package remain allowed only if INTEGRATION-00 recorded a concrete scaffold gap.

Implement 04 pins/bin/build/factory/strict configuration. Bundle content-core into the published artifact; public SDKs remain runtime dependencies exactly as frozen. The anonymous Neon SDK path obtains JWT using the supplied Auth URL and stores no login/session file. The central RPC client exposes only the fixed method allowlist; no tool argument may select an arbitrary endpoint/function. Use bounded timeout/cancellation and stderr for diagnostics; stdout is protocol only.

**Tests:** modern discovery and `2025-06-18` initialization expose instructions; invalid config fails before network with no leaked token; no stdout diagnostics; schema/transport errors map to fixed errors; anonymous token refresh; invalid endpoint/tool parameter cannot redirect credentials; built entrypoint boots.

**Commands:** common envelope plus `pnpm run build:mcp` and `pnpm run test:mcp`.

**Acceptance:** built package boots; exact version/pins; no admin-auth import, repo-relative runtime source or filesystem operation.

## MCP-02: Read/Edit/Image Tools

**Depends:** MCP-01. **Unblocks:** MCP-03.

**Owned production paths:**

- `src/tools/definitions.ts`
- `src/tools/getEditorContext.ts`
- `src/tools/listItems.ts`
- `src/tools/getItem.ts`
- `src/tools/findReferences.ts`
- `src/tools/applyOperations.ts`
- `src/tools/setMaterialImage.ts`
- `src/tools/getDiff.ts`
- `src/session/baseSnapshotCache.ts`
- `src/session/limits.ts`

**Owned tests:**

- `tests/read-edit.test.ts`
- `tests/images.test.ts`
- `tests/limits.test.ts`
- `tests/stale-merge.test.ts`

Implement the exact 04 inputs, descriptions, outputs, pagination and annotations. Use the SDK JSON-schema adapter, strict maximum bounds, and account for duplicated structured/text result bytes. Cache at most three base snapshots for 15 minutes and pin paged reads to generation. Mutations build on a verified cached base, use content-core CAS/reconcile/encode behavior and perform at most the single bounded retry permitted by 03/04. Images are accepted only through the frozen bytes/catalog/external/remove contract; never fetch arbitrary URLs or read filesystem paths.

**Tests:** every listed schema; rate/concurrency/cache expiry/LRU; large images omitted from reads; text paging concatenation; missing cache safe failure; stale independent edits merge; overlap/delete/order conflicts; second stale attempt bounded; ambiguous-save recovery; accepted no-op performs no write; input/output bounds; candidate-validation reporting.

**Commands:** common envelope plus `pnpm run test:mcp` and the shared core conformance suites consumed by these tests.

**Acceptance:** standalone agent edits with exactly the same operation/image/reconciliation semantics as dashboard; no imaginary SQL list/item RPCs.

## MCP-03: Guarded Publication

**Depends:** MCP-02. **Unblocks:** MCP-04 and INTEGRATION-01.

**Owned production paths:**

- `src/tools/preparePublish.ts`
- `src/tools/publishDraft.ts`
- `src/tools/definitions.ts` — publication tool additions only
- `src/server/instructions.ts` — publication-intent instruction additions only

**Owned tests:**

- `tests/publication.test.ts`
- `tests/instructions.test.ts`

Fetch exact current draft, verify generation/digest, inspect semantics and require base/live revision agreement. If normalization changes payload, return `validation_failed` with safe guidance to save normalized changes first; never publish a normalized substitute. Generate preparation UUID/token client-side as specified; prepare RPC receives only the token hash. Returning the raw publish token from `prepare_publish` is deliberate. Completion accepts only preparation UUID + raw token and invokes the replay-safe publication RPC.

**Tests:** invalid semantic content prevents prepare RPC; generation/live revision stale; wrong/expired token; intervening mutation invalidation; lost-response same-preparation replay; instructions/destructive annotations; no arbitrary publication payload input; edit/save fixture never invokes publish.

**Commands:** common envelope plus `pnpm run test:mcp`.

**Acceptance:** publication mechanics are separate from host/user intent; shipped instructions require explicit user request and do not claim universal host confirmation.

## MCP-04: Clone-Free Packed Artifact Gate

**Depends:** MCP-03 and DB-04. **Unblocks:** INTEGRATION-03 after INTEGRATION-02.

**Owned paths:**

- `scripts/tarball-smoke.mjs`
- `tests/standalone.test.ts`
- `tests/protocolCompatibility.test.ts`
- `README.md` — release/checklist section only

`pnpm run check:mcp-package` invokes `packages/content-mcp/scripts/tarball-smoke.mjs`. The script builds and `pnpm pack`s into a temporary directory, installs the tarball into another empty directory outside the repository, and launches the installed bin with credential-free local test transport/fixtures. Neither cwd nor `NODE_PATH` may reference the repo. The installed artifact contains bundled core and no unpublished workspace dependency. Verify stdio modern/legacy discovery and representative bounded read/edit dispatch without production credentials.

This task does not provision Neon and does not claim the live capability half of Gate E. INTEGRATION-03 exclusively owns `neon/tests/mcp-package-live.test.ts`; it reuses DB-04's disposable branch and exercises the same packed/installed artifact against real test Auth/Data API capability edit/prepare/publish.

**Tests:** npm manifest/bin/node version/version pin; tarball inventory; clean install without workspace; no stdout noise; modern/legacy protocol compatibility; package runtime resolves no source outside installed `node_modules`.

**Commands:** `pnpm run build:mcp`; `pnpm run test:mcp`; `pnpm run check:mcp-package`. DB-04 must already have recorded a green live database gate; do not create a second provisioning harness here.

**Acceptance:** retain pack/install evidence; no repository source dependency. Verify npm `@bemtevi` publishing permission before release; absence is a release blocker, not permission to rename package or generate `latest`. No npm publish without owner authorization. MCP-04 completes Gate E-local only.
