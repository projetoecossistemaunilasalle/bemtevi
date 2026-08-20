import { describe, expect, it } from 'vitest';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import type { ServiceDirectoryEntry } from '../../../domain/services/types';
import { mergePublishedContent } from '../mergePublishedContent';

function payload(overrides: Partial<PublishedContentPayload> = {}): PublishedContentPayload {
  return {
    flows: [],
    educationMaterials: [],
    educationGroups: [],
    contacts: [],
    locations: [],
    defaultGroupOrder: 0,
    ...overrides,
  };
}

const contact = {
  id: 'contact-one',
  name: 'Contato original',
  type: 'CAPS',
  badgeTone: 'primary',
  city: 'Canoas',
  state: 'RS',
  address: 'Rua Um, 123',
  phoneDisplay: '(51) 3000-0000',
  phoneHref: 'tel:5130000000',
  review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
} as ServiceDirectoryEntry;

describe('mergePublishedContent', () => {
  it('combines independent edits to the same record', () => {
    const base = payload({ contacts: [contact] });
    const local = payload({ contacts: [{ ...contact, name: 'Nome local' }] });
    const remote = payload({ contacts: [{ ...contact, phoneDisplay: '(51) 3111-0000' }] });

    const result = mergePublishedContent(base, local, remote);

    expect(result.conflicts).toEqual([]);
    expect(result.payload?.contacts[0]).toMatchObject({
      name: 'Nome local',
      phoneDisplay: '(51) 3111-0000',
    });
  });

  it('combines edits to different records in the same collection', () => {
    const secondContact = { ...contact, id: 'contact-two', name: 'Segundo contato' };
    const base = payload({ contacts: [contact, secondContact] });
    const local = payload({ contacts: [{ ...contact, name: 'Nome local' }, secondContact] });
    const remote = payload({ contacts: [contact, { ...secondContact, name: 'Nome remoto' }] });

    const result = mergePublishedContent(base, local, remote);

    expect(result.conflicts).toEqual([]);
    expect(result.payload?.contacts).toEqual([
      { ...contact, name: 'Nome local' },
      { ...secondContact, name: 'Nome remoto' },
    ]);
  });

  it('reports a conflict when both sides change the same field', () => {
    const base = payload({ contacts: [contact] });
    const local = payload({ contacts: [{ ...contact, name: 'Nome local' }] });
    const remote = payload({ contacts: [{ ...contact, name: 'Nome remoto' }] });

    const result = mergePublishedContent(base, local, remote);

    expect(result.payload).toBeNull();
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        path: 'contacts[contact-one].name',
        base: 'Contato original',
        local: 'Nome local',
        remote: 'Nome remoto',
      }),
    ]);
  });

  it('reports a conflict when one side removes a record the other edits', () => {
    const base = payload({ contacts: [contact] });
    const local = payload({ contacts: [] });
    const remote = payload({ contacts: [{ ...contact, name: 'Nome remoto' }] });

    const result = mergePublishedContent(base, local, remote);

    expect(result.payload).toBeNull();
    expect(result.conflicts[0]?.path).toBe('contacts[contact-one]');
  });

  it('merges independent nested flow edits', () => {
    const baseFlow = {
      id: 'flow-one',
      nodes: {
        start: { id: 'start', kind: 'result', text: 'Texto original' },
      },
    };
    const base = payload({ flows: [baseFlow as never] });
    const local = payload({
      flows: [{ ...baseFlow, nodes: { start: { ...baseFlow.nodes.start, text: 'Texto local' } } } as never],
    });
    const remote = payload({
      flows: [{ ...baseFlow, nodes: { start: { ...baseFlow.nodes.start, id: 'start-remoto' } } } as never],
    });

    const result = mergePublishedContent(base, local, remote);

    expect(result.conflicts).toEqual([]);
    expect(result.payload?.flows[0]).toMatchObject({
      nodes: { start: { id: 'start-remoto', text: 'Texto local' } },
    });
  });
});
