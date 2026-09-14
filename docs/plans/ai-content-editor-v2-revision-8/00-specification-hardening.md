# Stage 0 — Specification Hardening

**Completed for revision 8 on 2026-09-12 against `e030264786ae7010aac7832203244882d12f9265`.** Revision 6 performed repository realignment, Revision 7 clarified service/gate ownership, and Revision 8 is an executor-determinism change-control pass on the same audited base. Product source-of-truth, database schema/RPC behavior, concurrency, publication and MCP behavior remain unchanged; previously implicit field/policy/flag/ownership details are written literally and an impossible task-gate ordering is corrected.

## Purpose

This stage converts architecture direction into a decision-complete implementation specification that a strong instruction-following but weak architectural model can execute mechanically.

Implementation agents MUST NOT repeat Stage 0. They begin at [tasks/README.md](tasks/README.md) only while `README.md` is `IMPLEMENTATION_READY`.

## Authority and scope

The Stage 0 / change-control owner may modify any document inside `docs/plans/ai-content-editor-v2/`. It does not change production code.

Existing code is evidence about current behavior, not authority over V2 product decisions. The non-negotiables in `README.md` and exact contracts in 14–16 remain authoritative.

## Required procedure

### S0.1 — Repository reality audit

Verify all repository-state claims that tasks depend on: Neon client behavior, migrations, draft persistence, reconciliation, AI operations, MCP/bridge paths, images, root scripts/config, architecture baselines, test locations, package scaffolding, current file decomposition, and relevant official platform contracts.

Record the audited implementation-base SHA.

### S0.2 — Cross-document contradiction sweep

Resolve contradictions across architecture, data model, concurrency, MCP, UX, migration, task graph, tests, file ownership, and cleanup timing. In particular check publication authority, draft identity, merge ownership, image semantics, direct table/RPC access, IndexedDB authority, package release model, and legacy removal.

### S0.3 — Close implementation-affecting decisions

No task may require a weak implementation agent to choose storage shape, public API, SQL schema, auth semantics, retry behavior, publication behavior, file ownership, or test acceptance.

### S0.4 — Freeze database contracts

Define migration order, tables, constraints, indexes, RLS, grants/revokes, exact public/private RPCs, argument/result/error shapes, capability verification, CAS, publication preparation/publication transactions, actor metadata, and trust boundaries.

Revision 8 keeps the schema/RPC/publication behavior in [15-database-contract.md](15-database-contract.md) unchanged and freezes the two already-existing `published_content` write-policy names in the cutover artifact so no executor discovers them ad hoc.

### S0.5 — Freeze TypeScript/domain contracts

Define exact canonical types, operations, errors, image contract, reconciliation API, publication types, export format, digest/equality rules, and shared-package boundary.

Revision 8 keeps V2 operation semantics in [14-contracts.md](14-contracts.md) unchanged and replaces the implicit “current ITEM_KEYS/optional domain fields” reference with literal per-scope add/update/unset allowlists and literal protected-image rules.

### S0.6 — Freeze MCP contract

Define package/version/entry point, SDK pin/protocol compatibility, configuration variables, all tools and schemas, limits, error mapping, caches/retries, publication behavior, and shipped instructions.

Revision 8 reaffirms [04-agent-auth-and-mcp.md](04-agent-auth-and-mcp.md) unchanged.

### S0.7 — Freeze dashboard state machines

Define initial load, cache, edit/save timers, one-in-flight behavior, CAS/merge retry, conflict resolution, offline/ambiguous outcomes, polling, publication, connection management and file workflow.

Revision 8 keeps the save/recovery/publication state machine in [16-dashboard-state-machine.md](16-dashboard-state-machine.md) unchanged while freezing literal Vite-flag parsing and the exact integration-to-legacy composition handoff.

### S0.8 — Freeze file/module layout against the current tree

Exact owned paths must correspond to the audited repository. When an architecture refactor has split a formerly-owned file, every new relevant file must be assigned to one owner or explicitly declared preserved.

A task may not recreate a file that the audited base already removed.

### S0.9 — Produce executable task specifications

Every task has a stable ID, dependencies, owned paths, forbidden paths, exact requirements, tests, commands, acceptance, parallel-safety, and downstream tasks.

Tasks additionally classify pre-existing deliverables as:

- **adopt/verify** — file/scaffold already exists and must be inspected before editing;
- **patch if nonconforming** — edit only if the frozen acceptance requirement is not met;
- **implement** — deliverable is absent and is created by this task;
- **remove later** — legacy artifact remains until its replacement gate.

### S0.10 — Rebuild task graph and ownership

No two concurrent tasks own the same hot file. Current dashboard decomposition includes `DashboardRoute.tsx` **and** `DashboardTabContent.tsx`; current split test/source files must be represented explicitly.

### S0.11 — Freeze gates and evidence

Tests must cover authorization, capability isolation, CAS, admin/admin and admin/agent merge, stale publication, preparation invalidation, intent guidance, cache recovery, image bounds, clone-free MCP execution, architecture limits and legacy cleanup.

### S0.12 — Final self-review

Search for:

- stale file paths;
- removed tests still listed as owned;
- existing files described as absent;
- unowned newly-extracted modules;
- conflicting baselines;
- task prerequisites that current code already partially satisfies;
- a weak model needing to infer whether to preserve or overwrite current scaffolding;
- a task requiring a command whose prerequisite is owned only by a later task;
- conditional/open-ended ownership wording that is broader than the central ownership matrix.

### S0.13 — Repository Drift Gate

This is mandatory after Stage 0 and before each implementation task.

The audited base is `e030264786ae7010aac7832203244882d12f9265`. If HEAD differs, compare filenames from the audited base. Any change under the drift-sensitive set in `README.md` blocks affected V2 work until a strong-model change-control pass re-aligns the dossier.

Implementation agents do not classify V2-sensitive drift as “probably harmless”.

## Decision policy

When multiple internal implementations satisfy frozen public contracts, choose the simplest that preserves Neon editorial truth, frontend + Neon topology, generation CAS + semantic reconciliation, clone-free editing, guarded publication, minimal infrastructure, and documented file limits.

Escalate only when a choice changes product behavior, security posture, data ownership, or a non-negotiable requirement.

## Specification Readiness Gate

Implementation is unblocked only when:

- README says `IMPLEMENTATION_READY`;
- an audited implementation-base SHA is recorded;
- repository-state claims match that base;
- database/shared/MCP/dashboard contracts are exact;
- task ownership matches the current tree;
- existing scaffolding is classified adopt/verify vs implement;
- tests/gates refer to current files;
- architecture baseline matches the audited gate baseline;
- no unresolved contract TODO/TBD remains;
- change control and repository-drift rules are active.

Revision 8 passes Gate S for `e030264786ae7010aac7832203244882d12f9265`. It does **not** claim Gates A–F or live deployment evidence already pass.

## Stage 0 handoff

The strong-model handoff reports decisions closed, documents changed, contradictions resolved, repository drift reconciled, unchanged contracts, and confirmation that no production code was modified.
