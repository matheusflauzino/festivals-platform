import type { HTMLAttributes, ThHTMLAttributes } from 'react';

export function Table({ className = '', ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-left text-sm ${className}`} {...props} />
    </div>
  );
}

export function TableHead({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`bg-surface-muted ${className}`} {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`border-b border-border last:border-0 ${className}`} {...props} />;
}

export function TableHeaderCell({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-4 py-3 font-medium text-text-muted ${className}`} {...props} />;
}
