# Testing and Quality Gates

**Specification revision: 8. Audited base: `e030264786ae7010aac7832203244882d12f9265`.**

## Gate S — specification readiness

Before implementation:

- README status is `IMPLEMENTATION_READY` and revision is 8;
- audited-base drift preflight has passed;
- exact task files/allowlists exist;
- 14–16 remain authoritative;
- Revision-8 SHA manifest verifies the distributed dossier.

Later normative or V2-sensitive repository change routes through 13.

## Credential-free local gate

`pnpm run check` is the required local pre-push gate. At the audited scaffold it includes typecheck, lint, format check, flow validation, root Vitest, architecture check and production build; package-specific MCP test/build steps join when the real MCP implementation files exist. No task creates a fake-success MCP/DB artifact to make a future gate executable early.

Dossier readiness is not evidence that repository implementation gates are green. INTEGRATION-00 runs/adopts the actual checkout gate before MERGE-01.

## Architecture gate

`pnpm run check:architecture` uses the frozen `architecture-baseline.json`, byte/semantic-equivalent to the audited repository baseline. It enforces current line ceilings/baseline non-growth, forbidden dependency directions, package pins, secret scans and clone-free MCP constraints. No task raises limits, restores obsolete baseline entries, or forgives new growth.

## Task-local gate sequencing

### DB live gate

`check:db` is deliberately unavailable until DB-04 creates `neon/tests/run.ts`.

- DB-01, DB-02 and DB-03 author their specified live suites, run credential-free/common/static/focused checks, and record `check:db deferred to DB-04 by specification`.
- DB-04 provisions the disposable branch and runs **all** DB-01..03 live suites. It is the first task allowed to declare Gate B.
- DB-04 and later tasks that explicitly name `check:db` treat missing credentials/provisioning as failure, never skip.
- Creating a temporary/fake harness before DB-04 is a specification violation.

### MCP package gate

`test:mcp`/`build:mcp` become meaningful when MCP-01 lands. `check:mcp-package` becomes meaningful only in MCP-04. Earlier tasks do not stub them successful.

## Required test levels

### Shared/core

- literal V2 operation add/update/unset allowlists and limits;
- specialized image operations/protected material slots plus read-only generic handling for unsupported flow visuals;
- parse/apply/encode roundtrip and deterministic conformance fixtures;
- semantic compare/reconcile/conflict fingerprints;
- digest/canonical-text behavior;
- complete semantic-validation parity with existing app behavior.

### Database

- admin/non-admin/anonymous authorization and exact EXECUTE/table grants;
- valid/invalid/expired/revoked capabilities with indistinguishable invalid-secret response;
- singleton draft initialization and draft-head payload omission;
- same-generation CAS one-winner; stale accepted-no-op still conflicts; accepted current no-op does not advance generation;
- atomic operation/image batch rollback and structural bounds;
- durable export owner isolation, 14-day expiry, concurrent five-row pruning;
- guarded preparation/publication, lost-response replay and actor attribution;
- literal cutover policy removal/direct-write denial while public reads survive;
- operator emergency disable artifact.

Live evidence is real HTTP Auth/Data API behavior through DB-04's disposable branch, not owner-role SQL-only mocks.

### Dashboard

- canonical draft initialization/resume across session;
- 750 ms debounce, 30 s poll, one in-flight save, typed-during-save preservation;
- local cache is recovery-only and cannot become canonical truth;
- ambiguous write recovery and one bounded stale merge/CAS retry;
- conflict dialog for overlap/delete/order conflicts;
- exact-string feature flag parsing (`value === "true"` only);
- `v2Enabled=false` legacy-only before cutover, `true` V2-only, never both;
- read-only flag blocks browser mutations/publication/connection-create while preserving reads/recovery/export;
- V2 publication validation, generation/revision/digest pinning and post-publish refresh;
- no V2 error path falls back to `legacyPublication.ts`.

### File workflow

- full/scoped export and owner-only cross-session durable base;
- strict `operations.json` return contract;
- ZIP path/count/size/ratio/CRC/encryption/ZIP64/symlink/truncation bounds;
- image archive/reference rules;
- stale reconciliation and atomic rejection/no partial mutation;
- file-first UI ordering and explicit preview/apply.

### MCP

- standalone stdio startup from built package;
- exact version/protocol modern + `2025-06-18` compatibility;
- strict tool schemas/descriptions/annotations and publication-intent instructions;
- anonymous JWT acquisition from supplied Auth URL;
- snapshot cache/pagination/output limits;
- one bounded stale retry/rebase-required behavior, no blind retries;
- guarded prepare/publish and replay;
- clone-free packed clean install outside repo.

### Security

- no raw capability/publish token logging or persistence beyond explicitly returned one-time secret state;
- downloaded config treated as secret and cleared from UI state;
- no broad protected-table grants;
- revocation effective on next call;
- capability cannot manage other connections/exports;
- MCP image tooling cannot read local paths or arbitrary-fetch URLs;
- no VITE variable contains management/database secrets;
- legacy direct publication does not exist after cutover cleanup.

## Gates

- **A — shared contracts:** MERGE-03 + architecture green.
- **B — database:** DB-04 executes accumulated real Data API/security/CAS suites with no skips.
- **C — dashboard cutover:** INTEGRATION-03 two-client canonical-draft/publication behavior green.
- **D — file flow:** archive/import/image/stale/cross-session proof green.
- **E-local — MCP package:** MCP-04 `check:mcp-package` clone-free packed install/protocol smoke green.
- **E-live — installed MCP capability:** INTEGRATION-03 runs packed installed artifact against DB-04 disposable Neon for real capability edit + guarded publish.
- **F — legacy removal:** LEGACY-02 search/config/runtime cleanup + final full gate green.

## Final acceptance

INTEGRATION-04 is verification-only. Run, in order:

```bash
pnpm run check
pnpm run check:db
pnpm run check:mcp-package
pnpm run test:unit -- src/app/content src/features
pnpm run validate:flows
git diff --check
git status --short
```

All environment-dependent commands must actually run and pass for the release candidate. If one fails, return the defect to its owning task/change control; do not patch unrelated source under INTEGRATION-04. Production deployment/npm publication still require owner authorization.
