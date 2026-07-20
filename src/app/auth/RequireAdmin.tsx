import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { routes } from '../routes';
import { useAdminAuth } from './AdminAuthContext';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, refresh } = useAdminAuth();
  const entryCheckStarted = useRef(false);
  const [entryVerified, setEntryVerified] = useState(false);
  const revalidate = useEffectEvent(() => {
    void refresh();
  });
  const verifyEntry = useEffectEvent(async () => {
    await refresh();
    setEntryVerified(true);
  });

  useEffect(() => {
    if (status !== 'authenticated' || entryCheckStarted.current) return;
    entryCheckStarted.current = true;
    void verifyEntry();
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated' || !entryVerified) return;
    window.addEventListener('focus', revalidate);
    return () => window.removeEventListener('focus', revalidate);
  }, [entryVerified, status]);

  if (status === 'loading') return null;
  if (status !== 'authenticated') return <Navigate to={routes.home} replace />;
  if (!entryVerified) return null;
  return children;
}

export function RequireAnonymousAdmin({ children }: { children: ReactNode }) {
  const { status } = useAdminAuth();

  if (status === 'loading') return null;
  if (status === 'authenticated') return <Navigate to={routes.dashboard} replace />;
  return children;
}
