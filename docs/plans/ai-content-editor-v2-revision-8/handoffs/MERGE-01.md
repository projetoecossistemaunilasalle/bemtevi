# MERGE-01 Handoff — Framework-Neutral Models And Validation

**Task ID:** MERGE-01 (revision 8 dossier)
**Starting HEAD:** `e030264786ae7010aac7832203244882d12f9265` (equals audited base; working tree contained only the pre-existing revision-8 dossier docs migration — old `docs/plans/ai-content-editor-v2/**` deletions plus untracked `docs/plans/ai-content-editor-v2-revision-8/` — preserved untouched)
**Ending HEAD:** `e030264786ae7010aac7832203244882d12f9265` (no commits made; all changes in working tree)

## Preflight / drift gate

- `git rev-parse HEAD` = audited base; `git status` clean for every owned listed source file (`git diff e0302647...HEAD -- <path>` empty for all 21 facade sources). No drift-gate stop.
- Every owned existing file was inspected before editing.

## Classification

**Adopt/verify (unchanged):** `packages/content-core/package.json`, `packages/content-core/tsconfig.json`, `packages/content-core/src/index.ts` (adopted as the package entry point, now populated — this task owns `index.ts` serially).

**Created (owned new/core paths):**

- `packages/content-core/src/model/` — `content.ts`, `resources.ts`, `services.ts`, `locations.ts`, `flowTypes.ts`, `youtube.ts`, `groups.ts` (type + `DEFAULT_EDUCATION_GROUP_ID` only; the editorial group list stayed in the repo), `featuredImageIds.ts`, `publishedContent.ts` (payload/snapshot/row types, schema constants, `PublishedContentValidationError`).
- `packages/content-core/src/validation/` — `parseFlow.ts`; `validateFlow.ts` plus focused node helpers `flowNodeMediaValidation.ts` and `flowNodeKindValidation.ts` (split to respect the 300-line budget for non-baselined files); `publishedContent.ts` (payload/row/size parsing) split into `publishedContentMaterials.ts`, `publishedContentContacts.ts`, `publishedContentGuards.ts`; `validationTypes.ts`, `duplicateIds.ts` (plus local `findLastIndexById` — the non-owned content-core tsconfig lib is ES2022, without `findLastIndex`), `imageDataUrl.ts` (DOM-free twin of the upload helper's `isImageDataUrl`, using the same grammar/MIME list/forgiving-base64 length rule), `contactsValidation.ts`, `educationValidation.ts`, `flowValidation.ts` (+ `flowEffectValidation.ts`, `flowStructuralValidation.ts`, `flowStructuralChoiceIssues.ts`, `flowStructuralCoreIssues.ts`, `flowStructuralValidationContext.ts` copied verbatim with import re-pointing), `inspectContent.ts`.
- `packages/content-core/src/contracts/` — `operations.ts`, `drafts.ts`, `errors.ts`, `connections.ts`, `publication.ts`, `exports.ts` (exact types from doc 14).
- `packages/content-core/src/digest.ts` — `sha256Text` (Web Crypto, lowercase hex), `verifySnapshot`, `sameContent`.
- `packages/content-core/src/index.ts` — explicit named re-exports (no `export *`, avoiding ambiguous star exports).
- `packages/content-core/src/__tests__/` — `model-validation.test.ts`, `digest.test.ts` (`@vitest-environment node` for `crypto.subtle`), `inspectContent.test.ts`.

**Modified (owned audited compatibility facade paths, 21 files):** all listed facade sources now re-export from `@bemtevi/content-core`, preserving public exports:

- `src/domain/content/types.ts`, `src/domain/resources/types.ts`, `src/domain/services/types.ts`, `src/domain/services/locations.ts`, `src/domain/flow-engine/types.ts`, `src/domain/flow-engine/parseFlow.ts`, `src/domain/flow-engine/validateFlow.ts`, `src/domain/media/youtube.ts`.
- `src/content/resources/groups.ts` (keeps the editorial `educationResourceGroups` array in-repo), `src/content/resources/featuredImageIds.ts`.
- `src/app/content/publishedContent.ts`.
- `src/dev-dashboard/validation/validationTypes.ts`, `duplicateIds.ts`; `src/dev-dashboard/contacts/contactsValidation.ts`; `src/dev-dashboard/education/educationValidation.ts`; `src/dev-dashboard/flows/flowValidation.ts`, `flowEffectValidation.ts`, `flowStructuralValidation.ts`, `flowStructuralChoiceIssues.ts`, `flowStructuralCoreIssues.ts`, `flowStructuralValidationContext.ts`.
- `scripts/content-agent/contentValidation.ts`.

Notable facade details:

- `src/dev-dashboard/flows/flowValidation.ts` is a thin adapter (not just a re-export) because `src/dev-dashboard/flows/__tests__/flowValidation.test.ts` mocks `src/domain/flow-engine/validateFlow` to inject an unmapped structural message. Core `validateDashboardFlows` accepts an optional `validateFlowImpl` (defaulting to the canonical core validator); the adapter feeds the package's own validateFlow seam, keeping that existing test green unchanged. This is the only facade with logic beyond re-export.
- Core `contactsValidation` inlines a private copy of the one-line `normalizePhoneHref` helper and core `educationValidation` uses the DOM-free `isImageDataUrl` twin, because `contactDrafts.ts` / `components/fileUpload.ts` are not owned paths.

## Notes for MERGE-03 / change control (no action required now)

- `contracts/errors.ts` declares a structural twin of `SemanticConflict`/`ValueSlot`/`ContentPath`/`PathSegment` (frozen in `semanticDiff.ts`) and `digest.ts` a verbatim twin of `contentIdentity`, because `src/dev-dashboard/publishing/semanticDiff.ts` is MERGE-03-owned and core cannot import `src/`. Both are marked in-code; when MERGE-03 lands `content-reconciliation/`, the twins should be re-pointed to the canonical module (MERGE-03 owns `index.ts`; a small change-control note covers `contracts/errors.ts`/`digest.ts` imports if needed).

## Commands executed (exact results)

| Command                                                      | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`                                         | PASS, exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm run lint`                                              | PASS, exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm run format` (owned files) then `pnpm run format:check` | PASS — "All matched files use Prettier code style!"                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `pnpm run check:architecture`                                | PASS — "Architecture check passed (429 source files)." (was 390 at base; +39 core files, no new baseline entries)                                                                                                                                                                                                                                                                                                                                                          |
| `pnpm run test:unit -- packages/content-core`                | PASS — **112 test files, 933 tests passed** (the runner executes the full credential-free suite; this includes the 3 new core test files — 26 new tests — and the existing publication/flow/contact/education/content-agent validation suites run unchanged: `src/app/content/__tests__/publishedContent.test.ts`, `src/dev-dashboard/flows/__tests__/flowValidation.test.ts`, contacts/education validation tests, `scripts/content-agent`-related suites; 907→933 = +26) |
| `pnpm run validate:flows`                                    | PASS — "Flow/content validation passed for 8 flow(s)."                                                                                                                                                                                                                                                                                                                                                                                                                     |

One transient failure during development was fixed before final evidence: the existing `flowValidation.test.ts` mock seam (see facade note above) and an over-strict assertion in the new owned `inspectContent.test.ts` (empty locations legitimately produce the deterministic `no-locations` warning).

## Deferred gates and owners

- `pnpm run check` full-green — blocked only by Prettier formatting of the 18 pre-existing revision-8 dossier markdown files (documented in INTEGRATION-00 handoff; documentation hygiene, outside this task's allowlist). All code gates were run individually and pass.
- `check:db` / MCP package gates — unchanged, owned by DB-04 / MCP-01 / MCP-04.

## Downstream unblocked

- **MERGE-02** (operations, images, conformance fixtures) can start from this state.
