'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import { listFestivals } from '../../../../src/lib/api/festivals';
import { FestivalStatusBadge } from '../../../../src/components/festival-status-badge';
import { PageHeader } from '../../../../src/components/ui/page-header';
import { buttonStyles } from '../../../../src/components/ui/button';

export function FestivalList() {
  const { accessToken } = useAuth();
  const { data: festivals, isLoading } = useQuery({
    queryKey: ['festivals'],
    queryFn: () => listFestivals(accessToken as string),
    enabled: accessToken !== null,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Festivais"
        action={
          <Link href="/festivals/new" className={buttonStyles('primary')}>
            Novo Festival
          </Link>
        }
      />

      {isLoading ? (
        <p className="text-sm text-graphite">Carregando…</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-sky bg-white">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-sky bg-sky/30 text-xs font-medium tracking-wide text-graphite">
                <th className="px-4 py-3">Edição</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(festivals ?? []).map((festival) => (
                <tr key={festival.id} className="border-b border-sky/60 last:border-0">
                  <td className="px-4 py-3 text-sm text-graphite">
                    {festival.number}/{festival.year}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/festivals/${festival.id}`}
                      className="font-medium text-viola-strong hover:underline"
                    >
                      {festival.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <FestivalStatusBadge status={festival.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
