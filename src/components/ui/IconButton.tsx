import React from 'react';
import { cn } from '../../lib/utils';

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: 'md' | 'lg';
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, children, label, size = 'md', type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} aria-label={label} title={props.title || label} className={cn('inline-grid shrink-0 place-items-center rounded-full text-[var(--omni-text-primary)] transition-colors hover:bg-white/[0.08] active:bg-white/[0.12]', size === 'lg' ? 'h-12 w-12' : 'h-11 w-11', className)} {...props}>{children}</button>;
});
