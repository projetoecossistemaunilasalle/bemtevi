# MCP-02 — Read/Edit/Image Tools

**Task:** MCP-02 of the V2 dossier, revision 8.
**Base HEAD:** `e030264786ae7010aac7832203244882d12f9265` (unchanged; nothing committed or pushed).
**Worktree state:** starting = ending (all changes remain uncommitted in the working tree; earlier tasks' uncommitted work preserved — no reverts, no cleanups).
**Prerequisites:** MCP-01 (package/transport/dispatch seam), MERGE-03 (content-core), DB-04 (Gate B green; not consumed by this task).

## Inventory

All paths relative to `packages/content-mcp/` unless noted.

### Created (owned production)

- `src/session/baseSnapshotCache.ts` (130 lines) — three-entry, 15-minute TTL, LRU base-snapshot cache keyed by connection id + generation; memory only; injectable clock; stores `verified` flag (unverified post-mutation candidates are unusable as read bases); the pinned get_diff comparison lives on the same entries (same three-entry bound and TTL).
- `src/session/limits.ts` (111 lines) — sliding 60-second/60-call rate limiter (rejected calls are logged too), read gate (4) and mutation gate (1) with immediate `rate_limited` rejection (no queueing), injectable clock/delay, and the `runWithLimits` wrapper.

### Created (owned production, private helper splits inside the owned subtree)

- `src/tools/shared.ts` (225) — in-band `Result` envelope unwrapping, frozen-code surfacing with PT-BR fallbacks, `ToolError` (client `EditorialError` + doc-14 optional `conflicts`), ContentValidation projection (20 issues; code/message/path truncated to 120/300/200; one `output_truncated` warning), data-URL scrubbing (`isImageDataUrl` → `[embedded image omitted]`), pagination helpers (arrays and text pages), scope collections/labels/counts, 256 KiB output-budget check (counting both text and structuredContent copies).
- `src/tools/rpc.ts` (159) — the only place handlers touch the client: fixed allowlist names, `p_connection_id`/`p_token` connection pair, read retry (once, after 500 ms, on `unavailable`), no-retry `rpcOnce` for mutation paths, wire-shape predicates, digest-verified draft/publication fetches (`verifySnapshot`), `verifiedBaseOrRebase`.
- `src/tools/schemas.ts` (156) — strict JSON schemas for the seven tools (`additionalProperties:false`, `required`, bounds: generation positive safe integer, id ≤200, offset ≥0, limit 1..100, get_item limit 1..16000 chars, operations 1..200 with a strict `anyOf` over the six operation variants including strict `ImageSlot`/`ImageValue` unions).
- `src/tools/mutation.ts` (245) — the shared mutation pipeline: verified cached base required (`rebase_required`), local candidate via content-core `applyOperations`, complete `inspectContent` report projected into the result, CAS against `p_expected_generation` with the ORIGINAL operations, one bounded stale path (verified remote fetch → `reconcileContent` → `encodeOperations` delta → retry), empty-delta shortcut (no second RPC, `merged:true, changed:false`), `merge_conflict` with the ORIGINAL `SemanticConflict[]` when the bounded output fits (else `response_too_large`), second stale → `retry_required` with base preserved, ambiguous `unavailable` → verified fetch + `sameContent` comparison (saved / reconcile path; never a blind resend), unverified candidate caching on success (a failed refresh never fails the result), accepted no-op leaves the verified base in place.
- `src/tools/contentCoreLib.d.ts` (8) — types-only lib directive; see change-control item CC-1 below.

### Created (owned tool handlers)

- `src/tools/definitions.ts` (193) — the catalog: seven tools (`prepare_publish`/`publish_draft` deliberately NOT registered), exact doc-04 descriptions verbatim, per-kind annotations (reads `readOnlyHint:true/destructiveHint:false/idempotentHint:true`; mutations `readOnlyHint:false/destructiveHint:true/idempotentHint:false`; all `openWorldHint:false`), PT-BR titles, `contentToolSpecs()` for the server wiring, and `registerContentTools(runtime, dispatch)` which registers every handler under the shared limits.
- `src/tools/getEditorContext.ts` (69) — context+draft pair; generation race repeats the pair once (second race → `retry_required`); draft verified BEFORE caching; output `{head, publishedRevision, connectionId, principalUserId, expiresAt, instructions (= SERVER_INSTRUCTIONS), counts}`.
- `src/tools/listItems.ts` (71) — verified cached base or `rebase_required`; payload-order items; label = title/name/id truncated to 160; `offset`/`limit` paging with `nextOffset` (null when exhausted); 256 KiB budget guard.
- `src/tools/getItem.ts` (70) — item or one existing top-level field (unknown field → `invalid_input`); serialization AFTER data-URL replacement; character paging (UTF-16 code units, default 8000, max 16000); `totalCharacters` of the replacement-applied text.
- `src/tools/findReferences.ts` (81) — exact `===` string comparison; excludes keys named `id`, image-value fields and data-URL strings; deterministic traversal (five-scope enum order → payload order → JSON key order → array order); RFC-6901 JSON-pointer paths; paged.
- `src/tools/getDiff.ts` (85) — offset 0 fetches ONE verified publication snapshot (`agent_get_published_content`), pins revision + `compareContent` changes to the cached draft entry; further pages reuse the pinned comparison (missing → `rebase_required`); a new offset-0 request replaces it; `beforePreview`/`afterPreview` are stable JSON strings with data URLs omitted, truncated to 200 chars; output `{generation, publishedRevision, changes, nextOffset}`.
- `src/tools/applyOperations.ts` (22) — envelope bounds (1..200 → `invalid_input`, no RPC) + per-operation content-core parsing (`invalid_operations`/`invalid_image`) then the shared pipeline.
- `src/tools/setMaterialImage.ts` (52) — materialId existence in the verified cached base (`invalid_input`, no RPC), slot/image envelopes, single synthesized operation validated by content-core `parseEditorialOperation` (uploads re-validated by `validateUploadedImage`/`inspectImage` inside `applyOperations`), then the SAME shared pipeline. No filesystem or URL access anywhere.

### Created (owned tests)

- `tests/read-edit.test.ts` (492 lines, 24 tests) — catalog names/descriptions/annotations/strict schemas + SDK `fromJsonSchema` validation behavior (unknown keys and empty batches rejected); get_editor_context output shape, single race recovery, double race → `retry_required`, base population; list_items paging/labels/truncation/`rebase_required`; get_item paging concatenation, field reads, unknown field/item rejection, data-URL omission with external URLs preserved; find_references paths/exclusions/pagination; validation projection (20-issue cap + `output_truncated`, truncation bounds, semantic issues reported on an accepted save); accepted no-op (no generation advance, verified base intact); input bounds (201 ops → `invalid_input` with zero RPC; structural rejects with frozen codes).
- `tests/images.test.ts` (408 lines, 13 tests) — uploaded/catalog/external/remove on featured, legacy and body slots (with generation advance and unverified-candidate → `rebase_required` until a fresh `get_editor_context`); rejections: legacy catalog, legacy non-empty alt, non-PNG/JPEG/WebP, >1 MiB decoded bytes, dimension >4096, 4096×4096 megapixel product (crafted IHDR headers), fileName separators/length, alt length, `http://` external, missing body block, unknown material (`invalid_input` before any RPC), missing cache (`rebase_required`); protected generic image fields rejected; large images omitted from get_item and get_diff reads; `globalThis.fetch` replaced by a spy proving zero URL fetches.
- `tests/limits.test.ts` (427 lines, 11 tests) — TTL expiry (serves at TTL−1, `rebase_required` at TTL), LRU eviction beyond three entries with clock-advanced touch order, generation keying, verified/unverified base marking for reads AND mutations; 60-calls/60 s window with rejected calls counted; read concurrency 4 (fifth rejected immediately) and mutation concurrency 1 via deferred transports; read retry exactly once after 500 ms (delay list asserted) and exhaustion after the single retry; mutation sends the CAS RPC exactly once with no retry delay and recovers the ambiguous outcome via fetch+compare.
- `tests/stale-merge.test.ts` (310 lines, 9 tests) — stale → reconcile of independent edits → single retry with `p_expected_generation` = remote and the ENCODED delta asserted; empty encoded delta → no second RPC (`merged:true, changed:false`); overlap conflict with the original conflict objects (path/base/local/remote) and preserved base; delete conflict and incompatible reorder order conflict; second stale → `retry_required` with base preserved; ambiguous save recovered via `sameContent` (`changed:true`, one RPC); ambiguous + different remote → reconcile path; missing cache → `rebase_required` with zero RPC; conflict output beyond 256 KiB → `response_too_large`.

### Patched (disclosed add-only wiring per the MCP-01 handoff)

- `src/server/createServer.ts` — the ONLY change: `inputSchema: undefined` replaced by `fromJsonSchema<ToolHandlerArgs>(spec.inputSchema as JsonSchemaType)` (SDK adapter from `@modelcontextprotocol/server`), so the SDK validates tool arguments against each spec's strict JSON schema before the dispatch handler runs and advertises the same schema on `tools/list`. Name/version/instructions/annotation defaults/transport behavior untouched; `toolInputSchemas` helper left as-is.
- `src/index.ts` — add-only surface registration: `composeRuntime` now calls `registerContentTools({client, connectionId, agentToken}, dispatch)` (the seam MCP-01's handoff reserved for MCP-02/03) and `registeredTools()` returns `contentToolSpecs()` instead of `[]`. `ComposedRuntime`'s public shape is unchanged; `serve()`, stdio diagnostics and stdout discipline are untouched. **Plus one defect fix, see D-1 below** (this part is a modification, not add-only).
- `src/server/dispatch.ts` — inspected; NO changes needed (handlers already return `Result` objects; unknown-tool rejection and error wrapping unchanged).

### Adopt/verify files inspected unchanged

- `src/config.ts`, `src/client/dataApiClient.ts`, `src/client/errors.ts`, `src/server/instructions.ts`, `package.json`, `build.mjs`, `vitest.config.ts`, `README.md`, `tests/package.test.ts`, `tests/config.test.ts`, `tests/transport.test.ts`, `tests/server.test.ts` — inspected and left unchanged (server.test.ts shows 8 tests; MCP-01's handoff said 5 — pre-existing discrepancy in that record, file untouched).
- `packages/content-core/src/index.ts` and the exports consumed (`applyOperations`, `encodeOperations`, `parseEditorialOperation`, `inspectContent`, `reconcileContent`, `compareContent`, `sameContent`, `verifySnapshot`, `sha256Text`, `isImageDataUrl`, `applyMaterialImage`, allowlist constants, fixtures) — read, used as-is, unchanged.

## Defects found and fixed during implementation

- **D-1 (in MCP-01's `src/index.ts`, disclosed modification):** the bin-execution guard imported `realpathSync` from `node:fs`. The audited `scripts/check-architecture.mjs` fails MCP runtime sources that import `node:fs` (`mcp-forbidden-import`), and doc 04 forbids filesystem operations in the runtime — the architecture gate cannot pass with that import present. Replaced with the standard entrypoint comparison using file URLs only (`pathToFileURL(process.argv[1]).href === import.meta.url` plus a raw-path tolerance), preserving: direct `node dist/index.js` serving, tsx source serving, and never auto-serving on import (transport.test.ts: all 5 tests green after the change). Caveat: invocation through a POSIX `.bin` symlink now compares unresolved paths; MCP-04's packed-artifact smoke must invoke the installed bin entry file directly (or the guard must be revisited with owner sign-off). Recorded in change control as CC-2.
- The SDK's discriminated-union narrowing behaves differently under the root tsconfig (no `strict`) — all tool-layer outcome checks use explicit `=== true`/`=== false` comparisons so both the root and package configurations compile identically.

## Change-control items (no files edited outside ownership without disclosure)

- **CC-1 — `content-core/src/digest.ts` DOM type name:** `sha256Text`/`sha256Bytes` cast their bytes with the DOM-global type name `BufferSource`. MCP-02 is the first consumer to typecheck `@bemtevi/content-core` inside the MCP project (lib `ES2022`, no DOM, `"types": ["node"]`), so `digest.ts` failed there with TS2304. Fix applied inside the owned subtree: `src/tools/contentCoreLib.d.ts` carries `/// <reference lib="dom" />` — a types-only, program-wide lib addition with no runtime effect and no new imports. A stronger fix (local `ArrayBufferView | ArrayBuffer` alias inside content-core's digest module) belongs to the content-core owner and is routed here for change control.
- **CC-2 — D-1 above:** the `src/index.ts` guard rewrite is a modification to an MCP-01-owned file beyond the add-only scope; disclosed with rationale (frozen architecture rule) and a concrete MCP-04 verification obligation.
- **CC-3 — no change needed:** merge_conflict responses carry the doc-14 optional `conflicts` field via a `ToolError` subtype defined in the owned tool layer; `src/client/errors.ts` and `src/server/dispatch.ts` remain untouched.

## Commands and exact results

| Command                       | Result                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm run test:mcp`           | PASS — 8 files, 81/81 tests (read-edit 24, images 13, limits 11, stale-merge 9; MCP-01's package 5, config 6, server 8, transport 5) |
| `pnpm run typecheck`          | PASS — exit 0 (root + content-core + content-mcp projects)                                                                           |
| `pnpm run lint`               | PASS — exit 0, no errors/warnings                                                                                                    |
| `pnpm run format:check`       | PASS — "All matched files use Prettier code style!"                                                                                  |
| `pnpm run check:architecture` | PASS — 536 source files                                                                                                              |
| `pnpm run build:mcp`          | PASS — dist/index.js (182.4 kB, shebang) + dist/meta.json emitted                                                                    |
| `pnpm run test:unit`          | PASS — 135 files, 1196/1196 (root credential-free suite unchanged)                                                                   |
| `pnpm run validate:flows`     | PASS — 8 flows                                                                                                                       |

`check:db` not applicable (no database work; live capability behavior is INTEGRATION-03's proof). `check:mcp-package` deferred to MCP-04 (tarball smoke; fail-closed until then). No npm publish, no production migration, no git commit/push.

## Acceptance status

- Standalone agent edits use exactly the dashboard's operation/image/reconciliation semantics: the same content-core `applyOperations`/`parseEditorialOperation`/`inspectContent`/`reconcileContent`/`encodeOperations`/`sameContent`/`verifySnapshot`/image validators, the same frozen codes, the same one-retry merge-and-CAS model (docs 03/04/14).
- No imaginary SQL list/item RPCs: only the four allowlisted agent RPCs are called (`agent_get_editor_context`, `agent_get_draft`, `agent_get_published_content`, `agent_apply_operations`); all list/item/reference/diff projections are client-side over the cached verified snapshot.
- Strict schemas/descriptions/annotations shipped exactly; outputs budget-checked against 256 KiB counting both serialized copies; no token ever appears in any tool output; no filesystem, child-process, or URL-fetch path exists in the tool layer (fetch spy test).

## Deferred gates and owners

- `check:mcp-package` — MCP-04 (clone-free packed smoke; must also verify the bin guard under symlink invocation, see CC-2/D-1).
- Live capability edit/prepare/publish behavior — INTEGRATION-03 (`mcp-package-live.test.ts` against the DB-04 disposable branch).

## Downstream unblocked

- **MCP-03** — `src/tools/definitions.ts` exposes the catalog arrays (adding publication tools is additive: extend `CATALOG`/`handlers` and annotations), the mutation pipeline and cache/limits are reusable, and `RegisteredServerTool.inputSchema` is already adapted through the SDK `fromJsonSchema` in `createServer.ts`.

## Notes

- Chained mutations require a fresh `get_editor_context` between writes: post-mutation candidates are cached UNVERIFIED (doc 04) and therefore cannot serve as the next mutation's base. Host guidance already instructs re-reading context after saves.
- The two deliberate semantic errors inside `conformanceBasePayload` (contact phone href, flow recommendation) are used intentionally in read-edit's reporting test; image/read tests use a repaired payload so `validation.valid:true` is also exercised.
