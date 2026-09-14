/**
 * Volatile base-snapshot cache (doc 04 "Cache, Limits And Retries").
 *
 * At most THREE full draft snapshots per process, 15-minute TTL from
 * insertion, LRU eviction; the key is connection id plus draft generation and
 * the cache is memory-only (never a disk cache). A snapshot is cached as
 * verified only after digest verification; post-mutation candidates may be
 * stored unverified and are unusable as a read base until a full fetch
 * upgrades them. The pinned diff comparison lives alongside its base snapshot
 * entry so it is bounded by the same three entries and the same TTL.
 */

import type { DraftHead, PublishedContentPayload, SemanticChange } from '@bemtevi/content-core';

export const BASE_SNAPSHOT_TTL_MS = 15 * 60 * 1000;
export const BASE_SNAPSHOT_MAX_ENTRIES = 3;

/** Publication comparison pinned to one cached draft generation (doc 04 get_diff). */
export interface DiffComparison {
  publishedRevision: number;
  changes: SemanticChange[];
}

export interface BaseSnapshot {
  connectionId: string;
  generation: number;
  head: DraftHead;
  payload: PublishedContentPayload;
  canonicalPayload: string;
  /** False for post-mutation candidates: unusable as a read base. */
  verified: boolean;
}

interface CacheEntry extends BaseSnapshot {
  insertedAt: number;
  lastUsedAt: number;
  comparison: DiffComparison | null;
}

export interface BaseSnapshotCacheOptions {
  clock?: () => number;
  ttlMs?: number;
  maxEntries?: number;
}

function keyOf(connectionId: string, generation: number): string {
  return `${connectionId}#${generation}`;
}

export class BaseSnapshotCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly clock: () => number;
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: BaseSnapshotCacheOptions = {}) {
    this.clock = options.clock ?? (() => Date.now());
    this.ttlMs = options.ttlMs ?? BASE_SNAPSHOT_TTL_MS;
    this.maxEntries = options.maxEntries ?? BASE_SNAPSHOT_MAX_ENTRIES;
  }

  /** Inserts (or replaces) a snapshot; prunes expired entries, then LRU-evicts. */
  insert(snapshot: BaseSnapshot): void {
    const now = this.clock();
    this.pruneExpired(now);
    const key = keyOf(snapshot.connectionId, snapshot.generation);
    const previous = this.entries.get(key);
    this.entries.set(key, {
      ...snapshot,
      insertedAt: now,
      lastUsedAt: now,
      comparison: previous?.comparison ?? null,
    });
    this.evictBeyondLimit();
  }

  /** Returns the live (non-expired) snapshot and touches its LRU position. */
  get(connectionId: string, generation: number): BaseSnapshot | null {
    const now = this.clock();
    const entry = this.entries.get(keyOf(connectionId, generation));
    if (!entry) return null;
    if (now - entry.insertedAt >= this.ttlMs) {
      this.entries.delete(keyOf(connectionId, generation));
      return null;
    }
    entry.lastUsedAt = now;
    return entry;
  }

  /** Pins (or replaces) the diff comparison on the entry; same TTL/bounds. */
  pinComparison(connectionId: string, generation: number, comparison: DiffComparison): boolean {
    const entry = this.entries.get(keyOf(connectionId, generation));
    if (!entry) return false;
    entry.comparison = comparison;
    return true;
  }

  /** Returns the pinned comparison for the entry, or null (missing/expired). */
  comparison(connectionId: string, generation: number): DiffComparison | null {
    const entry = this.entries.get(keyOf(connectionId, generation));
    if (!entry) return null;
    const now = this.clock();
    if (now - entry.insertedAt >= this.ttlMs) {
      this.entries.delete(keyOf(connectionId, generation));
      return null;
    }
    return entry.comparison;
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (now - entry.insertedAt >= this.ttlMs) this.entries.delete(key);
    }
  }

  private evictBeyondLimit(): void {
    while (this.entries.size > this.maxEntries) {
      let victimKey: string | null = null;
      let victimUsedAt = Number.POSITIVE_INFINITY;
      for (const [key, entry] of this.entries) {
        if (entry.lastUsedAt < victimUsedAt) {
          victimUsedAt = entry.lastUsedAt;
          victimKey = key;
        }
      }
      if (victimKey === null) break;
      this.entries.delete(victimKey);
    }
  }
}
