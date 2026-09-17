import React from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-omni-accent text-[#0b0b0a] hover:brightness-110',
  secondary: 'border border-[var(--omni-border)] bg-omni-surface text-[var(--omni-text-primary)] hover:bg-omni-elevated',
  quiet: 'bg-transparent text-[var(--omni-text-secondary)] hover:bg-white/[0.06] hover:text-[var(--omni-text-primary)]',
  danger: 'bg-[var(--omni-danger)] text-white hover:brightness-110',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, children, disabled, loading = false, size = 'md', variant = 'primary', type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cn('inline-flex items-center justify-center gap-2 rounded-[var(--omni-radius-md)] font-semibold transition-[background,color,transform,opacity] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45', variants[variant], sizes[size], className)} {...props}>
    {loading && <LoaderCircle size={17} aria-hidden="true" className="animate-spin"/>}
    {children}
  </button>;
});
