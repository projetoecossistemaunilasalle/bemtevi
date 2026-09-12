# Stage 0 Readiness Audit

**Date:** 2026-09-10. **Specification revision:** 5. **Result:** decision-complete for implementation; not a claim that V2 code or deployment gates already pass.

## Repository Evidence

Audited checkout HEAD `0c43118f6d982e1ba7a729d6b6a90c582402d8d3`. The dossier was untracked at start. Preexisting unrelated changes: `docs/superpowers/plans/2026-05-16-json-flow-srq20.md`, `src/content/resources/generated-resources.ts`, `src/content/resources/resources.ts`. Preserve them; no V2 implementation task owns them.

| Finding                                                          | Evidence                                                                                      | Frozen consequence                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Frontend already uses Auth + Data API directly                   | src/app/neon/client.ts; SDK 0.6.2-beta                                                        | Reuse object-form client, no backend or SDK upgrade                                                     |
| Public/anonymous queries obtain anonymous JWT                    | SDK allowAnonymous:true; official access-control docs; successful read-only live query        | MCP config needs BEMTEVI_AUTH_URL; anonymous gateway JWT is not admin auth                              |
| Live content differs from bundle                                 | Live read: revision 50, 2,232,870 compact payload bytes; bundle revision 40, 2,208,625 bytes  | Initialize from Neon, never bundled snapshot; record measurements, do not content:pull during spec work |
| Bundle includes image-heavy content                              | 8 flows, 17 materials, 3 groups, 41 contacts, 6 locations in fallback                         | Item field patches, payload-free head/save responses; bounded body replacement tradeoff                 |
| SQL current publication still grants direct admin writes         | 20260715000000_published_content.sql                                                          | Separate late cutover revoke migration; no early privilege removal                                      |
| History uses BEFORE UPDATE trigger                               | 20260826000000_published_content_history.sql                                                  | Add connection column to current/history and amend OLD-copy trigger; no duplicate history insert        |
| Database types are handwritten and incomplete for history        | src/app/neon/database.ts                                                                      | Integration owner updates them, no invented generation command                                          |
| Browser workspace is currently canonical and session-local       | draft-storage/useDraftWorkspace.ts, workspace.ts, draftDb.ts                                  | Explicit read-only recovery adapter and principal/tab cache; no silent generation reuse                 |
| Existing merge already handles identity/order/fingerprints       | publishing/semanticDiff.ts and tests, mergePublishedContent.ts                                | Extract unchanged, preserve describePath name and exact conflicts                                       |
| Existing AI schema is 1.0.0 with baseRevision and no image edits | ai/aiOperations.ts                                                                            | Separate V2 2.0.0 envelope; explicit image/scalar/order/unset operations                                |
| AI archive copy contradicts parser                               | AiArchiveSection.tsx requests data.json in one tip while aiArchive.ts imports operations.json | Exact context.json export and operations.json import, strict root names                                 |
| AiFileArchiveSection.tsx does not exist                          | Source file inventory                                                                         | Create it, do not assign an edit to nonexistent code                                                    |
| Existing published validator normalizes data                     | app/content/publishedContent.ts parse/validate path                                           | No hidden normalization in draft save or pinned publication                                             |
| Current local server combines many concerns                      | scripts/content-agent/server.ts, 1213 lines                                                   | Standalone package split by responsibility, remove old tree last                                        |
| Existing root runner ignores focused test args                   | scripts/run-project-command.mjs                                                               | INTEGRATION-00 adds explicit test:unit forwarding and package/live configs                              |

The live read used only the existing public Auth/Data API endpoints and anonymous SDK configuration. It did not mutate content, query admin secrets, create a connection, apply a migration, or provision a branch. Current live revisions may advance after this audit; implementations must query them, never hard-code 50.

## External Verification

Consulted current official sources and package metadata during this pass:

