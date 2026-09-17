'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import {
  closeFestival,
  getFestival,
  listStages,
  publishFestival,
} from '../../../../../src/lib/api/festivals';
import { FestivalStatusBadge } from '../../../../../src/components/festival-status-badge';
import { getApiErrorMessage } from '../../../../../src/lib/api/error-message';

export function FestivalDetail({ festivalId }: { festivalId: string }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const festivalQuery = useQuery({
    queryKey: ['festivals', festivalId],
    queryFn: () => getFestival(accessToken as string, festivalId),
    enabled: accessToken !== null,
  });

  const stagesQuery = useQuery({
    queryKey: ['festivals', festivalId, 'stages'],
    queryFn: () => listStages(accessToken as string, festivalId),
    enabled: accessToken !== null,
  });

  const publishMutation = useMutation({
    mutationFn: () => publishFestival(accessToken as string, festivalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festivalId] });
      void queryClient.invalidateQueries({ queryKey: ['festivals'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => closeFestival(accessToken as string, festivalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festivalId] });
      void queryClient.invalidateQueries({ queryKey: ['festivals'] });
    },
  });

  if (festivalQuery.isLoading) return <p>Carregando…</p>;
  if (!festivalQuery.data) return <p>Festival não encontrado.</p>;

  const festival = festivalQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{festival.name}</h1>
          <p className="text-gray-500">
            {festival.number}/{festival.year}
          </p>
        </div>
        <FestivalStatusBadge status={festival.status} />
      </div>

      <div className="flex gap-2">
        {festival.status === 'DRAFT' && (
          <button
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
          >
            Publicar
          </button>
        )}
        {festival.status === 'OPEN' && (
          <button
            onClick={() => closeMutation.mutate()}
            disabled={closeMutation.isPending}
            className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
          >
            Fechar
          </button>
        )}
      </div>

      {publishMutation.isError && (
        <p className="text-sm text-red-600">
          {getApiErrorMessage(publishMutation.error, 'Erro ao publicar festival.')}
        </p>
      )}
      {closeMutation.isError && (
        <p className="text-sm text-red-600">
          {getApiErrorMessage(closeMutation.error, 'Erro ao fechar festival.')}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Fases</h2>
          <Link
            href={`/festivals/${festivalId}/stages/new`}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            Nova Fase
          </Link>
        </div>
        <ul className="flex flex-col gap-1">
          {(stagesQuery.data ?? []).map((stage) => (
            <li key={stage.id} className="flex items-center justify-between border-b border-gray-100 py-2">
              <span>
                {stage.order}. {stage.name}
              </span>
              <Link
                href={`/festivals/${festivalId}/stages/${stage.id}/grade-criteria/new`}
                className="text-sm text-slate-700 underline"
              >
                Novo Critério
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
