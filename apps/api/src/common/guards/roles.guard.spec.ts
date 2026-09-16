import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeContext(
  adminRole: string | undefined,
  requiredRoles: string[] | undefined,
) {
  const request = { admin: adminRole ? { role: adminRole } : undefined };
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as unknown as Reflector;

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return { context, reflector };
}

describe('RolesGuard', () => {
  it('allows the request when the admin role is in the required list', () => {
    const { context, reflector } = makeContext('ORGANIZER', ['ORGANIZER']);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects the request when the admin role is not in the required list', () => {
    const { context, reflector } = makeContext('JUDGE', ['ORGANIZER']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows any authenticated admin when the route has no @Roles() decorator', () => {
    const { context, reflector } = makeContext('JUDGE', undefined);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });
});
