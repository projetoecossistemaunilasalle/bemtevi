# Frozen Shared Contracts

Revision 5. This file defines the wire/domain contract; examples in concern documents are not alternative APIs. Implement these contracts before consumers. No V2 runtime source is delivered by this specification pass.

## Representation

- Content schema stays `1.0.0`. Editorial operation schema becomes `2.0.0`; reject V1 file responses with `unsupported_schema`, rather than interpreting `baseRevision` as a draft generation.
- JSON keys are case-sensitive. Reject unknown envelope/operation keys, non-finite numbers, duplicate item IDs, prototype keys (`__proto__`, `constructor`, `prototype`), and depth over 150. Never use a caller's key in dynamic SQL.
- IDs are nonempty strings of at most 200 Unicode code points. UUIDs use canonical lowercase UUID syntax. Integers crossing JSON are safe integers; database counters have upper bound `9007199254740991` and fail with `counter_exhausted` before overflow.
- All timestamps are UTC ISO-8601 strings. Wire names are camelCase; SQL columns and named RPC parameters are snake_case. RPCs return a single JSONB object, not a rowset.
- The five scopes are `flows`, `educationMaterials`, `educationGroups`, `contacts`, `locations`. `defaultGroupOrder` is the sixth, scalar, payload field. No whole-payload replacement operation exists.

## Canonical Modules And Types

`packages/content-core/src/contracts/drafts.ts` owns:

```ts
type Counter = number;
type Digest = string; // 64 lowercase hex characters
type Actor = { kind: 'admin' | 'agent'; principalUserId: string; connectionId: string | null };
interface DraftHead {
  id: 'current';
  schemaVersion: '1.0.0';
  baseRevision: Counter;
  generation: Counter;
  digest: Digest;
  updatedAt: string;
  lastActor: Actor;
}
interface ContentDraft extends DraftHead {
  status: 'active';
  payload: PublishedContentPayload;
  canonicalPayload: string;
  createdAt: string;
  createdBy: string;
}
interface DraftMutationInput {
  expectedGeneration: Counter;
  operations: EditorialOperation[];
}
interface DraftMutationResult {
  head: DraftHead;
  changed: boolean;
}
```

`PublishedContentPayload` and existing content model types are moved, not independently redefined, per the extraction map in `tasks/MERGE.md`. The type describes editable field shapes, not proof that titles, references, or flows are semantically valid. Parsing a draft runs structural checks only; public publication parsing retains existing strict validation.

`contracts/errors.ts` owns:

```ts
type ErrorCode =
  | 'unauthorized'
  | 'invalid_capability'
  | 'invalid_input'
  | 'unsupported_schema'
  | 'draft_unavailable'
  | 'published_base_unavailable'
  | 'stale_generation'
  | 'revision_conflict'
  | 'invalid_operations'
  | 'invalid_image'
  | 'payload_too_large'
  | 'validation_failed'
  | 'export_base_unavailable'
  | 'preparation_invalid'
  | 'preparation_expired'
  | 'preparation_stale'
  | 'counter_exhausted'
  | 'rebase_required'
  | 'merge_conflict'
  | 'retry_required'
  | 'rate_limited'
  | 'response_too_large'
  | 'unavailable'
  | 'not_configured';
interface EditorialError {
  code: ErrorCode;
  currentHead?: DraftHead;
  currentRevision?: Counter;
  conflicts?: SemanticConflict[];
}
type Result<T> = { ok: true; data: T } | { ok: false; error: EditorialError };
```

Return only the optional error fields defined here, never SQL messages, input bodies, tokens, or arbitrary exception details. `stale_generation` includes `currentHead`; `revision_conflict` includes `currentRevision`. Transport adapters map PostgREST `42501`/HTTP 401/403 to `unauthorized`, other unexpected failures to `unavailable`. A capability-authenticated domain failure is `invalid_capability`, indistinguishable across missing/expired/revoked/wrong-secret/removed-admin cases.

`contracts/connections.ts` owns `AgentConnection = { id, draftId: 'current', principalUserId, label, createdAt, expiresAt, revokedAt: string | null, lastUsedAt: string | null }`; all other fields are strings. No hash or secret is exposed in metadata.

`contracts/publication.ts` owns:

```ts
interface PublicationPreparation {
  preparationId: string;
  draftId: 'current';
  generation: Counter;
  expectedRevision: Counter;
  digest: Digest;
  expiresAt: string;
}
interface PublishResult {
  revision: Counter;
  publishedAt: string;
  draftGeneration: Counter;
  digest: Digest;
}
interface PrepareInput {
  generation: Counter;
  expectedRevision: Counter;
  digest: Digest;
  preparationId: string;
  tokenHash: Digest;
}
```

The caller creates preparation UUID and 32-byte random token; passes only its SHA-256 hash to prepare. Raw token remains in dashboard memory or is returned to the host by the MCP handler. `publish` accepts only preparation UUID and raw token. Replay returns the stored `PublishResult`, not the current draft head.

## Operations

`contracts/operations.ts` owns this discriminated union. `JsonRecord` contains JSON values only. Fields denoted optional are omitted, never sent as `undefined`.

