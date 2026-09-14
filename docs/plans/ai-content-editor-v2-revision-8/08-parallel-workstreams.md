# Task Execution Graph

**Specification revision: 8. Audited base: `e030264786ae7010aac7832203244882d12f9265`.**

Use the serial order by default for a weaker implementation model. Parallel execution is optional scheduling only; it never permits shared-contract negotiation or overlapping hot-file edits.

## Dependency graph

```text
INTEGRATION-00 -> MERGE-01 -> MERGE-02 -> MERGE-03
                                |
                                +-> DB-01 -> DB-02 -> DB-03 -> DB-04
MERGE-03 -> DASHBOARD-01 -> DASHBOARD-02 -> DASHBOARD-03
MERGE-03 -> AI-FILE-01 -> AI-FILE-02
MERGE-03 -> MCP-01 -> MCP-02 -> MCP-03
DB-04 + MCP-03 -> MCP-04
DASHBOARD-03 + AI-FILE-02 + MCP-03 + DB-04 -> INTEGRATION-01
INTEGRATION-01 -> INTEGRATION-02 -> INTEGRATION-03
INTEGRATION-03 + MCP-04 -> LEGACY-00 -> LEGACY-01 -> LEGACY-02 -> INTEGRATION-04
```

INTEGRATION-00 is an adopt/verify gate at the audited base because scaffolding exists. DB-01 may begin after MERGE-02, but the default serial order still finishes MERGE-03 before entering DB. DB-01..03 author live suites; DB-04 is the first executable `check:db` owner. Dashboard/MCP/AI unit work uses fake feature transports before typed/live integration. MCP-04 waits for DB-04 because full release evidence also includes the single live installed-artifact proof owned by INTEGRATION-03.

## Exclusive ownership map

This table summarizes task-file allowlists; task files remain the exact path authority. A path can pass between serial owners only where the task explicitly calls it a handoff/removal-only edit.

| Hot area                                                                | Serial owner sequence                                                                                                                          |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| root workspace/package/lockfile/runner/CI/architecture/AGENTS bootstrap | INTEGRATION-00 -> LEGACY-02 only where explicitly listed                                                                                       |
| content-core and audited domain/validation facades                      | MERGE-01 -> MERGE-02 -> MERGE-03 -> LEGACY-01 only for explicitly temporary V1 AI facades                                                      |
| SQL/additive migrations/cutover and DB harness                          | DB-01 -> DB-02 -> DB-03 -> DB-04                                                                                                               |
| draft repository/coordinator/cache + legacy recovery extraction         | DASHBOARD-01 -> DASHBOARD-02 -> DASHBOARD-03 -> INTEGRATION-02 hook handoff -> LEGACY-00 pure-model extraction -> LEGACY-01 old-store deletion |
| file archive services + AI presentation/connections                     | AI-FILE-01 -> AI-FILE-02 -> INTEGRATION-01 service composition -> LEGACY-01 temporary facade deletion                                          |
| standalone MCP package/source/tests                                     | MCP-01 -> MCP-02 -> MCP-03 -> MCP-04                                                                                                           |
| handwritten Neon DB types + `editorialNeonServices.ts`                  | INTEGRATION-01 only                                                                                                                            |
| `DashboardRoute.tsx` / `DashboardTabContent.tsx`                        | INTEGRATION-02 -> LEGACY-00 pure-model import move -> LEGACY-01 removal-only legacy imports -> LEGACY-02 enablement-branch removal only        |
| public education published-content projection                           | existing feature -> LEGACY-00 removes browser-draft preview; published context becomes the only public input                                   |
| publication/provider composition                                        | INTEGRATION-02 -> LEGACY-01 temporary adapter removal                                                                                          |
| live replacement evidence                                               | INTEGRATION-03 only; it does not own root CI                                                                                                   |
| root legacy command/config/docs cleanup                                 | LEGACY-02 only                                                                                                                                 |
| final release evidence document                                         | INTEGRATION-03 creates -> INTEGRATION-04 appends final verification evidence                                                                   |

INTEGRATION-01 does **not** own the root lockfile or `AiArchiveSection.tsx`. INTEGRATION-03 does **not** own `.github/workflows/ci.yml`; the audited CI already discovers `check:db` through the DB-04 harness. INTEGRATION-04 owns no source/config code and cannot perform late fixes.

## Current decomposition constraints

The audited base has already split dashboard route tests, dashboard storage tests, flow validation, several dashboard/content modules and the legacy content-agent server. No V2 task may recreate removed monoliths. Extraction tasks move/facade the current decomposed implementation.

## Parallel lanes

After MERGE-03, DB, DASHBOARD, AI-FILE and MCP paths are disjoint enough for explicit delegation. DB may technically start at MERGE-02, but do not overlap it with MERGE-03 under the default weak-model plan. All INTEGRATION and LEGACY tasks are serial. If two planned tasks name the same path, they are not parallel-safe regardless of this summary.

## Checkpoints

- **A:** MERGE-03 + architecture gate green.
- **B:** DB-04 real Data API/security/CAS evidence; DB-01..03 deferred live suites all executed with no skips.
- **C:** INTEGRATION-03 dashboard/file/MCP replacement proven with aligned draft base/live revision.
- **D:** file export/import/image/concurrency replacement proven through unit/integration + live cross-session evidence.
- **E-local:** MCP-04 clone-free packed artifact passes `check:mcp-package`.
- **E-live:** INTEGRATION-03 runs that installed artifact against DB-04 disposable Neon.
- **F:** LEGACY-02 leaves no operational legacy consumers; INTEGRATION-04 final gates green.

No legacy deletion before C, D, E-local and E-live are green. No direct-write revocation before deployed/staged V2 frontend is tested according to 15/INTEGRATION-03.

## Drift rule

Before every task apply README's repository-base preflight. If a V2-sensitive path differs from audited base, pause the affected task for change control; do not reinterpret current code as a replacement specification.
