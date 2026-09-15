import { describe, expect, it } from 'vitest';
import type { PublishedContentPayload } from '../../app/content/publishedContent';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import type { ServiceDirectoryEntry, ServiceLocation } from '../../domain/services/types';
import { createEmptyDashboardDraftState, type DashboardDraftState } from '../dashboardDraftState';
import { createDashboardContactMutationController } from '../dashboardContactMutations';
import { createDashboardFlowMutationController } from '../dashboardFlowMutations';

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
    });

    controller.onLocationRemove(0, 'loc-a');

    expect(update.latest?.removedLocationIds).toEqual(['loc-a']);
  });

  it('tombstones a shipped service only when its merged index still owns the ID', () => {
    const update = captureDraftUpdate();
    const controller = createDashboardContactMutationController({
      shipped: content({ contacts: [contact('contact-a'), contact('contact-b')] }),
      draftState: createEmptyDashboardDraftState(),
      updateDraftState: update.updateDraftState,
    });

    controller.onServiceRemove(1, 'contact-b');

    expect(update.latest?.removedContactIds).toEqual(['contact-b']);
  });

  it('ignores a service removal when the selected index belongs to another ID', () => {
    const update = captureDraftUpdate();
    const controller = createDashboardContactMutationController({
      shipped: content({ contacts: [contact('contact-a')] }),
      draftState: createEmptyDashboardDraftState(),
      updateDraftState: update.updateDraftState,
    });

    controller.onServiceRemove(0, 'contact-b');

    expect(update.latest).toEqual(createEmptyDashboardDraftState());
  });
});
