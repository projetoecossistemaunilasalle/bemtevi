# File Workflow And AI Presentation Tasks

**Specification revision: 8.** Export/connection repository interfaces and factories are feature-owned; authenticated Neon composition is INTEGRATION-01-owned.

Read 05, 14, 15 and 16. Service repository interfaces/factories are feature-owned. No task in this file edits `src/app/neon/database.ts`, constructs the application Neon client, or owns route/tab composition.

## AI-FILE-01: Durable Archive Roundtrip

**Depends:** MERGE-03. **Unblocks:** AI-FILE-02.

**Owned production paths:**

- `src/dev-dashboard/ai/files/exportRepository.ts`
- `src/dev-dashboard/ai/files/createEditorialArchive.ts`
- `src/dev-dashboard/ai/files/parseEditorialArchive.ts`
- `src/dev-dashboard/ai/files/zipBounds.ts`
- `src/dev-dashboard/ai/files/archiveInstructions.ts`
- `src/dev-dashboard/ai/files/importEditorialOperations.ts`
- `src/dev-dashboard/ai/aiArchive.ts` — compatibility facade only
- `src/dev-dashboard/ai/aiPrompts.ts` — compatibility facade only

**Owned tests:**

- `src/dev-dashboard/ai/files/__tests__/**`
- `src/dev-dashboard/ai/__tests__/aiPrompts.test.ts`
- new `src/dev-dashboard/ai/__tests__/aiArchiveV2Compatibility.test.ts`

`exportRepository.ts` owns `ExportRepository`, its narrow `ExportRpcTransport` structural interface and `createExportRepository(transport)`. It maps only the fixed export RPCs/parameters from 15/16 and is tested with fakes. It MUST NOT import `src/app/neon/database.ts`, `BemTeViNeonClient`, `defaultNeonClient`, construct a Neon client, or use `any`/double-cast escapes. INTEGRATION-01 supplies the typed authenticated transport later.

Implement the exact filenames, manifest, selection and image references in 14. Export base comes from server capture. Import retrieves the owner base and checks export ID, digest and generation; never substitute latest draft. Return candidate/diff/issues to the caller with no hidden mutation. ZIP processing performs central-directory preflight before JSZip and bounded actual extraction afterwards; reject every unsupported root or feature listed in 14.

Compatibility facades may re-export or adapt V2 file helpers for currently compiled callers, but MUST NOT preserve the V1 whole-payload/bridge semantics. LEGACY-01 may remove a facade once its final caller is gone.

**Tests:** repository RPC name/argument/result mapping with fake transport; full/scoped export; durable cross-session base mock; wrong owner/digest/missing/expired export; V1 rejection; context not accepted as operations; JSON and image ZIP roundtrip; duplicate paths, bomb ratio/count/size bounds, encrypted/symlink/ZIP64/CRC/truncation rejection; atomic rejection; explicit no partial mutation; replayed operations reconcile to no-op.

**Commands:** common envelope plus `pnpm run test:unit -- src/dev-dashboard/ai/files src/dev-dashboard/ai/__tests__/aiPrompts.test.ts src/dev-dashboard/ai/__tests__/aiArchiveV2Compatibility.test.ts`.

**Acceptance:** `operations.json` is the sole returned operation filename; unchanged context images are read-only; returned image operations use core semantics; feature source has no application Neon client/type dependency.

## AI-FILE-02: File-First And Connections UI

**Depends:** AI-FILE-01. **Unblocks:** INTEGRATION-01.

**Owned production paths:**

- `src/dev-dashboard/ai/AiArchiveSection.tsx`
- new `src/dev-dashboard/ai/AiFileArchiveSection.tsx`
- new `src/dev-dashboard/ai/connections/connectionRepository.ts`
- new `src/dev-dashboard/ai/connections/ConnectedAssistantsSection.tsx`
- new `src/dev-dashboard/ai/connections/ConnectionCreateDialog.tsx`
- new `src/dev-dashboard/ai/connections/ConnectionList.tsx`
- new `src/dev-dashboard/ai/connections/connectionConfig.ts`

**Owned tests:**

- new `src/dev-dashboard/ai/__tests__/AiArchiveSection.test.tsx`
- new `src/dev-dashboard/ai/__tests__/AiFileArchiveSection.test.tsx`
- `src/dev-dashboard/ai/connections/__tests__/**`

`connectionRepository.ts` owns `ConnectionRepository`, a narrow `ConnectionRpcTransport` structural interface and `createConnectionRepository(transport)`. It implements exact create/list/revoke mapping from 16 using fakes. It MUST NOT import/cast the app Neon client or handwritten Database types. INTEGRATION-01 instantiates it with the typed authenticated client.

`AiFileArchiveSection` receives exactly `{draft: ContentDraft, flush: () => Promise<boolean>, applyCandidate: (base, candidate) => Promise<boolean>, exportRepository: ExportRepository}`. `ConnectedAssistantsSection` receives exactly `{repository: ConnectionRepository, authUrl: string, dataApiUrl: string}`. `AiArchiveSection` is presentation composition only: ChatGPT/file path first, connected assistants second. It does not own route state, authenticated Neon composition, or the V2/legacy feature switch. By the end of AI-FILE-02 it MUST NOT import `aiArchive.ts`, `aiPrompts.ts`, `aiOperations.ts`, `DirectAgentSection.tsx`, `McpDraftSection.tsx`, `agentBridge.ts`, `agentSetup.ts`, `aiDraft.ts`, or `draft-sync/**`; those remain only for the still-flagged legacy branch until LEGACY-01.

Implement preview/apply/validation/error states, clean-flush requirement, one-time configuration generation with Web Crypto, disclosure, expiry and revocation states. Use existing components/design tokens and PT-BR UI strings. Generated configuration exists only in explicit component state for the disclosure action, is cleared on close/unmount, and is never cached. New UI contains no bridge/sync/project-clone instructions. Old modules are deleted only in LEGACY-01.

**Tests:** repository RPC mapping with fake transport; file section rendered before connected section; no clone/project-login instructions; export/apply blocked when dirty flush fails; preview before apply; token not regenerated on rerender; raw token absent from storage/logs/list responses; close clears secret; same UUID retained for ambiguous create retry; list/revoke behavior; no publish toggle/switch.

**Commands:** common envelope plus `pnpm run test:unit -- src/dev-dashboard/ai/__tests__/AiArchiveSection.test.tsx src/dev-dashboard/ai/__tests__/AiFileArchiveSection.test.tsx src/dev-dashboard/ai/connections`.

**Acceptance:** zero-setup flow is first and actionable; portable MCP JSON matches 04 exactly including `BEMTEVI_AUTH_URL` and exact package pin; no application Neon client import or type escape in feature source.
