import type { PublishedContentPayload } from '@bemtevi/content-core';

import type { DraftBaseSnapshot } from '../drafts/draftTypes';
import type { DraftRecoveryRecord, LocalDraftCache } from '../draft-storage/localDraftCache';

/**
 * Recovery-cache coordination for the canonical editor (dossier doc 16,
 * "IndexedDB Recovery"). Writes/reads/removes only the current tab's own
 * principal/tab-scoped record and lists the principal's other-tab records as
 * recoverable copies that are never automatically merged or deleted.
 * All cache failures are non-throwing booleans/empty lists so the coordinator
 * can keep memory intact and report `cacheAvailable=false`.
 */

export interface RecoveryTarget {
  principalId: string;
  tabId: string;
}

export type RecoveryRecordInput = Omit<DraftRecoveryRecord, 'key'>;

export async function saveRecoveryRecord(
  cache: LocalDraftCache,
  target: RecoveryTarget,
  base: DraftBaseSnapshot,
  local: PublishedContentPayload,
  savedAt: string,
): Promise<boolean> {
  return cache.save({
    principalId: target.principalId,
    tabId: target.tabId,
    savedAt,
    baseGeneration: base.generation,
    baseDigest: base.digest,
    basePayload: base.payload,
    localPayload: local,
  });
}

export async function clearOwnRecoveryRecord(cache: LocalDraftCache, target: RecoveryTarget): Promise<boolean> {
  return cache.remove(target.principalId, target.tabId);
}

/** Other-tab records of the same principal, offered as recoverable copies. */
export async function listRecoverableRecords(
  cache: LocalDraftCache,
  target: RecoveryTarget,
): Promise<DraftRecoveryRecord[]> {
  const listed = await cache.list(target.principalId);
  if (listed.status !== 'ok') return [];
  return listed.records.filter((record) => record.tabId !== target.tabId);
}

export interface RecoveryCoordinator {
  save(base: DraftBaseSnapshot, local: PublishedContentPayload): Promise<boolean>;
  clear(): Promise<boolean>;
  listRecoverable(): Promise<DraftRecoveryRecord[]>;
}

export interface RecoveryCoordinatorOptions {
  cache: LocalDraftCache;
  principalId: string;
  tabId: string;
  /** Injected clock, rendered as an ISO timestamp for `savedAt`. */
  now: () => number;
}

export function createRecoveryCoordinator(options: RecoveryCoordinatorOptions): RecoveryCoordinator {
  const { cache, now } = options;
  const target: RecoveryTarget = { principalId: options.principalId, tabId: options.tabId };
  return {
    save(base, local) {
      return saveRecoveryRecord(cache, target, base, local, new Date(now()).toISOString());
    },
    clear() {
      return clearOwnRecoveryRecord(cache, target);
    },
    listRecoverable() {
      return listRecoverableRecords(cache, target);
    },
  };
}

/**
 * Fire-and-forget record lifecycle used by the save coordinator: writes the
 * current base/local pair (a cache-write failure is reported through
 * `onCacheFailure` and never claims a local save) and removes the own record
 * after an acknowledged clean save, re-writing it when new edits arrived
 * while the request finished (doc 16 recovery rules).
 */
export interface RecoveryRecorder {
  write(base: DraftBaseSnapshot | null, local: PublishedContentPayload | null): void;
  remove(onDirty: () => void): void;
}

export function createRecoveryRecorder(
  recovery: RecoveryCoordinator | null,
  alive: () => boolean,
  onCacheFailure: () => void,
): RecoveryRecorder {
  return {
    write(base, local) {
      if (recovery === null || base === null || local === null) return;
      void recovery.save(base, local).then((saved) => {
        if (alive() && !saved) onCacheFailure();
      });
    },
    remove(onDirty) {
      if (recovery === null) return;
      void recovery.clear().then(onDirty);
    },
  };
}
