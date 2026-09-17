'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth/auth-context';

export function DashboardShell({ children }: { children: ReactNode }) {
  const { admin, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-slate-50 p-4">
        <nav className="flex flex-col gap-2">
          <Link href="/festivals" className="rounded px-3 py-2 hover:bg-slate-200">
            Festivais
          </Link>
          <span className="rounded px-3 py-2 text-gray-400">Usuários (em breve)</span>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <div>
            <span className="font-medium">{admin?.name}</span>
            <span className="ml-2 text-sm text-gray-500">{admin?.role}</span>
          </div>
          <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">
            Sair
          </button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
