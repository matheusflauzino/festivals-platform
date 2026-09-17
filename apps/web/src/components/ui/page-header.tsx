import type { ReactNode } from 'react';
import { StringDivider } from '../string-divider';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-graphite">{subtitle}</div>}
        </div>
        {action}
      </div>
      <StringDivider />
    </div>
  );
}
