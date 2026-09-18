'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import { listRegistrations, type Registration } from '../../../../src/lib/api/registrations';
import { PageHeader } from '../../../../src/components/ui/page-header';
import { Button } from '../../../../src/components/ui/button';
import { DataTable, type DataTableColumn } from '../../../../src/components/ui/data-table';
import { PlusIcon } from '../../../../src/components/ui/icons';
import { CreateRegistrationForm } from './create-registration-form';

const COLUMNS: DataTableColumn<Registration>[] = [
  {
    header: 'Festival',
    render: (registration) =>
      registration.festivalNumber !== null
        ? `${registration.festivalNumber}/${registration.festivalYear}`
        : '—',
  },
  { header: 'Participante', render: (registration) => registration.participantName },
  { header: 'Música', render: (registration) => registration.songName },
  {
    header: 'Data',
    render: (registration) =>
      new Date(registration.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
  },
];

export function RegistrationsList() {
  const { accessToken } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: registrations, isLoading } = useQuery({
    queryKey: ['registrations'],
    queryFn: () => listRegistrations(accessToken as string),
    enabled: accessToken !== null,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inscrições"
        breadcrumb={[{ label: 'Home', href: '/dashboard' }, { label: 'Inscrições' }]}
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            Nova Inscrição
          </Button>
        }
      />
      <DataTable
        title="Todas as inscrições"
        columns={COLUMNS}
        rows={registrations ?? []}
        rowKey={(registration) => registration.id}
        isLoading={isLoading}
        searchFields={(registration) => [registration.participantName, registration.songName]}
        emptyTitle="Nenhuma inscrição cadastrada"
        emptyDescription="Crie a primeira inscrição para começar."
      />
      <CreateRegistrationForm open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
