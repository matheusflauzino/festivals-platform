'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { createGradeCriterionSchema, type CreateGradeCriterionDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../../../../../src/lib/auth/auth-context';
import { createGradeCriterion } from '../../../../../../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../../../../../../src/lib/api/error-message';

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
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex max-w-lg flex-col gap-4"
    >
      <h1 className="text-xl font-semibold">Novo Critério de Nota</h1>

      <div className="flex flex-col gap-1">
        <label htmlFor="name">Nome</label>
        <input id="name" type="text" className="rounded border border-gray-300 px-3 py-2" {...register('name')} />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="weight">Peso</label>
        <input
          id="weight"
          type="number"
          step="0.01"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('weight', { valueAsNumber: true })}
        />
        {errors.weight && <p className="text-sm text-red-600">{errors.weight.message}</p>}
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-600">
          {getApiErrorMessage(mutation.error, 'Erro ao criar critério de nota.')}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        Criar Critério
      </button>
    </form>
  );
}
