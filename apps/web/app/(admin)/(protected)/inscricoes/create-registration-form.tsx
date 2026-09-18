'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRegistrationSchema, type CreateRegistrationDto } from '@fenac-platform/contracts';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import { createRegistration } from '../../../../src/lib/api/registrations';
import { listFestivals } from '../../../../src/lib/api/festivals';
import { getApiErrorMessage } from '../../../../src/lib/api/error-message';
import { Field, FieldError, Input, Label, Select } from '../../../../src/components/ui/field';
import { FormModal } from '../../../../src/components/ui/form-modal';

export function CreateRegistrationForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [festivalId, setFestivalId] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateRegistrationDto>({
    resolver: zodResolver(createRegistrationSchema),
  });

  const { data: festivals } = useQuery({
    queryKey: ['festivals'],
    queryFn: () => listFestivals(accessToken as string),
    enabled: accessToken !== null && open,
  });
  const openFestivals = (festivals ?? []).filter((festival) => festival.status === 'OPEN');

  const mutation = useMutation({
    mutationFn: (values: CreateRegistrationDto) =>
      createRegistration(accessToken as string, festivalId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['registrations'] });
      reset();
      setFestivalId('');
      onOpenChange(false);
    },
  });

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Nova Inscrição"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      isSubmitting={isSubmitting || mutation.isPending}
      submitLabel="Criar Inscrição"
    >
      <Field>
        <Label htmlFor="festivalId">Festival</Label>
        <Select
          id="festivalId"
          required
          value={festivalId}
          onChange={(event) => setFestivalId(event.target.value)}
        >
          <option value="" disabled>
            -- selecione um festival --
          </option>
          {openFestivals.map((festival) => (
            <option key={festival.id} value={festival.id}>
              {festival.number}/{festival.year} — {festival.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label htmlFor="participantName">Nome do participante</Label>
        <Input id="participantName" type="text" {...register('participantName')} />
        <FieldError>{errors.participantName?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="participantEmail">E-mail</Label>
        <Input id="participantEmail" type="email" {...register('participantEmail')} />
        <FieldError>{errors.participantEmail?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="participantCpf">CPF</Label>
        <Input id="participantCpf" type="text" {...register('participantCpf')} />
        <FieldError>{errors.participantCpf?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="songName">Nome da música</Label>
        <Input id="songName" type="text" {...register('songName')} />
        <FieldError>{errors.songName?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="performers">Intérpretes</Label>
        <Input id="performers" type="text" {...register('performers')} />
        <FieldError>{errors.performers?.message}</FieldError>
      </Field>

      <Field>
        <Label htmlFor="musicComposer">Compositor(a) da música (opcional)</Label>
        <Input
          id="musicComposer"
          type="text"
          {...register('musicComposer', { setValueAs: (value) => (value === '' ? undefined : value) })}
        />
      </Field>

      <Field>
        <Label htmlFor="lyricsComposer">Compositor(a) da letra (opcional)</Label>
        <Input
          id="lyricsComposer"
          type="text"
          {...register('lyricsComposer', { setValueAs: (value) => (value === '' ? undefined : value) })}
        />
      </Field>

      <Field>
        <Label htmlFor="videoUrl">Link do vídeo (opcional)</Label>
        <Input
          id="videoUrl"
          type="url"
          {...register('videoUrl', { setValueAs: (value) => (value === '' ? undefined : value) })}
        />
        <FieldError>{errors.videoUrl?.message}</FieldError>
      </Field>

      <FieldError>
        {mutation.isError ? getApiErrorMessage(mutation.error, 'Erro ao criar inscrição.') : undefined}
      </FieldError>
    </FormModal>
  );
}
