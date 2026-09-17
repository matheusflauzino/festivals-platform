'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../src/lib/auth/auth-context';
import * as festivalsApi from '../../../../src/lib/api/festivals';
import { PageHeader } from '../../../../src/components/ui/page-header';
import { StatCard } from '../../../../src/components/ui/stat-card';
import { CalendarIcon, TrendingUpIcon, AwardIcon } from '../../../../src/components/ui/icons';

export function DashboardView() {
  const { accessToken } = useAuth();
  const { data: festivals } = useQuery({
    queryKey: ['festivals'],
    queryFn: () => festivalsApi.listFestivals(accessToken as string),
    enabled: accessToken !== null,
  });

  const total = festivals?.length ?? 0;
  const open = festivals?.filter((festival) => festival.status === 'OPEN').length ?? 0;
  const draft = festivals?.filter((festival) => festival.status === 'DRAFT').length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" breadcrumb={[{ label: 'Home' }, { label: 'Dashboard' }]} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Festivais cadastrados" value={total} icon={<CalendarIcon className="h-5 w-5" />} />
        <StatCard label="Festivais abertos" value={open} icon={<TrendingUpIcon className="h-5 w-5" />} />
        <StatCard label="Em rascunho" value={draft} icon={<AwardIcon className="h-5 w-5" />} />
      </div>
    </div>
  );
}
