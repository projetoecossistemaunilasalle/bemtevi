# AI-FILE-01 Handoff — Durable Archive Roundtrip

**Task ID:** AI-FILE-01 (revision 8 dossier)
**Starting HEAD:** `e030264786ae7010aac7832203244882d12f9265` (equals audited base; no drift-gate stop)
**Ending HEAD:** same commit (no commits made; all changes in the working tree, per task instructions)

## Inventory (owned files created/modified)

**Created — `src/dev-dashboard/ai/files/` (V2 canonical implementation):**

- `exportRepository.ts` (211 lines) — `ExportRepository`, narrow structural `ExportRpcTransport`, `createExportRepository(transport)`: `create(exportId, expectedGeneration, selection)` → `create_content_edit_export` (`p_export_id`, `p_expected_generation`, `p_selection`) and `get(exportId)` → `get_content_edit_export` (`p_export_id`), both returning `Result<EditExport>`. Structural decoder `parseEditExport` (frozen doc-14 shape: `'current'`/`'2.0.0'`, UUID exportId, hex-64 digest, safe counters, six-field payload, `selection` null or `{scope, ids}` 1..200 unique); domain envelopes pass through (`export_base_unavailable` covers unauthorized/missing/expired per doc 15); transport mapping mirrors draftRepository (42501/401/403/PGRST301 → `unauthorized`, else `unavailable`; malformed → `unavailable`). No `src/app/neon/**` import, no client construction, no `any`/double-casts.
- `createEditorialArchive.ts` (178) — exact doc-14 roots `manifest.json`, `context.json`, `instructions.md`, optional `images/`; manifest `{schemaVersion:'2.0.0', exportId, baseGeneration, baseDigest, expiresAt, selection}`; context = whole payload for null selection, otherwise `{scope, items}` of the selected records only; embedded `data:image/*;base64` context values replaced by `images/<sha256-of-bytes>.<png|jpg|webp|gif|svg>` with existing bytes included, deduplicated by hash; external/catalog assets never downloaded. ZIP assembled with JSZip (DEFLATE).
- `parseEditorialArchive.ts` (214) — accepts plain `operations.json` (≤8 MiB) or a ZIP with root `operations.json`, optional identical `manifest.json`, and referenced `images/` files only. Rejects unsupported roots (including `context.json`/`instructions.md`/`data.json` — an export archive is never accepted as operations), subfolders under `images/`, extra directory entries, `imagePath` outside uploaded image values, and any other archive-path string. Central-directory preflight runs before JSZip; bounded actual extraction afterwards (declared/actual size match, per-entry ratio, 12 MiB total, CRC via `checkCRC32`).
- `zipBounds.ts` (185) — doc-05 archive bounds (≤8 MiB compressed, ≤12 MiB uncompressed, ≤64 entries incl. directory entries, ≤100:1 ratio) and EOCD/central-directory preflight rejecting: not-ZIP, truncation, encryption, ZIP64 markers, symlinks, duplicate normalized names, backslashes, absolute paths, dot segments; `checkInflatedEntry` bounds materialization one entry at a time.
- `archiveInstructions.ts` (100) — PT-BR `instructions.md` builder: V2 envelope format, bindings, expiry, scoped-export rules, image rules (`imagePath` on uploaded only; GIF/SVG context-only; no base64 in generic ops).
- `importEditorialOperations.ts` (193) — import orchestration: expiry checked on every attempt; verifies `sha256(canonicalPayload) === baseDigest` and `sameContent(parsed canonical, basePayload)` before using the base; checks `manifest.json` identity with the envelope; resolves ZIP `imagePath` → canonical uploaded `base64` (with `mime` preserved) before `parseOperationsEnvelope`; binds envelope `exportId`/`baseGeneration`/`baseDigest` to the retrieved owner export (never the latest draft); scoped exports reject `add`/`reorder`/`set_default_group_order` and out-of-selection targets; applies atomically via core `applyOperations` and returns `{candidate, changes (compareContent), issues (inspectContent), operationsCount}` — no hidden mutation, no partial application, replay reconciles idempotently. Frozen error codes only (`export_base_unavailable`, `invalid_input`, `invalid_operations`, parser passthrough incl. V1 → `unsupported_schema`).

