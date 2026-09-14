# Frozen Change Inventory

**Specification revision: 8. Audited base: `e030264786ae7010aac7832203244882d12f9265`.**

Exact allowlists are in task files; this index is only a cross-check. It reflects the decomposed audited repository, not an older pre-remediation tree.

| Concern                                                                             | Exact task owner(s) |
| ----------------------------------------------------------------------------------- | ------------------- |
| workspace/root runner/CI/architecture bootstrap verification                        | INTEGRATION-00      |
| pure models/validators + audited compatibility facades                              | MERGE-01            |
| literal V2 operations/images/conformance fixtures + temporary V1 facade             | MERGE-02            |
| semantic reconciliation extraction + publishing facades                             | MERGE-03            |
| additive SQL, publication/cutover SQL and DB live suites                            | DB-01..03           |
| disposable Neon provisioning/harness and accumulated DB live gate                   | DB-04               |
| canonical draft repository/factory/cache/coordinator/hook/recovery adapter          | DASHBOARD-01..03    |
| durable archive/import + export repository/factory                                  | AI-FILE-01          |
| file-first + connected-assistant UI + connection repository/factory                 | AI-FILE-02          |
| standalone MCP implementation and packed local gate                                 | MCP-01..04          |
| handwritten Neon function/current/history types + authenticated service composition | INTEGRATION-01      |
| exact route/tab, flags, canonical draft UI, publication/provider cutover            | INTEGRATION-02      |
| live cross-client + installed MCP proof and rollout evidence                        | INTEGRATION-03      |
| local bridge/draft-sync/V1 facade/old browser-canonical store deletion              | LEGACY-01           |
| root commands/config/enablement branch/operational docs cleanup                     | LEGACY-02           |
| verification-only final gate + rollout evidence append                              | INTEGRATION-04      |

## Already present at audited base — adopt/verify, do not recreate

- workspace definition and content-core/content-mcp package scaffolds;
- root V2 gate/runner command scaffolding and dependency pins;
- architecture checker/tests/current baseline;
- DB Vitest config skeleton;
- protected `v2-database` CI job;
- decomposed `DashboardRoute.tsx` + `DashboardTabContent.tsx`;
- split dashboard storage/route/flow/education tests;
- decomposed legacy content-agent server modules and flow validation modules.

These are scaffolding/evidence only, not proof V2 runtime behavior is implemented.

## Temporary artifacts with fixed lifecycle

- `src/dev-dashboard/publishing/legacyPublication.ts`: created by INTEGRATION-02 for the pre-cutover false branch; deleted by LEGACY-01.
- V1 compatibility facades `src/dev-dashboard/ai/{aiOperations,aiArchive,aiPrompts}.ts`: maintained only through their owning extraction/file tasks; deleted by LEGACY-01 after V2 consumers are proven.
- `VITE_EDITOR_V2_ENABLED`: introduced/used by INTEGRATION-02 for staged coexistence; removed by LEGACY-02. `VITE_EDITOR_READ_ONLY` survives.

## Preserve

Public published-content reads, history-trigger semantics, Neon Auth membership, flow engine behavior, design system, fallback `content:pull`, original local recovery bytes and unrelated architecture/content refactors remain. No V2 task manually edits production/fallback editorial corpus.

## Dossier artifacts

14–16 are authoritative contracts/state behavior. 18 and 19 are historical change records. 20 records the Revision-8 executor-determinism delta.
