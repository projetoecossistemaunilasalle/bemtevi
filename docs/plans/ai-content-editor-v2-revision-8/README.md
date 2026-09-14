# BemTeVi AI Content Editor V2 — Implementation Source of Truth

**Status:** Decision-complete implementation specification; Stage 0 + revision-8 executor-determinism hardening complete  
**Specification status:** `IMPLEMENTATION_READY`  
**Specification revision:** `8`  
**Audited implementation base:** `e030264786ae7010aac7832203244882d12f9265` (`main`, audited 2026-09-12)  
**Language:** English for engineering documentation; user-facing UI remains PT-BR  
**Scope:** Admin editorial drafts, concurrent editing, AI-assisted content editing, MCP integration, images, migration from the current local-agent architecture, testing, and implementation constraints.

## Authority

This directory is the source of truth for the V2 implementation. If an older AI/content document conflicts with this directory, **this directory wins**.

Implementation agents MUST read this file and the concern-specific file relevant to their work before editing code. No V2 implementation may begin while `Specification status` is `HARDENING_REQUIRED`.

Normative changes after Stage 0 are governed by [`13-dossier-change-control.md`](13-dossier-change-control.md). Revision 6 realigned the dossier to the post-remediation repository shape, Revision 7 closed four service/gate ownership gaps, and Revision 8 keeps the same audited base while removing remaining executor ambiguity. Revision 8 fixes the impossible DB-02/DB-03 live-gate ordering, restores exact integration/legacy allowlists, freezes operation/update/unset field lists and existing cutover policy names, defines literal Vite-flag parsing, freezes the DB-04 CLI command contract, and makes integration/final-gate ownership verification-only where the audited scaffold already suffices. The V2 source-of-truth, security, concurrency, persistence and guarded-publication behavior is unchanged.

## Mandatory repository-base preflight

Before **every** task:

1. Run `git status --short` and preserve unrelated work.
2. Run `git rev-parse HEAD`.
3. If HEAD equals `e030264786ae7010aac7832203244882d12f9265`, continue.
4. If HEAD differs, run `git diff --name-only e030264786ae7010aac7832203244882d12f9265...HEAD`.
5. If any changed path matches the drift-sensitive set below, STOP the affected V2 task and route the drift through `13-dossier-change-control.md`. A weak implementation model MUST NOT decide that such drift is harmless.
6. If all changed paths are outside the drift-sensitive set, record the new HEAD in the task handoff and continue without changing frozen contracts.

Drift-sensitive paths:

```text
docs/plans/ai-content-editor-v2/**
.github/workflows/ci.yml
AGENTS.md
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.json
vite.config.ts
vitest.config.ts
eslint.config.js
scripts/run-project-command.mjs
scripts/check-architecture.mjs
scripts/architecture-baseline.json
scripts/content-agent/**
scripts/agent-bridge/**
packages/content-core/**
packages/content-mcp/**
neon/**
src/app/content/**
src/app/neon/**
src/domain/**
src/dev-dashboard/**
src/content/resources/featuredImageIds.ts
src/content/resources/groups.ts
```

This rule is intentionally conservative. Unrelated content/data/UI work outside these paths may continue; V2-sensitive drift requires a strong-model re-alignment pass.

## Existing-scaffold rule

Revision 8 retains Revision 7's audited `main` base, where some work originally assigned to INTEGRATION-00 has already landed during an architecture remediation:

- `pnpm-workspace.yaml` exists.
- `packages/content-core/package.json`, `packages/content-core/tsconfig.json`, and an empty package entry point exist.
- `packages/content-mcp/package.json` and `tsconfig.json` exist, but the MCP implementation does not.
- root V2 runner commands and development dependency pins exist.
- `scripts/check-architecture.mjs`, its tests, and `scripts/architecture-baseline.json` exist.
- `neon/tests/vitest.config.ts` exists.
- the protected `v2-database` CI job definition exists.
- large dashboard/content modules and tests were decomposed after revision 5.

