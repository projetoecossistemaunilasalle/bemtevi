# Implementation Tasks

**Specification revision: 5.** Read ../README.md, ../11-agent-execution-rules.md, and the linked task file. Implement one task ID at a time. Do not rerun Stage 0 or ask an implementation model to choose contracts.

## Default Serial Order

1. [INTEGRATION-00](INTEGRATION.md): workspace/build/test guardrails.
2. [MERGE-01, MERGE-02, MERGE-03](MERGE.md): pure shared types/validation, operations/images, reconciliation.
3. [DB-01, DB-02, DB-03, DB-04](DB.md): migrations, capability/export RPCs, publication, actual Data API tests.
4. [DASHBOARD-01, DASHBOARD-02, DASHBOARD-03](DASHBOARD-DRAFTS.md): transport/cache, save coordinator, hook/recovery.
5. [AI-FILE-01, AI-FILE-02](AI-FILE-UX.md): archive services and presentation.
6. [MCP-01, MCP-02, MCP-03, MCP-04](MCP.md): package, read/edit tools, publication, clone-free artifact test.
7. [INTEGRATION-01, INTEGRATION-02, INTEGRATION-03](INTEGRATION.md): types/connection services, route/publication cutover, E2E/deployment proof.
8. [LEGACY-01, LEGACY-02](LEGACY-CLEANUP.md): old code, config/docs cleanup.
9. [INTEGRATION-04](INTEGRATION.md): complete local/live/release gates.

DB and package release tasks have explicit external prerequisites. Missing test credentials/npm scope permission block those gates, not an invitation to change the architecture or report skipped tests as passing. Local fake-service work may continue in dependency-independent tasks per ../08-parallel-workstreams.md.

The audited dirty checkout has existing test failures recorded in ../17-readiness-audit.md. Preserve unrelated changes and report baseline versus new regressions. Do not revert editorial changes or weaken tests to hide that baseline; no implementation commit may be pushed before the full gate is actually green.

## Contract Reading

All tasks consume ../14-contracts.md. DB tasks also read ../15-database-contract.md. Dashboard/file tasks also read ../16-dashboard-state-machine.md. MCP tasks read ../04-agent-auth-and-mcp.md. Existing code is extraction evidence, not permission to change the contracts.

## Common Task Envelope

These rules are part of **every** task below:

- Owned paths are allowlists. All other files, especially other workstreams' modules, root config and production editorial snapshots, are forbidden unless a later integration task explicitly owns them.
- New helper files are permitted only under that task's named new subtree, with one responsibility and public entry points unchanged. Adjacent tests use <module>.test.ts(x) or the explicitly named test directory. This is non-contractual internal decomposition, not permission to add APIs.
- Commands: `pnpm run typecheck`, `pnpm run lint`, `pnpm run check:architecture` after each task; focused tests via `pnpm run test:unit -- <path>` established by INTEGRATION-00. Full `pnpm run check` at checkpoints and before every commit intended for push. DB tasks additionally require `pnpm run check:db` before merge, never skip it.
- Acceptance requires the specified tests, zero errors, no out-of-ownership edits, and a handoff of task ID, tests/evidence, owned files and downstream dependencies. No placeholder successful handlers or TODO assertions.
- Do not publish npm packages, deploy production migrations or push solely because a task describes a release. Implementation approval authorizes code; production/release actions require the repository owner's release approval.
- Mark progress in the implementation handoff, not by rewriting these normative task specs. Later normative changes follow ../13-dossier-change-control.md.

Default parallel safety is **serial**. Only tasks explicitly named in 08's disjoint lanes may run in parallel after their dependencies. Tests and mocks do not widen file ownership.
