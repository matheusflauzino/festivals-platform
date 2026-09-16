import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, switchMap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AUDIT_LOG_KEY,
  AuditLogMetadata,
} from '../decorators/audit-log.decorator';
import type { RequestWithAdmin } from '../../admin-identity/infrastructure/admin-auth.guard';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditLogMetadata | undefined>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithAdmin>();

    return next.handle().pipe(
      switchMap(async (result: unknown) => {
        const target = metadata.extractTarget?.(result) ?? {
          targetType: 'unknown',
          targetId: 'unknown',
        };
        await this.prisma.auditLog.create({
          data: {
            tenantId: request.admin!.tenantId,
            actorAdminId: request.admin!.id,
            action: metadata.action,
            targetType: target.targetType,
            targetId: target.targetId,
          },
        });
        return result;
      }),
    );
  }
}
