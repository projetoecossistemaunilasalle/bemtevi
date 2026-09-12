# Agent Execution Rules

## Purpose

Tell coding agents exactly how to implement V2 without reinterpretation or accidental parallel conflicts.

## Required reading

Before starting a V2 task, an implementation agent MUST verify that `README.md` says `Specification status: IMPLEMENTATION_READY`. If it does not, implementation is blocked and Stage 0 must run first.

Then the implementation agent MUST read:

1. `README.md` in this directory.
2. `00-specification-hardening.md` to understand the frozen-contract boundary.
3. The concern-specific document for its assigned workstream.
4. The exact task file under `tasks/` assigned by Stage 0.
5. `08-parallel-workstreams.md`.
6. `09-testing-and-gates.md`.
7. `10-code-organization-constraints.md`.
8. `13-dossier-change-control.md`.
9. Root `AGENTS.md` until it is replaced by the V2 routing update.

## Classify the task first

### Engineering task

Examples:

- React code.
- TypeScript domain logic.
- migrations/RLS/functions.
- MCP package code.
- tests/tooling/docs.

Use GitHub/repository workflow.

### Editorial task

Examples:

- change material title/text.
- add/update/remove educational content.
- edit contact/location content.
- add an image to a material.

Use editorial draft tools/data flow. Do not edit repo content files.

## Workstream ownership

An agent MUST declare/know its workstream before editing.

It MUST limit changes to the assigned task's owned paths. Shared hot files (`package.json`, `DashboardRoute.tsx`, handwritten DB types, root config) are changed only by the owner/task sequence in 08 and tasks/README.md. Private helper splits in owned new subtrees are the only path-level implementation freedom.

## Parallel work rules

- Prefer additive files during parallel work.
- Do not delete/rename files another active workstream may still depend on.
- Do not independently change a shared interface after Checkpoint A without coordinating every consumer.
- Do not edit the same hot file concurrently in separate worktrees/branches.
- Commit logically complete slices so integration can cherry-pick/rebase safely.

## No architecture invention

If this dossier specifies a decision, agents MUST implement it rather than substitute an alternative because it is easier locally.

Specifically, do not reintroduce:

- repo clone requirements for content editing;
- filesystem canonical drafts;
- localhost dashboard sync;
- broad Neon credentials for editorial agents;
- arbitrary/direct publication that bypasses the guarded two-phase draft publication protocol;
- AI-specific last-write-wins or separate merge semantics;
- a general backend service.

Do not replace the accepted delegated-authority trust model with a second complete semantic validator in SQL. Postgres owns structural/security/concurrency/transaction invariants; `packages/content-core` owns complete semantic validation. Do not move ChatGPT export bases back to IndexedDB-only storage or remove their Neon owner/expiry/retention rules.

The standalone package and generated configurations MUST preserve the exact V2 pins: `@bemtevi/content-mcp@1.0.0` and `@modelcontextprotocol/server@2.0.0`. Version ranges, `latest`, and unversioned `npx` configuration are specification violations.

If an implementation detail is genuinely impossible, stop that slice and report the exact violated assumption with evidence instead of silently changing architecture.

## Specification changes during implementation

Implementation agents execute the frozen specification; they do not casually redesign it.

If code cannot satisfy the dossier, or the dossier is contradictory/incomplete, the agent MUST NOT silently choose a design or edit normative documentation to match its implementation. It must report the conflict and route the change through `13-dossier-change-control.md`. A strong reasoning model performs the impact analysis and updates all affected dossier files before the specification returns to `IMPLEMENTATION_READY`.

Pure spelling/format/link corrections that cannot change behavior are non-normative and may be fixed directly, but they must not alter requirements or acceptance meaning.

## Test-first requirements for risky boundaries

Before or alongside implementation, add focused tests for:

- concurrency CAS;
- semantic conflict behavior;
- capability authorization;
- anonymous RLS/function grants;
- image validation limits;
- migration of browser draft behavior;
- MCP publication boundary: `publish_draft` requires a pinned preparation and must never accept arbitrary content;
- publication intent guidance: edit/save/review requests do not imply publish intent.

## File constraint behavior

If a file approaches its soft target, split it before adding the next responsibility.

If a new file exceeds the hard limit, the task is not complete.

If an existing oversized file must be touched, do not increase its baseline size unless the architecture document is explicitly amended first.

## Verification cadence

During implementation:

- run focused tests for the changed module frequently;
- run typecheck/lint for meaningful integration points;
- run the complete repository gate before finalizing/merging.

## Final handoff from a workstream

Each agent should report:

- files changed;
- public interfaces added/changed;
- tests added and commands run;
- known integration dependencies;
- whether it touched any shared/hot file;
- any migration order requirement;
- confirmation that it did not widen editorial permissions.
