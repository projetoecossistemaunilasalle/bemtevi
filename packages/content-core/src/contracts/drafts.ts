import type { PublishedContentPayload } from '../model/publishedContent';
import type { EditorialOperation } from './operations';

/** Non-negative safe integer counter (revision, generation). */
export type Counter = number;

/** 64 lowercase hex characters (SHA-256 rendered as hex). */
export type Digest = string;

export type Actor = { kind: 'admin' | 'agent'; principalUserId: string; connectionId: string | null };

export interface DraftHead {
  id: 'current';
  schemaVersion: '1.0.0';
  baseRevision: Counter;
  generation: Counter;
  digest: Digest;
  updatedAt: string;
  lastActor: Actor;
}

export interface ContentDraft extends DraftHead {
  status: 'active';
  payload: PublishedContentPayload;
  canonicalPayload: string;
  createdAt: string;
  createdBy: string;
}

export interface DraftMutationInput {
  expectedGeneration: Counter;
  operations: EditorialOperation[];
}

export interface DraftMutationResult {
  head: DraftHead;
  changed: boolean;
}
