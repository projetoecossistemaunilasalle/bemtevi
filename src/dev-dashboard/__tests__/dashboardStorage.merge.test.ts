import { describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import { buildExportBundle } from '../export/exportBundle';
import {
  createEmptyDashboardDraftState,
  mergeDashboardDrafts,
  type DashboardDraftState,
} from '../draft-storage/dashboardStorage';
import { contact, emptyDraft } from './dashboardStorageTestFixtures';

describe('dashboardStorage - merge', () => {
  it('refreshes contacts when a managed location is renamed', () => {
    const location = { id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' };
    const draft: DashboardDraftState = {
      ...emptyDraft,
      locationPatches: [{ id: location.id, sourceIndex: 0, patch: { city: 'Porto Alegre' } }],
    };

    const merged = mergeDashboardDrafts(
      {
        flows: [],
        educationMaterials: [],
        educationGroups: [],
        contacts: [contact],
        locations: [location],
      },
      draft,
    );

    expect(merged.locations).toEqual([{ id: location.id, city: 'Porto Alegre', state: 'RS' }]);
    expect(merged.contacts[0]).toMatchObject({ locationId: location.id, city: 'Porto Alegre', state: 'RS' });
  });

  it('preserves legacy city edits from v4 drafts for explicit repair', () => {
    const location = { id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' };
    const draft: DashboardDraftState = {
      ...emptyDraft,
      contactPatches: [{ id: contact.id, sourceIndex: 0, patch: { city: 'Porto Alegre' } }],
    };

    const merged = mergeDashboardDrafts(
      {
        flows: [],
        educationMaterials: [],
        educationGroups: [],
        contacts: [contact],
        locations: [location],
      },
      draft,
    );

    expect(merged.locations).toEqual([location]);
    expect(merged.contacts[0]).toMatchObject({
      locationId: location.id,
      city: 'Porto Alegre',
      state: 'RS',
    });
  });

  it('preserves legacy city edits when shipped content has no locations array', () => {
    const { locationId: _locationId, ...legacyContact } = contact;
    const draft: DashboardDraftState = {
      ...emptyDraft,
      contactPatches: [{ id: legacyContact.id, sourceIndex: 0, patch: { city: 'Porto Alegre' } }],
    };

    const merged = mergeDashboardDrafts(
      {
        flows: [],
        educationMaterials: [],
        educationGroups: [],
        contacts: [legacyContact],
      },
      draft,
    );

    expect(merged.locations).toEqual([{ id: 'loc-canoas-rs', city: 'Canoas', state: 'RS' }]);
    expect(merged.contacts[0]).toMatchObject({ locationId: null, city: 'Porto Alegre', state: 'RS' });
  });

  it('keeps a database baseline default group order for an empty draft', () => {
    const draft = createEmptyDashboardDraftState();

    expect(
      mergeDashboardDrafts(
        { flows: [], educationMaterials: [], educationGroups: [], contacts: [], defaultGroupOrder: 3 },
        draft,
      ).defaultGroupOrder,
    ).toBe(3);
  });

  it('merges sparse overrides onto current shipped content', () => {
    const shippedFlow = { id: 'flow-one', title: 'Shipped flow' } as GuidedFlow;
    const shippedMaterial = { id: 'material-one', title: 'Shipped material' } as EducationResource;
    const draft = {
      ...emptyDraft,
      flowPatches: [{ id: 'flow-one', sourceIndex: 0, patch: { title: 'Edited flow' } }],
    };

    expect(
      mergeDashboardDrafts(
        { flows: [shippedFlow], educationMaterials: [shippedMaterial], educationGroups: [], contacts: [] },
        draft,
      ),
    ).toEqual({
      flows: [{ ...shippedFlow, title: 'Edited flow' }],
      educationMaterials: [shippedMaterial],
      educationGroups: [],
      contacts: [],
      locations: [],
      defaultGroupOrder: 0,
    });
  });

  it('filters removed education groups after merge', () => {
    const shippedGroup = { id: 'group-one', title: 'Group one', order: 1 };
    const keptGroup = { id: 'group-two', title: 'Group two', order: 2 };
    const draft = {
      ...emptyDraft,
      removedGroupIds: ['group-one'],
    };

    expect(
      mergeDashboardDrafts(
        { flows: [], educationMaterials: [], educationGroups: [shippedGroup, keptGroup], contacts: [] },
        draft,
      ).educationGroups,
    ).toEqual([keptGroup]);
  });

  it('filters removed education materials after merge', () => {
    const removedMaterial = { id: 'material-one', title: 'Removed material' } as EducationResource;
    const keptMaterial = { id: 'material-two', title: 'Kept material' } as EducationResource;
    const draft = {
      ...emptyDraft,
      removedEducationMaterialIds: [removedMaterial.id],
    };

    expect(
      mergeDashboardDrafts(
        { flows: [], educationMaterials: [removedMaterial, keptMaterial], educationGroups: [], contacts: [] },
        draft,
      ).educationMaterials,
    ).toEqual([keptMaterial]);
  });

  it('preserves the default group order when merging drafts', () => {
    const draft = {
      ...emptyDraft,
      defaultGroupOrder: 2,
    };

    expect(
      mergeDashboardDrafts({ flows: [], educationMaterials: [], educationGroups: [], contacts: [] }, draft)
        .defaultGroupOrder,
    ).toBe(2);
  });

  it('keeps duplicate IDs isolated by source index while editing', () => {
    const firstFlow = { id: 'duplicate-flow', title: 'First flow' } as GuidedFlow;
    const secondFlow = { id: 'duplicate-flow', title: 'Second flow' } as GuidedFlow;
    const draft = {
      ...emptyDraft,
      flowPatches: [{ id: 'duplicate-flow', sourceIndex: 1, patch: { title: 'Edited second flow' } }],
    };

    expect(
      mergeDashboardDrafts(
        { flows: [firstFlow, secondFlow], educationMaterials: [], educationGroups: [], contacts: [] },
        draft,
      ).flows,
    ).toEqual([firstFlow, { ...secondFlow, title: 'Edited second flow' }]);
  });

  it('applies legacy patches without source index to the first matching shipped record', () => {
    const firstFlow = { id: 'legacy-flow', title: 'First flow' } as GuidedFlow;
    const secondFlow = { id: 'legacy-flow', title: 'Second flow' } as GuidedFlow;
    const draft = {
      ...emptyDraft,
      flowPatches: [{ id: 'legacy-flow', patch: { title: 'Legacy edited flow' } }],
    };

    expect(
      mergeDashboardDrafts(
        { flows: [firstFlow, secondFlow], educationMaterials: [], educationGroups: [], contacts: [] },
        draft,
      ).flows,
    ).toEqual([{ ...firstFlow, title: 'Legacy edited flow' }, secondFlow]);
  });

  it('merges patched, added, and removed contacts by source index', () => {
    const firstDuplicate = { ...contact, name: 'First duplicate' };
    const secondDuplicate = { ...contact, name: 'Second duplicate' };
    const removedContact = { ...contact, id: 'removed-contact', name: 'Removed contact' };
    const addedContact = { ...contact, id: 'local-contact', name: 'Added contact' };
    const draft: DashboardDraftState = {
      ...emptyDraft,
      contactPatches: [
        { id: contact.id, sourceIndex: 1, sourceIdUnique: false, patch: { name: 'Edited second duplicate' } },
      ],
      addedContacts: [addedContact],
      removedContactIds: [removedContact.id],
    };

    expect(
      mergeDashboardDrafts(
        {
          flows: [],
          educationMaterials: [],
          educationGroups: [],
          contacts: [firstDuplicate, secondDuplicate, removedContact],
        },
        draft,
      ).contacts,
    ).toEqual([firstDuplicate, { ...secondDuplicate, name: 'Edited second duplicate' }, addedContact]);
  });

  it('keeps a unique indexed contact patch after shipped contacts are reordered', () => {
    const insertedContact = { ...contact, id: 'contact-two', name: 'Contact two' };
    const editedContact = { ...contact, name: 'Edited contact' };
    const shipped = {
      flows: [],
      educationMaterials: [],
      educationGroups: [],
      contacts: [insertedContact, contact],
    };
    const draft: DashboardDraftState = {
      ...emptyDraft,
      contactPatches: [{ id: contact.id, sourceIndex: 0, sourceIdUnique: true, patch: { name: editedContact.name } }],
    };

    const merged = mergeDashboardDrafts(shipped, draft);
    const exportBundle = buildExportBundle({
      shipped,
      drafts: merged,
      validation: { errors: [], warnings: [] },
      exportedAt: '2026-07-12T00:00:00.000Z',
    });

    expect(merged.contacts).toEqual([insertedContact, editedContact]);
    expect(exportBundle.changes.contacts).toEqual([editedContact]);
  });

  it.each([false, undefined])(
    'does not transfer a duplicate-origin contact patch after shipped duplicates collapse (%s)',
    (sourceIdUnique) => {
      const survivor = { ...contact, name: 'Surviving duplicate' };
      const draft: DashboardDraftState = {
        ...emptyDraft,
        contactPatches: [
          {
            id: contact.id,
            sourceIndex: 1,
            ...(sourceIdUnique === undefined ? {} : { sourceIdUnique }),
            patch: { name: 'Edited removed duplicate' },
          },
        ],
      };

      expect(
        mergeDashboardDrafts({ flows: [], educationMaterials: [], educationGroups: [], contacts: [survivor] }, draft)
          .contacts,
      ).toEqual([survivor]);
    },
  );

  it('does not apply an exact-index duplicate-origin patch after shipped duplicates collapse', () => {
    const survivor = { ...contact, name: 'Ambiguous surviving duplicate' };
    const draft: DashboardDraftState = {
      ...emptyDraft,
      contactPatches: [
        {
          id: contact.id,
          sourceIndex: 0,
          sourceIdUnique: false,
          patch: { name: 'Edited historical duplicate' },
        },
      ],
    };

    expect(
      mergeDashboardDrafts({ flows: [], educationMaterials: [], educationGroups: [], contacts: [survivor] }, draft)
        .contacts,
    ).toEqual([survivor]);
  });

  it('does not fall back by id when indexed patch occurrences are ambiguous', () => {
    const firstDuplicate = { ...contact, name: 'First duplicate' };
    const secondDuplicate = { ...contact, name: 'Second duplicate' };
    const draft: DashboardDraftState = {
      ...emptyDraft,
      contactPatches: [
        { id: contact.id, sourceIndex: 1, patch: { name: 'Edited second duplicate' } },
        { id: contact.id, sourceIndex: 2, patch: { name: 'Orphaned duplicate patch' } },
      ],
    };

    expect(
      mergeDashboardDrafts(
        {
          flows: [],
          educationMaterials: [],
          educationGroups: [],
          contacts: [firstDuplicate, secondDuplicate],
        },
        draft,
      ).contacts,
    ).toEqual([firstDuplicate, { ...secondDuplicate, name: 'Edited second duplicate' }]);
  });

  it('keeps unique education material and flow patches after shipped order shifts', () => {
    const originalMaterial = { id: 'mat-orig', title: 'Original Material' } as EducationResource;
    const insertedMaterial = { id: 'mat-inserted', title: 'Inserted Material' } as EducationResource;
    const originalFlow = { id: 'flow-orig', title: 'Original Flow' } as GuidedFlow;
    const insertedFlow = { id: 'flow-inserted', title: 'Inserted Flow' } as GuidedFlow;

    const draft: DashboardDraftState = {
      ...emptyDraft,
      educationMaterialPatches: [
        { id: 'mat-orig', sourceIndex: 0, sourceIdUnique: true, patch: { title: 'Edited Mat' } },
      ],
      flowPatches: [{ id: 'flow-orig', sourceIndex: 0, sourceIdUnique: true, patch: { title: 'Edited Flow' } }],
    };

    const shipped = {
      flows: [insertedFlow, originalFlow],
      educationMaterials: [insertedMaterial, originalMaterial],
      educationGroups: [],
      contacts: [],
    };

    const merged = mergeDashboardDrafts(shipped, draft);
    expect(merged.educationMaterials[1]).toEqual({ ...originalMaterial, title: 'Edited Mat' });
    expect(merged.flows[1]).toEqual({ ...originalFlow, title: 'Edited Flow' });
  });
});
