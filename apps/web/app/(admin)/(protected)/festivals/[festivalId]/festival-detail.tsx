'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import { closeFestival, getFestival, listStages, publishFestival } from '../../../../../src/lib/api/festivals';
import { FestivalStatusBadge } from '../../../../../src/components/festival-status-badge';
import { getApiErrorMessage } from '../../../../../src/lib/api/error-message';
import { Button } from '../../../../../src/components/ui/button';
import { FieldError } from '../../../../../src/components/ui/field';
import { PageHeader } from '../../../../../src/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../src/components/ui/card';
import { ConfirmModal } from '../../../../../src/components/ui/confirm-modal';
import { PencilIcon, PlusIcon } from '../../../../../src/components/ui/icons';
import { EditFestivalForm } from './edit-festival-form';
import { CreateStageForm } from './create-stage-form';
import { CreateGradeCriterionForm } from './stages/[stageId]/create-grade-criterion-form';

export function FestivalDetail({ festivalId }: { festivalId: string }) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [criterionStageId, setCriterionStageId] = useState<string | null>(null);

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
      setCloseConfirmOpen(false);
    },
  });

  if (festivalQuery.isLoading) return <p className="text-sm text-text-muted">Carregando…</p>;
  if (!festivalQuery.data) return <p className="text-sm text-text-muted">Festival não encontrado.</p>;

  const festival = festivalQuery.data;
  const stages = stagesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={festival.name}
        subtitle={`${festival.number}/${festival.year}`}
        breadcrumb={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Festivais', href: '/festivals' },
          { label: festival.name },
        ]}
        action={
          <div className="flex items-center gap-3">
            <FestivalStatusBadge status={festival.status} />
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <PencilIcon className="h-4 w-4" />
              Editar
            </Button>
            {festival.status === 'DRAFT' && (
              <Button size="sm" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
                Publicar
              </Button>
            )}
            {festival.status === 'OPEN' && (
              <Button variant="danger" size="sm" onClick={() => setCloseConfirmOpen(true)}>
                Fechar
              </Button>
            )}
          </div>
        }
      />

      <FieldError>
        {publishMutation.isError ? getApiErrorMessage(publishMutation.error, 'Erro ao publicar festival.') : undefined}
      </FieldError>
      <FieldError>
        {closeMutation.isError ? getApiErrorMessage(closeMutation.error, 'Erro ao fechar festival.') : undefined}
      </FieldError>

      <Card>
        <CardHeader>
          <CardTitle>Fases</CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setStageModalOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            Nova Fase
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {stages.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-text-muted">Nenhuma fase cadastrada ainda.</p>
          ) : (
            stages.map((stage) => (
              <div
                key={stage.id}
                className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0"
              >
                <span className="text-sm text-text">
                  {stage.order}. {stage.name}
                </span>
                <button
                  type="button"
                  onClick={() => setCriterionStageId(stage.id)}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Novo Critério
                </button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <EditFestivalForm festival={festival} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmModal
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title="Fechar festival?"
        description="As inscrições e avaliações deste festival serão encerradas. Essa ação não pode ser desfeita."
        confirmLabel="Fechar Festival"
        confirmVariant="danger"
        isConfirming={closeMutation.isPending}
        onConfirm={() => closeMutation.mutate()}
      />

      <CreateStageForm festivalId={festivalId} open={stageModalOpen} onOpenChange={setStageModalOpen} />

      <CreateGradeCriterionForm
        stageId={criterionStageId ?? ''}
        festivalId={festivalId}
        open={criterionStageId !== null}
        onOpenChange={(open) => {
          if (!open) setCriterionStageId(null);
        }}
      />
    </div>
  );
}
