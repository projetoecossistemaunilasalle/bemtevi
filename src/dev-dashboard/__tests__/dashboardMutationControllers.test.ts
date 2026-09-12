import { describe, expect, it, vi } from 'vitest';
import type { PublishedContentPayload, PublishedContentSnapshot } from '../../app/content/publishedContent';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import { createEmptyDashboardDraftState, type DashboardDraftState } from '../draft-storage/dashboardStorage';
import { createWorkspace, type DraftWorkspace } from '../draft-storage/workspace';
import { createDashboardContactMutationController } from '../dashboardContactMutations';
import { createDashboardFlowMutationController } from '../dashboardFlowMutations';
import type { DashboardWorkspaceUpdater } from '../dashboardMutationTypes';
import { buildDashboardPublicationPayload, createDashboardPublicationSuccessHandler } from '../dashboardPublication';

function content(overrides: Partial<PublishedContentPayload> = {}): PublishedContentPayload {
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

function flow(id: string, title = id) {
  return { id, title } as unknown as GuidedFlow;
}

function contact(id: string, name = id) {
  return {
    id,
    name,
    type: 'CAPS',
    badgeTone: 'primary',
    city: 'Canoas',
    state: 'RS',
    address: 'Rua de teste, 1',
    phoneDisplay: '(51) 99999-9999',
    phoneHref: 'tel:51999999999',
    hours: 'Segunda a sexta',
    notes: '',
    review: { status: 'approved', reviewedBy: 'Teste', reviewedAt: '2026-09-12', notes: '' },
  } as ServiceDirectoryEntry;
}

function location(id: string): ServiceLocation {
  return { id, city: 'Canoas', state: 'RS' };
}

function captureDraftUpdate(initial = createEmptyDashboardDraftState()) {
  let latest: DashboardDraftState | undefined;
  return {
    updateDraftState(updater: (current: DashboardDraftState) => DashboardDraftState) {
      latest = updater(structuredClone(initial));
    },
    get latest() {
      return latest;
    },
  };
}

describe('dashboard mutation controllers', () => {
  it('keeps duplicate flow edits isolated by their merged source index', () => {
    const update = captureDraftUpdate();
    const controller = createDashboardFlowMutationController({
      shipped: content({ flows: [flow('same', 'primeiro'), flow('same', 'segundo')] }),
      updateDraftState: update.updateDraftState,
    });

    controller.onFlowChange(1, 'same', { title: 'segundo editado' });

    expect(update.latest?.flowPatches).toEqual([{ id: 'same', sourceIndex: 1, patch: { title: 'segundo editado' } }]);
  });

  it('rebases a unique patch when a record moves to a new source index', () => {
    const initial = createEmptyDashboardDraftState();
    initial.contactPatches = [{ id: 'contact-a', sourceIndex: 0, patch: { name: 'edição anterior' } }];
    const update = captureDraftUpdate(initial);
    const controller = createDashboardContactMutationController({
      shipped: content({ contacts: [contact('contact-b'), contact('contact-a')] }),
      draftState: initial,
      updateDraftState: update.updateDraftState,
      updateWorkspace: () => {},
    });

    controller.onServiceChange(1, 'contact-a', { name: 'edição atual' });

    expect(update.latest?.contactPatches).toEqual([
      { id: 'contact-a', sourceIndex: 1, sourceIdUnique: true, patch: { name: 'edição atual' } },
    ]);
  });

  it('keeps a location tombstone in the operation when the location is removed', () => {
    const update = captureDraftUpdate();
    const controller = createDashboardContactMutationController({
      shipped: content({ locations: [location('loc-a')] }),
      draftState: createEmptyDashboardDraftState(),
      updateDraftState: update.updateDraftState,
      updateWorkspace: () => {},
    });

    controller.onLocationRemove(0, 'loc-a');

    expect(update.latest?.removedLocationIds).toEqual(['loc-a']);
  });

  it('removes a service from the current workspace only when its index still owns the ID', () => {
    let workspace: DraftWorkspace = createWorkspace(content({ contacts: [contact('contact-a')] }), null);
    const updateWorkspace: DashboardWorkspaceUpdater = (updater) => {
      workspace = updater(workspace);
    };
    const controller = createDashboardContactMutationController({
      shipped: content({ contacts: [contact('contact-a')] }),
      draftState: createEmptyDashboardDraftState(),
      updateDraftState: () => {},
      updateWorkspace,
    });

    controller.onServiceRemove(0, 'contact-a');

    expect(workspace.local.contacts).toEqual([]);
  });
});

describe('dashboard publication adapter', () => {
  it('builds the payload consumed by PublishDashboard without dropping locations', () => {
    const payload = content({ locations: [location('loc-a')], defaultGroupOrder: 3 });

    expect(buildDashboardPublicationPayload(payload)).toEqual(payload);
  });

  it('clears the draft only when the confirmed-publication callback is invoked', () => {
    const clearDraft = vi.fn();
    const onPublished = createDashboardPublicationSuccessHandler(clearDraft);
    const snapshot = { revision: 4 } as PublishedContentSnapshot;

    expect(clearDraft).not.toHaveBeenCalled();
    onPublished(snapshot);
    expect(clearDraft).toHaveBeenCalledOnce();
  });
});
