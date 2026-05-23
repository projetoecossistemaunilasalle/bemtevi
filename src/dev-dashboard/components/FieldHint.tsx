import type { ReactNode } from 'react';

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="font-body-md text-on-surface-variant">{children}</p>;
}
