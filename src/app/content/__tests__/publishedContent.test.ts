import { describe, expect, it } from 'vitest';
import {
  MAX_PUBLISHED_PAYLOAD_BYTES,
  PublishedContentValidationError,
  parsePayload,
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

  it('rejects a row whose revision is not a positive safe integer', () => {
    const base = getBundledContent();
    const buildRow = (revision: unknown) => ({
      id: 'current' as const,
      schema_version: '1.0.0' as const,
      revision,
      payload: base,
      published_at: '2026-07-15T12:00:00.000Z',
      published_by: '00000000-0000-0000-0000-000000000001',
    });

    for (const revision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '3']) {
      const error = expect(() => parsePublishedContentRow(buildRow(revision) as never)).toThrow(
        PublishedContentValidationError,
      );
      error.toThrow(/revision/i);
    }
  });

  it('rejects a payload whose defaultGroupOrder is non-finite', () => {
    for (const defaultGroupOrder of [NaN, Infinity, -Infinity]) {
      const payload = { ...getBundledContent(), defaultGroupOrder };
      const error = expect(() => parsePayload(payload as never)).toThrow(PublishedContentValidationError);
      error.toThrow(/defaultGroupOrder/i);
    }
  });

  it('rejects a row with an empty published_at', () => {
    const row = {
      id: 'current' as const,
      schema_version: '1.0.0' as const,
      revision: 1,
      payload: getBundledContent(),
      published_at: '',
      published_by: '00000000-0000-0000-0000-000000000001',
    };
    const error = expect(() => parsePublishedContentRow(row)).toThrow(PublishedContentValidationError);
    error.toThrow(/published_at/i);
  });

  it('rejects a row with an empty published_by', () => {
    const row = {
      id: 'current' as const,
      schema_version: '1.0.0' as const,
      revision: 1,
      payload: getBundledContent(),
      published_at: '2026-07-15T12:00:00.000Z',
      published_by: '   ',
    };
    const error = expect(() => parsePublishedContentRow(row)).toThrow(PublishedContentValidationError);
    error.toThrow(/published_by/i);
  });

  it('rejects a payload missing required collection keys', () => {
    const payload = getBundledContent();
    delete (payload as Partial<typeof payload>).contacts;
    delete (payload as Partial<typeof payload>).flows;
    const error = expect(() => parsePayload(payload as never)).toThrow(PublishedContentValidationError);
    error.toThrow(/payload/i);
  });
});
