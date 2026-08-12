import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '../routes';
import { useAdminAuth } from './AdminAuthContext';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status } = useAdminAuth();

  if (status === 'loading') return null;
  if (status !== 'authenticated') return <Navigate to={routes.home} replace />;
  return children;
}

export function RequireAnonymousAdmin({ children }: { children: ReactNode }) {
  const { status } = useAdminAuth();

  if (status === 'loading') return null;
  if (status === 'authenticated') return <Navigate to={routes.dashboard} replace />;
  return children;
}
