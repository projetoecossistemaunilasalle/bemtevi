# INTEGRATION-01 Handoff — Typed RPC And Authenticated Neon Composition

**Task ID:** INTEGRATION-01 (revision 8 dossier)
**Starting HEAD:** `e030264786ae7010aac7832203244882d12f9265` (equals audited base; no drift-gate stop)
**Ending HEAD:** same commit (no commits made; all changes in the working tree, per task instructions)
**Worktree state:** 107 entries before → 111 after; the 4 delta entries are exactly this task's owned files. All pre-existing uncommitted work (dashboard, content-core, neon, MCP package, docs deletions, `eslint.config.js`, etc.) preserved untouched. Nothing reverted, stashed, or committed.

## Prerequisites verified green

DB-04 (Gate B live harness), DASHBOARD-03 (canonical hook + recovery adapter), AI-FILE-02 (connections UI + repositories), MCP-03 (guarded publication catalog). `check:db` ran live with credentials from the outside-repo DB-04 fixture file.

## Adopt/verify files inspected unchanged

- `src/app/neon/client.ts` — `defaultNeonClient` can be null (empty config); `createConfiguredNeonClient(config, factory)` injectable for tests.
- `src/dev-dashboard/drafts/draftRepository.ts` — transport `rpc(method: string, args: Record<string, unknown>): Promise<{data, error}>`; exact admin RPC names/args.
- `src/dev-dashboard/ai/files/exportRepository.ts` — same pattern, 2 export RPCs.
- `src/dev-dashboard/ai/connections/connectionRepository.ts` — same pattern, 3 connection RPCs, hash-only wire.
- `src/dev-dashboard/draft-storage/useDraftWorkspace.ts` — `configureCanonicalWorkspaceServices(services | null)` expects `CanonicalWorkspaceServices = {repository, cache?, now?, timers?, isOnline?, tabId?}`; only `repository` is required.
- `packages/content-mcp/src/client/dataApiClient.ts` — agent RPCs carry their own allowlist/client inside the MCP package.
- `neon/tests/rpc-types.ts`, `neon/tests/capabilities.test.ts` — cross-checked doc-15 arg keys and bytea reality (`token_hash` stored as `Buffer` server-side; `p_token_hash` is 64-hex text decoded inside SQL).
- Dossier docs read: tasks/INTEGRATION.md (INTEGRATION-01), 14, 15, 16 (Services And Ownership), 10, 11, tasks/README.md, root AGENTS.md.

## Inventory (owned files)

| File                                                        | Status   | Lines | Budget (doc 10) |
| ----------------------------------------------------------- | -------- | ----- | --------------- |
| `src/app/neon/database.ts`                                  | modified | 290   | ≤300 prod .ts   |
| `src/app/neon/__tests__/databaseV2Contract.test.ts`         | new      | 330   | ≤500 test       |
| `src/dev-dashboard/editorialNeonServices.ts`                | new      | 110   | ≤300 prod .ts   |
| `src/dev-dashboard/__tests__/editorialNeonServices.test.ts` | new      | 347   | ≤500 test       |

### `src/app/neon/database.ts`

Registered the 4 V2 tables (`content_drafts`, `content_agent_connections`, `content_edit_exports`, `content_publish_preparations`) with full Row/Insert/Update shapes via a compact `TableShape` helper (keeps the file under the 300-line hard limit that applies because this file has no baseline entry); added the `published_via_connection_id: string | null` audit column to `published_content`; registered `published_content_history` (was absent from the type; doc-15 audit amendment); registered the 10 admin V2 RPCs with exact doc-15 snake_case `Args` and `Returns: unknown` (jsonb `Result<T>` envelope).

### `src/dev-dashboard/editorialNeonServices.ts`

Sole browser composition of the three real V2 repositories from `defaultNeonClient`; exports the frozen `{draftRepository, exportRepository, connectionRepository}` object plus `editorialNeonConfigured`; wires `configureCanonicalWorkspaceServices({repository: draftRepository})` at module import when the client exists. No UI, no auth state, no second client, no repository reimplementation, no raw table clients, no `any`/double-casts, no production stubs, no secret row fields, no caller-supplied actor identity.

### Tests

- `databaseV2Contract.test.ts` (7 tests) — compile-time `Equal<>` pins for the exact function catalog, arg-key sets, `unknown` returns, table catalog; runtime `Object.keys` pinning of doc-15 snake_case arg sets; audit column and nullable-column/secret typing checks; asserts the 6 agent RPCs are NOT registered in the browser type.
- `editorialNeonServices.test.ts` (12 tests) — structural transport satisfaction (spy + factory-produced client); frozen composition keys; import-time canonical-hook wiring capture (mocked); create/list/revoke with exact args; error-envelope decode; prepare/publish exact args; load/mutate exact args; lost-create replay pass-through; cross-session export create+get; 403→`unauthorized` mapping; raw-token/secret absence in all rpc args (via `vi.hoisted` spy on the real production composition).

