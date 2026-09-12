# Dossier Change Control

## Purpose

Keep this dossier trustworthy after Stage 0. Once implementation agents rely on the specification, direct documentation changes can be as dangerous as code changes because they may silently invalidate contracts, parallel ownership, tests, or already-completed work.

## Core rule

Implementation code MUST follow the dossier. The dossier MUST NOT be casually rewritten to justify implementation code after the fact.

A normative dossier change requires a specification-level reasoning pass before it becomes authoritative.

## Change classes

### Non-normative change

A change is non-normative only when it cannot alter implementation behavior or agent interpretation, for example:

- spelling/grammar correction;
- broken internal link correction;
- formatting cleanup;
- clarification that does not change a requirement, contract, task dependency, ownership boundary, test, gate, or acceptance criterion.

These changes do not require the full hardening cycle, but they MUST NOT introduce contradictory wording.

### Normative change

Treat a change as normative if it modifies or can reasonably change interpretation of any of the following:

- a `MUST`, `MUST NOT`, `SHALL`, gate, or acceptance criterion;
- architecture/source-of-truth behavior;
- database schema, RPC, RLS, grant, or transaction behavior;
- TypeScript/shared contract;
- MCP tool, prompt, input/output, error, or publication behavior;
- concurrency/reconciliation behavior;
- image behavior;
- dashboard state transition;
- security/credential behavior;
- file/module path or ownership;
- file-size constraints;
- migration/deprecation order;
- task dependency or parallel-safety declaration;
- test expectation;
- definition of done.

When uncertain, classify the change as normative.

## Mandatory process for a normative change

### C1 — Block affected implementation

Set the README field:

```text
Specification status: HARDENING_REQUIRED
```

Affected implementation tasks MUST pause at their current safe boundary. Unaffected work may continue only if the strong-model impact analysis explicitly confirms that the change cannot affect their contracts or files.

### C2 — Strong-model impact analysis

A strong reasoning model MUST inspect:

- the requested change;
- current repository state relevant to the change;
- every dossier document that references the affected concept;
- executable task files affected directly or transitively;
- tests/gates that encode the previous behavior;
- parallel work that may already have consumed the previous contract.

The model MUST identify downstream impact before editing the dossier.

### C3 — Update the specification atomically

The specification owner updates all affected documents as one logical change.

Do not update only the file where the inconsistency was noticed. Examples:

- changing MCP publication behavior requires checking architecture, MCP contract, tests, tasks, execution rules, and definition of done;
- changing draft identity requires checking data model, repository APIs, concurrency, UI, RPCs, tests, migration, and tasks;
- changing a shared module path requires checking task ownership, dependency rules, imports, change inventory, and architecture gates.

### C4 — Re-run the Stage 0 readiness checks for affected concerns

At minimum verify:

- no contradiction remains;
- public contracts are complete;
- tests assert the new behavior;
- task dependencies still make sense;
- hot-file ownership is still exclusive;
- work already completed under the previous contract is identified for revalidation or rework;
- no weak implementation agent must infer a new design decision.

For broad architectural changes, re-run the entire Stage 0 procedure.

### C5 — Increment specification revision

Update the README `Specification revision` field for every normative change.

Use a monotonic dossier revision independent of application versioning, for example:

```text
Specification revision: 3
```

The change-control handoff MUST summarize what changed and which tasks/implementations require revalidation.

### C6 — Restore readiness

Only after the impact review and consistency gate pass may the specification owner set:

```text
Specification status: IMPLEMENTATION_READY
```

## Rules for implementation agents

Implementation agents MUST NOT make normative dossier changes as a convenience while implementing a task.

If an implementation agent discovers that the specification is incomplete, contradictory, or technically impossible:

1. do not silently choose a new architecture;
2. do not modify code and then update docs to match it;
3. report the exact conflict with evidence;
4. request/trigger the specification change-control path;
5. resume the affected task only after the specification returns to `IMPLEMENTATION_READY`.

A strong implementation model may also act as specification owner, but it must explicitly switch roles and follow this change-control process before modifying normative dossier content.

## Direct user-requested dossier changes

A user request such as "change the MCP publication behavior" or "use a different draft model" is authoritative product input, but it still requires the same impact process.

The strong-model pass is not allowed to debate or override an explicit user decision. Its job is to propagate that decision consistently through all affected contracts, tasks, tests, gates, and migration steps.

## Change-control handoff

After a normative change, report:

- previous and new specification revision;
- changed decision;
- files updated;
- tasks affected;
- completed work requiring revalidation;
- tests/gates changed;
- confirmation that cross-document consistency was checked;
- final specification status.
