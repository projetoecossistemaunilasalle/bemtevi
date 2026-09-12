# Standalone MCP Tasks

Read 04 in full plus 14/15. Exact paths below are relative to packages/content-mcp unless noted. No root configs/lockfile, UI, SQL, filesystem draft or provider bridge changes.

## MCP-01: Package And Transport

**Depends:** MERGE-03, INTEGRATION-00 workspace skeleton. **Unblocks:** MCP-02. **Parallel:** MCP lane.
**Owns:** package.json, README.md, build.mjs, vitest.config.ts, src/{index,config}.ts, src/server/{createServer,dispatch,instructions}.ts, src/client/{dataApiClient,errors}.ts; adjacent tests.
Implement 04 pins/bin/build/factory/strict config. Core bundled, public SDKs runtime dependencies. Anonymous SDK obtains JWT using auth URL without login/session files. Central RPC client only fixed method allowlist, no arbitrary endpoints/functions from tool args. Safe process cancellation/timeouts.
**Tests:** modern discovery and 2025-06-18 initialize expose instructions; invalid config fails before network with no leaked token; no stdout diagnostics; schema/transport errors map to fixed errors; anonymous token refresh; invalid endpoint/tool parameter cannot redirect credentials.
**Commands:** common plus pnpm run build:mcp and pnpm run test:mcp.
**Acceptance:** executable entry boots from built package; no unpinned MCP SDK, admin auth import, repo-relative runtime source or filesystem operations.

## MCP-02: Read/Edit/Image Tools

**Depends:** MCP-01. **Unblocks:** MCP-03.
**Owns:** src/tools/{definitions,getEditorContext,listItems,getItem,findReferences,applyOperations,setMaterialImage,getDiff}.ts; src/session/{baseSnapshotCache,limits}.ts; tests.
Implement exact 04 inputs/descriptions/output/pagination/annotations. Use SDK JSON-schema adapter, strict max bounds, size accounting for duplicated structured/text results. Cache 3 snapshots/15 minutes; generation-pinned pages. Mutation builds on verified cached base, uses core CAS/reconcile/encode; one automatic retry. Images come as bytes/catalog/external/remove contract; no URL fetch/path read.
**Tests:** every listed schema, rate/concurrency/cache expiry/LRU, large images omitted in reads, text paging concat, missing cache safe failure, stale independent edits merge, overlapping/deletion/order conflicts, second stale bounded, ambiguous save recovery, no-op no write, input/output limits and candidate-validation reporting.
**Commands:** common plus test:mcp and focused core conformance fixtures.
**Acceptance:** standalone agent edits exactly same draft semantics as dashboard, no imaginary SQL list/item RPCs.

## MCP-03: Guarded Publication

**Depends:** MCP-02. **Unblocks:** MCP-04, INTEGRATION-01.
**Owns:** src/tools/{preparePublish,publishDraft}.ts and their tests; definitions.ts/instructions.ts sequentially within MCP lane.
Fetch exact current draft, verify generation/digest, inspect semantics, require base/live revision agreement. If normalization changes payload, return validation_failed with safe guidance to save normalized changes first; don't publish a normalized substitute. Generate token+UUID; prepare RPC receives only hash; output raw publish token deliberately. Completion accepts only UUID/token and uses replay-safe RPC.
**Tests:** validation invalid prevents RPC, generation/live stale, wrong/expired token, mutation invalidation, lost response same-preparation replay, instruction text/destructive annotation, no arbitrary payload schema. Fixture must show edit/save never auto-call publish.
**Commands:** common plus test:mcp.
**Acceptance:** mechanics tested separately from host intent; no assertion of universal human confirmation.

## MCP-04: Clone-Free Artifact Gate

**Depends:** MCP-03 and DB-04 for live smoke. **Unblocks:** LEGACY-01 after INTEGRATION-03.
**Owns:** tests/standalone.test.ts, tests/protocolCompatibility.test.ts, package README release checklist.
Build and pnpm pack into temporary directory; install tarball in another empty directory outside repository, run bin with test transport, then Gate E live capability fixture when DB-04 ready. Neither cwd nor NODE_PATH references repo; artifact contains bundled core and no unpublished workspace dependency. Check stdio modern/legacy discovery and edit/prepare/publish against disposable test content.
**Tests:** npm manifest/bin/node-version/version pin, tarball file inventory, clean install without workspace, no stdout noise, expired/revoked capability, package runtime resolves no source outside installed node_modules.
**Commands:** pnpm run build:mcp, pnpm run test:mcp, pnpm run check:mcp-package; live smoke via check:db after DB-04.
**Acceptance:** retain pack/install/live evidence; verify npm @bemtevi scope publishing permission before release. No npm publish without owner authorization. If scope unavailable report release blocker, do not rename package or generate latest config.
