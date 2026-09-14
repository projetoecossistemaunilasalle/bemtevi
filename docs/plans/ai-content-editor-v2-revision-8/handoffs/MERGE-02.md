# MERGE-02 Handoff — Operations, Images And Conformance Fixtures

**Task ID:** MERGE-02 (revision 8 dossier)
**Starting HEAD:** `e030264786ae7010aac7832203244882d12f9265` (equals audited base; working tree contained the pre-existing revision-8 dossier docs migration and MERGE-01's uncommitted core/facade changes — preserved untouched)
**Ending HEAD:** `e030264786ae7010aac7832203244882d12f9265` (no commits made; all changes in working tree)

## Preflight / drift gate

- `git rev-parse HEAD` = audited base; no drift-gate stop. MERGE-01 artifacts were adopted as found (models, validation, contracts, digest, facades).

## File inventory

**Created (owned core paths):**

- `packages/content-core/src/operations/allowlists.ts` — literal `ADD_ALLOWED_KEYS` / `UPDATE_PATCH_ALLOWED_KEYS` / `UPDATE_UNSET_ALLOWED_KEYS` per scope (exact doc-14 lists, frozen data in code — never derived from the V1 `ITEM_KEYS` or optional TS properties), plus bounds constants (batch 1..200, 8 MiB, notes 20×500, IDs ≤200 code points, depth 150, prototype keys, counter bound, image bounds).
- `packages/content-core/src/operations/jsonChecks.ts` — JSON-purity checks (finite numbers, depth ≤150, `__proto__`/`constructor`/`prototype` rejection), ID/counter validators, `OperationFailure`/`OpResult` (structurally assignable to the frozen `Result<T>`; `message` is internal-only).
- `packages/content-core/src/operations/imageValues.ts` — `ImageSlot`/`ImageValue` parsing: strict padded canonical base64 (decode + re-encode match) ≤1 MiB decoded, fileName 1..120 without separators/control chars, alt ≤500, catalog IDs restricted to `FEATURED_IMAGE_IDS`, external HTTPS-only without userinfo/ports ≤2048.
- `packages/content-core/src/operations/parseOperations.ts` — `parseOperationsEnvelope(input): OpResult<EditorialEnvelope>` (string or object input; 8 MiB check; exact envelope/selfCheck keys; all four flags; 1..200 operations) and `parseEditorialOperation` for the discriminated union with literal allowlists, patch/unset overlap, distinct unset, empty-update rejection, reorder distinct-ID validation and `set_default_group_order` safe-integer bound. Non-`2.0.0` schema → `unsupported_schema` (V1 rejection).
- `packages/content-core/src/operations/protectedImages.ts` — generic-operation protected slot rules: material add body image blocks must omit `imageUrl`/`imageFileName`/`alt`; retained body image blocks must keep those three fields JSON-equal; flow adds must not introduce `visuals`; flow `nodes` patches must preserve retained-node `visuals` arrays JSON-equally (presence, order, IDs, `src`, `alt`).
- `packages/content-core/src/operations/materialImageSlots.ts` — the specialized image contract (`set_material_image` only): featured uploaded→dataUrl/fileName/alt, catalog, external, remove deletes the field; legacy slot requires `alt: ''`, uploaded sets `imageUrl`+`imageFileName`, external sets `imageUrl` and deletes `imageFileName`, remove deletes both; body target must already exist with `kind: 'image'`, sets/clears exactly the three fields, no implicit block creation; uploaded bytes go through `images/inspectImage`.
- `packages/content-core/src/operations/applyOperations.ts` — `applyOperations(base, operations): Result<PublishedContentPayload>`; validates base structure, clones, applies sequentially (add unique-ID, update shallow patch + unset, delete confirmed, reorder exact permutation, scalar, image ops), re-parses each op through the same parser (single authority), final 5 MiB bound; never normalizes or semantically repairs.
- `packages/content-core/src/operations/encodeOperations.ts` — `encodeOperations(base, candidate): Result<EditorialOperation[]>`; unchanged candidate → `[]`; order per doc 14 (deletes, adds, non-image field updates, image changes, reorders, scalar); adds filtered to the literal add allowlist (protected image data in new items → `invalid_operations`); title-only changes emit only the changed field; retained image-slot changes emit only `set_material_image`; flow visuals changes → `invalid_operations`; >200 ops or >8 MiB → `invalid_operations`.
- `packages/content-core/src/images/base64.ts` — `decodeStrictBase64` (canonical padded standard base64 with re-encode match and zero trailing bits) and `parseImageDataUrl`.
- `packages/content-core/src/images/inspectImage.ts` — bounded container-header validation: PNG signature/IHDR + bounded chunk scan rejecting `acTL`; JPEG SOI, length-bounded marker scan through SOF0/SOF1/SOF2 (other SOF rejected), requires EOI; WebP RIFF/WEBP bounds with VP8/VP8L/VP8X dimensions, rejecting animation bit/ANIM/ANMF; dimensions 1..4096 each, product ≤16,000,000.
- `packages/content-core/src/fixtures/basePayload.ts` — deterministic base payload: flow with `visuals`/`videos`/all add keys; material with every editable field plus legacy `imageUrl`/`imageFileName` and catalog `featuredImage`; group with `description`; contact with every optional field; location; `defaultGroupOrder`; fixture constants (exportId UUID, generation 7, 64-hex digest, 1×1 PNG).
- `packages/content-core/src/fixtures/invalidStates.ts` — representative semantic-invalid states (add existing ID, update/delete missing ID, reorder not a permutation, material image-block change, flow visuals edit, missing body block).
- `packages/content-core/src/fixtures/conformanceFixtures.ts` — add values covering the complete literal allowlist per scope; unset operations covering every unset key per scope (`locations: []`); image-action fixtures for every action (uploaded/catalog/external/remove) on every slot (featured/legacy/body); accepted no-op; stale-generation envelope; `buildFixtureEnvelope`; `serializeConformanceFixtures()` (byte-stable JSON of all fixtures).
- `packages/content-core/src/__tests__/operations.test.ts`, `images.test.ts`, `conformanceFixtures.test.ts` (details below).

**Modified (owned):** `packages/content-core/src/index.ts` (named re-exports of operations/images/fixtures; no `export *`), `src/dev-dashboard/ai/aiOperations.ts` (V1 kept fully working for current callers plus clearly named `parseAiOperationsResponseV1`/`applyAiOperationsV1` adapters; V2 routed through `@bemtevi/content-core` re-exports `parseOperationsEnvelope`/`applyEditorialOperations`/`encodeEditorialOperations`), `src/dev-dashboard/ai/__tests__/aiOperations.test.ts` (new test: V1 envelope rejected by V2 parser with `unsupported_schema`; V2 envelope rejected by the V1 parser).

## Tests (all in owned files)

- operations.test.ts: exact parse/encode/apply roundtrip (add/update/unset/delete/reorder/scalar); every literal add/patch/unset allowlist per scope; protected image keys and `locations` empty-unset rejection; unknown/prototype keys, non-finite numbers, unknown ops; patch/unset overlap, duplicate unset, empty update; delete confirmation; reorder permutation; envelope keys, bad digest, empty/oversized batch, selfCheck/notes bounds; V1 → `unsupported_schema`; no-op accepted; title-only update omits unchanged body/image fields; image slot preservation; visuals unrepresentable; >200 encoded ops rejected.
- images.test.ts: strict base64 (canonical, unpadded, whitespace, URL-safe, non-canonical trailing bits); PNG/IHDR bounds and `acTL`; JPEG SOF0/1/2 with unsupported-SOF and EOI requirements; WebP VP8/VP8L/VP8X dimensions and animation rejection; image value contract (uploaded metadata/size bounds, catalog allowlist, external HTTPS/userinfo/2048, invalid slots); every fixture image action applied and mapped to the correct slot; legacy `alt` restriction; catalog on body rejected; missing/non-image body block rejected.
- conformanceFixtures.test.ts: byte-stable serialization and roundtrip; valid envelope against fixture generation; base payload contains every editable/unsettable field; add fixtures exactly equal the literal allowlist; unset fixtures exactly cover the unset allowlist; image actions cover every slot×action; no-op byte-equality; stale envelope; every semantic-invalid state rejected.
- aiOperations.test.ts (owned compatibility): pre-existing V1 tests unchanged and green, plus V1↔V2 parser distinctness.

## Commands executed (exact results)

| Command                                                                                           | Result                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run typecheck`                                                                              | PASS, exit 0                                                                                                                                                                                                |
| `pnpm run lint`                                                                                   | PASS, exit 0 (0 errors, 0 warnings after fixes)                                                                                                                                                             |
| `pnpm run format` then `pnpm run format:check`                                                    | PASS — "All matched files use Prettier code style!"                                                                                                                                                         |
| `pnpm run check:architecture`                                                                     | PASS — "Architecture check passed (445 source files)." (no new baseline entries; largest new file 299 lines)                                                                                                |
| `pnpm run test:unit -- packages/content-core src/dev-dashboard/ai/__tests__/aiOperations.test.ts` | PASS — **115 test files, 984 tests passed** (runner executes the full credential-free suite; MERGE-01 was 112 files/933 tests; +3 new core test files, +51 tests, including the 5-test compatibility suite) |
| `pnpm run validate:flows`                                                                         | PASS — "Flow/content validation passed for 8 flow(s)."                                                                                                                                                      |

## Notes / issues found during implementation

- Root `tsconfig.json` does not enable `strictNullChecks`, so boolean-discriminant narrowing via truthiness (`if (!r.ok)`) does not narrow; all operation-result narrowing uses explicit `=== false` comparisons.
- `contracts/operations.ts`/`contracts/drafts.ts` types are consumed exactly as frozen from MERGE-01; the `EditorialEnvelope` "number/string instead of Counter/Digest aliases" alignment was unnecessary because `Counter`/`Digest` are themselves `number`/`string` aliases — the structural shape is identical and no owned file needed changing.
- Per doc 14, `applyOperations` checks structural validity and final bounds only; full strict publication validation remains publication-side and semantic issues remain `inspectContent`'s domain.

## Deferred gates and owners

- `pnpm run check` full-green is blocked only by Prettier formatting of the pre-existing revision-8 dossier markdown files (documented in INTEGRATION-00/MERGE-01 handoffs); all code gates above pass individually.
- `check:db` and MCP package gates — unchanged, owned by DB-04 / MCP-01 / MCP-04.

## Downstream unblocked

- **DB-01** (draft persistence RPCs) can consume the frozen operation/envelope contracts and fixtures from `@bemtevi/content-core`.
- **MERGE-03** (semantic reconciliation) can start.
