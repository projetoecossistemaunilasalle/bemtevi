# Dossier Change Control

## Core rule

Implementation code follows the dossier. The dossier is not rewritten after the fact to justify implementation choices.

A normative product/specification change or a V2-sensitive repository-shape change requires a strong-model impact pass.

## Change classes

Non-normative: spelling, formatting, broken link, or clarification that cannot change implementation interpretation.

Normative includes changes to architecture, persistence, database/RPC/RLS/grants, public TypeScript contracts, MCP tools/prompts/errors/publication, concurrency, images, state transitions, security, file/module ownership, file budgets/baselines, migration order, task dependencies, tests/gates or definition of done.

## Repository drift is also controlled

Revision 8 audits `e030264786ae7010aac7832203244882d12f9265`. Revision 8 itself is a C1–C6 normative executor-determinism pass over Revision 7; the audited implementation base did not move because repository `main` remained at the same SHA during the pass.

A later commit touching any drift-sensitive path listed in README is treated as a **potential normative repository-alignment event**, even when the code change claims to be “refactor only”. A weak model must not decide on its own that changed ownership/baselines/tests are compatible with the dossier.

### Drift procedure

1. Compare changed paths from `e030264786ae7010aac7832203244882d12f9265` (or the most recent later audited SHA).
2. If no V2-sensitive path changed, implementation may continue and handoff records the newer HEAD.
3. If a V2-sensitive path changed, affected work pauses.
4. Strong model checks whether frozen behavior/contracts remain implementable and updates current-state evidence/ownership/tasks as needed.
5. Increment dossier revision only when normative dossier text changes.
6. Record the new audited implementation base.
7. Restore `IMPLEMENTATION_READY` only after consistency checks.

## Mandatory process for normative change

### C1 — Block affected implementation

Set README `Specification status: HARDENING_REQUIRED`.

### C2 — Impact analysis

Inspect requested change/drift, current repository, every affected dossier reference, tasks/tests/gates and already-completed work.

### C3 — Update atomically

Update every affected document, not just the file where inconsistency was noticed.

### C4 — Re-run affected Stage-0 checks

Verify contracts, task dependencies, exclusive ownership, tests, current paths, and completed work requiring revalidation.

### C5 — Increment revision

Update README revision and audited implementation-base SHA when repository shape is re-certified.

### C6 — Restore readiness

Only a strong-model specification owner restores `IMPLEMENTATION_READY`.

## Implementation-agent rule

Implementation agents do not casually edit normative dossier files. If impossible/incomplete/contradictory, report exact evidence and stop the affected slice.

## Change-control handoff

Report old/new revision, audited base, changed decision or repository assumption, files updated, tasks affected, completed work needing revalidation, tests/gates changed and final status.
