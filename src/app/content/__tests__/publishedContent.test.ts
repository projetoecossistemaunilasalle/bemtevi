import { describe, expect, it } from 'vitest';
import {
  MAX_PUBLISHED_PAYLOAD_BYTES,
  PublishedContentValidationError,
  parsePublishedContentRow,
  validatePublicationPayload,
} from '../publishedContent';
import { getBundledContent } from '../bundledContent';

describe('published content validation', () => {
  it('parses a valid database row', () => {
    const payload = getBundledContent();
    expect(
      parsePublishedContentRow({
        id: 'current',
        schema_version: '1.0.0',
        revision: 3,
        payload,
        published_at: '2026-07-15T12:00:00.000Z',
        published_by: '00000000-0000-0000-0000-000000000001',
      }),
    ).toMatchObject({ revision: 3, payload });
  });

  it('rejects a row with a malformed payload instead of exposing it to screens', () => {
    expect(() =>
      parsePublishedContentRow({
        id: 'current',
        schema_version: '1.0.0',
        revision: 1,
        payload: { flows: 'not-an-array' },
        published_at: '2026-07-15T12:00:00.000Z',
        published_by: '00000000-0000-0000-0000-000000000001',
      }),
    ).toThrow(PublishedContentValidationError);
  });

  it('rejects unsupported schema versions', () => {
    const payload = getBundledContent();
    expect(() =>
      parsePublishedContentRow({
        id: 'current',
        schema_version: '2.0.0',
        revision: 1,
        payload,
        published_at: '2026-07-15T12:00:00.000Z',
        published_by: '00000000-0000-0000-0000-000000000001',
      }),
    ).toThrow(/schema/i);
  });

  it('rejects publication payloads larger than 5 MiB', () => {
    const payload = getBundledContent();
    payload.educationMaterials[0] = {
      ...payload.educationMaterials[0],
      description: 'x'.repeat(MAX_PUBLISHED_PAYLOAD_BYTES),
    };
    expect(() => validatePublicationPayload(payload)).toThrow(/5 MiB/);
  });
});
