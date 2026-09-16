'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginAdminUserSchema, type LoginAdminUserDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../src/lib/auth/auth-context';

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginAdminUserDto>({
    resolver: zodResolver(loginAdminUserSchema),
  });

  async function onSubmit(values: LoginAdminUserDto) {
    setSubmitError(null);
    try {
      await login(values.email, values.password);
      router.push('/festivals');
    } catch {
      setSubmitError('E-mail ou senha inválidos.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          className="rounded border border-gray-300 px-3 py-2"
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
      </div>
      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        Entrar
      </button>
    </form>
  );
}
