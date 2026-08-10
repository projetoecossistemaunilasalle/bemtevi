import { describe, expect, it } from 'vitest';
import {
  MAX_PUBLISHED_PAYLOAD_BYTES,
  PublishedContentValidationError,
  parsePayload,
  parsePublishedContentRow,
  validateLocations,
  validatePublicationPayload,
} from '../publishedContent';
import { getBundledContent } from '../bundledContent';

describe('published content validation', () => {
  it('normalizes legacy payloads without an explicit locations key', () => {
    const bundled = getBundledContent();
    const legacyContacts = bundled.contacts.map(({ locationId: _locationId, ...contact }) => contact);
    const { locations: _locations, ...legacyPayload } = bundled;

    const parsed = parsePayload({ ...legacyPayload, contacts: legacyContacts });

    expect(parsed.locations).toEqual([{ id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' }]);
    expect(parsed.contacts.every((contact) => contact.locationId === 'loc-canoas-rs')).toBe(true);
  });

  it('rejects duplicate location IDs and duplicate slug-equivalent location pairs', () => {
    expect(() =>
      validateLocations([
        { id: 'same', city: 'Canoas', state: 'RS' },
        { id: 'same', city: 'Esteio', state: 'RS' },
      ]),
    ).toThrow(/ID/i);

    expect(() =>
      validateLocations([
        { id: 'one', city: 'São José', state: 'RS' },
        { id: 'two', city: 'Sao Jose', state: 'RS' },
      ]),
    ).toThrow(/local/i);
  });

  it('rejects blank cities and invalid states in managed locations', () => {
    expect(() => validateLocations([{ id: 'blank-city', city: ' ', state: 'RS' }])).toThrow(/city/i);
    expect(() => validateLocations([{ id: 'bad-state', city: 'Canoas', state: 'R1' }])).toThrow(/estado/i);
  });

  it('rejects contacts that reference an unknown location', () => {
    const payload = getBundledContent();
    payload.contacts = [{ ...payload.contacts[0], locationId: 'missing-location' }];

    expect(() => parsePayload(payload)).toThrow(/desconhecido/i);
  });

  it('does not silently add an orphan contact city to an explicit managed list', () => {
    const payload = getBundledContent();
    payload.locations = [{ id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' }];
    payload.contacts = [{ ...payload.contacts[0], locationId: null, city: 'Porto Alegre', state: 'RS' }];

    expect(() => parsePayload(payload)).toThrow(/sem local|cidade/i);
  });

  it('accepts national contacts with no location', () => {
    const payload = getBundledContent();
    payload.contacts = [
      {
        ...payload.contacts[0],
        locationId: null,
        city: '',
        state: '',
      },
    ];

    expect(parsePayload(payload).contacts[0]).toMatchObject({ locationId: null, city: '', state: '' });
  });

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
      expect(() => parsePublishedContentRow(buildRow(revision) as never)).toThrow(PublishedContentValidationError);
      expect(() => parsePublishedContentRow(buildRow(revision) as never)).toThrow(/revision/i);
    }
  });

  it('rejects a payload whose defaultGroupOrder is non-finite', () => {
    for (const defaultGroupOrder of [NaN, Infinity, -Infinity]) {
      const payload = { ...getBundledContent(), defaultGroupOrder };
      expect(() => parsePayload(payload as never)).toThrow(PublishedContentValidationError);
      expect(() => parsePayload(payload as never)).toThrow(/defaultGroupOrder/i);
    }
  });

  it('rejects malformed education body blocks before screens render them', () => {
    const payload = getBundledContent();
    payload.educationMaterials[0] = {
      ...payload.educationMaterials[0],
      body: [null] as never,
    };

    expect(() => parsePayload(payload)).toThrow(PublishedContentValidationError);
    expect(() => parsePayload(payload)).toThrow(/body/i);
  });

  it('rejects non-string education list items before the detail screen trims them', () => {
    const payload = getBundledContent();
    payload.educationMaterials[0] = {
      ...payload.educationMaterials[0],
      body: [{ id: 'invalid-list', kind: 'list', items: [null] as never }],
    };

    expect(() => parsePayload(payload)).toThrow(PublishedContentValidationError);
    expect(() => parsePayload(payload)).toThrow(/body/i);
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
    expect(() => parsePublishedContentRow(row)).toThrow(PublishedContentValidationError);
    expect(() => parsePublishedContentRow(row)).toThrow(/published_at/i);
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
    expect(() => parsePublishedContentRow(row)).toThrow(PublishedContentValidationError);
    expect(() => parsePublishedContentRow(row)).toThrow(/published_by/i);
  });

  it('rejects a payload missing required collection keys', () => {
    const payload = getBundledContent();
    delete (payload as Partial<typeof payload>).contacts;
    delete (payload as Partial<typeof payload>).flows;
    expect(() => parsePayload(payload as never)).toThrow(PublishedContentValidationError);
    expect(() => parsePayload(payload as never)).toThrow(/payload/i);
  });
});
