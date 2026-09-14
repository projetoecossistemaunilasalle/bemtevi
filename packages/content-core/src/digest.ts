import type { Digest } from './contracts/drafts';
import type { PublishedContentPayload } from './model/publishedContent';

/**
 * Lowercase SHA-256 hex of the UTF-8 text. This mirrors the persistence digest:
 * `pg_catalog.sha256(pg_catalog.convert_to(payload::text, 'UTF8'))` — i.e. it is
 * defined over an exact string (the canonical payload text), never over
 * `JSON.stringify(payload)`.
 */
export async function sha256Text(text: string): Promise<Digest> {
  const bytes = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Lowercase SHA-256 hex of the exact bytes. Capability token hashes are defined
 * over the decoded 32 credential bytes, never over the base64url token text
 * (doc 15 "hash decoded bytes, not token text").
 */
export async function sha256Bytes(bytes: Uint8Array): Promise<Digest> {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a (payload, canonicalPayload, digest) triple before using it as a
 * base: the digest must match the canonical text and the parsed canonical text
 * must be semantically equal to the payload.
 */
export async function verifySnapshot(
  payload: PublishedContentPayload,
  canonicalPayload: string,
  digest: Digest,
): Promise<boolean> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonicalPayload);
  } catch {
    return false;
  }
  if (!sameContent(parsed, payload)) return false;
  return (await sha256Text(canonicalPayload)) === digest;
}

// Re-pointed to the canonical reconciliation implementation (MERGE-03).
// Array order and null are significant; object key order is not.
import { contentIdentity } from './content-reconciliation/semanticDiff';

/** Semantic content equality: key-order-insensitive, array-order-sensitive. */
export function sameContent(a: unknown, b: unknown): boolean {
  return contentIdentity(a) === contentIdentity(b);
}
