import type { ReactNode } from 'react';

const tones = {
  primary: 'bg-tertiary-container text-on-tertiary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  neutral: 'bg-outline-variant text-on-surface',
} as const;

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: keyof typeof tones }) {
  return (
    <span className={`inline-flex w-fit max-w-full items-center px-3 py-1 rounded-full font-label-md ${tones[tone]}`}>
      {children}
    </span>
  );
}