**Modified — compatibility facades:**

- `src/dev-dashboard/ai/aiArchive.ts` (233) — facade: identity re-exports of the V2 helpers (`createExportRepository`, `createEditorialArchiveV2`, `parseEditorialArchiveV2`, `importEditorialOperationsV2`, `buildArchiveInstructions`, zip bounds) plus the still-compiled legacy V1 functions for the current `AiArchiveSection` caller (AI-FILE-02 removes that import; LEGACY-01 deletes the facade). No V1 whole-payload/bridge semantics are re-exported as V2 API; V1 and V2 parsers remain distinct.
- `src/dev-dashboard/ai/aiPrompts.ts` (428, baseline 432) — facade header added; the unused whole-payload prompt builder `buildFullPayloadPrompt` **removed** (V1 whole-payload semantics); archive/flow/material/contact prompts used by compiled callers retained.

**Tests (all in owned paths, 52 tests):**

- `files/__tests__/exportRepository.test.ts` (11) — exact RPC name/argument mapping with fake transport (null and object selection, get), durable cross-session identical retrieval, structural decode, domain error passthrough, transport mapping, malformed envelope/export → `unavailable`, selection validator rejections.
- `files/__tests__/zipBounds.test.ts` (14) — hand-crafted central directories (encryption/ZIP64/symlink/duplicate/unsafe paths/truncation/65 entries/ratio and size bounds; `images/` directory entry allowed and counted) plus real JSZip archives.
- `files/__tests__/createEditorialArchive.test.ts` (6) — full export roundtrip through JSZip (manifest fields, context byte-paths, stored bytes equal to source bytes, sha-named file), dedup of the same image referenced twice, scoped `{scope, items}` context, no downloads without embedded data; instructions content.
- `files/__tests__/importRoundtrip.test.ts` (15) — plain JSON and image-ZIP roundtrip (imagePath → uploaded dataUrl via core semantics), rejection of an `imagePath` image value in a plain JSON source at parse time, no-op replay with visible semantic issues, diff/candidate returned with base unmutated, V1 → `unsupported_schema`, context-not-accepted-as-operations, expired export, wrong exportId/generation/digest bindings, corrupted canonical base, manifest mismatch, missing/unreferenced images, `images/` subfolder, unsupported roots, export-archive-as-import rejection, CRC corruption, truncation, scoped rules (add/scalar/reorder/out-of-selection rejected; in-selection update accepted).
- `ai/__tests__/aiArchiveV2Compatibility.test.ts` (3) — facade identity re-exports, `buildFullPayloadPrompt` absence, V1/V2 file parser distinctness (V2 envelope never passes as V1 and vice versa).
- `ai/__tests__/aiPrompts.test.ts` — unchanged, still green (uses `buildFullPayloadPromptForArchive`/`buildFlowPrompt`).

## Commands executed (exact results, working tree at `e030264…`)

