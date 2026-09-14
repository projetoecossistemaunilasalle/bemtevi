import { createContext, useContext } from 'react';
import type { PublishedContentPayload, PublishedContentSnapshot } from './publishedContent';
import { PublishedContentValidationError } from './publishedContent';
import type { PublishedContentRepositoryError } from './publishedContentRepository';

/**
 * Public read source for the published content (doc 16). The context is
 * read-only since INTEGRATION-02: the arbitrary
 * `publish(payload, publisherId, expectedRevision)` method was removed with
 * the repository's direct-table write path. Browser publication is guarded by
 * the V2 prepare/publish protocol (`usePublicationController`) or, during
 * coexistence, by the legacy dashboard branch's dedicated adapter.
 */

export type PublishedContentSource = 'bundled' | 'database';
export type PublishedContentStatus = 'loading' | 'ready' | 'fallback';

export interface PublishedContentContextValue {
  content: PublishedContentPayload;
  snapshot: PublishedContentSnapshot | null;
  source: PublishedContentSource;
  status: PublishedContentStatus;
  loadError: PublishedContentRepositoryError | PublishedContentValidationError | null;
  refresh(): Promise<void>;
  refreshLatest?(): Promise<PublishedContentSnapshot | null>;
}

export const PublishedContentContext = createContext<PublishedContentContextValue | null>(null);

export function usePublishedContent(): PublishedContentContextValue {
  const ctx = useContext(PublishedContentContext);
  if (!ctx) {
    throw new Error('usePublishedContent must be used within a PublishedContentProvider');
  }
  return ctx;
}
