import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createAdminAuthService,
  createMockAdminAuthService,
  type AdminAccount,
  type AdminAuthService,
} from './adminAuth';
import { AdminAuthContext, type AdminAuthStatus } from './AdminAuthContext';
import { createNeonAdminAuthBackend } from './neonClient';
const defaultService =
  import.meta.env.VITE_DISABLE_AUTH === 'true'
    ? createMockAdminAuthService()
    : createAdminAuthService(createNeonAdminAuthBackend());

export function AdminAuthProvider({
  children,
  service = defaultService,
}: {
  children: ReactNode;
  service?: AdminAuthService;
}) {
  const [status, setStatus] = useState<AdminAuthStatus>('loading');
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const operationGeneration = useRef(0);
  const forcedSignedOut = useRef(false);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => undefined;
    const restoreGeneration = ++operationGeneration.current;

    try {
      unsubscribe = service.subscribe((nextAccount) => {
        if (!active) return;
        if (forcedSignedOut.current && nextAccount) {
          operationGeneration.current++;
          setAccount(null);
          setStatus('unauthenticated');
          void service
            .logout()
            .then(() => {
              forcedSignedOut.current = false;
            })
            .catch(() => undefined);
          return;
        }
        if (!nextAccount) forcedSignedOut.current = false;
        operationGeneration.current++;
        setAccount(nextAccount);
        setStatus(nextAccount ? 'authenticated' : 'unauthenticated');
      });
    } catch {
      queueMicrotask(() => {
        if (active) setStatus('unavailable');
      });
    }

    void service
      .restore()
      .then((restoredAccount) => {
        if (!active || restoreGeneration !== operationGeneration.current) return;
        setAccount(restoredAccount);
        setStatus(restoredAccount ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!active || restoreGeneration !== operationGeneration.current) return;
        setAccount(null);
        setStatus('unavailable');
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [service]);

  async function login(email: string, password: string) {
    forcedSignedOut.current = false;
    const generation = ++operationGeneration.current;
    const authenticatedAccount = await service.login(email, password);
    if (generation !== operationGeneration.current) return;
    setAccount(authenticatedAccount);
    setStatus('authenticated');
  }

  async function logout() {
    forcedSignedOut.current = true;
    operationGeneration.current++;
    setAccount(null);
    setStatus('unauthenticated');
    await service.logout();
    forcedSignedOut.current = false;
  }

  async function refresh() {
    const generation = ++operationGeneration.current;
    setAccount(null);
    setStatus('loading');
    try {
      const restoredAccount = await service.restore();
      if (generation !== operationGeneration.current) return;
      setAccount(restoredAccount);
      setStatus(restoredAccount ? 'authenticated' : 'unauthenticated');
    } catch {
      if (generation !== operationGeneration.current) return;
      setAccount(null);
      setStatus('unavailable');
    }
  }

  return (
    <AdminAuthContext.Provider value={{ status, account, login, logout, refresh }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
