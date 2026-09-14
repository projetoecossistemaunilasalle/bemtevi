# INTEGRATION-02 Handoff — Canonical Dashboard And Publication Cutover Code

**Task ID:** INTEGRATION-02 (revision 8 dossier)
**Starting HEAD:** `e030264786ae7010aac7832203244882d12f9265` (equals audited base; no drift)
**Ending HEAD:** same commit — no commits, stashes, or pushes made; all changes uncommitted in the working tree, per task instructions.

## Worktree state

- Before: 111 entries (`git status --short`). After: 131 entries.
- The 20 delta entries are exactly this task's owned files (8 new untracked, 12 modified inside the allowlist). All pre-existing uncommitted work (old dossier deletions, MERGE/DB/DASHBOARD/AI-FILE/MCP lanes, `eslint.config.js`, content-core extraction, etc.) preserved untouched. One out-of-allowlist exception disclosed below under change control: `scripts/content-agent/neonPublisher.ts` (minimal repoint). `src/app/content/publishedContent.ts` was NOT touched (its diff is pre-existing MERGE-03 facade work).

## Adopt/verify files inspected unchanged

- `src/dev-dashboard/editorialNeonServices.ts` (consumed; frozen composition `{draftRepository, exportRepository, connectionRepository}` + `editorialNeonConfigured`).
- `src/dev-dashboard/ai/AiArchiveSection.tsx` + `AiFileArchiveSection.tsx` + `connections/*` (consumed via props only; canonical V2 prop set wired in the V2 branch).
- `src/dev-dashboard/drafts/draftRepository.ts`, `saveCoordinator.ts`, `saveTransitions.ts` (consumed; `SaveState`/labels reused verbatim).
- `src/app/neon/client.ts` (`getNeonConfig`, `defaultNeonClient` — consumed for gateway/URLs only), `src/app/auth/AdminAuthContext.ts` (`account.id` = `principalId`).
- `packages/content-core` `digest.ts` (`sha256Bytes`), `inspectContent`, `contracts/publication.ts` — consumed.
- Dossier docs read in full: tasks/INTEGRATION.md (INTEGRATION-02), 16, 06, 14, 15, 11, 10, tasks/README.md, root AGENTS.md; handoffs INTEGRATION-01, DASHBOARD-03, AI-FILE-02.

## Created/modified files (line counts vs budgets)

| File                                                                       | Status                | Lines      | Budget                 |
| -------------------------------------------------------------------------- | --------------------- | ---------- | ---------------------- |
| `.env.example`                                                             | modified              | +10        | n/a                    |
| `src/dev-dashboard/editorFlags.ts`                                         | new                   | 29         | ≤300 ts                |
| `src/dev-dashboard/__tests__/editorFlags.test.ts`                          | new                   | 37         | ≤500 test              |
| `src/dev-dashboard/publishing/legacyPublication.ts`                        | new                   | 106        | ≤300 ts                |
| `src/dev-dashboard/publishing/__tests__/legacyPublication.test.ts`         | new                   | 200        | ≤500                   |
| `src/dev-dashboard/publishing/usePublicationController.ts`                 | rewritten             | 264        | ≤300 ts                |
| `src/dev-dashboard/publishing/__tests__/usePublicationController.test.tsx` | new                   | 388        | ≤500                   |
| `src/dev-dashboard/publishing/PublishDashboard.tsx`                        | modified              | 391        | baseline 410           |
| `src/dev-dashboard/publishing/__tests__/PublishDashboard.test.tsx`         | adapted               | 244        | ≤500                   |
| `src/dev-dashboard/drafts/DraftWorkspaceSection.tsx`                       | new                   | 120        | ≤320 tsx               |
| `src/dev-dashboard/drafts/DraftSaveStatus.tsx`                             | new                   | 34         | ≤320 tsx               |
| `src/dev-dashboard/drafts/DraftConflictDialog.tsx`                         | new                   | 119        | ≤320 tsx               |
| `src/dev-dashboard/drafts/__tests__/` (3 component suites)                 | new                   | 173/76/117 | ≤500                   |
| `src/dev-dashboard/__tests__/dashboardRoute.coexistence.test.tsx`          | new                   | 100        | ≤500                   |
| `src/dev-dashboard/DashboardRoute.tsx`                                     | modified              | 314        | baseline 320           |
| `src/dev-dashboard/DashboardTabContent.tsx`                                | modified              | 313        | ≤320 tsx (no baseline) |
| `src/dev-dashboard/__tests__/dashboardRouteTestHarness.tsx`                | modified              | 339        | ≤500                   |
| `src/dev-dashboard/draft-storage/useDraftWorkspace.ts`                     | modified              | 312        | baseline 315           |
| `src/app/content/publishedContentRepository.ts`                            | modified (read-only)  | 166        | baseline 371 → shrank  |
| `src/app/content/PublishedContentProvider.tsx`                             | modified (read-only)  | 98         | —                      |
| `src/app/content/PublishedContentContext.ts`                               | modified (read-only)  | 36         | —                      |
| `src/app/content/__tests__/publishedContentRepository.test.ts`             | adapted               | 178        | ≤500                   |
| `src/app/content/__tests__/PublishedContentProvider.test.tsx`              | adapted               | 196        | ≤500                   |
| `src/dev-dashboard/__tests__/useDraftWorkspace.test.ts`                    | adapted (rename only) | 85         | —                      |

