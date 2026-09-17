import type { ReactNode } from 'react';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: 'bg-status-draft-bg text-status-draft-fg',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-status-open-bg text-status-open-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  danger: 'bg-status-closed-bg text-status-closed-fg',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONE_STYLES[tone]}`}>
      {children}
    </span>
  );
}
