import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminTokenService } from './admin-token.service';
import { AdminAuthGuard, RequestWithAdmin } from './admin-auth.guard';

function makeContext(authHeader?: string): ExecutionContext {
  const request: { headers: Record<string, string>; admin?: unknown } = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AdminAuthGuard', () => {
  const tokenService = new AdminTokenService(
    new JwtService({ secret: 'test-secret' }),
  );
  const guard = new AdminAuthGuard(tokenService);

  it('allows a request with a valid access token and attaches request.admin', () => {
    const token = tokenService.signAccessToken({
      sub: 'admin-1',
      tenantId: 'tenant-1',
      role: 'ORGANIZER',
    });
    const context = makeContext(`Bearer ${token}`);

    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    expect(request.admin).toEqual({
      id: 'admin-1',
      tenantId: 'tenant-1',
      role: 'ORGANIZER',
    });
  });

  it('rejects a request with no authorization header', () => {
    expect(() => guard.canActivate(makeContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a request bearing a refresh token instead of an access token', () => {
    const token = tokenService.signRefreshToken({
      sub: 'admin-1',
      tenantId: 'tenant-1',
      role: 'ORGANIZER',
    });
    expect(() => guard.canActivate(makeContext(`Bearer ${token}`))).toThrow(
      UnauthorizedException,
    );
  });
});
