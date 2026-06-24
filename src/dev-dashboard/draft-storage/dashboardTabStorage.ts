import type { DashboardTab } from '../components/DashboardShell';

/**
 * Persists the active dashboard tab across reloads, mirroring the localStorage
 * convention used by `dashboardStorage.ts` (secuida: namespace, plain value).
 * Falls back to `defaultTab` when storage is unavailable or holds garbage.
 */
const STORAGE_KEY = 'secuida:dev-dashboard:active-tab';

const validTabs: readonly DashboardTab[] = ['flows', 'education', 'export'];

export function loadActiveTab(defaultTab: DashboardTab = 'flows'): DashboardTab {
  if (typeof window === 'undefined') return defaultTab;

  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value && (validTabs as readonly string[]).includes(value)) {
      return value as DashboardTab;
    }
  } catch {
    // Storage may be blocked; fall through to default.
  }

  return defaultTab;
}

export function saveActiveTab(tab: DashboardTab) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    // Ignore write failures (e.g. private mode quota).
  }
}
