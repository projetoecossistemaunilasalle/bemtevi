import type { Counter, Digest } from './drafts';

export interface PublicationPreparation {
  preparationId: string;
  draftId: 'current';
  generation: Counter;
  expectedRevision: Counter;
  digest: Digest;
  expiresAt: string;
}

export interface PublishResult {
  revision: Counter;
  publishedAt: string;
  draftGeneration: Counter;
  digest: Digest;
}

export interface PrepareInput {
  generation: Counter;
  expectedRevision: Counter;
  digest: Digest;
  preparationId: string;
  /** SHA-256 of the 32-byte random token; the raw token never reaches the database. */
  tokenHash: Digest;
}
