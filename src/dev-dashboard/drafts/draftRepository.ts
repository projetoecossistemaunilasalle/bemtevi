import type {
  ContentDraft,
  Counter,
  Digest,
  DraftHead,
  DraftMutationInput,
  DraftMutationResult,
  EditorialError,
  ErrorCode,
  PrepareInput,
  PublicationPreparation,
  PublishResult,
  PublishedContentPayload,
  Result,
} from '@bemtevi/content-core';

/**
 * Dashboard draft repository (dossier docs 15/16, task DASHBOARD-01).
 *
 * Maps ONLY the fixed admin draft/publication RPCs of the frozen catalog (15)
 * onto a narrow structural transport. It never imports `src/app/neon/database.ts`,
 * `BemTeViNeonClient` or `defaultNeonClient`, never creates a Neon client and
 * never uses `any`/double-casts to bypass V2 RPC typings. INTEGRATION-01 later
 * registers the handwritten Database types and passes the existing
 * authenticated client structurally into `createDraftRepository`.
 *
 * Every RPC RETURNS jsonb carrying a `Result<T>` (doc 14); wire parameters are
 * snake_case. Transport-level failures map to `unauthorized`/`unavailable`
 * exactly as doc 14 prescribes; domain envelopes pass through after structural
 * decoding.
 */

/** Envelope returned by the underlying Data API call. */
export interface DraftRpcCallResult {
  data: unknown;
  error: unknown;
}

/**
 * Narrow structural transport satisfied by the existing authenticated Neon
 * client (`client.rpc(name, args)`) without importing its concrete types.
 */
export interface DraftRpcTransport {
  rpc(method: string, args: Record<string, unknown>): Promise<DraftRpcCallResult>;
}

