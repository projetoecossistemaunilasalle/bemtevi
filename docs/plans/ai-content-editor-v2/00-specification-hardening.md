# Stage 0 — Specification Hardening

**Completed for revision 5 on 2026-09-10.** The procedure below remains the change-control checklist, not a request for implementation agents to repeat Stage 0. Evidence and closed decisions are recorded in [17-readiness-audit.md](17-readiness-audit.md); begin implementation at [tasks/README.md](tasks/README.md).

## Purpose

This stage runs **before any V2 implementation work**. Its job is to convert the approved architecture direction into a decision-complete implementation specification that can be executed safely by models that are strong at instruction following but are not expected to make architectural decisions.

Stage 0 MUST be performed by a strong reasoning model acting as the specification owner. Implementation agents MUST NOT begin until the Specification Readiness Gate at the end of this document passes.

## Authority and scope

The Stage 0 model MAY modify every document inside `docs/plans/ai-content-editor-v2/` because specification hardening is its task. It MUST NOT change production code as part of this stage.

The model MUST inspect the current repository before freezing contracts. Existing code is evidence about current behavior, not authority over V2 decisions. The non-negotiable decisions in `README.md` remain authoritative unless the user explicitly changes them.

## Primary objective

At the end of Stage 0, an implementation agent should never need to answer questions such as:

- Which table shape should I choose?
- Which RPC name or error shape should I invent?
- Should this use one row or multiple rows?
- Where should this module live?
- What should this tool return?
- How should stale-generation behavior work?
- Which component owns this shared state?
- Is publication available to the MCP?
- Which workstream owns this hot file?
- Which tests prove that this task is complete?

Those decisions MUST already be frozen in this dossier.

## Required Stage 0 procedure

### S0.1 — Repository reality audit

Inspect the current repository and verify every current-state claim used by the dossier, including at minimum:

- existing Neon Auth/Data API client behavior;
- `published_content` and publication history migrations;
- current dashboard draft persistence;
- current semantic diff/reconciliation implementation;
- current AI operation protocol;
- current MCP tools and publication protocol;
- current image representation;
- current root scripts, MCP configs, and legacy bridge/sync paths;
- current oversized files that require architecture baselines;
- current published/fallback payload size and the network cost of draft autosave;
- current Neon Data API authorization/role/function-execution behavior from up-to-date official documentation;
- current MCP protocol/SDK behavior relevant to stdio servers, server instructions, and host compatibility.

Correct stale factual claims in the dossier before continuing.

### S0.2 — Cross-document contradiction sweep

Read every dossier file together, not independently. Resolve all contradictory requirements.

Search explicitly for contradictions involving:

- MCP publication;
- capability permissions;
- canonical draft ownership;
- number/identity of active drafts;
- merge responsibility;
- image storage and image mutation behavior;
- direct table access versus RPC access;
- IndexedDB authority;
- legacy removal timing;
- package location and package execution model;
- workstream dependencies;
- quality gates and file-size limits.

A requirement MUST appear consistently in architecture, data model, MCP, UX, tests, workstreams, execution rules, and change inventory wherever applicable.

### S0.3 — Close architectural implementation decisions

Replace implementation-affecting ambiguity with explicit decisions. Contract-affecting uses of terms such as `MAY`, `SHOULD`, `potential`, `expected near`, `if required`, `if necessary`, `chosen`, or `agreed` MUST either:

1. be replaced by a concrete decision; or
2. be explicitly labeled as non-contractual implementation freedom that cannot affect interoperability, security, persistence semantics, public behavior, workstream ownership, or tests.

Do not leave architectural choices to workstream agents.

### S0.4 — Freeze database contracts

The dossier MUST define exactly:

- migration order and exact migration responsibilities;
- exact table names and columns;
- primary/unique/foreign/check constraints;
- indexes;
- RLS policies;
- grants/revokes;
- exact RPC/function names;
- exact RPC arguments and return shapes;
- capability-token storage and verification rules;
- generation compare-and-swap semantics;
- publication preparation and publication semantics;
- transaction boundaries;
- stable database/domain error codes;
- actor/audit metadata that must be persisted;
- the exact persistence or cryptographic mechanism for publication preparations/tokens;
- which correctness invariants are enforced by Postgres versus trusted dashboard/MCP client validation, with no claim of server-side semantic validation unless it is actually implemented;
- the exact anonymous/authenticated Data API roles and `EXECUTE`/table grants required for capability-authenticated RPCs.

An implementation agent must not design SQL contracts from prose intent.

### S0.5 — Freeze TypeScript/domain contracts

Define exact canonical interfaces/types and exact owning module paths for at least:

- `ContentDraft`;
- draft mutation input/result;
- stale-generation result/error;
- editor/actor metadata;
- agent connection metadata;
- editorial operation envelope;
- image operation contract;
- reconciliation input/output/conflict types;
- publication preparation/result;
- MCP client errors;
- the exact shared-code packaging boundary so the standalone MCP can consume/bundle canonical operations, validation, and reconciliation logic without importing dashboard/UI internals at runtime.

Define which existing types are reused and which compatibility wrappers are temporary.

### S0.6 — Freeze MCP contract

Define exactly:

- package directory and package name used inside the repository;
- package distribution/release model and versioning strategy used by downloaded MCP configuration;
- executable entry point;
- MCP SDK and supported protocol-version strategy;
- configuration variables;
- every exposed tool name;
- exact tool descriptions for mechanics, bounds, and consequences;
- exact input and output schemas;
- size/page limits;
- stable error mapping;
- base snapshot/reconciliation behavior;
- image behavior;
- `prepare_publish` and `publish_draft` behavior;
- the exact mechanism used to deliver shipped agent instructions to supported hosts, verified against the selected MCP SDK/protocol;
- the shipped agent instruction text stating that publication occurs only on explicit user request;
- what the MCP is technically incapable of doing.

