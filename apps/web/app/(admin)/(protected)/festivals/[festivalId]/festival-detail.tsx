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
import { Button, buttonStyles } from '../../../../../src/components/ui/button';
import { FieldError } from '../../../../../src/components/ui/field';
import { StringDivider } from '../../../../../src/components/string-divider';

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

  if (festivalQuery.isLoading) return <p className="text-sm text-graphite">Carregando…</p>;
  if (!festivalQuery.data) return <p className="text-sm text-graphite">Festival não encontrado.</p>;

  const festival = festivalQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{festival.name}</h1>
          <p className="text-sm text-graphite">
            {festival.number}/{festival.year}
          </p>
        </div>
        <FestivalStatusBadge status={festival.status} />
      </div>
      <StringDivider />

      <div className="flex gap-3">
        {festival.status === 'DRAFT' && (
          <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
            Publicar
          </Button>
        )}
        {festival.status === 'OPEN' && (
          <Button
            variant="danger"
            onClick={() => closeMutation.mutate()}
            disabled={closeMutation.isPending}
          >
            Fechar
          </Button>
        )}
      </div>

      <FieldError>
        {publishMutation.isError
          ? getApiErrorMessage(publishMutation.error, 'Erro ao publicar festival.')
          : undefined}
      </FieldError>
      <FieldError>
        {closeMutation.isError
          ? getApiErrorMessage(closeMutation.error, 'Erro ao fechar festival.')
          : undefined}
      </FieldError>

      <section className="flex flex-col gap-3 rounded-xl border border-sky bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Fases</h2>
          <Link href={`/festivals/${festivalId}/stages/new`} className={buttonStyles('secondary')}>
            Nova Fase
          </Link>
        </div>
        <ul className="flex flex-col">
          {(stagesQuery.data ?? []).map((stage) => (
            <li
              key={stage.id}
              className="flex items-center justify-between border-b border-sky/60 py-3 last:border-0"
            >
              <span className="text-sm text-ink">
                {stage.order}. {stage.name}
              </span>
              <Link
                href={`/festivals/${festivalId}/stages/${stage.id}/grade-criteria/new`}
                className="text-sm font-medium text-viola-strong hover:underline"
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
