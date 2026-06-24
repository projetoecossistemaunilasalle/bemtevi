import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

const variants = {
  primary: 'bg-primary text-on-primary hover:bg-surface-tint',
  secondary:
    'bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-low hover:border-secondary',
  ghost: 'text-primary hover:bg-surface-container-low',
  danger: 'bg-error-container text-on-error-container hover:bg-error-container/85',
} as const;

const sizes = {
  sm: 'min-h-9 px-3 py-1 text-sm',
  md: 'min-h-12 px-5 py-2',
  lg: 'min-h-14 px-6 py-3',
} as const;

type ButtonVariant = keyof typeof variants;
type ButtonSize = keyof typeof sizes;

interface BaseProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;
type LinkButtonProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement>;

function buttonClassName(variant: ButtonVariant, size: ButtonSize, className = '') {
  return `inline-flex items-center justify-center gap-2 rounded-full font-label-md transition-colors shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`;
}

export function Button({ children, variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button className={buttonClassName(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({ children, variant = 'primary', size = 'md', className, ...props }: LinkButtonProps) {
  return (
    <a className={buttonClassName(variant, size, className)} {...props}>
      {children}
    </a>
  );
}
