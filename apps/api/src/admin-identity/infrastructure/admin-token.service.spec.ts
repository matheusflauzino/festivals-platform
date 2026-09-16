import { JwtService } from '@nestjs/jwt';
import { AdminTokenService } from './admin-token.service';

describe('AdminTokenService', () => {
  const jwtService = new JwtService({ secret: 'test-admin-secret' });
  const service = new AdminTokenService(jwtService);

  const payload = { sub: 'admin-1', tenantId: 'tenant-1', role: 'ORGANIZER' as const };

  it('signs and verifies an access token, carrying the role claim', () => {
    const token = service.signAccessToken(payload);
    const decoded = service.verifyAccessToken(token);

    expect(decoded.sub).toBe('admin-1');
    expect(decoded.tenantId).toBe('tenant-1');
    expect(decoded.role).toBe('ORGANIZER');
  });

  it('signs and verifies a refresh token', () => {
    const token = service.signRefreshToken(payload);
    const decoded = service.verifyRefreshToken(token);
    expect(decoded.sub).toBe('admin-1');
  });

  it('rejects a refresh token when checked as an access token', () => {
    const token = service.signRefreshToken(payload);
    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it('rejects an access token when checked as a refresh token', () => {
    const token = service.signAccessToken(payload);
    expect(() => service.verifyRefreshToken(token)).toThrow();
  });

  it('rejects a token signed with a different secret', () => {
    const otherService = new AdminTokenService(new JwtService({ secret: 'different-secret' }));
    const token = otherService.signAccessToken(payload);
    expect(() => service.verifyAccessToken(token)).toThrow();
  });
});
