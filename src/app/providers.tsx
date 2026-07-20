import type { ReactNode } from 'react';
import { AdminAuthProvider } from './auth/AdminAuthProvider';
import { PublishedContentProvider } from './content/PublishedContentProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <PublishedContentProvider>{children}</PublishedContentProvider>
    </AdminAuthProvider>
  );
}
