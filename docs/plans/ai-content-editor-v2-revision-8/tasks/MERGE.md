# Shared Domain Tasks

**Specification revision: 8.** Read 14 and 17. These tasks extract current behavior into `@bemtevi/content-core` and add the frozen V2 operation/image protocol; they do not redesign published content semantics.

All MERGE tasks serially own `packages/content-core/src/index.ts`. The package may create private helpers only inside the specifically owned core subtrees below. Existing compatibility facades remain at their audited paths until LEGACY-01 unless a task explicitly says otherwise.

## MERGE-01: Framework-Neutral Models And Validation

**Depends:** INTEGRATION-00. **Unblocks:** MERGE-02.

**Owned new/core paths:**

- `packages/content-core/src/model/**`
- `packages/content-core/src/validation/**`
- `packages/content-core/src/contracts/**`
- `packages/content-core/src/digest.ts`
- `packages/content-core/src/index.ts`
- `packages/content-core/src/__tests__/model-validation.test.ts`
- `packages/content-core/src/__tests__/digest.test.ts`
- `packages/content-core/src/__tests__/inspectContent.test.ts`

**Owned audited compatibility facade paths:**

- `src/domain/content/types.ts`
- `src/domain/resources/types.ts`
- `src/domain/services/types.ts`
- `src/domain/services/locations.ts`
- `src/domain/flow-engine/types.ts`
- `src/domain/flow-engine/parseFlow.ts`
- `src/domain/flow-engine/validateFlow.ts`
- `src/domain/media/youtube.ts`
- `src/content/resources/groups.ts`
- `src/content/resources/featuredImageIds.ts`
- `src/app/content/publishedContent.ts`
- `src/dev-dashboard/validation/validationTypes.ts`
- `src/dev-dashboard/validation/duplicateIds.ts`
- `src/dev-dashboard/contacts/contactsValidation.ts`
- `src/dev-dashboard/education/educationValidation.ts`
- `src/dev-dashboard/flows/flowValidation.ts`
- `src/dev-dashboard/flows/flowEffectValidation.ts`
- `src/dev-dashboard/flows/flowStructuralValidation.ts`
- `src/dev-dashboard/flows/flowStructuralChoiceIssues.ts`
- `src/dev-dashboard/flows/flowStructuralCoreIssues.ts`
- `src/dev-dashboard/flows/flowStructuralValidationContext.ts`
- `scripts/content-agent/contentValidation.ts`

Do not modify existing test files merely because they exercise these facades. The facades must preserve their public exports so current tests compile unchanged. Run those existing tests as verification evidence.

### Frozen extraction map

| Existing source                                   | Canonical destination                                               |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `src/domain/content/types.ts`                     | `model/content.ts`                                                  |
| `src/domain/resources/types.ts`                   | `model/resources.ts`                                                |
| `src/domain/services/types.ts`, `locations.ts`    | `model/services.ts`, `model/locations.ts`                           |
| `src/domain/flow-engine/types.ts`, `parseFlow.ts` | `model/flowTypes.ts`, `validation/parseFlow.ts`                     |
| `src/domain/flow-engine/validateFlow.ts`          | `validation/validateFlow.ts` plus focused node helpers              |
| `src/domain/media/youtube.ts`                     | `model/youtube.ts`                                                  |
| `src/content/resources/groups.ts`                 | group type + `DEFAULT_EDUCATION_GROUP_ID` only -> `model/groups.ts` |
| `src/content/resources/featuredImageIds.ts`       | `model/featuredImageIds.ts`                                         |
| `src/app/content/publishedContent.ts`             | model plus payload/material/snapshot validation modules             |
| dashboard validation files listed above           | corresponding focused core validation modules                       |
| `scripts/content-agent/contentValidation.ts`      | `validation/inspectContent.ts`                                      |

