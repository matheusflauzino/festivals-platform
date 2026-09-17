'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth/auth-context';
import { BrandWordmark } from './brand-mark';

export function DashboardShell({ children }: { children: ReactNode }) {
  const { admin, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-mist">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-sky bg-white p-5">
        <BrandWordmark />
        <nav className="flex flex-col gap-1">
          <Link
            href="/festivals"
            className="rounded-lg bg-orchid/20 px-3 py-2 text-sm font-medium text-viola-strong"
          >
            Festivais
          </Link>
          <span className="rounded-lg px-3 py-2 text-sm text-graphite/60">Usuários (em breve)</span>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-sky bg-white px-6 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-ink">{admin?.name}</span>
            <span className="text-xs text-graphite">{admin?.role}</span>
          </div>
          <button
            onClick={logout}
            className="text-sm text-graphite transition-colors hover:text-viola-strong"
          >
            Sair
          </button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
