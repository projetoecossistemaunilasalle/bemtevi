import type { DashboardDraftState } from './dashboardDraftState';

export type DashboardDraftUpdater = (updater: (current: DashboardDraftState) => DashboardDraftState) => void;
