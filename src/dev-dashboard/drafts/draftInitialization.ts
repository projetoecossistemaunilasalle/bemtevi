import { verifySnapshot } from '@bemtevi/content-core';
import type { EditorialError, PublishedContentPayload } from '@bemtevi/content-core';

import type { LocalDraftCache, DraftRecoveryRecord } from '../draft-storage/localDraftCache';
import type { DraftRepository } from './draftRepository';
import type { DraftBaseSnapshot } from './draftTypes';

/**
 * Canonical draft initialization (dossier doc 16, "load" transition): load or
 * initialize the draft, verify its digest, then check the principal/tab-scoped
 * recovery cache. React-free and deterministic; failure never seeds content
 * from the bundle and never deletes a recovery record.
 */

export interface DraftInitializationInput {
  repository: DraftRepository;
  cache: LocalDraftCache;
  principalId: string;
  tabId: string;
}

export type CacheConflictReason = 'generation_mismatch' | 'digest_mismatch';

export type DraftInitialization =
  | {
      status: 'ready';
      base: DraftBaseSnapshot;
      /** Local candidate resumed from this tab's own cache; null when clean. */
      local: PublishedContentPayload | null;
      cacheAvailable: boolean;
    }
  | {
      status: 'cache_conflict';
      base: DraftBaseSnapshot;
      /** Own-tab record that does NOT match the current server head. */
      record: DraftRecoveryRecord;
      reason: CacheConflictReason;
      cacheAvailable: boolean;
    }
  | {
      status: 'unavailable';
      error: EditorialError;
      cacheAvailable: boolean;
    };

function toBase(
  head: {
    id: 'current';
    schemaVersion: '1.0.0';
    baseRevision: number;
    generation: number;
    digest: string;
    updatedAt: string;
    lastActor: { kind: 'admin' | 'agent'; principalUserId: string; connectionId: string | null };
  },
  payload: PublishedContentPayload,
): DraftBaseSnapshot {
  return {
    id: head.id,
    schemaVersion: head.schemaVersion,
    baseRevision: head.baseRevision,
    generation: head.generation,
    digest: head.digest,
    updatedAt: head.updatedAt,
    lastActor: head.lastActor,
    payload,
  };
}

/**
 * Loads the canonical draft, verifies its digest triple and reconciles the
 * own-tab recovery record against the server head:
 * - matching generation + digest resumes the saved local candidate;
 * - a mismatching record is surfaced as `cache_conflict` and never auto-merged;
 * - a load or digest failure is `unavailable` and preserves the cache.
 */
export async function initializeDraft(input: DraftInitializationInput): Promise<DraftInitialization> {
  const { repository, cache, principalId, tabId } = input;

  const lookup = await cache.load(principalId, tabId);
  const cacheAvailable = lookup.status === 'ok';

  const loadResult = await repository.load();
  if (loadResult.ok === false) {
    return { status: 'unavailable', error: loadResult.error, cacheAvailable };
  }

  const draft = loadResult.data;
  const digestVerified = await verifySnapshot(draft.payload, draft.canonicalPayload, draft.digest);
  if (!digestVerified) {
    return {
      status: 'unavailable',
      error: { code: 'validation_failed' },
      cacheAvailable,
    };
  }

  const base = toBase(draft, draft.payload);

  if (lookup.status === 'ok' && lookup.record !== null) {
    const record = lookup.record;
    if (record.baseGeneration !== base.generation) {
      return { status: 'cache_conflict', base, record, reason: 'generation_mismatch', cacheAvailable: true };
    }
    if (record.baseDigest !== base.digest) {
      return { status: 'cache_conflict', base, record, reason: 'digest_mismatch', cacheAvailable: true };
    }
    return { status: 'ready', base, local: record.localPayload, cacheAvailable: true };
  }

  return { status: 'ready', base, local: null, cacheAvailable };
}
