import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAdmin, RequireAnonymousAdmin } from './auth/RequireAdmin';
import { canShowDevDashboard, createDevDashboardRoute } from './devDashboard';
import { routes } from './routes';
import { AppShell } from './shell/AppShell';
import { ContactsScreen } from '../features/contacts/ContactsScreen';
import { EducationLibraryScreen } from '../features/education/EducationLibraryScreen';
import { ResourceDetailScreen } from '../features/education/ResourceDetailScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { OrientationScreen } from '../features/orientation/OrientationScreen';
import { SupportScreen } from '../features/support/SupportScreen';
import { AdminLoginScreen } from '../features/admin-login/AdminLoginScreen';

const DevDashboardRoute = createDevDashboardRoute();

export function Router() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path={routes.home} element={<HomeScreen />} />
        <Route path={routes.orientation} element={<OrientationScreen />} />
        <Route path={routes.support} element={<SupportScreen />} />
        <Route path={routes.contacts} element={<ContactsScreen />} />
        <Route path={routes.education} element={<EducationLibraryScreen />} />
        <Route path={routes.educationDetail} element={<ResourceDetailScreen />} />
        {canShowDevDashboard() && (
          <Route
            path={routes.login}
            element={
              <RequireAnonymousAdmin>
                <AdminLoginScreen />
              </RequireAnonymousAdmin>
            }
          />
        )}
        {canShowDevDashboard() && DevDashboardRoute && (
          <Route
            path={routes.dashboard}
            element={
              <RequireAdmin>
                <Suspense fallback={null}>
                  <DevDashboardRoute />
                </Suspense>
              </RequireAdmin>
            }
          />
        )}
        <Route path="*" element={<Navigate to={routes.home} replace />} />
      </Route>
    </Routes>
  );
}