- [Neon access control](https://neon.com/docs/data-api/access-control): anonymous/authenticated roles, RLS/grants and anonymous JWT acquisition. Retrieved its `.md` form with HTTPS when web rendering failed.
- [Neon JavaScript SDK](https://neon.com/docs/reference/javascript-sdk): existing 0.6.2-beta requires object-form initialization; Auth and RPC transport remain separate from capability authority.
- [Neon branch CLI](https://neon.com/docs/cli/branches), [Data API CLI](https://neon.com/docs/cli/data-api), [environment CLI](https://neon.com/docs/cli/env): disposable branch, explicit branch targeting, schema refresh and test-only environment extraction.
- [MCP v2 stdio](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio.html), [legacy compatibility](https://ts.sdk.modelcontextprotocol.io/v2/serving/legacy-clients.html), [server API](https://ts.sdk.modelcontextprotocol.io/v2/api/@modelcontextprotocol/server/server/mcp.html): factory-based serveStdio, server instructions, modern discovery versus legacy initialization. No handwritten protocol negotiation.
- npm metadata verified `@modelcontextprotocol/server@2.0.0` exists and requires Node >=20; development pins `neon@4.14.6`, `esbuild@0.25.12`, `pg@8.16.3` exist. Runtime Neon SDK is already installed at 0.6.2-beta.

Documentation establishes platform contracts, not live proof of new grants. Actual capability RPCs/migrations do not exist yet; their required disposable-Neon test is DB-04. This distinction prevents a documentation readiness marker being misread as security certification.

## Decisions Closed

- Exact singleton table schema, actor/principal split, checks, indexes, API-role grants and private helper boundary.
- Exactly 16 public RPCs, fixed argument/result/error shapes, no imagined list/image SQL APIs, no direct table draft writes.
- SHA-256 token hashing over decoded bytes; persistence digest over PostgreSQL canonical text with verifiable text returned for snapshots. Ambiguous writes compare semantic candidate equality, not incompatible serializers.
- No-op behavior, counter overflow, one automatic retry, preservation of edits typed during a merged save, conflict-decision invalidation and offline recovery.
- One shared publication preparation protocol for admin and MCP, replay after successful preparation expiry, current capability checks on replay, transaction lock order, history attribution and late privilege revocation.
- V2 operation version, explicit unset/order/defaultGroupOrder/image semantics, field-patch transfer strategy, image legacy compatibility and atomic bounded ZIP handling.
- Durable owner/scoped export bases, concurrent pruning, same-admin cross-device import and failure instead of guessed bases.
- Exact standalone SDK/package/config pins, missing Auth URL, bounded read projections/cache/tools, shipped intent instructions and packed release smoke.
- 23 task IDs with dependencies/owned paths/tests/acceptance, one exclusive hot-file owner, serial weak-model execution path, baseline of existing oversized files.

## Readiness Versus Release Prerequisites

Gate S passes once dossier format/link/task consistency checks pass and README is marked ready. No task must choose storage, protocol, SQL schema, auth role, retry policy, image semantics or ownership.

Implementation still must obtain ordinary operational prerequisites: a sanitized Neon test parent with test accounts and protected CI credentials, npm scope release access, and owner approval for production deploy/npm publish. These have named owners (DB-04, MCP-04, INTEGRATION-03), commands and fail-closed acceptance. Their absence blocks deployment evidence, not design completeness. Never skip those tests or silently change package name/trust model.

The only implementation freedom is private helper decomposition inside owned new subtrees, private identifiers and existing-system styling/non-frozen PT-BR explanatory copy. It cannot alter public contracts or acceptance behavior. Meaningful editorial merge choices still belong to the user, not the implementation model.

No production code, database state, generated content or root tooling was changed in this specification-hardening pass. No commit, push, npm publication or production deployment is part of this pass.

## Verification Results

- Dossier Prettier check passes. Relative-link check found no broken links across 27 Markdown files; task check found 23 unique task IDs, required acceptance/test/dependency sections and no unknown prerequisite IDs. All 37 frozen oversized-file counts match the audited checkout.
- `pnpm run check` passed typecheck, lint, repository formatting and validation of eight flows, then failed tests: 839 passed, nine failed across two untouched suites. Eight failures are education resource/content expectation mismatches in `src/features/education/__tests__/EducationScreens.test.tsx`; one is a five-second timeout in `scripts/content-agent/__tests__/syncServer.test.ts`. This is the current dirty-checkout result, not a claim those failures were introduced by V2 docs or a verified diagnosis of their cause.
- `pnpm run build` passed separately, with existing large-chunk warnings. No push was performed because the complete local gate is not green.
- The legacy sync test passed when rerun alone through the Vitest CLI; the full-suite timeout remains recorded rather than treated as a proven permanent defect. The eight education expectation failures still require baseline triage.
- Implementation agents must report this baseline and distinguish new regressions from these untouched tests; do not delete tests, restore unrelated content changes, or loosen assertions simply to obtain green. Ordinary baseline repair requires its own appropriately scoped work before push. Gate S is documentation readiness, not Gate A/B/C or a waiver of any implementation quality gate.
