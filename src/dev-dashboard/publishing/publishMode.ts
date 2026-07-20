export type DashboardPublishMode = 'database' | 'export';

export function getDashboardPublishMode(
  value: string | undefined = import.meta.env.VITE_DASHBOARD_PUBLISH_MODE,
): DashboardPublishMode {
  return value === 'export' ? 'export' : 'database';
}
