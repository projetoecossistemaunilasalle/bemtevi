# Frozen Change Inventory

Revision 5. The exact allowlists in [tasks/README.md](tasks/README.md) and its seven concern files replace the pre-hardening inventory. This file is a navigation index, not permission for parallel owners to edit shared paths.

| Concern                                                             | Exact inventory owner                                            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Workspace, root commands/config/CI, frozen architecture baseline    | tasks/INTEGRATION.md INTEGRATION-00                              |
| Pure models/validators and all compatibility facades                | tasks/MERGE.md MERGE-01 extraction map                           |
| Editorial operations, images, fixtures                              | tasks/MERGE.md MERGE-02                                          |
| Semantic reconciliation package/facades                             | tasks/MERGE.md MERGE-03                                          |
| Four additive SQL migrations, separately staged revocation          | 15-database-contract.md migration list; tasks/DB.md              |
| New table/function types in handwritten Database                    | tasks/INTEGRATION.md INTEGRATION-01                              |
| Neon draft repository/coordinator/cache/hook                        | tasks/DASHBOARD-DRAFTS.md                                        |
| Durable file export and strict operation/image import               | tasks/AI-FILE-UX.md                                              |
| New AiFileArchiveSection.tsx and connection UI                      | tasks/AI-FILE-UX.md AI-FILE-02; this file does not already exist |
| Standalone MCP package/config/tools/cache                           | tasks/MCP.md                                                     |
| DashboardRoute and guarded publication composition                  | tasks/INTEGRATION.md INTEGRATION-02                              |
| Live Data API test harness and release checklist                    | tasks/DB.md DB-04, tasks/INTEGRATION.md INTEGRATION-03           |
| Delete old local MCP, bridge, draft-sync and obsolete adapters      | tasks/LEGACY-CLEANUP.md LEGACY-01                                |
| Remove old root commands, editorial MCP config and operational docs | tasks/LEGACY-CLEANUP.md LEGACY-02                                |

## Preserve

Public published-content reads, history trigger semantics, Neon Auth admin membership, the deterministic educator flow engine, existing design system, read-only fallback content:pull and original legacy local recovery bytes remain. No task owns manual edits to production/fallback editorial corpus.

The existing dirty SRQ20 plan and generated resource files identified in 17 are unrelated and must not be reverted or bundled into V2 implementation commits.

## Dossier Artifacts

00-13 retain architecture/migration/gate guidance. New authoritative implementation detail:

- 14-contracts.md: wire/domain/operation/image/file contract.
- 15-database-contract.md: exact SQL/RPC/security/transaction contract.
- 16-dashboard-state-machine.md: exact coordinator/cache/actions.
- 17-readiness-audit.md: evidence, decisions and remaining operational release prerequisites.
- architecture-baseline.json: immutable Stage 0 source-size baseline.
- tasks/README.md plus DB.md, MERGE.md, DASHBOARD-DRAFTS.md, AI-FILE-UX.md, MCP.md, INTEGRATION.md, LEGACY-CLEANUP.md: 23 executable task IDs.

Only docs under this dossier are changed in Stage 0. Migrations, packages, UI and tests listed here are implementation deliverables, not claimed to exist already.