A task that owns an already-present file MUST **adopt and verify it first**. Do not recreate, revert, or replace conforming scaffolding merely because an older task verb says “add” or “create”. Patch only the exact gaps required by the task acceptance criteria.

## Start implementation

Follow [tasks/README.md](tasks/README.md) in its default serial order, beginning with **INTEGRATION-00**. INTEGRATION-00 is now a verification/adoption gate; it may be a no-op code task if all current scaffolding passes its focused checks.

Read [14-contracts.md](14-contracts.md) for exact domain/wire contracts, [15-database-contract.md](15-database-contract.md) for exact SQL/RPCs, and [16-dashboard-state-machine.md](16-dashboard-state-machine.md) for exact save/recovery behavior. Those product contracts were revalidated against the same audited base. Revision 8 does not redesign them: 14 now writes previously implicit operation field/unset allowlists literally, 15 writes the already-existing publication policy names literally, and 16 freezes feature-flag parsing/composition behavior so an executor does not infer it.

## Revision 8 executor-determinism rules

These rules are normative and are intended to make the serial task set safe for a literal implementation model:

1. A task `Owns` list is an allowlist. Phrases such as “as applicable”, “if required”, “files explicitly needed”, or “tests discovered” do not grant ownership unless the task names a path/pattern explicitly.
2. DB-01, DB-02 and DB-03 author their live tests but **do not run `pnpm run check:db`** because DB-04 owns the harness that makes that command executable. DB-04 runs the accumulated DB-01..03 live suites and is the first task allowed to claim Gate B.
3. Current audited CI already invokes `pnpm run check:db` in the protected `v2-database` job. INTEGRATION-03 does not edit CI merely to discover its new live test files; DB-04's runner/Vitest configuration must discover them. A claimed need to change CI is a drift/change-control event.
4. `VITE_EDITOR_V2_ENABLED` and `VITE_EDITOR_READ_ONLY` are enabled only by the exact string `"true"`. Missing, `"false"`, `"TRUE"`, `"1"`, or any non-string value is false.
5. Temporary coexistence artifacts are created and deleted only by the tasks that name them. In particular INTEGRATION-02 creates `src/dev-dashboard/publishing/legacyPublication.ts`; LEGACY-01 deletes it after replacement proof.
6. INTEGRATION-04 is a verification/signoff task, not a late architecture-fix task. A final-gate failure returns to the task that owns the failing file or enters change control; INTEGRATION-04 does not opportunistically redesign source/configuration.

## Non-negotiable decisions

1. **GitHub is the source of truth for software.**
2. **Neon is the source of truth for editorial content.**
3. **The application remains frontend + Neon.** No BemTeVi application backend is introduced.
4. **The browser is not the canonical draft store.** IndexedDB is local cache/recovery only.
5. **Content editing never requires cloning the BemTeVi repository.**
6. **Coding agents edit code; content editors edit content.**
7. **The AI content MCP is a standalone local client, not a repository tool.**
8. **The AI content MCP does not receive a Neon API key, database connection string, or administrator session.**
9. **The AI content MCP can publish only through the guarded two-phase protocol and only on explicit user publication intent.**
10. **All editors use the same generation CAS + semantic reconciliation protocol.**
11. **No last-write-wins for draft mutations.** Accepted no-op does not advance generation; stale no-op still fails CAS.
12. **No new god files.** File-size and responsibility constraints are gates.
13. **The easiest AI workflow is shown first.** File export/import for ChatGPT is the default path.
14. **V2 supports images in the agent workflow without new object storage/backend infrastructure.**
15. **An agent connection is delegated authority from exactly one admin principal.**
16. **ChatGPT export bases are durable in Neon for cross-device reconciliation.**
17. **Capability connections expire exactly one calendar year after creation and are replaced rather than renewed.**
18. **Capability holders are trusted delegated editors, not sandboxed adversaries.** Postgres enforces auth/structure/CAS/transactions; `content-core` owns complete semantic validation.
19. **The standalone MCP release is version-pinned:** `@bemtevi/content-mcp@1.0.0`, `@modelcontextprotocol/server@2.0.0`.
20. **Implementation is anchored to an audited repository shape.** Drift in V2-sensitive paths is a specification event, not implementation freedom.

