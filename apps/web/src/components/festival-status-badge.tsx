import type { FestivalStatus } from '../lib/api/festivals';

const STYLES: Record<FestivalStatus, string> = {
  DRAFT: 'bg-status-draft-bg text-status-draft-fg',
  OPEN: 'bg-status-open-bg text-status-open-fg',
  CLOSED: 'bg-status-closed-bg text-status-closed-fg',
};

export function FestivalStatusBadge({ status }: { status: FestivalStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}