The MCP MUST support guarded publication. Editing does not imply publication intent.

### S0.7 — Freeze dashboard state machines

Define exact behavior for:

- initial draft load/creation;
- local edit state;
- debounce interval;
- mutation granularity and payload-transfer strategy, taking the real content payload size into account;
- save-in-flight behavior;
- generation updates;
- stale-generation handling;
- automatic merge;
- unresolved conflict handling;
- retry behavior;
- offline behavior;
- IndexedDB cache recovery;
- cross-tab/cross-admin refresh behavior;
- publication from a canonical draft;
- connection creation/revocation;
- ChatGPT file export/import.

User-visible copy may remain PT-BR implementation content, but state transitions and acceptance behavior must be frozen.

### S0.8 — Freeze file/module layout

Replace provisional paths with exact ownership paths wherever a task depends on them. Define:

- exact files to create;
- exact files to modify;
- exact files to delete;
- exact shared/hot-file owner;
- dependency direction;
- file-size limits and oversized-file baselines.

No implementation workstream may independently rename shared modules or move public contracts after this gate.

### S0.9 — Produce executable task specifications

Create an implementation task index and concern-specific task files. The expected structure is:

```text
docs/plans/ai-content-editor-v2/tasks/
  README.md
  DB.md
  MERGE.md
  DASHBOARD-DRAFTS.md
  AI-FILE-UX.md
  MCP.md
  INTEGRATION.md
  LEGACY-CLEANUP.md
```

Every task MUST have:

- stable task ID, such as `DB-01`, `MCP-04`, or `MERGE-02`;
- objective;
- prerequisites/dependencies;
- exact files owned by the task;
- files it is forbidden to modify unless explicitly coordinated;
- exact implementation requirements;
- public interfaces produced/consumed;
- tests to add/change;
- commands to run;
- acceptance criteria;
- parallel-safety declaration;
- next tasks unblocked by completion.

Tasks MUST be small enough that one agent can complete them without making cross-component design decisions.

### S0.10 — Rebuild the parallel execution graph

Update `08-parallel-workstreams.md` from the frozen task graph, not from broad conceptual workstreams alone.

For each task, state whether it:

- can run immediately after Stage 0;
- can run concurrently with another named task;
- depends on an interface artifact from another task;
- owns a hot/shared file;
- is an integration-only task;
- must run after replacement paths are proven.

Implementation agents MUST NOT negotiate new shared contracts during parallel execution.

### S0.11 — Freeze gates and evidence

For every task and stage, define the exact tests/evidence required before downstream work begins.

The dossier MUST include tests for at least:

- database authorization and capability isolation;
- compare-and-swap concurrency;
- admin-vs-admin merge;
- admin-vs-agent merge;
- stale generation and stale publication revision;
- publication preparation invalidation;
- explicit publication-intent guidance;
- local cache recovery;
- image bounds and image operation behavior;
- clone-free MCP execution;
- architecture/file-size enforcement;
- legacy removal without dangling routes/scripts/docs/config.

### S0.12 — Final self-review

Before marking the specification ready, perform a final cross-document review as if reviewing another architect's work.

The model MUST specifically look for:

- a statement that is true in one file and false in another;
- a task that needs an unstated contract;
- two workstreams that own the same file concurrently;
- tests that assert behavior different from architecture;
- an RPC/tool referenced but never specified;
- a removal scheduled before all consumers migrate;
- any place where a weak implementation model would have to choose between materially different designs;
- any security/correctness guarantee described as database-enforced that is actually enforced only by a trusted client;
- any standalone MCP dependency on repository-relative source files that would fail after package publication.

## Decision policy for the Stage 0 model

The Stage 0 model is expected to make engineering decisions. It SHOULD NOT defer ordinary architecture details back to the implementation agents.

When multiple designs satisfy the approved product constraints, choose the simplest design that:

1. preserves Neon as editorial source of truth;
2. preserves frontend + Neon with no new application backend;
3. preserves universal generation-based concurrency and semantic reconciliation;
4. preserves clone-free content editing;
5. preserves guarded MCP publication on explicit user intent;
6. minimizes new infrastructure and migration risk;
7. keeps modules inside the documented size/responsibility boundaries.

Escalate to the user only when the unresolved choice materially changes product behavior, security posture, data ownership, or an explicit non-negotiable requirement and cannot be resolved from existing decisions.

## Specification Readiness Gate

Implementation is BLOCKED until all of the following are true:

- `README.md` says `Specification status: IMPLEMENTATION_READY`.
- The repository reality audit is complete.
- All cross-document contradictions are resolved.
- Database contracts are exact.
- shared TypeScript contracts are exact.
- MCP tools and publication protocol are exact.
- dashboard state machines are exact.
- file/module ownership is exact.
- executable task files exist and contain acceptance criteria.
- parallel dependencies are expressed at task level.
- tests/gates match the frozen behavior.
- no unresolved `TBD`/`TODO`/placeholder contract remains.
- no implementation-affecting ambiguity is intentionally delegated to workstream agents.
- the specification change-control rules in `13-dossier-change-control.md` are active.

Only the Stage 0 specification owner (or a later strong-model change-control pass) may change the README status from `HARDENING_REQUIRED` to `IMPLEMENTATION_READY`.

## Stage 0 handoff

The final Stage 0 response MUST report:

- decisions closed;
- documents changed;
- task files created;
- contradictions resolved;
- any remaining explicitly non-contractual freedom;
- confirmation that no production code was changed;
- confirmation that the Specification Readiness Gate passed.
