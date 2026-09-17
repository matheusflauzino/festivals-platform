'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createStageSchema, type CreateStageDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../../../../src/lib/auth/auth-context';
import { createStage } from '../../../../../../../src/lib/api/festivals';

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
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex max-w-lg flex-col gap-4"
    >
      <h1 className="text-xl font-semibold">Nova Fase</h1>

      <div className="flex flex-col gap-1">
        <label htmlFor="name">Nome</label>
        <input id="name" type="text" className="rounded border border-gray-300 px-3 py-2" {...register('name')} />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="order">Ordem</label>
        <input
          id="order"
          type="number"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('order', { valueAsNumber: true })}
        />
        {errors.order && <p className="text-sm text-red-600">{errors.order.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        Criar Fase
      </button>
    </form>
  );
}
