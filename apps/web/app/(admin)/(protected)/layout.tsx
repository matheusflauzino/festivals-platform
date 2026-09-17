'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../src/lib/auth/auth-context';
import { DashboardShell } from '../../../src/components/dashboard-shell';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Carregando…</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
