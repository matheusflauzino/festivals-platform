'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateFestivalSchema } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import { updateFestival, type Festival } from '../../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label } from '../../../../../src/components/ui/field';
import { FormModal } from '../../../../../src/components/ui/form-modal';

type EditFestivalFormValues = z.input<typeof updateFestivalSchema>;

function toDateTimeLocal(isoString: string): string {
  return isoString ? isoString.slice(0, 16) : '';
}

export function EditFestivalForm({
  festival,
  open,
  onOpenChange,
}: {
  festival: Festival;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditFestivalFormValues>({
    resolver: zodResolver(updateFestivalSchema),
    values: {
      name: festival.name,
      registrationBegin: toDateTimeLocal(festival.registrationBegin),
      registrationEnd: toDateTimeLocal(festival.registrationEnd),
      inscriptionFee: festival.inscriptionFee,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: EditFestivalFormValues) =>
      updateFestival(accessToken as string, festival.id, updateFestivalSchema.parse(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['festivals', festival.id] });
      void queryClient.invalidateQueries({ queryKey: ['festivals'] });
      onOpenChange(false);
    },
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Editar Festival"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isSubmitting={isSubmitting || mutation.isPending}
      submitLabel="Salvar Alterações"
    >
      <Field>
        <Label htmlFor="edit-name">Nome</Label>
        <Input id="edit-name" type="text" {...register('name')} />
        <FieldError>{errors.name?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="edit-registrationBegin">Início das inscrições</Label>
        <Input id="edit-registrationBegin" type="datetime-local" {...register('registrationBegin')} />
        <FieldError>{errors.registrationBegin?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="edit-registrationEnd">Fim das inscrições</Label>
        <Input id="edit-registrationEnd" type="datetime-local" {...register('registrationEnd')} />
        <FieldError>{errors.registrationEnd?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="edit-inscriptionFee">Valor da inscrição</Label>
        <Input
          id="edit-inscriptionFee"
          type="number"
          step="0.01"
          {...register('inscriptionFee', { valueAsNumber: true })}
        />
        <FieldError>{errors.inscriptionFee?.message}</FieldError>
      </Field>

      <FieldError>
        {mutation.isError ? getApiErrorMessage(mutation.error, 'Erro ao editar festival.') : undefined}
      </FieldError>
    </FormModal>
  );
}
