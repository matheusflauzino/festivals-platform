'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { createGradeCriterionSchema, type CreateGradeCriterionDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../../../../../src/lib/auth/auth-context';
import { createGradeCriterion } from '../../../../../../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../../../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label } from '../../../../../../../../../src/components/ui/field';
import { Button } from '../../../../../../../../../src/components/ui/button';
import { PageHeader } from '../../../../../../../../../src/components/ui/page-header';

export function CreateGradeCriterionForm({
  stageId,
  festivalId,
}: {
  stageId: string;
  festivalId: string;
}) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateGradeCriterionDto>({
    resolver: zodResolver(createGradeCriterionSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateGradeCriterionDto) =>
      createGradeCriterion(accessToken as string, stageId, values),
    onSuccess: () => {
      router.push(`/festivals/${festivalId}`);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Novo Critério de Nota" />
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
          <Label htmlFor="weight">Peso</Label>
          <Input id="weight" type="number" step="0.01" {...register('weight', { valueAsNumber: true })} />
          <FieldError>{errors.weight?.message}</FieldError>
        </Field>

        <FieldError>
          {mutation.isError
            ? getApiErrorMessage(mutation.error, 'Erro ao criar critério de nota.')
            : undefined}
        </FieldError>

        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          Criar Critério
        </Button>
      </form>
    </div>
  );
}
