# Agent Execution Rules

## Required preflight

Before every V2 task:

1. Verify README says `IMPLEMENTATION_READY`, revision 8.
2. Run `git status --short`; preserve unrelated changes.
3. Run the repository-base preflight against `e030264786ae7010aac7832203244882d12f9265`.
4. If V2-sensitive drift is detected, STOP and report it; do not edit production code for the affected task.
5. Read README, this file, the concern document, exact task file, 08, 09, 10, 13, and root `AGENTS.md`.

## Task classification

Engineering tasks change code/migrations/tests/tooling/docs in Git. Editorial tasks change content through editorial protocols, never by manually editing bundled production content.

## Adopt-before-edit rule

For every owned path:

- if it already exists at the audited base, inspect it before editing;
- if it already satisfies the task requirement, leave it unchanged;
- if it partially satisfies the task requirement, patch the smallest gap;
- if the task says a file is absent and it actually exists under the audited base, stop and report specification drift unless the current revision explicitly marks it adopt/verify;
- never restore a removed monolith or obsolete baseline allowance.

This rule is especially important for INTEGRATION-00.

## Workstream ownership

Owned paths are allowlists. Shared/hot files are edited only by their scheduled integration/legacy owner. Current hot dashboard composition includes both `DashboardRoute.tsx` and `DashboardTabContent.tsx`. A phrase such as “as applicable”, “if required”, “files needed”, or “discovered tests” is never permission to edit a path that is absent from the task allowlist.

A task does not fail merely because a later task owns the harness for an explicitly deferred live gate. DB-01..03 run their common/focused credential-free checks and author live suites; DB-04 is the first task that runs `check:db` and retroactively validates those suites. Conversely, once DB-04 exists, skipping `check:db` is a failure.

Private helper splits inside task-owned new subtrees are allowed only when public contracts remain unchanged and file budgets are respected.

## No architecture invention

Do not reintroduce repository-clone editorial workflows, filesystem canonical drafts, localhost sync, broad Neon credentials, admin-session reuse, arbitrary publication, last-write-wins, a separate AI merge system, or a new backend.

Do not replace the delegated-authority model with a full SQL semantic validator.

Exact pins remain `@bemtevi/content-mcp@1.0.0` and `@modelcontextprotocol/server@2.0.0`.

If a contract is impossible against current code/platform behavior, stop that slice and report the exact assumption with evidence.

## Test-first risky boundaries

Add/retain focused tests for CAS, semantic conflict, capability auth, role/function grants, image limits, browser recovery, guarded publication, and explicit publication-intent guidance.

## File constraints

Do not grow a baselined file above the audited revision-8 baseline. No new handwritten source exceeds the hard limits or global 500-line ceiling. Do not weaken the architecture checker.

## Verification cadence

Run focused tests frequently; typecheck/lint at meaningful integration points; complete repository gates before merge/release.

## Final handoff

Every task handoff reports:

- task ID;
- starting and ending HEAD;
- files changed;
- adopt/verify files checked but left unchanged;
- public interfaces added/changed;
- tests and commands run;
- skipped environment-dependent gates and why (never call them passed);
- downstream dependencies;
- shared/hot files touched;
- migration ordering;
- confirmation editorial permissions were not widened.
