import Link from 'next/link';
import { ChevronRightIcon } from './icons';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {index > 0 && <ChevronRightIcon className="h-3.5 w-3.5" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-text">
              {item.label}
            </Link>
          ) : (
            <span className={index === items.length - 1 ? 'text-text' : undefined}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
