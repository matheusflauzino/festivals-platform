'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFestivalSchema } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../src/lib/auth/auth-context';
import { createFestival } from '../../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label } from '../../../../../src/components/ui/field';
import { Button } from '../../../../../src/components/ui/button';
import { PageHeader } from '../../../../../src/components/ui/page-header';

type CreateFestivalFormValues = z.input<typeof createFestivalSchema>;

export function CreateFestivalForm() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateFestivalFormValues>({
    resolver: zodResolver(createFestivalSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: CreateFestivalFormValues) =>
      createFestival(accessToken as string, createFestivalSchema.parse(values)),
    onSuccess: (festival) => {
      void queryClient.invalidateQueries({ queryKey: ['festivals'] });
      router.push(`/festivals/${festival.id}`);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Novo Festival" />
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="flex max-w-lg flex-col gap-4 rounded-xl border border-sky bg-white p-6"
      >
        <Field>
          <Label htmlFor="number">Número</Label>
          <Input id="number" type="number" {...register('number', { valueAsNumber: true })} />
          <FieldError>{errors.number?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="year">Ano</Label>
          <Input id="year" type="number" {...register('year', { valueAsNumber: true })} />
          <FieldError>{errors.year?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="name">Nome</Label>
          <Input id="name" type="text" {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="registrationBegin">Início das inscrições</Label>
          <Input id="registrationBegin" type="datetime-local" {...register('registrationBegin')} />
          <FieldError>{errors.registrationBegin?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="registrationEnd">Fim das inscrições</Label>
          <Input id="registrationEnd" type="datetime-local" {...register('registrationEnd')} />
          <FieldError>{errors.registrationEnd?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="inscriptionFee">Valor da inscrição</Label>
          <Input
            id="inscriptionFee"
            type="number"
            step="0.01"
            {...register('inscriptionFee', { valueAsNumber: true })}
          />
          <FieldError>{errors.inscriptionFee?.message}</FieldError>
        </Field>

        <FieldError>
          {mutation.isError ? getApiErrorMessage(mutation.error, 'Erro ao criar festival.') : undefined}
        </FieldError>

        <Button type="submit" disabled={isSubmitting || mutation.isPending}>
          Criar Festival
        </Button>
      </form>
    </div>
  );
}
