import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import type { AuditLogMetadata } from '../decorators/audit-log.decorator';

describe('AuditLogInterceptor', () => {
  function makeContextAndHandler(
    metadata: AuditLogMetadata | undefined,
    handlerResult: unknown,
    shouldThrow = false,
  ) {
    const request = {
      admin: { id: 'admin-1', tenantId: 'tenant-1', role: 'ORGANIZER' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const handler: CallHandler = {
      handle: () =>
        shouldThrow ? throwError(() => new Error('boom')) : of(handlerResult),
    };

    const reflector = { get: () => metadata } as unknown as Reflector;

    return { context, handler, reflector };
  }

  it('writes an audit log row after a successful handler execution', (done) => {
    const prisma = {
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const metadata: AuditLogMetadata = {
      action: 'invited_admin',
      extractTarget: (result: unknown) => ({
        targetType: 'AdminUser',
        targetId: (result as { id: string }).id,
      }),
    };
    const { context, handler, reflector } = makeContextAndHandler(metadata, {
      id: 'new-admin-1',
    });

    const interceptor = new AuditLogInterceptor(reflector, prisma as never);

    interceptor.intercept(context, handler).subscribe(() => {
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          actorAdminId: 'admin-1',
          action: 'invited_admin',
          targetType: 'AdminUser',
          targetId: 'new-admin-1',
        },
      });
      done();
    });
  });

  it('does not write a row when the route has no @AuditLog() decorator', (done) => {
    const prisma = { auditLog: { create: jest.fn() } };
    const { context, handler, reflector } = makeContextAndHandler(undefined, {
      id: 'x',
    });
    const interceptor = new AuditLogInterceptor(reflector, prisma as never);

    interceptor.intercept(context, handler).subscribe(() => {
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
      done();
    });
  });

  it('does not write a row when the handler throws', (done) => {
    const prisma = { auditLog: { create: jest.fn() } };
    const metadata: AuditLogMetadata = { action: 'invited_admin' };
    const { context, handler, reflector } = makeContextAndHandler(
      metadata,
      undefined,
      true,
    );
    const interceptor = new AuditLogInterceptor(reflector, prisma as never);

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
