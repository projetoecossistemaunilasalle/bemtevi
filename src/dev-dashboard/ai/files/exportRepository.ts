import type {
  Counter,
  Digest,
  DraftHead,
  EditExport,
  EditorialError,
  ErrorCode,
  PublishedContentPayload,
  Result,
  Scope,
} from '@bemtevi/content-core';

/**
 * Export repository (dossier docs 15/16, task AI-FILE-01).
 *
 * Maps ONLY the two durable file-export RPCs of the frozen catalog (doc 15)
 * onto a narrow structural transport, mirroring the draftRepository pattern:
 * it never imports `src/app/neon/database.ts`, `BemTeViNeonClient` or
 * `defaultNeonClient`, never constructs a Neon client and never uses
 * `any`/double-casts. INTEGRATION-01 later supplies the typed authenticated
 * transport.
 *
 * Every RPC RETURNS jsonb carrying a `Result<T>` (doc 14); wire parameters are
 * snake_case. Transport failures map to `unauthorized`/`unavailable`; the
 * `export_base_unavailable` domain code covers unauthorized/missing/expired
 * exports (doc 15). Success envelopes are decoded structurally; malformed
 * envelopes decode to `unavailable`.
 */

/** Envelope returned by the underlying Data API call. */
export interface ExportRpcCallResult {
  data: unknown;
  error: unknown;
}

/**
 * Narrow structural transport satisfied by the existing authenticated Neon
 * client (`client.rpc(name, args)`) without importing its concrete types.
 */
export interface ExportRpcTransport {
  rpc(method: string, args: Record<string, unknown>): Promise<ExportRpcCallResult>;
}

/** `selection` is `null` or `{ scope, ids }` with 1..200 unique existing IDs (doc 14). */
export interface ExportSelection {
  scope: Scope;
  ids: string[];
}

export interface ExportRepository {
  /** `create_content_edit_export` — server capture of the clean generation. */
  create(exportId: string, expectedGeneration: Counter, selection: ExportSelection | null): Promise<Result<EditExport>>;
  /** `get_content_edit_export` — owner-only durable retrieval. */
  get(exportId: string): Promise<Result<EditExport>>;
}

const ERROR_CODES: ReadonlySet<string> = new Set(
  `unauthorized invalid_capability invalid_input unsupported_schema draft_unavailable
   published_base_unavailable stale_generation revision_conflict invalid_operations invalid_image
   payload_too_large validation_failed export_base_unavailable preparation_invalid preparation_expired
   preparation_stale counter_exhausted rebase_required merge_conflict retry_required rate_limited
   response_too_large unavailable not_configured`
    .split(/\s+/)
    .filter(Boolean),
);
const UNAUTHORIZED_STATUS = new Set(['401', '403', 'PGRST301']);
const HEX_64 = /^[0-9a-f]{64}$/;
const EDITORIAL_SCOPES: ReadonlySet<string> = new Set([
  'flows',
  'educationMaterials',
  'educationGroups',
  'contacts',
  'locations',
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCounter(value: unknown): value is Counter {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function isDigest(value: unknown): value is Digest {
  return typeof value === 'string' && HEX_64.test(value);
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && ERROR_CODES.has(value);
}

/** Structural decoder for the embedded `DraftHead` of domain errors (same shape as draftRepository). */
function parseErrorDraftHead(value: unknown): DraftHead | null {
  if (!isRecord(value)) return null;
  const { baseRevision, generation, digest, updatedAt, lastActor } = value;
  if (
    value.id !== 'current' ||
    value.schemaVersion !== '1.0.0' ||
    !isCounter(baseRevision) ||
    !isCounter(generation) ||
    !isDigest(digest) ||
    typeof updatedAt !== 'string' ||
    !isRecord(lastActor)
  ) {
    return null;
  }
  const { kind, principalUserId, connectionId } = lastActor;
  if ((kind !== 'admin' && kind !== 'agent') || typeof principalUserId !== 'string') return null;
  if (typeof connectionId === 'string') {
    return {
      id: 'current',
      schemaVersion: '1.0.0',
      baseRevision,
      generation,
      digest,
      updatedAt,
      lastActor: { kind, principalUserId, connectionId },
    };
  }
  if (connectionId === null) {
    return {
      id: 'current',
      schemaVersion: '1.0.0',
      baseRevision,
      generation,
      digest,
      updatedAt,
      lastActor: { kind, principalUserId, connectionId: null },
    };
  }
  return null;
}

/** Structural check only (doc 14): the six exact top-level payload fields. */
function parsePublishedPayload(value: unknown): PublishedContentPayload | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.flows) ||
    !Array.isArray(value.educationMaterials) ||
    !Array.isArray(value.educationGroups) ||
    !Array.isArray(value.contacts) ||
    !Array.isArray(value.locations) ||
    typeof value.defaultGroupOrder !== 'number' ||
    !Number.isSafeInteger(value.defaultGroupOrder)
  ) {
    return null;
  }
  return {
    flows: value.flows,
    educationMaterials: value.educationMaterials,
    educationGroups: value.educationGroups,
    contacts: value.contacts,
    locations: value.locations,
    defaultGroupOrder: value.defaultGroupOrder,
  };
}

