import type { ReactNode } from 'react';
import { AdminAuthProvider } from './auth/AdminAuthProvider';

export function Providers({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
