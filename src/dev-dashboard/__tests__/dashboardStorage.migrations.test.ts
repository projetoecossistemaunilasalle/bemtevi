import { beforeEach, describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
import {
  DASHBOARD_DRAFT_SCHEMA_VERSION,
  loadDashboardDrafts,
  mergeDashboardDrafts,
  saveDashboardDrafts,
  type DashboardDraftState,
} from '../draft-storage/dashboardStorage';
import { contact, emptyDraft } from './dashboardStorageTestFixtures';

describe('dashboardStorage - migrations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates v4 drafts to v6 without losing contact edits', () => {
    localStorage.setItem(
      'bemtevi:dev-dashboard:drafts:v1',
      JSON.stringify({
        schemaVersion: '4.0.0',
        flowPatches: [],
        educationMaterialPatches: [],
        groupPatches: [],
        contactPatches: [{ id: contact.id, sourceIndex: 0, patch: { name: 'Contato editado' } }],
        addedFlows: [],
        addedEducationMaterials: [],
        addedGroups: [],
        addedContacts: [],
        removedGroupIds: [],
        removedFlowIds: [],
        removedEducationMaterialIds: [],
        removedContactIds: [],
        updatedAt: null,
      }),
    );

    const loaded = loadDashboardDrafts();

    expect(loaded.schemaVersion).toBe('6.0.0');
    expect(loaded.contactPatches).toEqual([{ id: contact.id, sourceIndex: 0, patch: { name: 'Contato editado' } }]);
    expect(loaded.locationPatches).toEqual([]);
    expect(loaded.addedLocations).toEqual([]);
    expect(loaded.removedLocationIds).toEqual([]);
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
      locationPatches: [],
      addedLocations: [],
      removedLocationIds: [],
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
      locationPatches: [],
      addedLocations: [],
      removedLocationIds: [],
      baseRevision: undefined,
      defaultGroupOrder: undefined,
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
