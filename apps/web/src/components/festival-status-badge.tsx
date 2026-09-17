import type { FestivalStatus } from '../lib/api/festivals';

const STYLES: Record<FestivalStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  OPEN: 'bg-green-100 text-green-700',
  CLOSED: 'bg-red-100 text-red-700',
};

export function FestivalStatusBadge({ status }: { status: FestivalStatus }) {
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${STYLES[status]}`}>{status}</span>
  );
}
