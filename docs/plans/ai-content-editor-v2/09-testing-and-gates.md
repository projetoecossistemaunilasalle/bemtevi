# Testing and Quality Gates

## Purpose

Define mandatory evidence before each implementation stage may proceed or be merged.

## Gate S — Specification readiness

Before any implementation task starts:

- `README.md` MUST report `Specification status: IMPLEMENTATION_READY`;
- Stage 0 in `00-specification-hardening.md` MUST be complete;
- executable task files MUST exist;
- all contract-affecting decisions required by the assigned task MUST be frozen;
- `13-dossier-change-control.md` governs any later normative change.

If a normative dossier change occurs during implementation, affected work is blocked until the strong-model change-control pass restores `IMPLEMENTATION_READY`.

## Existing full repository gate

The project already defines `pnpm run check` as the complete local quality gate. V2 MUST preserve this requirement.

The final gate must include at least:

- TypeScript typecheck.
- ESLint.
- Prettier check.
- flow validation.
- Vitest suite.
- production build.

V2 also adds architecture/file-size checks described below.

## New architecture gate

Add the exact root runner command:

- `pnpm run check:architecture`

and include it in the root `check` pipeline.

At minimum it enforces:

- new/modified source file size budgets;
- no growth of allowlisted oversized legacy files;
- forbidden dependency/import directions where practical;
- no editorial MCP import of repository-local filesystem DraftStore/sync/publisher modules;
- no arbitrary/raw publication path in the V2 MCP; `publish_draft` must require a successful pinned `prepare_publish`;
- no committed capability secrets.
- exact `@modelcontextprotocol/server@2.0.0` and generated `@bemtevi/content-mcp@1.0.0` pins with no ranges, `latest`, or unversioned invocation.

## Test levels

### Unit tests

Required for:

- semantic compare/reconcile behavior;
- operation parsing/application;
- image validation/encoding helpers;
- capability token parsing/hash helpers;
- content-edit export expiry/digest/ownership helpers;
- MCP tool handlers with mocked Data API client;
- dashboard save/retry state machine.

### Database contract/integration tests

Required for migrations/RPCs:

- authenticated admin can read/write draft.
- non-admin cannot mutate draft.
- anonymous direct table mutation fails.
- valid agent capability can call the fixed editorial RPC surface.
- invalid secret fails.
- expired capability fails.
- revoked capability fails.
- caller-supplied alternate draft identity is rejected; the singleton constraint is enforced. Do not create an impossible second active draft merely to satisfy a fixture.
- agent publication succeeds only through a valid pinned preparation; direct/arbitrary publication fails.
- agent publication attributes `published_by` to the connection principal and records the connection id separately.
- preparation expiry, revocation, replay-after-success, and single-use behavior are enforced.
- an admin can retrieve their export from another authenticated session/device.
- another admin cannot retrieve the export.
- export creation leaves at most five active exports for its creator and exports expire after 14 days.
- same `expected_generation` used twice results in exactly one successful mutation.
- failed/stale mutation leaves payload unchanged.
- a structurally valid but semantically invalid draft mutation can be stored; database tests do not claim full semantic enforcement.

Database tests use a dedicated `pnpm run check:db` command that provisions a disposable Neon branch, applies migrations, exercises the actual Data API as anonymous/authenticated/capability callers, and deletes the branch. The required protected CI job has Neon credentials and MUST fail rather than skip when provisioning or credentials are unavailable.

`pnpm run check` remains deterministic and credential-free for local development. Database-affecting work is mergeable only when both `pnpm run check` and the required `pnpm run check:db` CI job pass. The two commands and their distinct evidence requirements MUST be documented in root `AGENTS.md` when V2 database work begins.

### Dashboard integration tests

Required scenarios:

- load existing Neon draft;
- initialize from published content when missing;
- debounced save updates generation;
- IndexedDB cache does not overwrite newer Neon draft;
- visible polling fetches only the draft head until generation changes;
- an ambiguous save result is resolved by digest/read/reconciliation rather than a blind retry;
- a second intervening generation stops automatic retry and requires review;
- automatic merge of non-overlapping edits;
- manual conflict for overlapping edits;
- save failure preserves local edit;
- offline/local state indicator;
- publication still checks live published revision.
- dashboard publication is not requested while `content-core` semantic validation fails.