```ts
type EditorialOperation =
  | { op: 'add'; scope: Scope; value: JsonRecord }
  | { op: 'update'; scope: Scope; id: string; patch: JsonRecord; unset: string[] }
  | { op: 'delete'; scope: Scope; id: string; confirmation: true }
  | { op: 'reorder'; scope: Scope; ids: string[] }
  | { op: 'set_default_group_order'; value: number }
  | { op: 'set_material_image'; materialId: string; slot: ImageSlot; image: ImageValue };
type ImageSlot = { kind: 'featured' } | { kind: 'legacy' } | { kind: 'body'; blockId: string };
type ImageValue =
  | { kind: 'uploaded'; mime: 'image/png' | 'image/jpeg' | 'image/webp'; base64: string; fileName: string; alt: string }
  | { kind: 'catalog'; imageId: string }
  | { kind: 'external'; url: string; alt: string }
  | { kind: 'remove' };
interface EditorialEnvelope {
  schemaVersion: '2.0.0';
  exportId: string;
  baseGeneration: Counter;
  baseDigest: Digest;
  operations: EditorialOperation[];
  selfCheck: {
    reviewed: true;
    noOutOfScopeChanges: true;
    noUnrequestedDeletes: true;
    noUnsupportedImagePaths: true;
    notes: string[];
  };
}
```

Operation batches contain 1..200 operations and at most 8 MiB UTF-8 JSON. Envelope selfCheck.notes contains at most 20 strings of at most 500 characters. Candidate payload must fit 5 MiB in both compact JSON and database `jsonb::text` representation; never use compressed/TOAST size. `unset` contains distinct allowed optional field names; a field cannot appear in both `patch` and `unset`. Empty patch plus empty unset is invalid. Null is a literal JSON value, not removal. Update is shallow at item-field level; nested objects/arrays supplied in patch replace that field atomically. Merge remains field-aware before encoding the final mutation.

The exact scope field allowlists are the current `ITEM_KEYS` in `aiOperations.ts` (audited revision in `17-readiness-audit.md`), with `id` excluded from update/unset. Only fields optional in the existing domain types may be unset. Add requires a unique `value.id`, appends to the collection, and preserves explicit order. Updating/deleting missing IDs or adding an existing ID fails the entire batch. Reorder requires a permutation of every ID currently in that scope at that point in the batch; no implicit deletion. Scalar order must be a finite safe integer.

Generic add/update/unset cannot introduce or alter image-bearing values. On retained materials/body IDs they must preserve `featuredImage`, `imageUrl`, `imageFileName`, and image block `alt`; new records omit those fields. Removing an entire material/block is an explicit structural deletion and removes its image. Use `set_material_image` to change/remove a retained slot. An uploaded/catalog/external image already present in the baseline is grandfathered unchanged, including existing GIF/SVG/catalog assets; restrictions apply to new image changes, not unrelated text edits. The database compares old/new protected slots to enforce this, not a blanket search for `data:` strings. `reorder` and scalar operations are allowed for all editors, not dashboard-only privileges.

`operations/applyOperations.ts` exports `applyOperations(base, operations): Result<PublishedContentPayload>`. It clones base, applies sequentially, checks structure and final bounds, and never normalizes or semantically repairs a payload. `operations/encodeOperations.ts` exports `encodeOperations(base, candidate): Result<EditorialOperation[]>`; unchanged candidates produce an empty list (caller skips RPC). Encode deletes, adds, non-image field changes, image changes, reorders, then scalar change; preserve stable scope/ID iteration order. If >200 operations or >8 MiB, return `invalid_operations` without splitting an atomic import into multiple commits.

`validation/inspectContent.ts` exports existing `inspectContent` behavior (publication validator plus dashboard flow/contact/education validators). Save stores structurally valid but semantically invalid candidates and returns validation issues separately in client UI/MCP results. Publication validation MUST NOT silently replace the canonical candidate with the validator's normalized return value. If normalization changes identity, save the normalized candidate with normal CAS first, then re-read/review/re-prepare; no publish under the old generation.

## Digest And Equality

Postgres owns the persistence digest: lowercase SHA-256 of UTF-8 `payload::text`, calculated using `pg_catalog.sha256(pg_catalog.convert_to(payload::text, 'UTF8'))`. Persist and return it with each head. Full draft/export responses also return `canonicalPayload = payload::text`. Clients verify SHA-256 of that string and semantic equality of its parsed JSON to `payload` before using a base. Do NOT hash `JSON.stringify(payload)` and expect the same digest: PostgreSQL key ordering, whitespace and numeric rendering differ.

`digest.ts` exports `sha256Text(text): Promise<Digest>` using Web Crypto, `verifySnapshot(payload, canonicalPayload, digest): Promise<boolean>`, and `sameContent(a,b): boolean` using existing `contentIdentity`. The attempted candidate after an ambiguous save is compared to a fetched payload with `sameContent`, not a fabricated client digest. All prepare digest comparisons use the server-returned, verified digest.

## Reconciliation