export interface DraftRepository {
  /** `get_content_draft` — full draft; the RPC initializes it when missing. */
  load(): Promise<Result<ContentDraft>>;
  /** `get_content_draft_head` — head only; no initialization. */
  head(): Promise<Result<DraftHead>>;
  /** `apply_content_draft_operations` — CAS batch mutation. */
  mutate(input: DraftMutationInput): Promise<Result<DraftMutationResult>>;
  /** `prepare_content_draft_publish` — receives only the token hash. */
  prepare(input: PrepareInput): Promise<Result<PublicationPreparation>>;
  /** `publish_content_draft` — preparation UUID plus the raw publish token. */
  publish(preparationId: string, token: string): Promise<Result<PublishResult>>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCounter(value: unknown): value is Counter {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isDigest(value: unknown): value is Digest {
  return typeof value === 'string' && HEX_64.test(value);
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && ERROR_CODES.has(value);
}

function parseActor(value: unknown): DraftHead['lastActor'] | null {
  if (!isRecord(value)) return null;
  const { kind, principalUserId, connectionId } = value;
  if ((kind !== 'admin' && kind !== 'agent') || typeof principalUserId !== 'string') return null;
  if (typeof connectionId === 'string') return { kind, principalUserId, connectionId };
  if (connectionId === null) return { kind, principalUserId, connectionId: null };
  return null;
}

export function parseDraftHead(value: unknown): DraftHead | null {
  if (!isRecord(value)) return null;
  const actor = parseActor(value.lastActor);
  if (
    value.id !== 'current' ||
    value.schemaVersion !== '1.0.0' ||
    !isCounter(value.baseRevision) ||
    !isCounter(value.generation) ||
    !isDigest(value.digest) ||
    typeof value.updatedAt !== 'string' ||
    actor === null
  ) {
    return null;
  }
  return {
    id: 'current',
    schemaVersion: '1.0.0',
    baseRevision: value.baseRevision,
    generation: value.generation,
    digest: value.digest,
    updatedAt: value.updatedAt,
    lastActor: actor,
  };
}

/** Structural check only (doc 14): the six exact top-level payload fields. */
function parsePublishedPayload(value: Record<string, unknown>): PublishedContentPayload | null {
  const flows = value.flows;
  const educationMaterials = value.educationMaterials;
  const educationGroups = value.educationGroups;
  const contacts = value.contacts;
  const locations = value.locations;
  if (
    !Array.isArray(flows) ||
    !Array.isArray(educationMaterials) ||
    !Array.isArray(educationGroups) ||
    !Array.isArray(contacts) ||
    !Array.isArray(locations) ||
    !isCounter(value.defaultGroupOrder)
  ) {
    return null;
  }
  return {
    flows: flows as PublishedContentPayload['flows'],
    educationMaterials: educationMaterials as PublishedContentPayload['educationMaterials'],
    educationGroups: educationGroups as PublishedContentPayload['educationGroups'],
    contacts: contacts as PublishedContentPayload['contacts'],
    locations: locations as PublishedContentPayload['locations'],
    defaultGroupOrder: value.defaultGroupOrder,
  };
}

function parseContentDraft(value: unknown): ContentDraft | null {
  const head = parseDraftHead(value);
  const payload = isRecord(value) && isRecord(value.payload) ? parsePublishedPayload(value.payload) : null;
  if (
    head === null ||
    payload === null ||
    !isRecord(value) ||
    value.status !== 'active' ||
    typeof value.canonicalPayload !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.createdBy !== 'string'
  ) {
    return null;
  }
  return {
    ...head,
    status: 'active',
    payload,
    canonicalPayload: value.canonicalPayload,
    createdAt: value.createdAt,
    createdBy: value.createdBy,
  };
}

function parseMutationResult(value: unknown): DraftMutationResult | null {
  if (!isRecord(value) || typeof value.changed !== 'boolean') return null;
  const head = parseDraftHead(value.head);
  return head === null ? null : { head, changed: value.changed };
}

function parsePreparation(value: unknown): PublicationPreparation | null {
  if (!isRecord(value)) return null;
  const { preparationId, generation, expectedRevision, digest, expiresAt } = value;
  if (
    typeof preparationId !== 'string' ||
    value.draftId !== 'current' ||
    !isCounter(generation) ||
    !isCounter(expectedRevision) ||
    !isDigest(digest) ||
    typeof expiresAt !== 'string'
  ) {
    return null;
  }
  return { preparationId, draftId: 'current', generation, expectedRevision, digest, expiresAt };
}

function parsePublishResult(value: unknown): PublishResult | null {
  if (!isRecord(value)) return null;
  const { revision, publishedAt, draftGeneration, digest } = value;
  if (!isCounter(revision) || typeof publishedAt !== 'string' || !isCounter(draftGeneration) || !isDigest(digest)) {
    return null;
  }
  return { revision, publishedAt, draftGeneration, digest };
}

function decodeDomainError(value: unknown): EditorialError {
  if (isRecord(value) && isErrorCode(value.code)) {
    const error: EditorialError = { code: value.code };
    if (isRecord(value.currentHead)) {
      const head = parseDraftHead(value.currentHead);
      if (head !== null) error.currentHead = head;
    }
    if (isCounter(value.currentRevision)) error.currentRevision = value.currentRevision;
    if (Array.isArray(value.conflicts)) error.conflicts = value.conflicts;
    return error;
  }
  return { code: 'unavailable' };
}

export function mapTransportError(error: unknown): EditorialError {
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
  transport: DraftRpcTransport,
  method: string,
  args: Record<string, unknown>,
  parse: (value: unknown) => T | null,
): Promise<Result<T>> {
  let response: DraftRpcCallResult;
  try {
    response = await transport.rpc(method, args);
  } catch {
    return { ok: false, error: { code: 'unavailable' } };
  }
  if (response.error !== null && response.error !== undefined) {
    return { ok: false, error: mapTransportError(response.error) };
  }
  const decoded = decodeEnvelope(response.data);
  if (decoded.ok === false) return decoded;
  const parsed = parse(decoded.data);
  if (parsed === null) return { ok: false, error: { code: 'unavailable' } };
  return { ok: true, data: parsed };
}

export function createDraftRepository(transport: DraftRpcTransport): DraftRepository {
  return {
    load() {
      return call(transport, 'get_content_draft', {}, parseContentDraft);
    },

    head() {
      return call(transport, 'get_content_draft_head', {}, parseDraftHead);
    },

    mutate(input) {
      return call(
        transport,
        'apply_content_draft_operations',
        { p_expected_generation: input.expectedGeneration, p_operations: input.operations },
        parseMutationResult,
      );
    },

    prepare(input) {
      return call(
        transport,
        'prepare_content_draft_publish',
        {
          p_preparation_id: input.preparationId,
          p_generation: input.generation,
          p_expected_revision: input.expectedRevision,
          p_digest: input.digest,
          p_token_hash: input.tokenHash,
        },
        parsePreparation,
      );
    },

    publish(preparationId, token) {
      return call(
        transport,
        'publish_content_draft',
        { p_preparation_id: preparationId, p_publish_token: token },
        parsePublishResult,
      );
    },
  };
}