### File AI workflow tests

- exported package is valid and scoped.
- instructions consistently reference `operations.json`.
- import accepts valid operations.
- malformed operations rejected without mutation.
- stale generation uses normal reconciliation path.
- image operations roundtrip.
- an export created in one browser can be imported by the same admin in another browser through the Neon base.
- missing, expired, unauthorized, and digest-mismatched exports fail with `export_base_unavailable`.
- ZIP size, entry-count, compression-ratio, path, duplicate, MIME, byte, and dimension limits fail atomically.

### MCP contract tests

- initializes as a standalone stdio MCP.
- uses `@modelcontextprotocol/server@2.0.0`, reports package version `1.0.0`, targets `2026-07-28`, and negotiates with a `2025-06-18` host fixture.
- all tools have bounded schemas.
- output payloads respect size limits.
- guarded `prepare_publish` and `publish_draft` tools exist and arbitrary direct publication does not.
- no repository clone/path is required.
- Data API errors map to stable domain errors.
- stale generation merges when base snapshot is available.
- stale generation returns `rebase_required` when base is unavailable.
- no blind retry after conflict.
- MCP publication is not requested while `content-core` semantic validation fails.
- anonymous Data API requests obtain the public anonymous JWT using BEMTEVI_AUTH_URL; no admin login/session is copied.
- read pagination pins the cached generation, removes image bytes, and accounts for both structured/text output sizes.
- a no-op does not increment generation; a stale no-op still fails CAS.
- edits made while a merged save is in flight survive rebase onto its acknowledged candidate.
- database digest verification uses returned canonical text, not JSON.stringify equivalence.

Exact task commands, files, fixture scenarios and checkpoint dependencies are in [tasks/README.md](tasks/README.md). The live harness contract is DB-04; SDK/package compatibility and packed install are MCP-04. Scope permission, protected CI credentials and production approval are release prerequisites, never skipped tests.

### Security regression tests

- raw token never logged.
- downloaded config is treated as secret material.
- agent RPC functions have explicit grants.
- protected tables do not expose unintended anonymous privileges.
- connection revocation takes effect on next RPC.
- secret cannot create/revoke other connections.
- image tool cannot read arbitrary local files.
- image MIME and size restrictions enforced.
- server instructions and the `publish_draft` destructive annotation are present; tests do not claim universal host confirmation.

## Gates by implementation stage

### Gate A — shared contracts

Required:

- existing merge test suite green;
- new reconciliation domain tests green;
- no behavior regression;
- architecture size gate installed.

### Gate B — database

Required:

- migration applies cleanly to an isolated database;
- concurrency/RLS/capability tests green;
- rollback/manual cleanup instructions documented where needed.
- protected `pnpm run check:db` disposable-Neon CI job green without skips.

### Gate C — dashboard draft cutover

Required:

- two-client concurrency scenario green;
- local cache recovery scenario green;
- existing publication tests green.

### Gate D — AI file flow

Required:

- import/export tests green;
- concurrent draft mutation tests green;
- image contract tests green.

### Gate E — MCP

Required:

- standalone clean-install smoke test;
- capability security tests green;
- clone-free edit E2E green;
- guarded publication E2E: explicit `prepare_publish` then `publish_draft` succeeds for an unchanged valid generation;
- stale generation/revision and mismatched publish token/digest fail closed;
- no arbitrary payload can be supplied directly to `publish_draft`.

### Gate F — legacy deletion

Required before deletion:

- replacement flows all green.

Required after deletion:

- no dangling imports/scripts/docs/config;
- repository-wide search confirms removed user instructions are gone;
- full `pnpm run check` green.

## Final acceptance gate

No implementation PR is complete until:

```bash
pnpm run check
```

passes with the new architecture gate included.
