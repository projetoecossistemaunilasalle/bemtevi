import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishedContentPayload } from '../../app/content/publishedContent';
import type { EducationResource } from '../../domain/resources/types';
import { canoasServices } from '../../content/services/canoas-services';
import { getShippedDashboardContent } from '../content/shippedContent';
import {
  DASHBOARD_DRAFT_SCHEMA_VERSION,
  clearDashboardDrafts,
  createEmptyDashboardDraftState,
  exportDraftAsJson,
  importDraftFromJson,
  loadDashboardDrafts,
  resetDashboardDrafts,
  restoreDraftFromIndexedDbFallback,
  saveDashboardDrafts,
  type DashboardDraftState,
} from '../draft-storage/dashboardStorage';
import * as draftDbModule from '../draft-storage/draftDb';
import { contact, emptyDraft } from './dashboardStorageTestFixtures';

describe('dashboardStorage - lifecycle', () => {
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
      locationPatches: [],
      addedContacts: [],
      addedLocations: [],
      removedGroupIds: [],
      removedFlowIds: [],
      removedContactIds: [],
      removedLocationIds: [],
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

    expect(DASHBOARD_DRAFT_SCHEMA_VERSION).toBe('6.0.0');
    expect(loadDashboardDrafts()).toEqual({ ...v3Draft, baseRevision: null });
  });

  it('persists the database revision on which a draft is based', () => {
    const draft = { ...emptyDraft, baseRevision: 7 };

    saveDashboardDrafts(draft);

    expect(loadDashboardDrafts().baseRevision).toBe(7);
  });

  it('persists the content base used for concurrent merge checks', () => {
    const basePayload: PublishedContentPayload = {
      flows: [],
      educationMaterials: [],
      educationGroups: [],
      contacts: [contact],
      locations: [],
      defaultGroupOrder: 0,
    };
    const draft = { ...emptyDraft, baseRevision: 7, basePayload };

    saveDashboardDrafts(draft);

    expect(loadDashboardDrafts().basePayload).toEqual(basePayload);
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

  it('includes educationGroups in shipped content', () => {
    const shipped = getShippedDashboardContent();
    expect(shipped.educationGroups).toBeDefined();
    expect(shipped.educationGroups.length).toBeGreaterThan(0);
  });

  it('includes Canoas services in shipped contacts', () => {
    expect(getShippedDashboardContent().contacts).toMatchObject(canoasServices.services);
    expect(getShippedDashboardContent().locations.some((l) => l.city === 'Canoas')).toBe(true);
    expect(getShippedDashboardContent().locations.length).toBeGreaterThan(0);
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
    expect(draft.locationPatches).toEqual([]);
    expect(draft.addedLocations).toEqual([]);
    expect(draft.removedLocationIds).toEqual([]);
  });

  it('starts with an empty draft when browser storage is unavailable', () => {
    const unavailableStorage = {
      getItem() {
        throw new DOMException('Storage unavailable');
      },
    } as unknown as Storage;

    expect(loadDashboardDrafts(unavailableStorage)).toEqual(createEmptyDashboardDraftState());
  });

  it('exports and imports draft JSON faithfully', () => {
    const draft: DashboardDraftState = {
      ...emptyDraft,
      flowPatches: [{ id: 'flow-one', sourceIndex: 0, sourceIdUnique: true, patch: { title: 'Flow Backup' } }],
      contactPatches: [{ id: 'contact-one', sourceIndex: 0, sourceIdUnique: true, patch: { name: 'Contact Backup' } }],
      addedEducationMaterials: [{ id: 'material-local-1', title: 'Local Mat' } as EducationResource],
      updatedAt: '2026-08-26T12:00:00.000Z',
    };

    const json = exportDraftAsJson(draft);
    expect(typeof json).toBe('string');
    const imported = importDraftFromJson(json);
    expect(imported.flowPatches).toEqual(draft.flowPatches);
    expect(imported.contactPatches).toEqual(draft.contactPatches);
    expect(imported.addedEducationMaterials).toEqual(draft.addedEducationMaterials);
  });

  it('preserves the base and reports quota failure without saving a truncated draft', () => {
    let callCount = 0;
    const mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn((_key: string, _val: string) => {
        callCount++;
        if (callCount === 1) {
          throw new DOMException('QuotaExceededError');
        }
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as unknown as Storage;

    const heavyDraft: DashboardDraftState = {
      ...emptyDraft,
      basePayload: {
        flows: [],
        educationMaterials: [],
        educationGroups: [],
        contacts: [],
        locations: [],
        defaultGroupOrder: 0,
      },
      flowPatches: [{ id: 'flow-1', patch: { title: 'Patched' } }],
    };

    expect(() => saveDashboardDrafts(heavyDraft, mockStorage)).toThrow();
    expect(mockStorage.setItem).toHaveBeenCalledTimes(1);
    const saved = JSON.parse((mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0][1] as string);
    expect(saved.basePayload).toEqual(heavyDraft.basePayload);
    expect(saved.flowPatches).toEqual(heavyDraft.flowPatches);
  });

  it('restores draft from IndexedDB fallback when localStorage is empty', async () => {
    const dbDraft: DashboardDraftState = {
      ...emptyDraft,
      flowPatches: [{ id: 'flow-1', patch: { title: 'Restored from DB' } }],
      updatedAt: '2026-08-26T12:00:00.000Z',
    };
    const spy = vi.spyOn(draftDbModule, 'loadDraftFromIndexedDb').mockResolvedValueOnce(dbDraft);

    const restored = await restoreDraftFromIndexedDbFallback();
    expect(restored).toEqual(dbDraft);
    expect(loadDashboardDrafts().flowPatches).toEqual(dbDraft.flowPatches);
    spy.mockRestore();
  });

  it('does not overwrite newer localStorage draft with older IndexedDB draft', async () => {
    const localDraft: DashboardDraftState = {
      ...emptyDraft,
      flowPatches: [{ id: 'flow-1', patch: { title: 'Newer local draft' } }],
      updatedAt: '2026-08-26T14:00:00.000Z',
    };
    saveDashboardDrafts(localDraft);

    const olderDbDraft: DashboardDraftState = {
      ...emptyDraft,
      flowPatches: [{ id: 'flow-1', patch: { title: 'Older DB draft' } }],
      updatedAt: '2026-08-26T12:00:00.000Z',
    };
    const spy = vi.spyOn(draftDbModule, 'loadDraftFromIndexedDb').mockResolvedValueOnce(olderDbDraft);

    const restored = await restoreDraftFromIndexedDbFallback();
    expect(restored).toBeNull();
    expect(loadDashboardDrafts().flowPatches[0].patch.title).toBe('Newer local draft');
    spy.mockRestore();
  });
});
