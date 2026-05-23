import { Route, Routes } from 'react-router-dom';
import { routes } from './routes';
import { AppShell } from './shell/AppShell';
import { ContactsScreen } from '../features/contacts/ContactsScreen';
import { EducationLibraryScreen } from '../features/education/EducationLibraryScreen';
import { ResourceDetailScreen } from '../features/education/ResourceDetailScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { OrientationScreen } from '../features/orientation/OrientationScreen';
import { PrivacyScreen } from '../features/privacy/PrivacyScreen';
import { SupportScreen } from '../features/support/SupportScreen';
import { DashboardRoute } from '../dev-dashboard/DashboardRoute';

function isDevDashboardEnabled() {
  return import.meta.env.VITE_ENABLE_DEV_DASHBOARD === 'true';
}

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
        <Route path={routes.privacy} element={<PrivacyScreen />} />
        {isDevDashboardEnabled() && <Route path={routes.dashboard} element={<DashboardRoute />} />}
      </Route>
    </Routes>
  );
}
