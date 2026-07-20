import { describe, expect, it } from 'vitest';
import { getBundledContent } from '../../../app/content/bundledContent';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import { computeChangeSummary } from '../changeSummary';

function clonePayload(payload: PublishedContentPayload): PublishedContentPayload {
  return {
    flows: [...payload.flows],
    educationMaterials: [...payload.educationMaterials],
    educationGroups: [...payload.educationGroups],
    contacts: [...payload.contacts],
    defaultGroupOrder: payload.defaultGroupOrder,
  };
}

describe('computeChangeSummary', () => {
  it('counts a single removed flow in a full snapshot comparison', () => {
    const base = getBundledContent();
    const baseline = { ...clonePayload(base), defaultGroupOrder: 0 };
    const draft: PublishedContentPayload = {
      ...baseline,
      flows: baseline.flows.filter((flow) => flow.id !== baseline.flows[0].id),
    };

    const summary = computeChangeSummary(baseline, draft);

    expect(summary.flows).toEqual({ added: 0, edited: 0, removed: 1 });
    expect(summary.total).toBe(1);
  });

  it('sums added, edited, removed and a changed default group order', () => {
    const base = getBundledContent();
    const baseline = clonePayload(base);
    const removedFlowId = baseline.flows[0].id;
    const editedGroupId = baseline.educationGroups[0].id;

    const draft: PublishedContentPayload = {
      flows: baseline.flows.filter((flow) => flow.id !== removedFlowId),
      educationMaterials: [
        ...baseline.educationMaterials,
        {
          id: 'added-material',
          title: 'Material adicionado',
          source: 'Equipe BemTeVi',
          description: 'Descrição do material adicionado.',
          tags: ['teste'],
          audience: 'teachers',
          review: { status: 'pending_review', reviewedBy: null, reviewedAt: null, notes: '' },
        },
      ],
      educationGroups: baseline.educationGroups.map((group) =>
        group.id === editedGroupId ? { ...group, title: 'Grupo editado' } : group,
      ),
      contacts: baseline.contacts,
      defaultGroupOrder: 1,
    };

    const summary = computeChangeSummary(baseline, draft);

    expect(summary.flows).toEqual({ added: 0, edited: 0, removed: 1 });
    expect(summary.materials).toEqual({ added: 1, edited: 0, removed: 0 });
    expect(summary.groups).toEqual({ added: 0, edited: 1, removed: 0 });
    expect(summary.contacts).toEqual({ added: 0, edited: 0, removed: 0 });
    expect(summary.defaultGroupOrderChanged).toBe(true);
    expect(summary.total).toBe(4);
  });

  it('pairs duplicate ids by occurrence rather than by a single id', () => {
    const base = getBundledContent();
    const sample = base.contacts[0];

    const first = { ...sample, id: 'dup-contact', name: 'Primeiro contato' };
    const second = { ...sample, id: 'dup-contact', name: 'Segundo contato' };
    const editedSecond = { ...second, name: 'Segundo contato editado' };

    const baseline: PublishedContentPayload = {
      flows: [],
      educationMaterials: [],
      educationGroups: [],
      contacts: [first, second],
      defaultGroupOrder: 0,
    };
    const draft: PublishedContentPayload = {
      flows: [],
      educationMaterials: [],
      educationGroups: [],
      contacts: [first, editedSecond],
      defaultGroupOrder: 0,
    };

    const summary = computeChangeSummary(baseline, draft);

    expect(summary.contacts).toEqual({ added: 0, edited: 1, removed: 0 });
  });

  it('counts an extra duplicate occurrence as an addition', () => {
    const base = getBundledContent();
    const sample = base.contacts[0];
    const only = { ...sample, id: 'solo-contact' };

    const baseline: PublishedContentPayload = {
      flows: [],
      educationMaterials: [],
      educationGroups: [],
      contacts: [only],
      defaultGroupOrder: 0,
    };
    const draft: PublishedContentPayload = {
      flows: [],
      educationMaterials: [],
      educationGroups: [],
      contacts: [only, only],
      defaultGroupOrder: 0,
    };

    const summary = computeChangeSummary(baseline, draft);

    expect(summary.contacts).toEqual({ added: 1, edited: 0, removed: 0 });
  });

  it('reports no changes when baseline and draft are identical', () => {
    const base = getBundledContent();
    const baseline = clonePayload(base);
    const draft = clonePayload(base);

    const summary = computeChangeSummary(baseline, draft);

    expect(summary.flows).toEqual({ added: 0, edited: 0, removed: 0 });
    expect(summary.materials).toEqual({ added: 0, edited: 0, removed: 0 });
    expect(summary.groups).toEqual({ added: 0, edited: 0, removed: 0 });
    expect(summary.contacts).toEqual({ added: 0, edited: 0, removed: 0 });
    expect(summary.defaultGroupOrderChanged).toBe(false);
    expect(summary.total).toBe(0);
  });
});