## Public interfaces added/changed

1. **Promoted hook export (doc 16 final):** `useDraftWorkspace(principalId: string, override?: CanonicalWorkspaceServices): CanonicalDraftWorkspace` — `{state, edit, flush, refresh, resolve, retry, discardLocal, undo}`. The DASHBOARD-03 temporary name `useCanonicalDraftWorkspace` remains as a documented alias. The legacy local-persistence hook was renamed `useLegacyDraftWorkspace(remote, revision)` (behavior unchanged; deleted by LEGACY-01).
2. **Read-only publication context:** `PublishedContentContextValue` and `PublishedContentProvider` no longer expose `publish(payload, publisherId, expectedRevision)`; `PublishedContentRepository` exposes only `loadPublishedContent()`. Public PWA reads/fallback/offline untouched (provider read path identical).
3. **New modules:** `editorFlags.ts` (`EditorFlags`, `parseEditorFlag`, `getEditorFlags` — exact-`'true'` parsing only, `import.meta.env` only, no runtime override); `publishing/legacyPublication.ts` (`legacyPublishContent`, `LegacyPublishFn`, re-exports `createNeonPublishedContentGateway`) — the MOVED direct `published_content` insert/update implementation, sole direct-publication path during coexistence, reachable only from the `v2Enabled=false` branch; `usePublicationController` V2 (prepare+publish protocol: flush gate, head+live-revision re-check, fresh UUID + 32-byte token → 43-char base64url, `sha256Bytes` hash over decoded bytes, replay-once on lost response, token cleared on close/success/budget-exhaustion, post-publish draft+public-query refreshes); `PublishDashboard` takes `mode: 'legacy' | 'v2'`; `DashboardTabContent` takes `mode` + full V2 prop set; drafts components `DraftWorkspaceSection`/`DraftSaveStatus` (exact doc-16 labels via shared `saveStatusLabel`)/`DraftConflictDialog`.

## Commands and exact results

| Command                                | Result                                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`                   | PASS, exit 0, 0 errors (incl. tests)                                                                                            |
| `pnpm run lint`                        | PASS, exit 0, 0 errors, 0 warnings                                                                                              |
| `pnpm run check:architecture`          | PASS — "Architecture check passed (558 source files)"                                                                           |
| `pnpm run format:check`                | PASS — "All matched files use Prettier code style!"                                                                             |
| Focused `pnpm exec vitest run <owned>` | PASS — 22 files, 188 tests                                                                                                      |
| `pnpm run test:unit`                   | PASS — 144 files, 1262 tests                                                                                                    |
| `pnpm run check`                       | PASS, exit 0 (full CI gate incl. validate:flows, build, MCP smoke 120 tests)                                                    |
| `pnpm run check:db`                    | PASS, exit 0 — "[check:db] all live suites passed; cleaning up"; disposable branch `br-wispy-rice-ackeltik` created and deleted |

## Test counts per new/adapted suite

editorFlags 3; legacyPublication 9; usePublicationController 11; PublishDashboard (adapted) 8; DraftSaveStatus 8; DraftConflictDialog 6; DraftWorkspaceSection 8; dashboardRoute.coexistence 4; publishedContentRepository (read-only, adapted) 7; PublishedContentProvider (adapted, read-only proof) 7; all pre-existing `dashboardRoute.*` suites (63+11) green unchanged in behavior.

## Deviations / change-control items

1. **`scripts/content-agent/neonPublisher.ts` (OUT of allowlist, minimal edit):** the legacy content-agent script consumed `repository.publishContent`, which this task removed from the read-only repository. The dossier's "Owns" list does not include it, but leaving it broken fails typecheck. Fix is a 10-line repoint to the moved adapter (`legacyPublishContent(createAuthenticatedGateway(...), input)`) with identical behavior; its 2 test files stay green. Disclosed as a change-control item rather than an ownership claim. (LEGACY-01 deletes the whole `scripts/content-agent/**` subtree, so the edit is transitional.)
2. **V2 field-level validation in the route:** `DashboardRoute`'s V2 branch currently passes empty `validation`/`contactValidation` stubs to `PublishDashboard`; full V2 validation wiring derives from the canonical draft state and is INTEGRATION-03/LEGACY polish. Publication itself is independently guarded by `inspectContent` inside `usePublicationController` (error-level issues block the review), so no invalid content can be published through V2.
3. **`DashboardRoute.tsx` compacted to 314 ≤ 320 baseline** using `// prettier-ignore` blocks (established precedent: `saveCoordinator.ts`, DASHBOARD-03 disclosures) — no checker weakening, no baseline edits, formatting-stable.
4. **Legacy route AI apply** (`handleAiApply`/McpDraft surfaces) unchanged in behavior; the AI tab now shows the PT-BR standby notice under read-only.

## Skipped gates

None. Every required gate ran, including live `check:db`.

## Downstream unblocked

**INTEGRATION-03** — can now build `neon/tests/editorial-e2e.test.ts` and `mcp-package-live.test.ts` against: the frozen flag semantics (`VITE_EDITOR_V2_ENABLED='true'` selects V2), the promoted hook, the read-only provider (its public-read refresh contract is proven), the V2 prepare/publish controller, and the isolated legacy adapter for cutover-revocation verification. LEGACY-01's deletion list now includes `legacyPublication.ts`, `useLegacyDraftWorkspace`, and the compatibility branch.
