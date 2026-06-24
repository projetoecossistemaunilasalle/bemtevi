import { beforeEach, describe, expect, it } from 'vitest';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { EducationResource } from '../../domain/resources/types';
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
  updatedAt: '2026-05-22T00:00:00.000Z',
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
      updatedAt: null,
    });
  });

  it('saves and loads dashboard drafts', () => {
    saveDashboardDrafts(emptyDraft);

    expect(loadDashboardDrafts()).toEqual(emptyDraft);
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
      mergeDashboardDrafts({ flows: [shippedFlow], educationMaterials: [shippedMaterial], educationGroups: [] }, draft),
    ).toEqual({
      flows: [{ ...shippedFlow, title: 'Edited flow' }],
      educationMaterials: [shippedMaterial],
      educationGroups: [],
    });
  });

  it('keeps duplicate IDs isolated by source index while editing', () => {
    const firstFlow = { id: 'duplicate-flow', title: 'First flow' } as GuidedFlow;
    const secondFlow = { id: 'duplicate-flow', title: 'Second flow' } as GuidedFlow;
    const draft = {
      ...emptyDraft,
      flowPatches: [{ id: 'duplicate-flow', sourceIndex: 1, patch: { title: 'Edited second flow' } }],
    };

    expect(
      mergeDashboardDrafts({ flows: [firstFlow, secondFlow], educationMaterials: [], educationGroups: [] }, draft)
        .flows,
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
      mergeDashboardDrafts({ flows: [firstFlow, secondFlow], educationMaterials: [], educationGroups: [] }, draft)
        .flows,
    ).toEqual([{ ...firstFlow, title: 'Legacy edited flow' }, secondFlow]);
  });

  it('includes educationGroups in shipped content', () => {
    const shipped = getShippedDashboardContent();
    expect(shipped.educationGroups).toBeDefined();
    expect(shipped.educationGroups.length).toBeGreaterThan(0);
  });

  it('includes groupPatches and addedGroups in draft state', () => {
    const draft = loadDashboardDrafts();
    expect(draft.groupPatches).toEqual([]);
    expect(draft.addedGroups).toEqual([]);
  });

  it('migrates v1 localStorage value to v2 preserving existing fields', () => {
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
  });

  it('migrates v1 draft with group data to v2 preserving groups', () => {
    const v1Draft = {
      schemaVersion: '1.0.0',
      flowPatches: [],
      educationMaterialPatches: [],
      addedFlows: [],
      addedEducationMaterials: [],
      updatedAt: '2026-05-22T00:00:00.000Z',
      groupPatches: [{ id: 'auto-cuidado', sourceIndex: 0, patch: { title: 'Edited Group' } }],
      addedGroups: [{ id: 'new-group', title: 'New Group', order: 5 }],
    };
    localStorage.setItem('secuida:dev-dashboard:drafts:v1', JSON.stringify(v1Draft));

    const loaded = loadDashboardDrafts();

    expect(loaded.schemaVersion).toBe(DASHBOARD_DRAFT_SCHEMA_VERSION);
    expect(loaded.groupPatches).toEqual(v1Draft.groupPatches);
    expect(loaded.addedGroups).toEqual(v1Draft.addedGroups);
  });

  it('resets to empty v2 draft for unknown schema version', () => {
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
    expect(loaded.flowPatches).toEqual([]);
    expect(loaded.addedGroups).toEqual([]);
    expect(loaded.updatedAt).toBeNull();
  });
});
