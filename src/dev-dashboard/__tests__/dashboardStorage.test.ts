import { beforeEach, describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import type { ServiceDirectoryEntry } from '../../domain/services/types';
import { canoasServices } from '../../content/services/canoas-services';
import type { DashboardDraftState } from '../draft-storage/dashboardStorage';
import {
  DASHBOARD_DRAFT_SCHEMA_VERSION,
  clearDashboardDrafts,
  loadDashboardDrafts,
  mergeDashboardDrafts,
  saveDashboardDrafts,
} from '../draft-storage/dashboardStorage';
import { getShippedDashboardContent } from '../content/shippedContent';

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
  defaultGroupOrder: 0,
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
      defaultGroupOrder: 0,
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

    expect(DASHBOARD_DRAFT_SCHEMA_VERSION).toBe('3.0.0');
    expect(loadDashboardDrafts()).toEqual(v3Draft);
  });

  it('clears dashboard drafts', () => {
    saveDashboardDrafts(emptyDraft);
    clearDashboardDrafts();

    expect(loadDashboardDrafts().updatedAt).toBeNull();
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
      contactPatches: [{ id: contact.id, sourceIndex: 1, patch: { name: 'Edited second duplicate' } }],
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
    expect(draft.defaultGroupOrder).toBe(0);
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
    localStorage.setItem('secuida:dev-dashboard:drafts:v1', JSON.stringify(v1Draft));

    const loaded = loadDashboardDrafts();

    expect(loaded.schemaVersion).toBe(DASHBOARD_DRAFT_SCHEMA_VERSION);
    expect(loaded.flowPatches).toEqual(v1Draft.flowPatches);
    expect(loaded.educationMaterialPatches).toEqual(v1Draft.educationMaterialPatches);
    expect(loaded.addedFlows).toEqual(v1Draft.addedFlows);
    expect(loaded.addedEducationMaterials).toEqual(v1Draft.addedEducationMaterials);
    expect(loaded.updatedAt).toBe(v1Draft.updatedAt);
    expect(loaded.groupPatches).toEqual([]);
    expect(loaded.addedGroups).toEqual([]);
    expect(loaded.defaultGroupOrder).toBe(0);
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
    localStorage.setItem('secuida:dev-dashboard:drafts:v1', JSON.stringify(v2Draft));

    expect(loadDashboardDrafts()).toEqual({
      ...v2Draft,
      schemaVersion: DASHBOARD_DRAFT_SCHEMA_VERSION,
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
      defaultGroupOrder: 0,
      updatedAt: null,
    };
    localStorage.setItem('secuida:dev-dashboard:drafts:v1', JSON.stringify(incompleteV3Draft));

    expect(loadDashboardDrafts()).toEqual({
      ...incompleteV3Draft,
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
    localStorage.setItem('secuida:dev-dashboard:drafts:v1', JSON.stringify(malformedV3Draft));

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
    localStorage.setItem('secuida:dev-dashboard:drafts:v1', JSON.stringify(unknownDraft));

    const loaded = loadDashboardDrafts();

    expect(loaded.schemaVersion).toBe(DASHBOARD_DRAFT_SCHEMA_VERSION);
    expect(loaded.groupPatches).toEqual([]);
    expect(loaded.addedGroups).toEqual([]);
    expect(loaded.defaultGroupOrder).toBe(0);
    expect(loaded.removedGroupIds).toEqual([]);
    expect(loaded.removedFlowIds).toEqual([]);
    expect(loaded.contactPatches).toEqual([]);
    expect(loaded.addedContacts).toEqual([]);
    expect(loaded.removedContactIds).toEqual([]);
    expect(loaded.updatedAt).toBeNull();
  });
});
