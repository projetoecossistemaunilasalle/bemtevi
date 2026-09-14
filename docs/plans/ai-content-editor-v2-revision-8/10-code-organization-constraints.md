# Code Organization Constraints

**Specification revision: 8. Audited base: `e030264786ae7010aac7832203244882d12f9265`.**

## Physical line budgets

| File kind                                | Soft target | Hard maximum |
| ---------------------------------------- | ----------: | -----------: |
| Production `.ts`                         |         200 |          300 |
| Component/hook `.tsx`                    |         220 |          320 |
| Test `.test.ts(x)` or `__tests__` source |         350 |          500 |
| Tooling `.mjs`                           |         220 |          320 |

Additionally, no scanned handwritten source file may exceed **500 physical lines**, even when baselined.

Physical-line counting and scan/ignore behavior are whatever is implemented by the audited `scripts/check-architecture.mjs`; tasks may not weaken that implementation to make V2 pass.

## Audited architecture baseline

Revision 5's historical baseline is obsolete because architecture remediation split several oversized files and introduced the global 500-line ceiling.

Revision 8 carries forward the baseline frozen by revision 6 and retained by revision 7 in [`architecture-baseline.json`](architecture-baseline.json), which is the exact current baseline expected at `e030264786ae7010aac7832203244882d12f9265`. INTEGRATION-00 verifies the repository's `scripts/architecture-baseline.json` matches it. It does **not** copy an older/larger allowance over a newer baseline.

Rules:

- missing baseline path after deletion is fine;
- shrinking never creates permission to regrow above the retained baseline;
- new files do not inherit historical allowances;
- no new baseline entries without change control;
- do not re-add removed revision-5 entries.

## Automated dependency rules

The current architecture checker remains authoritative for mechanical enforcement. At minimum preserve:

- core -> no `src/`, MCP, React, Neon, MCP SDK, `node:*`, DOM runtime/FileReader/window/document or generated corpus;
- frontend -> no MCP implementation internals or legacy content-agent/agent-bridge runtime;
- MCP -> no app source, legacy scripts, child process, Git, filesystem draft/image read;
- no runtime workspace dependency leaking from packed MCP;
- exact version pins and secret scanning.

## Fixed ownership boundaries

- `packages/content-core/src/model`: content types/constants only.
- `packages/content-core/src/validation`: semantic validators split by concern.
- `packages/content-core/src/contracts`: wire/domain types and errors.
- `packages/content-core/src/operations`, `images`: V2 operations and image validation.
- `packages/content-core/src/content-reconciliation`: semantic compare/merge.
- `src/dev-dashboard/drafts`: canonical repository/coordinator/polling/state UI.
- `src/dev-dashboard/draft-storage`: hook, IndexedDB recovery, read-only legacy recovery.
- `src/dev-dashboard/ai/files`: durable archive workflow.
- `src/dev-dashboard/ai/connections`: capability metadata/config/UI.
- `packages/content-mcp/src/server`: composition/dispatch/instructions.
- `packages/content-mcp/src/tools`: named handlers/schemas.
- `packages/content-mcp/src/client`: Data API transport/error mapping.
- `packages/content-mcp/src/session`: bounded volatile cache/limiter.
- `neon/tests`: real DB harness.

Integration additionally owns current composition files:

- `src/dev-dashboard/DashboardRoute.tsx`
- `src/dev-dashboard/DashboardTabContent.tsx`

## Current decomposition

The audited tree already contains focused modules created by architecture remediation. V2 extraction is performed from that tree; do not concatenate split source merely to match an older extraction description.

In particular, flow validation extraction includes:

- `flowValidation.ts`
- `flowEffectValidation.ts`
- `flowStructuralValidation.ts`
- `flowStructuralChoiceIssues.ts`
- `flowStructuralCoreIssues.ts`
- `flowStructuralValidationContext.ts`

Current focused route/storage/education/flow test files stay split.

## Compatibility facades

Facades are thin re-exports/adapters, never parallel implementations. V1 operation and legacy persistence compatibility is removed only at LEGACY-01.

## Non-contractual freedom

Private variable names, helper decomposition inside task-owned new subtrees, equivalent existing-token CSS, and non-frozen PT-BR explanatory copy are implementation freedom. Storage/security/interoperability/ownership/public APIs/state transitions/gates are not.
