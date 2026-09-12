# Task Execution Graph

Revision 5. Stage 0 is complete. [tasks/README.md](tasks/README.md) is the executable index; concern files and 14-16 define immutable interfaces. Use the listed **serial order by default** for a weaker model. Parallel execution is optional scheduling, not authorization to create agents.

## Dependency Graph

```text
INTEGRATION-00 -> MERGE-01 -> MERGE-02 -> MERGE-03
                                |
                                +-> DB-01 -> DB-02 -> DB-03 -> DB-04
MERGE-03 -> DASHBOARD-01 -> DASHBOARD-02 -> DASHBOARD-03
MERGE-03 -> AI-FILE-01 -> AI-FILE-02
MERGE-03 -> MCP-01 -> MCP-02 -> MCP-03 -> MCP-04
DASHBOARD-03 + AI-FILE-02 + MCP-03 + DB-04 -> INTEGRATION-01
INTEGRATION-01 -> INTEGRATION-02 -> INTEGRATION-03
INTEGRATION-03 + MCP-04 -> LEGACY-01 -> LEGACY-02 -> INTEGRATION-04
```

DB-01 can start after MERGE-02 (SQL operation fixtures frozen); DB-04 needs DB-03 and INTEGRATION-00 harness. DASHBOARD/MCP/AI unit implementation uses fake repositories until DB-04 passes; live integration must wait. No shell-only tasks with unstated contracts.

## Exclusive Ownership

| Area                                                                            | Owner tasks, serial within area                           |
| ------------------------------------------------------------------------------- | --------------------------------------------------------- |
| root package/config/runner/lockfile/CI/AGENTS; architecture tooling             | INTEGRATION-00, INTEGRATION-02, LEGACY-02, INTEGRATION-04 |
| content-core + existing domain/validation compatibility facades                 | MERGE-01..03                                              |
| SQL, database harness/tests, additive types proposal                            | DB-01..04                                                 |
| canonical draft coordinator, cache, hook                                        | DASHBOARD-01..03                                          |
| archive services and AI presentation except route                               | AI-FILE-01..02                                            |
| standalone MCP source/tests/package manifest                                    | MCP-01..04                                                |
| DashboardRoute, publication controller/composition, typed database registration | INTEGRATION-01..03                                        |
| obsolete bridge/draft-sync modules/config/docs                                  | LEGACY-01..02 after replacement proven                    |

Root lockfile changes are collected by integration owner after package manifest changes, not concurrent feature owners. DB tasks produce `neon/tests/rpc-types.ts` contract fixtures; INTEGRATION-01 updates `src/app/neon/database.ts` (currently handwritten, not generated). All tests adjacent to a task's new modules belong to that task. Never assign the same existing test file concurrently.

After MERGE-03, DB, DASHBOARD, AI-FILE and MCP paths have disjoint ownership and may run concurrently if explicitly delegated. INTEGRATION-00 and MERGE tasks are serial foundation work. All INTEGRATION/LEGACY tasks are serial. No workstream may negotiate a new shared contract.

## Checkpoints

A: MERGE-03 green plus architecture gate installed. B: DB-04 actual Data API/security/CAS evidence, no skipped credential tests. C: INTEGRATION-03 dashboard/file/MCP replacement proven, aligned base/live revision and controlled cutover. E: MCP-04 clone-free tarball/registry release prerequisite verified. F: LEGACY-02 removes dangling consumers; INTEGRATION-04 final full local and live gates.

No legacy deletion before C and E. No direct-write revocation before deployed V2 frontend is tested; cutover SQL is kept outside automatic additive migration enumeration for that reason.
