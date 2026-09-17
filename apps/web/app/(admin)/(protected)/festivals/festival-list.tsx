'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import { listFestivals, type Festival } from '../../../../src/lib/api/festivals';
import { FestivalStatusBadge } from '../../../../src/components/festival-status-badge';
import { PageHeader } from '../../../../src/components/ui/page-header';
import { buttonStyles } from '../../../../src/components/ui/button';
import { DataTable, type DataTableColumn } from '../../../../src/components/ui/data-table';

const COLUMNS: DataTableColumn<Festival>[] = [
  { header: 'Edição', render: (festival) => `${festival.number}/${festival.year}` },
  {
    header: 'Nome',
    render: (festival) => (
      <Link href={`/festivals/${festival.id}`} className="font-medium text-brand hover:underline">
        {festival.name}
      </Link>
    ),
  },
  {
    header: 'Período de Inscrição',
    render: (festival) => {
      const format = (iso: string) =>
        new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `${format(festival.registrationBegin)} a ${format(festival.registrationEnd)}`;
    },
  },
  {
    header: 'Taxa',
    render: (festival) =>
      festival.inscriptionFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  },
  { header: 'Status', render: (festival) => <FestivalStatusBadge status={festival.status} /> },
];

export function FestivalList() {
  const { accessToken } = useAuth();
  const { data: festivals, isLoading } = useQuery({
    queryKey: ['festivals'],
    queryFn: () => listFestivals(accessToken as string),
    enabled: accessToken !== null,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Festivais"
        breadcrumb={[{ label: 'Home', href: '/dashboard' }, { label: 'Festivais' }]}
        action={
          <Link href="/festivals/new" className={buttonStyles('primary')}>
            Novo Festival
          </Link>
        }
      />
      <DataTable
        title="Todos os festivais"
        columns={COLUMNS}
        rows={festivals ?? []}
        rowKey={(festival) => festival.id}
        isLoading={isLoading}
        searchFields={(festival) => [festival.name, `${festival.number}/${festival.year}`]}
        emptyTitle="Nenhum festival cadastrado"
        emptyDescription="Crie o primeiro festival para começar."
      />
    </div>
  );
}
