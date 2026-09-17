'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createStageSchema, type CreateStageDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../../../src/lib/auth/auth-context';
import { createStage } from '../../../../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label } from '../../../../../../../src/components/ui/field';
import { Button } from '../../../../../../../src/components/ui/button';
import { PageHeader } from '../../../../../../../src/components/ui/page-header';

export function CreateStageForm({ festivalId }: { festivalId: string }) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateStageDto>({
    resolver: zodResolver(createStageSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateStageDto) => createStage(accessToken as string, festivalId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festivalId, 'stages'] });
      router.push(`/festivals/${festivalId}`);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nova Fase" />
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="flex max-w-lg flex-col gap-4 rounded-xl border border-sky bg-white p-6"
      >
        <Field>
          <Label htmlFor="name">Nome</Label>
          <Input id="name" type="text" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="order">Ordem</Label>
          <Input id="order" type="number" {...register('order', { valueAsNumber: true })} />
          <FieldError>{errors.order?.message}</FieldError>
        </Field>

        <FieldError>
          {mutation.isError ? getApiErrorMessage(mutation.error, 'Erro ao criar fase.') : undefined}
        </FieldError>

        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          Criar Fase
        </Button>
      </form>
    </div>
  );
}
