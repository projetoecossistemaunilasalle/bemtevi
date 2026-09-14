import type { Digest } from './drafts';
import type { Scope } from './operations';
import type { PublishedContentPayload } from '../model/publishedContent';

export interface EditExport {
  exportId: string;
  draftId: 'current';
  schemaVersion: '2.0.0';
  baseGeneration: number;
  baseDigest: Digest;
  publishedRevision: number;
  basePayload: PublishedContentPayload;
  canonicalPayload: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  selection: { scope: Scope; ids: string[] } | null;
}
