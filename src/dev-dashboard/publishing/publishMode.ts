/** Content is published only through the Neon-backed Dashboard. */
export const DASHBOARD_PUBLISH_MODE = 'database' as const;

export type DashboardPublishMode = typeof DASHBOARD_PUBLISH_MODE;

/**
 * Kept as a compatibility boundary while callers migrate away from publish-mode
 * configuration. Environment variables must not enable an alternate writer.
 */
export function getDashboardPublishMode(): DashboardPublishMode {
  return DASHBOARD_PUBLISH_MODE;
}
