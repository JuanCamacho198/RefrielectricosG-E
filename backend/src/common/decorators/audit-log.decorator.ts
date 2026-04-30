import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  action: string;
  entity: string;
}

export const AuditLog = (action: string, entity: string) =>
  SetMetadata(AUDIT_LOG_KEY, { action, entity });
