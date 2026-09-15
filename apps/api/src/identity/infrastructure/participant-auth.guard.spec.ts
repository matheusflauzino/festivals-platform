import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ParticipantTokenService } from './participant-token.service';
import { ParticipantAuthGuard } from './participant-auth.guard';

function makeContext(authHeader?: string): ExecutionContext {
  const request: { headers: Record<string, string>; participant?: unknown } = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ParticipantAuthGuard', () => {
  const tokenService = new ParticipantTokenService(
    new JwtService({ secret: 'test-secret' }),
  );
  const guard = new ParticipantAuthGuard(tokenService);

  it('allows a request with a valid bearer token and attaches request.participant', () => {
    const token = tokenService.signAccessToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
    });
    const context = makeContext(`Bearer ${token}`);

    expect(guard.canActivate(context)).toBe(true);
    const request = context
      .switchToHttp()
      .getRequest<{ participant?: unknown }>();
    expect(request.participant).toEqual({ id: 'user-1', tenantId: 'tenant-1' });
  });

  it('rejects a request with no authorization header', () => {
    const context = makeContext();
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a request with an invalid token', () => {
    const context = makeContext('Bearer not-a-real-token');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a request with a malformed authorization header (not "Bearer <token>")', () => {
    const context = makeContext('Basic dXNlcjpwYXNz');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
