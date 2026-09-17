'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import { listFestivals } from '../../../../src/lib/api/festivals';
import { FestivalStatusBadge } from '../../../../src/components/festival-status-badge';

export function FestivalList() {
  const { accessToken } = useAuth();
  const { data: festivals, isLoading } = useQuery({
    queryKey: ['festivals'],
    queryFn: () => listFestivals(accessToken as string),
    enabled: accessToken !== null,
  });

  if (isLoading) return <p>Carregando…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Festivais</h1>
        <Link href="/festivals/new" className="rounded bg-slate-900 px-4 py-2 text-white">
          Novo Festival
        </Link>
      </div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200 text-sm text-gray-500">
            <th className="py-2">Edição</th>
            <th className="py-2">Nome</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {(festivals ?? []).map((festival) => (
            <tr key={festival.id} className="border-b border-gray-100">
              <td className="py-2">
                {festival.number}/{festival.year}
              </td>
              <td className="py-2">
                <Link href={`/festivals/${festival.id}`} className="text-slate-900 underline">
                  {festival.name}
                </Link>
              </td>
              <td className="py-2">
                <FestivalStatusBadge status={festival.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
