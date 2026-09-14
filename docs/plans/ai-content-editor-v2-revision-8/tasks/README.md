# Implementation Tasks

**Specification revision: 8. Audited base: `e030264786ae7010aac7832203244882d12f9265`.**

Implement one task ID at a time. Do not rerun Stage 0, broaden an ownership allowlist, invent shared interfaces, or substitute a later gate just because a command is unavailable in the current task.

## Mandatory per-task preflight

Before every task:

1. apply the README repository-base drift gate;
2. preserve unrelated working-tree changes;
3. inspect every owned existing file before editing;
4. classify each owned deliverable as `adopt/verify`, `patch if nonconforming`, `implement`, or `remove later`;
5. run focused baseline tests named by the task when they already exist;
6. never recreate a file/module removed by the audited architecture remediation.

A task's `Owned`/`Owns` section is an **allowlist**, not a suggestion. Running an existing test does not grant permission to modify it. If a required fix falls outside the allowlist, stop that task and use the handoff/change-control process.

## Default serial order

1. **INTEGRATION-00** — verify/adopt workspace/build/test/architecture scaffolding.
2. **MERGE-01, MERGE-02, MERGE-03** — canonical shared models/validation, operations/images, reconciliation.
3. **DB-01..04** — schema/CAS, capabilities/exports, publication, real Neon gate.
4. **DASHBOARD-01..03** — repository/cache, save coordinator, hook/recovery.
5. **AI-FILE-01..02** — durable archive and file-first/connection UI.
6. **MCP-01..04** — standalone package, edit/read, publication, packed clone-free gate. MCP-04 additionally requires DB-04 green.
7. **INTEGRATION-01..03** — typed wiring, dashboard/publication cutover, live proof.
8. **LEGACY-01..02** — remove legacy product paths/config/docs.
9. **INTEGRATION-04** — verification-only final complete gate.

The dependency graph in 08 is authoritative if optional parallel scheduling is used.

## Contract reading

All tasks consume 14. DB tasks consume 15. Dashboard/file tasks consume 16. MCP tasks consume 04. Feature repository tasks consume the narrow transport boundary in 16; only INTEGRATION-01 may compose those factories with the application Neon client. Existing code is extraction evidence, not authority to change a frozen contract.

## Common task envelope

For every implementation task except where a task explicitly narrows/defer a gate:

```bash
pnpm run typecheck
pnpm run lint
pnpm run check:architecture
```

plus the task's named focused tests. Run `pnpm run format` only to fix owned-file formatting, then re-run `pnpm run format:check` as needed. Run full `pnpm run check` at checkpoints and before any push-intended commit.

### Live database gate availability

- **DB-01, DB-02, DB-03:** author live suites but **MUST NOT run `pnpm run check:db`** because `neon/tests/run.ts` does not exist until DB-04. Record `check:db deferred to DB-04 by specification` in each handoff.
- **DB-04 and later tasks that explicitly require it:** run `pnpm run check:db` with the required credentials. Missing credentials/provisioning are failures, never skips.
- Never create a fake harness or success stub to make an unavailable gate pass.

### Package gate availability

- `pnpm run test:mcp`/`build:mcp` become executable when MCP-01 lands.
- `pnpm run check:mcp-package` becomes executable when MCP-04 lands.
- Earlier tasks do not create fake package artifacts merely to satisfy those commands.

## Handoff record

Every completed task records:

- task ID;
- starting and ending HEAD/worktree state;
- adopt/verify files inspected unchanged;
- changed/created/deleted files;
- commands/tests actually executed and exact result;
- explicitly deferred gates and the task that owns them;
- downstream dependency now unblocked;
- any external prerequisite still pending.

No placeholder-success handlers, TODO assertions, npm publish, production migration/deploy, or git push is authorized solely because a task mentions release. Default execution is serial; only 08's disjoint lanes may run in parallel after prerequisites.
