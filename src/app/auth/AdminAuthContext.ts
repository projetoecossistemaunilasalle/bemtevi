import { createContext, useContext } from 'react';
import type { AdminAccount } from './adminAuth';

export type AdminAuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable';

export interface AdminAuthContextValue {
  status: AdminAuthStatus;
  account: AdminAccount | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}

export const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function useAdminAuth() {
  const value = useContext(AdminAuthContext);
  if (!value) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return value;
}
