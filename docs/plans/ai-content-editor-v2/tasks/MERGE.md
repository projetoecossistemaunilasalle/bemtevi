# Shared Domain Tasks

Read 14 and the repository audit. This is extraction plus explicit V2 protocol work, not a rewrite of published content semantics.

All three serial MERGE tasks own `packages/content-core/src/index.ts` to export their completed public APIs. This shared file is never edited concurrently. Internal source/test helper splits are allowed only inside the task's named subtree.

## MERGE-01: Framework-Neutral Models And Validation

**Depends:** INTEGRATION-00. **Unblocks:** MERGE-02. **Parallel:** serial foundation.
**Owns:** `packages/content-core/src/model/**`, `packages/content-core/src/validation/**`, `packages/content-core/src/contracts/**`, digest.ts, index.ts, and the existing facade paths in the map below. No root config, MCP, draft persistence or UI components.

Exact extraction map (paths relative to repo):
| Existing source | Canonical destination under packages/content-core/src |
| --- | --- |
| src/domain/content/types.ts | model/content.ts |
| src/domain/resources/types.ts | model/resources.ts |
| src/domain/services/types.ts, locations.ts | model/services.ts, model/locations.ts |
| src/domain/flow-engine/types.ts, parseFlow.ts | model/flowTypes.ts, validation/parseFlow.ts |
| src/domain/flow-engine/validateFlow.ts | validation/validateFlow.ts plus validation/validateFlowNode.ts |
| src/domain/media/youtube.ts | model/youtube.ts |
| src/content/resources/groups.ts type and DEFAULT_EDUCATION_GROUP_ID only | model/groups.ts |
| src/content/resources/featuredImageIds.ts | model/featuredImageIds.ts |
| src/app/content/publishedContent.ts | model/publishedContent.ts (types/constants), validation/payloadValidation.ts, validation/materialValidation.ts, validation/snapshotValidation.ts |
| src/dev-dashboard/validation/validationTypes.ts, duplicateIds.ts | validation/validationTypes.ts, validation/duplicateIds.ts |
| src/dev-dashboard/contacts/contactsValidation.ts | validation/contactsValidation.ts |
| src/dev-dashboard/education/educationValidation.ts | validation/educationValidation.ts |
| src/dev-dashboard/flows/flowValidation.ts | validation/flowsValidation.ts plus validation/flowGraphValidation.ts, validation/flowReferenceValidation.ts, validation/flowReviewValidation.ts |
| scripts/content-agent/contentValidation.ts | validation/inspectContent.ts |

Move existing exports and re-export from original facade paths to preserve consumers/tests. Do not move the actual education group corpus or generated resource content into core. Extract normalizePhoneHref into model/phone.ts and make contactDrafts.ts import/re-export it. Extract isImageDataUrl from components/fileUpload.ts into images/dataUrl.ts; preserve upload browser behavior with re-export. No DOM/FileReader in core. Split oversized implementations at the named responsibility boundaries; do not move 766-line validators verbatim into new over-budget files.

Implement exact contracts in contracts/drafts.ts, errors.ts, connections.ts, publication.ts, exports.ts from 14, and digest.ts. Re-export public API from index.ts. No core imports of src/, React, Neon, MCP, node:fs or runtime bundled corpus. Type-only external repository imports are also forbidden: installed artifact must be self-contained.

**Tests:** keep existing publication, flow, contact, education and content-agent validation suites green through facades. Add validation/inspectContent.test.ts for valid/invalid/warning, normalization identity detection; digest.test.ts for reordered JSON keys, Unicode, SQL canonical text versus compact JSON, tampered payload/text/digest.
**Commands:** common commands; focused src/app/content, src/domain/flow-engine, `src/dev-dashboard/education/__tests__`, `src/dev-dashboard/contacts/__tests__`, `src/dev-dashboard/flows/__tests__/flowValidation.test.ts`, packages/content-core.
**Acceptance:** one canonical validator implementation, behavior parity, core import graph has no app/UI/runtime dependency; no mutation normalization hidden as a read.

## MERGE-02: Operations, Images And Conformance Fixtures

**Depends:** MERGE-01. **Unblocks:** DB-01, MERGE-03. **Parallel:** serial with MERGE-03.
**Owns:** core contracts/operations.ts, `operations/**`, `images/**`, `fixtures/**`; src/dev-dashboard/ai/aiOperations.ts compatibility facade and its tests. Do not change archive/UI callers to V2 yet.

Implement all operations/encoding semantics and strict limits from 14. Keep legacy V1 parser exported as a clearly named compatibility adapter until LEGACY-01; existing legacy consumers continue their old behavior. V2 exports parseEditorialEnvelope, parseOperations, applyOperations, encodeOperations. No separate MCP protocol type. Implement inspectImage, data URL conversion and slot diff; image restrictions compare retained slots, not blanket string rejection.

Create fixtures/operations.json as a list of named {base,operations,expectedPayload?,expectedError?} cases consumed by both TS tests and SQL tests. Include Unicode, field unset versus null, defaultGroupOrder, nested field replacement, add/delete/order sequencing, same-ID errors, unchanged old image preservation, explicit image change, total limits and >200 operations. Valid tiny PNG/JPEG/WebP byte fixtures and invalid/animated/header-truncated cases live under fixtures/images/ (generated test fixtures only, not editorial assets).

**Tests:** parser rejects all extra keys/unsafe keys/oversizes, encode->apply identity for every existing payload field, no-op returns empty encoding, failed batch leaves base unchanged, exact SQL/TS shared fixture expectations. Boundary tests at limit and one above.
**Commands:** common plus focused packages/content-core and legacy aiOperations tests.
**Acceptance:** dashboard can encode every existing editable field without arbitrary payload replacement; title change omits unchanged image/body; V1 cannot be mistaken for V2.

## MERGE-03: Preserve Semantic Reconciliation

**Depends:** MERGE-02. **Unblocks:** DASHBOARD-01, AI-FILE-01, MCP-01. **Parallel:** serial.
**Owns:** core content-reconciliation/{types,identity,compareContent,reconcileContent,describePath,index}.ts, reconciliationSession.ts, their tests; src/dev-dashboard/publishing/semanticDiff.ts and mergePublishedContent.ts facades plus their existing tests.

Preserve exact exported names: contentIdentity, assertComparable, compareContent, reconcileContent, describePath. Move fingerprint/value-slot/ordering behavior, don't substitute JSON Merge Patch or last-write-wins. Add adapter specified in 14. Facades remain until consumers migrated; core exports package entry point only, not dashboard ownership.

**Tests:** existing semanticDiff/mergePublishedContent tests unchanged in expectations; title versus description merges, divergent title conflict, identical value merge, delete-versus-edit, independent ordering and true order conflict, missing versus null, fingerprint invalidation after second remote edit. Comparator failures do not become successful merges.
**Commands:** common plus focused `src/dev-dashboard/publishing/__tests__/semanticDiff.test.ts`, mergePublishedContent.test.ts and content-core.
**Acceptance:** Gate A, whole pnpm run check green, all downstream contracts importable without UI.
