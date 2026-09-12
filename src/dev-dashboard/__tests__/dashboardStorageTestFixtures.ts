import type { ServiceDirectoryEntry } from '../../domain/services/types';
import { DASHBOARD_DRAFT_SCHEMA_VERSION, type DashboardDraftState } from '../draft-storage/dashboardStorage';

export const emptyDraft: DashboardDraftState = {
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
  updatedAt: '2026-05-22T00:00:00.000Z',
};

export const contact: ServiceDirectoryEntry = {
  id: 'contact-one',
  name: 'Contact one',
  type: 'CAPS',
  badgeTone: 'primary',
  city: 'Canoas',
  state: 'RS',
  locationId: 'loc-canoas-rs',
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
