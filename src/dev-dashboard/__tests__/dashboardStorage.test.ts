import { beforeEach, describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { ServiceDirectoryEntry } from '../../domain/services/types';
import { canoasServices } from '../../content/services/canoas-services';
import type { DashboardDraftState } from '../draft-storage/dashboardStorage';
import {
  DASHBOARD_DRAFT_SCHEMA_VERSION,
  clearDashboardDrafts,
  createEmptyDashboardDraftState,
  loadDashboardDrafts,
  mergeDashboardDrafts,
  resetDashboardDrafts,
  saveDashboardDrafts,
} from '../draft-storage/dashboardStorage';
import { getShippedDashboardContent } from '../content/shippedContent';
import { buildExportBundle } from '../export/exportBundle';

const emptyDraft: DashboardDraftState = {
  schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
  flowPatches: [],
  educationMaterialPatches: [],
  groupPatches: [],
  addedFlows: [],
  addedEducationMaterials: [],
  addedGroups: [],
  contactPatches: [],
  addedContacts: [],
  removedGroupIds: [],
  removedFlowIds: [],
  removedContactIds: [],
  updatedAt: '2026-05-22T00:00:00.000Z',
};

const contact: ServiceDirectoryEntry = {
  id: 'contact-one',
  name: 'Contact one',
  type: 'CAPS',
  badgeTone: 'primary',
  city: 'Canoas',
  state: 'RS',
  address: 'Rua Um, 123',
  phoneDisplay: '(51) 3000-0000',
  phoneHref: 'tel:5130000000',
  review: {
    status: 'pending_review',
    reviewedBy: null,
    reviewedAt: null,
    notes: '',
  },
};

describe('dashboardStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty draft when storage is empty', () => {
    expect(loadDashboardDrafts()).toEqual({
      schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
      flowPatches: [],
      educationMaterialPatches: [],
      groupPatches: [],
      addedFlows: [],
      addedEducationMaterials: [],
      addedGroups: [],
      contactPatches: [],
      addedContacts: [],
      removedGroupIds: [],
      removedFlowIds: [],
      removedContactIds: [],
      updatedAt: null,
    });
  });

  it('saves and loads v3 dashboard drafts', () => {
    const v3Draft: DashboardDraftState = {
      ...emptyDraft,
      contactPatches: [{ id: contact.id, sourceIndex: 0, patch: { name: 'Edited contact' } }],
      addedContacts: [{ ...contact, id: 'local-contact' }],
      removedContactIds: ['removed-contact'],
    };

    saveDashboardDrafts(v3Draft);

    expect(DASHBOARD_DRAFT_SCHEMA_VERSION).toBe('4.0.0');
    expect(loadDashboardDrafts()).toEqual({ ...v3Draft, baseRevision: null });
  });

  it('persists the database revision on which a draft is based', () => {
    const draft = { ...emptyDraft, baseRevision: 7 };

    saveDashboardDrafts(draft);

    expect(loadDashboardDrafts().baseRevision).toBe(7);
  });

  it('marks a pre-revision non-empty draft as conflict-only instead of rebasing it', () => {
    const legacyDraft = {
      ...emptyDraft,
      contactPatches: [{ id: contact.id, sourceIndex: 0, patch: { name: 'Legacy edit' } }],
    };
    delete (legacyDraft as Partial<DashboardDraftState>).baseRevision;
    saveDashboardDrafts(legacyDraft);

    expect(loadDashboardDrafts().baseRevision).toBeNull();
  });

  it('clears dashboard drafts', () => {
    saveDashboardDrafts(emptyDraft);
    clearDashboardDrafts();

    expect(loadDashboardDrafts().updatedAt).toBeNull();
  });

  it('resets dashboard drafts to an empty state in storage and returns it', () => {
    saveDashboardDrafts({ ...emptyDraft, defaultGroupOrder: 5 });

    const result = resetDashboardDrafts();

    expect(result).toEqual(createEmptyDashboardDraftState());
    expect(loadDashboardDrafts()).toEqual(createEmptyDashboardDraftState());
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

  it('includes educationGroups in shipped content', () => {
    const shipped = getShippedDashboardContent();
    expect(shipped.educationGroups).toBeDefined();
    expect(shipped.educationGroups.length).toBeGreaterThan(0);
  });

  it('includes Canoas services in shipped contacts', () => {
    expect(getShippedDashboardContent().contacts).toEqual(canoasServices.services);
  });

  it('includes group and contact draft collections in draft state', () => {
    const draft = loadDashboardDrafts();
    expect(draft.groupPatches).toEqual([]);
    expect(draft.addedGroups).toEqual([]);
    expect(draft.defaultGroupOrder).toBeUndefined();
    expect(draft.removedGroupIds).toEqual([]);
    expect(draft.removedFlowIds).toEqual([]);
    expect(draft.contactPatches).toEqual([]);
    expect(draft.addedContacts).toEqual([]);
    expect(draft.removedContactIds).toEqual([]);
  });

  it('migrates v1 localStorage value to v3 preserving existing fields', () => {
    const v1Draft = {
      schemaVersion: '1.0.0',
      flowPatches: [{ id: 'flow-one', sourceIndex: 0, patch: { title: 'Edited' } }],
      educationMaterialPatches: [],
      addedFlows: [],
      addedEducationMaterials: [],
      updatedAt: '2026-05-22T00:00:00.000Z',
    };
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(v1Draft));

    const loaded = loadDashboardDrafts();

    expect(loaded.schemaVersion).toBe(DASHBOARD_DRAFT_SCHEMA_VERSION);
    expect(loaded.flowPatches).toEqual(v1Draft.flowPatches);
    expect(loaded.educationMaterialPatches).toEqual(v1Draft.educationMaterialPatches);
    expect(loaded.addedFlows).toEqual(v1Draft.addedFlows);
    expect(loaded.addedEducationMaterials).toEqual(v1Draft.addedEducationMaterials);
    expect(loaded.updatedAt).toBe(v1Draft.updatedAt);
    expect(loaded.groupPatches).toEqual([]);
    expect(loaded.addedGroups).toEqual([]);
    expect(loaded.defaultGroupOrder).toBeUndefined();
    expect(loaded.removedGroupIds).toEqual([]);
    expect(loaded.removedFlowIds).toEqual([]);
    expect(loaded.contactPatches).toEqual([]);
    expect(loaded.addedContacts).toEqual([]);
    expect(loaded.removedContactIds).toEqual([]);
  });

  it('migrates v2 localStorage value to v3 preserving existing fields', () => {
    const v2Draft = {
      schemaVersion: '2.0.0',
      flowPatches: [{ id: 'flow-one', sourceIndex: 0, patch: { title: 'Edited flow' } }],
      educationMaterialPatches: [{ id: 'material-one', sourceIndex: 0, patch: { title: 'Edited material' } }],
      groupPatches: [{ id: 'group-one', sourceIndex: 0, patch: { title: 'Edited group' } }],
      addedFlows: [{ id: 'local-flow', title: 'Local flow' } as GuidedFlow],
      addedEducationMaterials: [{ id: 'local-material', title: 'Local material' } as EducationResource],
      addedGroups: [{ id: 'local-group', title: 'Local group', order: 4 }],
      defaultGroupOrder: 3,
      removedGroupIds: ['removed-group'],
      removedFlowIds: ['removed-flow'],
      updatedAt: '2026-06-15T00:00:00.000Z',
    };
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(v2Draft));

    expect(loadDashboardDrafts()).toEqual({
      ...v2Draft,
      schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
      baseRevision: null,
      contactPatches: [],
      addedContacts: [],
      removedContactIds: [],
    });
  });

  it('defaults absent v3 contact and removal collections', () => {
    const incompleteV3Draft = {
      schemaVersion: '3.0.0',
      flowPatches: [],
      educationMaterialPatches: [],
      groupPatches: [],
      addedFlows: [],
      addedEducationMaterials: [],
      addedGroups: [],
      updatedAt: null,
    };
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(incompleteV3Draft));

    expect(loadDashboardDrafts()).toEqual({
      ...incompleteV3Draft,
      schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
      removedGroupIds: [],
      removedFlowIds: [],
      contactPatches: [],
      addedContacts: [],
      removedContactIds: [],
    });
  });

  it('normalizes malformed v3 contact collections before merge', () => {
    const malformedV3Draft = {
      schemaVersion: '3.0.0',
      flowPatches: [],
      educationMaterialPatches: [],
      groupPatches: [],
      contactPatches: { id: contact.id, patch: { name: 'Invalid patch collection' } },
      addedFlows: [],
      addedEducationMaterials: [],
      addedGroups: [],
      addedContacts: 'invalid additions',
      defaultGroupOrder: 0,
      removedGroupIds: [],
      removedFlowIds: [],
      removedContactIds: { id: contact.id },
      updatedAt: null,
    };
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(malformedV3Draft));

    const loaded = loadDashboardDrafts();

    expect(loaded.contactPatches).toEqual([]);
    expect(loaded.addedContacts).toEqual([]);
    expect(loaded.removedContactIds).toEqual([]);
    expect(
      mergeDashboardDrafts({ flows: [], educationMaterials: [], educationGroups: [], contacts: [contact] }, loaded)
        .contacts,
    ).toEqual([contact]);
  });

  it('resets to empty v3 draft for unknown schema version', () => {
    const unknownDraft = {
      schemaVersion: '0.0.0',
      flowPatches: [{ id: 'flow-one', sourceIndex: 0, patch: { title: 'Edited' } }],
      educationMaterialPatches: [],
      addedFlows: [],
      addedEducationMaterials: [],
      updatedAt: '2026-05-22T00:00:00.000Z',
    };
    localStorage.setItem('bemtevi:dev-dashboard:drafts:v1', JSON.stringify(unknownDraft));

    const loaded = loadDashboardDrafts();

    expect(loaded.schemaVersion).toBe(DASHBOARD_DRAFT_SCHEMA_VERSION);
    expect(loaded.groupPatches).toEqual([]);
    expect(loaded.addedGroups).toEqual([]);
    expect(loaded.defaultGroupOrder).toBeUndefined();
    expect(loaded.removedGroupIds).toEqual([]);
    expect(loaded.removedFlowIds).toEqual([]);
    expect(loaded.contactPatches).toEqual([]);
    expect(loaded.addedContacts).toEqual([]);
    expect(loaded.removedContactIds).toEqual([]);
    expect(loaded.updatedAt).toBeNull();
  });
});
