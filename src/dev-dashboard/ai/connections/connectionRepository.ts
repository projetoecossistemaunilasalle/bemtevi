import type { AgentConnection, EditorialError, ErrorCode, Result } from '@bemtevi/content-core';

/**
 * Agent connection repository (dossier docs 15/16, task AI-FILE-02).
 *
 * Maps ONLY the three admin connection RPCs of the frozen catalog (doc 15)
 * onto a narrow structural transport, mirroring the draft/export repository
 * pattern: it never imports `src/app/neon/database.ts`, `BemTeViNeonClient`
 * or `defaultNeonClient`, never casts handwritten Database types and never
 * uses `any`/double-casts. INTEGRATION-01 later instantiates it with the typed
 * authenticated client.
 *
 * Every RPC RETURNS jsonb carrying a `Result<T>` (doc 14); wire parameters are
 * snake_case. The raw agent token NEVER crosses this module: `create` sends
 * only the SHA-256 hex `tokenHash` (`p_token_hash`); no list/revoke response
 * field can carry a secret because `AgentConnection` metadata is secret-free
 * by contract (doc 14).
 */

/** Envelope returned by the underlying Data API call. */
export interface ConnectionRpcCallResult {
  data: unknown;
  error: unknown;
}

/**
 * Narrow structural transport satisfied by the existing authenticated Neon
 * client (`client.rpc(name, args)`) without importing its concrete types.
 */
export interface ConnectionRpcTransport {
  rpc(method: string, args: Record<string, unknown>): Promise<ConnectionRpcCallResult>;
}

export interface ConnectionRepository {
  /** `create_content_agent_connection` — registers only the token hash. */
  create(id: string, tokenHash: string, label: string): Promise<Result<AgentConnection>>;
  /** `list_content_agent_connections` — metadata only, created_at DESC, id ASC. */
  list(): Promise<Result<AgentConnection[]>>;
  /** `revoke_content_agent_connection` — explicit two-step revocation. */
  revoke(id: string): Promise<Result<AgentConnection>>;
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const LABEL_MAX_CODE_POINTS = 80;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && ERROR_CODES.has(value);
}

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  // Structural wire check: UTC ISO-8601 string (doc 14). Deep date validation
  // is unnecessary; the value is metadata shown to admins, never executed.
  return typeof value === 'string' && value.length > 0;
}

/**
 * Structural decoder for the frozen `AgentConnection` contract (doc 14):
 * `draftId` is always 'current'; no hash/secret field is ever accepted.
 */
export function parseAgentConnection(value: unknown): AgentConnection | null {
  if (!isRecord(value)) return null;
  const { id, principalUserId, label, createdAt, expiresAt } = value;
  const revokedAtRaw: unknown = value.revokedAt;
  const lastUsedAtRaw: unknown = value.lastUsedAt;
  if (value.draftId !== 'current') return null;
  if (!isValidUuid(id)) return null;
  if (typeof principalUserId !== 'string' || principalUserId.length === 0) return null;
  if (typeof label !== 'string' || label.trim().length === 0) return null;
  if (label.length > LABEL_MAX_CODE_POINTS) return null;
  if (!isIsoTimestamp(createdAt) || !isIsoTimestamp(expiresAt)) return null;
  let revokedAt: string | null;
  if (typeof revokedAtRaw === 'string') {
    if (!isIsoTimestamp(revokedAtRaw)) return null;
    revokedAt = revokedAtRaw;
  } else if (revokedAtRaw === null) {
    revokedAt = null;
  } else {
    return null;
  }
  let lastUsedAt: string | null;
  if (typeof lastUsedAtRaw === 'string') {
    if (!isIsoTimestamp(lastUsedAtRaw)) return null;
    lastUsedAt = lastUsedAtRaw;
  } else if (lastUsedAtRaw === null) {
    lastUsedAt = null;
  } else {
    return null;
  }
  // Only the exact metadata fields of the frozen contract are carried forward;
  // any additional response key (a hash column, for example) is dropped here.
  return {
    id,
    draftId: 'current',
    principalUserId,
    label,
    createdAt,
    expiresAt,
    revokedAt,
    lastUsedAt,
  };
}

function parseAgentConnectionList(value: unknown): AgentConnection[] | null {
  if (!Array.isArray(value)) return null;
  const connections: AgentConnection[] = [];
  for (const item of value) {
    const connection = parseAgentConnection(item);
    if (connection === null) return null;
    connections.push(connection);
  }
  return connections;
}

function decodeDomainError(value: unknown): EditorialError {
  if (isRecord(value) && isErrorCode(value.code)) return { code: value.code };
  return { code: 'unavailable' };
}

export function mapConnectionTransportError(error: unknown): EditorialError {
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
  transport: ConnectionRpcTransport,
  method: string,
  args: Record<string, unknown>,
  parse: (value: unknown) => T | null,
): Promise<Result<T>> {
  let response: ConnectionRpcCallResult;
  try {
    response = await transport.rpc(method, args);
  } catch {
    return { ok: false, error: { code: 'unavailable' } };
  }
  if (response.error !== null && response.error !== undefined) {
    return { ok: false, error: mapConnectionTransportError(response.error) };
  }
  const decoded = decodeEnvelope(response.data);
  if (decoded.ok === false) return decoded;
  const parsed = parse(decoded.data);
  if (parsed === null) return { ok: false, error: { code: 'unavailable' } };
  return { ok: true, data: parsed };
}

function isValidTokenHash(value: string): boolean {
  return HEX_64.test(value);
}

export function createConnectionRepository(transport: ConnectionRpcTransport): ConnectionRepository {
  return {
    create(id, tokenHash, label) {
      if (!isValidTokenHash(tokenHash)) {
        return Promise.resolve({ ok: false, error: { code: 'invalid_input' } });
      }
      return call(
        transport,
        'create_content_agent_connection',
        { p_connection_id: id, p_token_hash: tokenHash, p_label: label },
        parseAgentConnection,
      );
    },

    list() {
      return call(transport, 'list_content_agent_connections', {}, parseAgentConnectionList);
    },

    revoke(id) {
      return call(transport, 'revoke_content_agent_connection', { p_connection_id: id }, parseAgentConnection);
    },
  };
}
