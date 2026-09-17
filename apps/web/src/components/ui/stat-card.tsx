import type { ReactNode } from 'react';
import { Card } from './card';

export function StatCard({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      {icon && (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          {icon}
        </span>
      )}
      <div>
        <p className="text-2xl font-semibold text-text">{value}</p>
        <p className="text-sm text-text-muted">{label}</p>
      </div>
    </Card>
  );
}
