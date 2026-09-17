'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS } from './sidebar-nav-data';
import { useSidebar } from './sidebar-context';
import { BrandMark, BrandWordmark } from '../brand-mark';
import { ChevronLeftIcon } from '../ui/icons';

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full flex-col border-r border-border bg-surface transition-all duration-200 lg:static ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          {collapsed ? <BrandMark className="h-8 w-8" /> : <BrandWordmark />}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-5">
              {!collapsed && (
                <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-text-subtle">
                  {group.label}
                </p>
              )}
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  if (item.status === 'soon') {
                    return (
                      <li key={item.label}>
                        <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-subtle">
                          <Icon className="h-5 w-5 shrink-0" />
                          {!collapsed && (
                            <>
                              <span className="flex-1">{item.label}</span>
                              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px]">
                                em breve
                              </span>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  }

                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-brand-soft text-brand'
                            : 'text-text-muted hover:bg-surface-muted hover:text-text'
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex shrink-0 items-center justify-center gap-2 border-t border-border py-3 text-sm text-text-muted hover:text-text"
        >
          <ChevronLeftIcon className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && 'Recolher'}
        </button>
      </aside>
    </>
  );
}
