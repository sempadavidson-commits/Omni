import React from 'react';
import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react';
import { Button } from './Button';

export type ScreenStateProps = {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
};

export function ScreenState({ kind, title, description, actionLabel, onAction, icon }: ScreenStateProps) {
  const defaultIcon = kind === 'loading' ? <LoaderCircle className="animate-spin"/> : kind === 'error' ? <AlertTriangle/> : <Inbox/>;
  return <section role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'error' ? 'assertive' : 'polite'} className="grid min-h-64 place-items-center px-6 py-10 text-center">
    <div className="max-w-sm"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--omni-accent-soft)] text-omni-accent">{icon || defaultIcon}</span><h2 className="mt-4 text-xl font-semibold tracking-tight">{title}</h2>{description && <p className="mt-2 text-sm leading-6 text-[var(--omni-text-secondary)]">{description}</p>}{actionLabel && onAction && <Button className="mt-5" onClick={onAction}>{actionLabel}</Button>}</div>
  </section>;
}
