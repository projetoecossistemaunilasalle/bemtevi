import { lazy, type ComponentType } from 'react';

type DashboardRouteModule = {
  DashboardRoute: ComponentType;
};

const dashboardRouteModules = import.meta.glob<DashboardRouteModule>('../dev-dashboard/DashboardRoute.tsx');
const dashboardRouteLoader = dashboardRouteModules['../dev-dashboard/DashboardRoute.tsx'];

export function isDevDashboardEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_DASHBOARD === 'true';
}

export function hasDevDashboardModule() {
  return Boolean(dashboardRouteLoader);
}

export function canShowDevDashboard() {
  return isDevDashboardEnabled() && hasDevDashboardModule();
}

export function createDevDashboardRoute() {
  if (!dashboardRouteLoader) return null;

  return lazy(() => dashboardRouteLoader().then((module) => ({ default: module.DashboardRoute })));
}
