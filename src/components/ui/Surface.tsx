import React from 'react';
import { cn } from '../../lib/utils';

export function Surface({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn('rounded-[var(--omni-radius-lg)] border border-[var(--omni-border-subtle)] bg-omni-surface', className)} {...props}/>;
}
