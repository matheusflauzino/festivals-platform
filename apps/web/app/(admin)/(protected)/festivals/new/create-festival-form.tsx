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
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex max-w-lg flex-col gap-4"
    >
      <h1 className="text-xl font-semibold">Novo Festival</h1>

      <div className="flex flex-col gap-1">
        <label htmlFor="number">Número</label>
        <input
          id="number"
          type="number"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('number', { valueAsNumber: true })}
        />
        {errors.number && <p className="text-sm text-red-600">{errors.number.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="year">Ano</label>
        <input
          id="year"
          type="number"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('year', { valueAsNumber: true })}
        />
        {errors.year && <p className="text-sm text-red-600">{errors.year.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="name">Nome</label>
        <input
          id="name"
          type="text"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('name')}
        />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="registrationBegin">Início das inscrições</label>
        <input
          id="registrationBegin"
          type="datetime-local"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('registrationBegin')}
        />
        {errors.registrationBegin && (
          <p className="text-sm text-red-600">{errors.registrationBegin.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="registrationEnd">Fim das inscrições</label>
        <input
          id="registrationEnd"
          type="datetime-local"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('registrationEnd')}
        />
        {errors.registrationEnd && (
          <p className="text-sm text-red-600">{errors.registrationEnd.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="inscriptionFee">Valor da inscrição</label>
        <input
          id="inscriptionFee"
          type="number"
          step="0.01"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('inscriptionFee', { valueAsNumber: true })}
        />
        {errors.inscriptionFee && (
          <p className="text-sm text-red-600">{errors.inscriptionFee.message}</p>
        )}
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-600">
          {getApiErrorMessage(mutation.error, 'Erro ao criar festival.')}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        Criar Festival
      </button>
    </form>
  );
}