Preserve `JsonValue`, `ValueSlot`, `PathSegment`, `ContentPath`, `SemanticChange`, `SemanticConflict`, `ConflictDecisions`, `ComparisonResult`, and `SemanticMerge` exactly from `semanticDiff.ts`. Preserve public signatures of `assertComparable`, `contentIdentity`, `compareContent`, `reconcileContent`, and `describePath`; see extraction task. No rewriting conflict fingerprints.

`reconciliationSession.ts` exports `reconcileDraft(base: PublishedContentPayload, local: PublishedContentPayload, remote: PublishedContentPayload, decisions: ConflictDecisions = {}): Result<{ candidate: PublishedContentPayload; conflicts: SemanticConflict[] }>` as a thin adapter of `reconcileContent`. Decisions are used only for still-identical conflict IDs. An incomplete result is `merge_conflict` with conflicts; UI can call the pure reconciler for its incomplete preview, never persist it while conflicts remain. Clients encode a complete merge against the latest remote, never replay old operations directly.

## Image Mapping

- Uploaded featured -> `{kind:'uploaded', dataUrl:'data:'+mime+';base64,'+base64, fileName, alt}`. Catalog featured -> existing catalog union. External featured -> existing external union.
- Legacy uploaded -> `imageUrl` data URL plus `imageFileName`. Legacy external -> `imageUrl`, remove `imageFileName`. Legacy has no alt field; require `alt: ''` and tell the caller to use featured/body for accessible alt text. Catalog is featured-only.
- Body target must already exist with `kind:'image'`. Set `imageUrl`, `imageFileName` when uploaded, and `alt`; preserve other block fields. Remove clears only these three fields, leaving the block for further editing/validation. No implicit block creation.
- Remove featured deletes `featuredImage`; remove legacy deletes `imageUrl`/`imageFileName`. External URLs must be HTTPS without userinfo, at most 2048 characters; never fetched by the MCP or database. Catalog IDs use the existing `featuredImageIds.ts` list.
- New uploads: strict padded standard base64 with a canonical decode/re-encode match, <=1,048,576 decoded bytes, filename 1..120 characters without separators/control characters, alt <=500 characters. PNG/JPEG/WebP only. Match signature, parse dimensions, reject animation, dimensions 1..4096 each and product <=16,000,000. `4096 * 4096` therefore fails the megapixel bound.
- `images/inspectImage.ts` and SQL structural helper parse bounded container headers: PNG signature/IHDR plus bounded chunk scan rejecting `acTL`; JPEG SOI, length-bounded marker scan through SOF0/SOF1/SOF2 to dimensions, reject unsupported SOF, require EOI; WebP RIFF/WEBP length and bounded chunk scan for VP8/VP8L/VP8X dimensions, reject animation bit/ANIM/ANMF. Truncated/overflowing lengths fail. This is header/container validation, not antivirus or a claim of full codec validation. Preserve current browser upload conversion but route its output through this same validator.

## File Contract

`contracts/exports.ts` owns `EditExport = { exportId, draftId:'current', schemaVersion:'2.0.0', baseGeneration, baseDigest, publishedRevision, basePayload, canonicalPayload, createdBy, createdAt, expiresAt, selection }`. IDs/times/digests are strings, counters are numbers, payload uses the canonical type. `selection` is `null` or `{scope: Scope, ids: string[]}` (1..200 unique existing IDs).

Export ZIP roots: `manifest.json`, `context.json`, `instructions.md`, optional `images/`. Manifest is `{schemaVersion:'2.0.0', exportId, baseGeneration, baseDigest, expiresAt, selection}`. Context is the whole payload for null selection, otherwise `{scope, items}` of selected records only. Replace embedded images in context with `images/<sha256-of-bytes>.<png|jpg|webp|gif|svg>` and include their existing bytes; do not download external/catalog assets. Context is read-only, never imported as replacement content. Existing GIF/SVG may be supplied for context, not introduced by returned operations.

Import either a plain `operations.json` envelope (<=8 MiB) or a ZIP with root `operations.json`, optional identical `manifest.json`, and referenced `images/` files only. ZIP image operations use uploaded `ImageValue` with `imagePath` instead of `base64`; resolve to base64 before canonical parsing. No other archive-path field is accepted. Optional directory entry `images/` is ignored but counts toward 64 entries. Reject ZIP encryption, symlinks, ZIP64, duplicate normalized names, backslashes, absolute paths, dot segments, nesting below `images/`, missing/unreferenced image files, unsupported roots, CRC mismatch, and declared/actual size mismatch. Read central directory bounds before JSZip inflation; enforce the compressed/uncompressed/ratio limits in 05 during streaming inflation too, never only after materializing an unbounded string.

Import checks envelope exportId/generation/digest against the owner-only durable export. For scoped exports reject any operation targeting outside selection; disallow add/reorder/scalar changes in scoped exports. Apply on full exported base, inspect, show semantic diff and issues, then explicit Apply submits against current draft through reconciliation. Semantically invalid but structurally safe imports can be applied with visible issues; only publication is blocked. Expiry is checked on every import attempt; imports never consume an export row, so replay reconciles idempotently. Export and import require all existing local edits flushed first; cancel if flush/conflict/offline fails.
