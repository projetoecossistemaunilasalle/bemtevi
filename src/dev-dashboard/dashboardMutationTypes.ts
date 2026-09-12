import type { DashboardDraftState } from './draft-storage/dashboardStorage';
import type { DraftWorkspace } from './draft-storage/workspace';

export type DashboardDraftUpdater = (updater: (current: DashboardDraftState) => DashboardDraftState) => void;

export type DashboardWorkspaceUpdater = (updater: (current: DraftWorkspace) => DraftWorkspace) => void;