| Command                                                                                                                                                            | Result                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`                                                                                                                                               | PASS, exit 0                                                                                               |
| `pnpm run lint`                                                                                                                                                    | PASS, exit 0 (0 errors, 0 warnings)                                                                        |
| `pnpm run format:check`                                                                                                                                            | PASS — "All matched files use Prettier code style!" (after `prettier --write` on the owned files)          |
| `pnpm run check:architecture`                                                                                                                                      | PASS — "Architecture check passed (494 source files)." (all new files well within the 300-line ts budget)  |
| `pnpm run test:unit`                                                                                                                                               | PASS — 130 test files, 1150 tests passed (includes the 52 new/owned tests; runner executes the full suite) |
| `pnpm run validate:flows`                                                                                                                                          | PASS — "Flow/content validation passed for 8 flow(s)."                                                     |
| `pnpm exec vitest run src/dev-dashboard/ai/files src/dev-dashboard/ai/__tests__/aiPrompts.test.ts src/dev-dashboard/ai/__tests__/aiArchiveV2Compatibility.test.ts` | PASS — 6 files, 52 tests                                                                                   |

Note: `pnpm run test:unit -- <paths>` runs the full root suite on this runner (same observation as DASHBOARD-01); focused verification used `pnpm exec vitest run <paths>`.

## Deferred gates and owners

- `pnpm run check:db` (Gate B) — already green from DB-04; not re-run here (no DB changes).
- `pnpm run check` full build — not owned by this task; all owned-scope components green individually.
- No UI wiring, route/tab/flag composition, or authenticated transport instantiation: AI-FILE-02 owns the file/connections UI; INTEGRATION-01 registers the V2 RPCs in `src/app/neon/database.ts` and passes `defaultNeonClient` structurally into `createExportRepository`.

## Notes for downstream tasks

- **AI-FILE-02 (unblocked):** `AiFileArchiveSection` receives `exportRepository: ExportRepository` and consumes `createEditorialArchive`/`parseEditorialArchive`/`importEditorialOperations` for the PT-BR preview/diff/issues/apply flow. Import needs `{kind:'json', text}` or `{kind:'zip', bytes}` sources plus the owner export from `repository.get(exportId)`.
- The ZIP image contract for returned operations is uploaded `ImageValue` with `imagePath` **and** `mime` (the rest of the uploaded fields unchanged); resolution replaces only `imagePath` → `base64`.
- Result narrowing requires `===`/`!==` discriminant checks (repo tsconfig has no `strictNullChecks`) — followed in all owned modules.
- The fixture base payload is semantically invalid (contact phone link), so no-op imports legitimately surface `inspectContent` issues while remaining applyable — per doc 14, only publication is blocked.
- Unrelated pre-existing working-tree changes (MERGE/DB/DASHBOARD lanes, old dossier deletion) were preserved untouched.

## Review follow-ups

An independent review of the AI-FILE-01 implementation found two code follow-ups; both were fixed in the working tree (no commit), with the module contracts preserved.

1. **`imagePath` in plain JSON sources (minor bug):** For a `kind:'json'` operations source, an uploaded image value carrying `imagePath` passed `parseEditorialArchive.ts` (the reference was collected but not rejected), and `importEditorialOperations.ts`'s `resolveImagePaths` then threw a raw `Error` (no ZIP image files can exist for a JSON source) before `parseOperationsEnvelope` could reject the unknown key — the promise rejected with an exception instead of a domain error, contradicting the parser's "throws nothing" contract. Doc 14 permits `imagePath` only in ZIP imports. Fix: `collectImageReferences` now takes a `rejectReferences` flag; the `kind:'json'` path passes `true`, so any `imagePath` inside an uploaded image value is rejected at parse time with `invalid_input` and a PT-BR message pointing to ZIP imports. ZIP sources keep the previous collect-and-verify behavior. New test: `importRoundtrip.test.ts` — "rejects an imagePath image value in a plain JSON source at parse time (no throw)".
2. **Double-cast escapes (style):** Three `as unknown as` casts were removed with no behavior change and no weakened decoding:
   - `exportRepository.ts` `parseEditExport` — the `basePayload` double-cast was replaced by a structural `parsePublishedPayload` decoder (same six exact top-level payload predicates as before, now returning the decoded object directly, mirroring `draftRepository.ts` from DASHBOARD-01).
   - `exportRepository.ts` `decodeDomainError` — the `currentHead` double-cast (which only checked `generation` was a number) was replaced by a full structural `parseErrorDraftHead` decoder validating every `DraftHead` field (id `'current'`, schemaVersion `'1.0.0'`, counters, digest, updatedAt, lastActor admin/agent with principalUserId and string-or-null connectionId); malformed heads are now dropped rather than partially passed through, strictly strengthening the decode.
   - `createEditorialArchive.ts` `buildContext` — the scoped `collection` double-cast was removed; `find` results are narrowed to `Record<string, unknown>` via an `isRecord` type guard before entering `items` (the subsequent `extractEmbeddedImages` already handles arbitrary record values).
