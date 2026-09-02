import publishedContentSnapshot from '../../content/generated/published-content.snapshot.json';
import { parsePayload, type PublishedContentPayload } from './publishedContent';

// This generated mirror is pulled from Neon. It is a read-only offline fallback,
// never an input to publication.
const bundledPayload = parsePayload(publishedContentSnapshot.payload);

export function getBundledContent(): PublishedContentPayload {
  return structuredClone(bundledPayload);
}
