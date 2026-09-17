'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createStageSchema, type CreateStageDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import { createStage } from '../../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label } from '../../../../../src/components/ui/field';
import { FormModal } from '../../../../../src/components/ui/form-modal';

export function CreateStageForm({
  festivalId,
  open = true,
  onOpenChange = () => {},
}: {
  festivalId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStageDto>({
    resolver: zodResolver(createStageSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateStageDto) => createStage(accessToken as string, festivalId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festivalId, 'stages'] });
      router.push(`/festivals/${festivalId}`);
      reset();
      onOpenChange(false);
    },
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Nova Fase"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isSubmitting={isSubmitting || mutation.isPending}
      submitLabel="Criar Fase"
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
    </FormModal>
  );
}
