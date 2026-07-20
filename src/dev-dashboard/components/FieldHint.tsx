import type { ReactNode } from 'react';

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="font-label-sm text-on-surface-variant/80">{children}</p>;
}