## Commands and exact results

| Command                                  | Result                                                                                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`                     | PASS, exit 0 (after two development iterations: SDK thenable incompatibility → async adapter; test fixture typing)                                                                 |
| `pnpm run lint`                          | PASS, exit 0, 0 problems (7 warnings during development eliminated)                                                                                                                |
| `pnpm run check:architecture`            | PASS — "Architecture check passed (546 source files)" (one intermediate failure `OVER_HARD_LIMIT database.ts lines=359 hard=300` fixed by TableShape compaction to 290)            |
| `pnpm exec vitest run <2 focused files>` | PASS — 2 files, 19 tests passed (7 contract + 12 composition)                                                                                                                      |
| `pnpm run format:check`                  | PASS repo-wide after formatting the pre-existing MCP-04 handoff file (outside this task's allowlist; formatted by the orchestrator to restore the shared gate — content unchanged) |
| `pnpm run test:unit`                     | PASS — 137 files, 1215 tests passed                                                                                                                                                |
| `pnpm run check:db`                      | PASS, exit 0 — "[check:db] all live suites passed; cleaning up"; disposable branch `br-little-wave-ac2eq6h2` created and deleted                                                   |

## Decisions recorded

1. **bytea representation:** `token_hash` columns typed as `string` in Row shapes — the neon-js/postgrest-js browser stack has no bytea convention (SDK `.d.ts` exposes only `GenericFunction.Returns: unknown`), these columns are never returned to the browser (all reads go through jsonb RPCs returning secret-free metadata, doc 15 "Never expose hash columns"), and `p_token_hash` args remain `string` (64 lowercase hex) decoded inside SQL. No secret values exposed in types.
2. **Agent-RPC registration:** NOT registered in the browser `Database` type. The browser repositories use only the 10 admin RPCs; the 6 agent RPCs belong to the standalone MCP package's own client/allowlist. The contract test explicitly asserts their absence while pinning the exact 10-name admin catalog.
3. **`Returns: unknown`:** every V2 RPC declares `Returns: unknown` — each function RETURNS jsonb carrying `Result<T>` (doc 14), decoded structurally by the repositories; concrete shapes in the Database type would misrepresent the envelope layer.
4. **Canonical hook wiring:** wired at module import with only `{repository: draftRepository}` (the hook's only required service; cache/now/timers stay at hook defaults). The hook file itself was NOT modified (INTEGRATION-02 owns it).
5. **Null-client handling:** when `defaultNeonClient === null`, the composition binds a fail-closed transport (every call returns `{data: null, error}` → repositories surface `unavailable`), exports `editorialNeonConfigured = false`, and does NOT wire the canonical hook (stays inert/loading). No second client, no fake success.
6. **SDK thenable adapter:** the SDK's `rpc` returns a `PostgrestFilterBuilder` thenable, not a `Promise`, and keys args by a per-function type — direct structural assignment to the frozen transports is impossible. Solved with a cast-free `async` delegation adapter that narrows `method` to `string & keyof Database['public']['Functions']` (only registered names pass; args governed by the registered Args types). No `any`, no double-casts.

## Change-control items

- **MCP-04 handoff formatting (orchestrator fix, not this task's edit):** `pnpm run format:check` failed solely on `docs/plans/ai-content-editor-v2-revision-8/handoffs/MCP-04.md` (untracked MCP-04 handoff, pre-existing). The orchestrator ran prettier on that file to restore the shared gate; content unchanged.
- **TableShape helper:** `database.ts` needed a compact generic to register 8 tables × 3 shapes within the 300-line hard limit (no baseline entry exists for this file). Public contract semantics unchanged (Row/Insert/Update/Relationships identical); a strictly literal shape would exceed the ceiling and require a baseline change-control entry.

## Skipped gates

None. All required gates ran, including live `check:db`.

## Downstream unblocked

- **INTEGRATION-02** — can consume `editorialNeonServices` (frozen composition), the typed admin RPC catalog, and the already-wired canonical workspace services. Remaining scope: `editorFlags.ts`, route/tab cutover, `usePublicationController`, provider read-only conversion, `legacyPublication.ts` temporary adapter, and the rest of the doc-16 hook surface promotion.