## Documents

- [`00-specification-hardening.md`](00-specification-hardening.md) — strong-model hardening procedure plus repository-drift gate.
- [`01-system-architecture.md`](01-system-architecture.md) — system boundaries and source-of-truth rules.
- [`02-draft-data-model.md`](02-draft-data-model.md) — Neon draft and capability-connection data model.
- [`03-concurrency-and-merge.md`](03-concurrency-and-merge.md) — universal optimistic concurrency and semantic merge.
- [`04-agent-auth-and-mcp.md`](04-agent-auth-and-mcp.md) — standalone MCP, capability credentials, RPC surface, and tool contract.
- [`05-assets-and-images.md`](05-assets-and-images.md) — image editing/generation constraints and V2 storage decision.
- [`06-dashboard-ux.md`](06-dashboard-ux.md) — admin UX, save state, AI paths, conflicts, and connected assistants.
- [`07-migration-and-deprecation.md`](07-migration-and-deprecation.md) — migration sequence and removal of legacy local/repo architecture.
- [`08-parallel-workstreams.md`](08-parallel-workstreams.md) — task graph and exclusive ownership.
- [`09-testing-and-gates.md`](09-testing-and-gates.md) — mandatory tests and quality/security gates.
- [`10-code-organization-constraints.md`](10-code-organization-constraints.md) — current module boundaries, file budgets, and architecture baseline.
- [`11-agent-execution-rules.md`](11-agent-execution-rules.md) — mechanical rules for implementation agents.
- [`12-change-inventory.md`](12-change-inventory.md) — exact current create/modify/remove inventory.
- [`13-dossier-change-control.md`](13-dossier-change-control.md) — strong-model process for normative changes and repository drift.
- [`14-contracts.md`](14-contracts.md) — exact shared types, operations, images, digests and file contract.
- [`15-database-contract.md`](15-database-contract.md) — exact schema, RPC catalog, grants and transaction algorithms.
- [`16-dashboard-state-machine.md`](16-dashboard-state-machine.md) — exact dashboard services, transitions and recovery.
- [`17-readiness-audit.md`](17-readiness-audit.md) — revision-8 readiness audit and repository evidence.
- [`18-revision-6-realignment.md`](18-revision-6-realignment.md) — historical record of the revision-6 repository realignment.
- [`19-revision-7-execution-hardening.md`](19-revision-7-execution-hardening.md) — historical record of the revision-7 service/gate hardening.
- [`20-revision-8-executor-determinism.md`](20-revision-8-executor-determinism.md) — current normative delta removing the remaining executor ambiguity.
- [`tasks/README.md`](tasks/README.md) — executable task index and default serial order.

## Current-state facts that motivate V2

The repository still contains the legacy local-agent/draft-sync product path, but architecture-remediation commits have already decomposed several oversized modules and installed V2-oriented workspace/gate scaffolding. This does **not** mean V2 domain, database, dashboard-canonical-draft, file workflow, or standalone MCP implementation is complete.

`packages/content-core/src/index.ts` is still only an empty package entry point at the audited base, and `packages/content-mcp` contains only manifest/TypeScript scaffolding. The canonical V2 runtime contracts remain implementation work.

The frontend already talks directly to Neon using Neon Auth + Neon Data API. Existing semantic reconciliation remains the basis for V2 and MUST be extracted/reused rather than replaced.

## Definition of done

V2 is done only when all original revision-5 functional conditions remain true, plus:

- every task handoff records the repository HEAD it executed against;
- no task recreated or reverted conforming post-revision-5 architecture scaffolding;
- the architecture baseline used by the gate equals this revision's audited baseline unless a later change-control revision explicitly replaces it;
- current split source/test ownership is respected;
- all gates A–F pass on the implementation HEAD, not merely on this specification snapshot.
