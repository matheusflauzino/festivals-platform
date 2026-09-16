import { SetMetadata } from '@nestjs/common';

export interface AuditLogMetadata {
  action: string;
  extractTarget?: (result: unknown) => { targetType: string; targetId: string };
}

export const AUDIT_LOG_KEY = 'audit_log';
export const AuditLog = (
  action: string,
  extractTarget?: AuditLogMetadata['extractTarget'],
) => SetMetadata(AUDIT_LOG_KEY, { action, extractTarget });
