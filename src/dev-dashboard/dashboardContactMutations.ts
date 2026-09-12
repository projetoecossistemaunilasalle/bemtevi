import type { PublishedContentPayload } from '../app/content/publishedContent';
import type { ServiceDirectoryEntry, ServiceLocation } from '../domain/services/types';
import { createLocalLocation, createLocalService } from './contacts/contactDrafts';
import type { DashboardDraftState } from './draft-storage/dashboardStorage';
import { resolveRecordOrigin, updateRecordAtIndex, upsertPatchById } from './dashboardModel';
import type { DashboardDraftUpdater, DashboardWorkspaceUpdater } from './dashboardMutationTypes';

export interface DashboardContactMutationController {
  onServiceChange: (serviceIndex: number, serviceId: string, patch: Partial<ServiceDirectoryEntry>) => void;
  onServiceAdd: () => string;
  onServiceRemove: (serviceIndex: number, serviceId: string) => void;
  onLocationChange: (locationIndex: number, locationId: string, patch: Partial<ServiceLocation>) => void;
  onLocationAdd: () => string;
  onLocationRemove: (locationIndex: number, locationId: string) => void;
}

export function createDashboardContactMutationController({
  shipped,
  draftState,
  updateDraftState,
  updateWorkspace,
}: {
  shipped: PublishedContentPayload;
  draftState: DashboardDraftState;
  updateDraftState: DashboardDraftUpdater;
  updateWorkspace: DashboardWorkspaceUpdater;
}): DashboardContactMutationController {
  return {
    onServiceChange: (serviceIndex, serviceId, patch) =>
      updateDraftState((current) => {
        const origin = resolveRecordOrigin(
          shipped.contacts,
          current.addedContacts,
          current.removedContactIds ?? [],
          serviceIndex,
          serviceId,
        );
        if (!origin || origin.id !== serviceId) return current;

        if (origin.kind === 'added') {
          return { ...current, addedContacts: updateRecordAtIndex(current.addedContacts, origin.addedIndex, patch) };
        }

        return {
          ...current,
          contactPatches: upsertPatchById(
            current.contactPatches,
            origin.id,
            origin.sourceIndex,
            patch,
            shipped.contacts.filter((contact) => contact.id === origin.id).length === 1,
          ),
        };
      }),
    onServiceAdd: () => {
      const newService = createLocalService(
        shipped.contacts.map((service) => service.id),
        shipped.locations,
      );
      updateDraftState((current) => ({ ...current, addedContacts: [...current.addedContacts, newService] }));
      return newService.id;
    },
    onServiceRemove: (serviceIndex, serviceId) =>
      updateWorkspace((current) => {
        if (current.local.contacts[serviceIndex]?.id !== serviceId) return current;
        return {
          ...current,
          local: {
            ...current.local,
            contacts: current.local.contacts.filter((_, index) => index !== serviceIndex),
          },
          reconciliation: undefined,
        };
      }),
    onLocationChange: (locationIndex, locationId, patch) =>
      updateDraftState((current) => {
        const origin = resolveRecordOrigin(
          shipped.locations ?? [],
          current.addedLocations,
          current.removedLocationIds ?? [],
          locationIndex,
          locationId,
        );
        if (!origin || origin.id !== locationId) return current;

        if (origin.kind === 'added') {
          return { ...current, addedLocations: updateRecordAtIndex(current.addedLocations, origin.addedIndex, patch) };
        }

        return {
          ...current,
          locationPatches: upsertPatchById(
            current.locationPatches,
            origin.id,
            origin.sourceIndex,
            patch,
            (shipped.locations ?? []).filter((location) => location.id === origin.id).length === 1,
          ),
        };
      }),
    onLocationAdd: () => {
      const existingIds = [
        ...(shipped.locations ?? []).map((location) => location.id),
        ...draftState.addedLocations.map((location) => location.id),
        ...(draftState.removedLocationIds ?? []),
      ];
      const newLocation = createLocalLocation(existingIds);
      updateDraftState((current) => ({ ...current, addedLocations: [...current.addedLocations, newLocation] }));
      return newLocation.id;
    },
    onLocationRemove: (locationIndex, locationId) =>
      updateDraftState((current) => {
        const origin = resolveRecordOrigin(
          shipped.locations ?? [],
          current.addedLocations,
          current.removedLocationIds ?? [],
          locationIndex,
          locationId,
        );
        if (!origin || origin.id !== locationId) return current;
        if (shipped.contacts.some((contact) => contact.locationId === origin.id)) return current;

        if (origin.kind === 'added') {
          return {
            ...current,
            addedLocations: current.addedLocations.filter((_, index) => index !== origin.addedIndex),
            removedLocationIds: [...new Set([...(current.removedLocationIds ?? []), origin.id])],
          };
        }

        return {
          ...current,
          locationPatches: current.locationPatches.filter((patch) => patch.id !== origin.id),
          removedLocationIds: [...new Set([...(current.removedLocationIds ?? []), origin.id])],
        };
      }),
  };
}