function parseSelection(value: unknown): ExportSelection | null {
  if (value === null) return null;
  if (!isRecord(value)) return null;
  const { scope, ids } = value;
  if (typeof scope !== 'string' || !EDITORIAL_SCOPES.has(scope) || !Array.isArray(ids)) return null;
  if (ids.length < 1 || ids.length > 200) return null;
  const unique = new Set<string>();
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0 || id.length > 200) return null;
    unique.add(id);
  }
  if (unique.size !== ids.length) return null;
  return { scope: scope as Scope, ids: [...unique] };
}

/** Structural decoder for the frozen `EditExport` contract (doc 14). */
export function parseEditExport(value: unknown): EditExport | null {
  if (!isRecord(value)) return null;
  const { exportId, baseGeneration, baseDigest, publishedRevision, canonicalPayload, createdBy, createdAt, expiresAt } =
    value;
  if (value.draftId !== 'current' || value.schemaVersion !== '2.0.0') return null;
  if (typeof exportId !== 'string' || !UUID_RE.test(exportId)) return null;
  if (!isCounter(baseGeneration) || !isDigest(baseDigest) || !isCounter(publishedRevision)) return null;
  if (typeof canonicalPayload !== 'string' || typeof createdBy !== 'string') return null;
  if (typeof createdAt !== 'string' || typeof expiresAt !== 'string') return null;
  const basePayload = parsePublishedPayload(value.basePayload);
  if (basePayload === null) return null;
  const selection = parseSelection(value.selection);
  if (value.selection !== null && selection === null) return null;
  return {
    exportId,
    draftId: 'current',
    schemaVersion: '2.0.0',
    baseGeneration,
    baseDigest,
    publishedRevision,
    basePayload,
    canonicalPayload,
    createdBy,
    createdAt,
    expiresAt,
    selection,
  };
}

function decodeDomainError(value: unknown): EditorialError {
  if (isRecord(value) && isErrorCode(value.code)) {
    const error: EditorialError = { code: value.code };
    if (isRecord(value.currentHead)) {
      const head = parseErrorDraftHead(value.currentHead);
      if (head !== null) error.currentHead = head;
    }
    if (typeof value.currentRevision === 'number' && Number.isSafeInteger(value.currentRevision)) {
      error.currentRevision = value.currentRevision;
    }
    return error;
  }
  return { code: 'unavailable' };
}

export function mapExportTransportError(error: unknown): EditorialError {
  if (isRecord(error)) {
    const code = typeof error.code === 'string' ? error.code : '';
    const status = typeof error.status === 'number' ? String(error.status) : '';
    if (code === '42501' || UNAUTHORIZED_STATUS.has(code) || UNAUTHORIZED_STATUS.has(status)) {
      return { code: 'unauthorized' };
    }
  }
  return { code: 'unavailable' };
}

function decodeEnvelope(value: unknown): Result<unknown> {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return { ok: false, error: { code: 'unavailable' } };
  if (value.ok === false) return { ok: false, error: decodeDomainError(value.error) };
  return { ok: true, data: value.data };
}

async function call<T>(
  transport: ExportRpcTransport,
  method: string,
  args: Record<string, unknown>,
  parse: (value: unknown) => T | null,
): Promise<Result<T>> {
  let response: ExportRpcCallResult;
  try {
    response = await transport.rpc(method, args);
  } catch {
    return { ok: false, error: { code: 'unavailable' } };
  }
  if (response.error !== null && response.error !== undefined) {
    return { ok: false, error: mapExportTransportError(response.error) };
  }
  const decoded = decodeEnvelope(response.data);
  if (decoded.ok === false) return decoded;
  const parsed = parse(decoded.data);
  if (parsed === null) return { ok: false, error: { code: 'unavailable' } };
  return { ok: true, data: parsed };
}

export function createExportRepository(transport: ExportRpcTransport): ExportRepository {
  return {
    create(exportId, expectedGeneration, selection) {
      return call(
        transport,
        'create_content_edit_export',
        {
          p_export_id: exportId,
          p_expected_generation: expectedGeneration,
          p_selection: selection,
        },
        parseEditExport,
      );
    },

    get(exportId) {
      return call(transport, 'get_content_edit_export', { p_export_id: exportId }, parseEditExport);
    },
  };
}
