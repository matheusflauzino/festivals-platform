import type { ReactNode } from 'react';
import { Breadcrumb, type BreadcrumbItem } from './breadcrumb';

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumb,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-text-muted">{subtitle}</div>}
      </div>
      <div className="flex flex-col items-start gap-3 sm:items-end">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        {action}
      </div>
    </div>
  );
}
