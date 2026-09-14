// Compatibility facade: canonical implementation lives in @bemtevi/content-core
// (model/publishedContent + validation/publishedContent*).
export {
  PUBLISHED_CONTENT_SCHEMA_VERSION,
  MAX_PUBLISHED_PAYLOAD_BYTES,
  PublishedContentValidationError,
  parsePayload,
  parsePublishedContentRow,
  getPublishedPayloadSize,
  validatePublicationPayload,
  validateLocations,
} from '@bemtevi/content-core';
export type { PublishedContentPayload, PublishedContentSnapshot, PublishedContentRow } from '@bemtevi/content-core';
