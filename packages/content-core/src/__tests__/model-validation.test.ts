import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDUCATION_GROUP_ID,
  FEATURED_IMAGE_IDS,
  PublishedContentValidationError,
  deriveLocationsFromContacts,
  getYouTubeEmbedUrl,
  isFeaturedImageId,
  locationPairKey,
  normalizeContactLocations,
  parseGuidedFlow,
  parsePayload,
  validateDashboardContacts,
  validateDashboardEducation,
  validateDashboardFlows,
  validateFlow,
  validatePublicationPayload,
  type PublishedContentPayload,
} from '../index';

function validFlow(id: string) {
  return {
    id,
    version: '1.0.0',
    locale: 'pt-BR',
    title: 'Fluxo de teste',
    type: 'guided_conversation',
    status: 'approved',
    entry: { nodeId: 'inicio', enteringPhrases: ['oi'], transitionMessage: 'vamos' },
    nodes: {
      inicio: {
        id: 'inicio',
        kind: 'choice',
        text: 'Como você está?',
        options: [{ id: 'op1', label: 'Ok', next: 'fim' }],
      },
      fim: { id: 'fim', kind: 'result', text: 'Tudo bem.', recommendations: [] },
    },
  };
}

function basePayload(overrides: Partial<PublishedContentPayload> = {}): PublishedContentPayload {
  return {
    flows: [validFlow('fluxo')] as unknown as PublishedContentPayload['flows'],
    educationMaterials: [],
    educationGroups: [],
    contacts: [],
    locations: [],
    defaultGroupOrder: 1,
    ...overrides,
  };
}

describe('flow model and validation', () => {
  it('accepts a structurally valid flow', () => {
    const flow = validFlow('fluxo');
    expect(validateFlow(flow)).toEqual({ valid: true, errors: [] });
    expect(parseGuidedFlow(flow)).toEqual(flow);
  });

  it('reports missing entry and dangling node references', () => {
    const result = validateFlow({ id: 'x', nodes: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('entrada do fluxo');
  });

  it('rejects choice nodes without options and dangling option targets', () => {
    const flow = {
      id: 'f',
      entry: { nodeId: 'a', enteringPhrases: ['oi'] },
      nodes: { a: { id: 'a', kind: 'choice', text: 'x', options: [{ id: 'o', label: 'l', next: 'zz' }] } },
    };
    const result = validateFlow(flow);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('nó inexistente');
  });
});

describe('published content payload validation', () => {
  it('parses a structurally valid payload and normalizes locations', () => {
    const payload = parsePayload(basePayload());
    expect(payload.defaultGroupOrder).toBe(1);
    expect(payload.flows).toHaveLength(1);
    expect(payload.locations).toEqual([]);
  });

  it('rejects incomplete payloads with a domain error', () => {
    expect(() => parsePayload({})).toThrow(PublishedContentValidationError);
    try {
      parsePayload({ flows: [] });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PublishedContentValidationError);
      expect((error as Error).message).toContain('educationMaterials');
    }
  });

  it('rejects invalid education materials and contacts', () => {
    expect(() =>
      parsePayload(
        basePayload({
          educationMaterials: [
            {
              id: 'm',
              title: '',
              source: 's',
              description: 'd',
              tags: [],
              audience: 'teachers',
              review: { status: 'approved', reviewedBy: null, reviewedAt: null, notes: '' },
            },
          ] as unknown as PublishedContentPayload['educationMaterials'],
        }),
      ),
    ).toThrow(PublishedContentValidationError);
  });

  it('enforces the 5 MiB bound through validatePublicationPayload', () => {
    const payload = validatePublicationPayload(basePayload());
    expect(payload.locations).toEqual([]);
  });
});

describe('locations model', () => {
  it('derives stable location ids from contacts', () => {
    const locations = deriveLocationsFromContacts([
      { city: 'São Paulo', state: 'sp' },
      { city: 'Sao Paulo', state: 'SP' },
      { city: 'Curitiba', state: 'PR' },
    ]);
    expect(locations).toHaveLength(2);
    expect(locations[0]?.city).toBe('São Paulo');
    expect(locations[0]?.state).toBe('SP');
  });

  it('computes accent-insensitive pair keys', () => {
    expect(locationPairKey('São Paulo', 'SP')).toBe(locationPairKey('sao paulo', 'sp'));
  });

  it('normalizes contacts against the location model', () => {
    const locations = deriveLocationsFromContacts([{ city: 'Curitiba', state: 'PR' }]);
    const result = normalizeContactLocations(
      [
        {
          id: 'c1',
          name: 'n',
          type: 't',
          badgeTone: 'neutral',
          city: 'Curitiba',
          state: 'PR',
          address: 'a',
          phoneDisplay: '99999999',
          phoneHref: 'tel:99999999',
          review: { status: 'approved', reviewedBy: null, reviewedAt: null, notes: '' },
        },
      ],
      locations,
    );
    expect(result.contacts[0]?.locationId).toBe(locations[0]?.id);
    expect(result.contacts[0]?.city).toBe('Curitiba');
  });
});

describe('dashboard validators', () => {
  it('flags contacts with invalid phone href and short phone digits', () => {
    const result = validateDashboardContacts([
      {
        id: 'c1',
        name: 'Contato',
        type: 'Tipo',
        badgeTone: 'neutral',
        city: '',
        state: '',
        locationId: null,
        address: 'Rua',
        phoneDisplay: '123',
        phoneHref: 'tel:456',
        review: { status: 'approved', reviewedBy: null, reviewedAt: null, notes: '' },
      },
    ]);
    const ids = result.errors.map((issue) => issue.id);
    expect(ids).toContain('invalid-phone-display:c1:0');
    expect(ids).toContain('invalid-phone-href:c1:0');
  });

  it('warns for materials without tags and errors for unknown catalog images', () => {
    const result = validateDashboardEducation(
      [
        {
          id: 'm1',
          title: 'T',
          source: 'S',
          description: 'D',
          tags: [],
          audience: 'teachers',
          featuredImage: { kind: 'catalog', imageId: 'nao-existe' },
          review: { status: 'approved', reviewedBy: null, reviewedAt: null, notes: '' },
        },
      ],
      [{ id: DEFAULT_EDUCATION_GROUP_ID, title: 'Geral', order: 1 }],
    );
    const ids = [...result.errors.map((issue) => issue.id), ...result.warnings.map((issue) => issue.id)];
    expect(ids).toContain('unknown-featured-image:m1');
    expect(ids).toContain('empty-tags:m1');
    expect(ids).toContain('reserved-group-id:geral');
  });

  it('flags flow recommendations pointing to missing materials', () => {
    const flow = validFlow('fluxo') as unknown as {
      nodes: Record<string, { kind: string; recommendations?: string[] }>;
    };
    flow.nodes.fim.recommendations = ['material-inexistente'];
    const result = validateDashboardFlows([flow as never], []);
    expect(result.errors.map((issue) => issue.id)).toContain('missing-resource:fluxo:fim:material-inexistente');
  });
});

describe('media and catalog helpers', () => {
  it('parses YouTube ids and embed urls', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
    expect(getYouTubeEmbedUrl('https://exemplo.com/video')).toBeNull();
  });

  it('validates featured image ids against the frozen catalog', () => {
    expect(FEATURED_IMAGE_IDS).toContain('classroom-1');
    expect(isFeaturedImageId('classroom-1')).toBe(true);
    expect(isFeaturedImageId('outra')).toBe(false);
  });
});
