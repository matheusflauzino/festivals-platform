import { JwtService } from '@nestjs/jwt';
import { ParticipantTokenService } from './participant-token.service';

describe('ParticipantTokenService', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const service = new ParticipantTokenService(jwtService);

  it('signs and verifies an access token', () => {
    const token = service.signAccessToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
    });
    const payload = service.verifyAccessToken(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.tenantId).toBe('tenant-1');
  });

  it('signs and verifies a refresh token', () => {
    const token = service.signRefreshToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
    });
    const payload = service.verifyRefreshToken(token);

    expect(payload.sub).toBe('user-1');
  });

  it('rejects a token signed with a different secret', () => {
    const otherService = new ParticipantTokenService(
      new JwtService({ secret: 'different-secret' }),
    );
    const token = otherService.signAccessToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
    });

    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it('rejects a refresh token when verified as an access token', () => {
    const token = service.signRefreshToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
    });

    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it('rejects an access token when verified as a refresh token', () => {
    const token = service.signAccessToken({
      sub: 'user-1',
      tenantId: 'tenant-1',
    });

    expect(() => service.verifyRefreshToken(token)).toThrow();
  });
});