If any listed source differs from audited base `e030264786ae7010aac7832203244882d12f9265`, stop under the drift gate rather than inferring a new extraction map. Move behavior, then leave thin facades at existing import paths. Do not move editorial corpus. No DOM/FileReader in core. Implement exact digest/contracts from 14. Core imports no `src/`, React, Neon, MCP, `node:*`, or generated corpus.

**Tests:** new owned core tests plus current publication/flow/contact/education/content-agent validation suites. Use the current split test filenames discovered by the audited tree; running an existing test does not grant ownership to edit it.

**Commands:** common envelope; `pnpm run test:unit -- packages/content-core`; existing focused publication/flow/contact/education/content-agent validation tests; `pnpm run validate:flows`.

**Acceptance:** one canonical validator implementation, behavior parity, self-contained package, no new architecture baseline exceptions.

## MERGE-02: Operations, Images And Conformance Fixtures

**Depends:** MERGE-01. **Unblocks:** DB-01 and MERGE-03.

**Owned core paths:**

- `packages/content-core/src/operations/**`
- `packages/content-core/src/images/**`
- `packages/content-core/src/fixtures/**`
- `packages/content-core/src/index.ts`
- `packages/content-core/src/__tests__/operations.test.ts`
- `packages/content-core/src/__tests__/images.test.ts`
- `packages/content-core/src/__tests__/conformanceFixtures.test.ts`

**Owned compatibility paths:**

- `src/dev-dashboard/ai/aiOperations.ts`
- `src/dev-dashboard/ai/__tests__/aiOperations.test.ts`

Implement the literal operation/add/update/unset/image allowlists and bounds in 14. Do not derive allowed keys at runtime or during implementation from the old `ITEM_KEYS` object or optional TypeScript properties. The compatibility module may expose a clearly named V1 adapter for still-compiled callers, but V1 and V2 parsers are distinct and V1 input cannot pass as V2. Generic operations never mutate protected image slots; all retained-slot image changes use the specialized image contract.

The shared fixtures are deterministic and importable by TypeScript/DB tests. They cover every editable field, every unsettable field, every image action, accepted no-op, stale generation, and representative semantic-invalid draft states.

**Tests:** exact parse/encode/apply roundtrip; every literal allowlist; unknown/protected key rejection; title-only change omits unchanged body/image fields; add/remove/update/unset semantics; image slot preservation; bounds; V1 rejection by V2; deterministic conformance fixture serialization.

**Commands:** common envelope plus `pnpm run test:unit -- packages/content-core src/dev-dashboard/ai/__tests__/aiOperations.test.ts`.

**Acceptance:** one exact V2 protocol implementation; compatibility facade does not become normative authority.

## MERGE-03: Preserve Semantic Reconciliation

**Depends:** MERGE-02. **Unblocks:** DASHBOARD-01, AI-FILE-01 and MCP-01.

**Owned core paths:**

- `packages/content-core/src/content-reconciliation/**`
- `packages/content-core/src/index.ts`
- `packages/content-core/src/__tests__/reconciliation.test.ts`

**Owned compatibility facade paths:**

- `src/dev-dashboard/publishing/semanticDiff.ts`
- `src/dev-dashboard/publishing/mergePublishedContent.ts`

Move the current semantic compare/reconcile implementation into content-core while preserving externally used export names, canonical fingerprints/conflict IDs and behavior. The two dashboard files become thin facades only. Do not alter current publishing UI/controller behavior in this task; INTEGRATION-02 owns that migration.

**Tests:** new core reconciliation suite plus existing semantic diff/merge/publishing tests run unchanged; distinct-field merge, overlapping value conflict, delete/edit conflict, ordering conflict, missing/null behavior and conflict-fingerprint invalidation.

**Commands:** common envelope plus `pnpm run test:unit -- packages/content-core src/dev-dashboard/publishing`.

**Acceptance:** Gate A; all downstream V2 consumers can import reconciliation from content-core with no UI dependency and current dashboard tests remain behaviorally green.
