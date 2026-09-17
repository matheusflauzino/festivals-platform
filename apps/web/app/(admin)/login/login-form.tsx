'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginAdminUserSchema, type LoginAdminUserDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../src/lib/auth/auth-context';
import { Field, FieldError, Input, Label } from '../../../src/components/ui/field';
import { Button } from '../../../src/components/ui/button';

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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex w-full flex-col gap-4">
      <Field>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register('email')} />
        <FieldError>{errors.email?.message}</FieldError>
      </Field>
      <Field>
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" {...register('password')} />
        <FieldError>{errors.password?.message}</FieldError>
      </Field>
      <FieldError>{submitError ?? undefined}</FieldError>
      <Button type="submit" loading={isSubmitting} className="w-full">
        Entrar
      </Button>
    </form>
  );
}
