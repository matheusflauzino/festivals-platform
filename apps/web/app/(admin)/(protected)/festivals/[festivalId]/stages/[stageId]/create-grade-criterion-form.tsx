'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createGradeCriterionSchema, type CreateGradeCriterionDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../../../src/lib/auth/auth-context';
import { createGradeCriterion } from '../../../../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label } from '../../../../../../../src/components/ui/field';
import { FormModal } from '../../../../../../../src/components/ui/form-modal';

export function CreateGradeCriterionForm({
  stageId,
  festivalId,
  open = true,
  onOpenChange = () => {},
}: {
  stageId: string;
  festivalId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateGradeCriterionDto>({
    resolver: zodResolver(createGradeCriterionSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateGradeCriterionDto) => createGradeCriterion(accessToken as string, stageId, values),
    onSuccess: () => {
      router.push(`/festivals/${festivalId}`);
      reset();
      onOpenChange(false);
    },
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Novo Critério de Nota"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isSubmitting={isSubmitting || mutation.isPending}
      submitLabel="Criar Critério"
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
        {mutation.isError ? getApiErrorMessage(mutation.error, 'Erro ao criar critério de nota.') : undefined}
      </FieldError>
    </FormModal>
  );
}
