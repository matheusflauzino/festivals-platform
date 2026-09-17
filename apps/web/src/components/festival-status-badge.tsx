import type { FestivalStatus } from '../lib/api/festivals';
import { Badge, type BadgeTone } from './ui/badge';

const TONE_BY_STATUS: Record<FestivalStatus, BadgeTone> = {
  DRAFT: 'neutral',
  OPEN: 'success',
  CLOSED: 'danger',
};

export function FestivalStatusBadge({ status }: { status: FestivalStatus }) {
  return <Badge tone={TONE_BY_STATUS[status]}>{status}</Badge>;
}
