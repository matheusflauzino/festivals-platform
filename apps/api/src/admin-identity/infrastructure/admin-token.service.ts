import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminRole } from '../domain/admin-user.entity';

export interface AdminTokenPayload {
  sub: string;
  tenantId: string;
  role: AdminRole;
}

type TokenType = 'access' | 'refresh';

@Injectable()
export class AdminTokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(payload: AdminTokenPayload): string {
    return this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: '15m' },
    );
  }

  signRefreshToken(payload: AdminTokenPayload): string {
    return this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: '7d' },
    );
  }

  verifyAccessToken(token: string): AdminTokenPayload {
    return this.verifyOfType(token, 'access');
  }

  verifyRefreshToken(token: string): AdminTokenPayload {
    return this.verifyOfType(token, 'refresh');
  }

  private verifyOfType(token: string, type: TokenType): AdminTokenPayload {
    const payload = this.jwtService.verify<
      AdminTokenPayload & { type?: string }
    >(token);
    if (payload.type !== type) {
      throw new Error('wrong token type');
    }
    return { sub: payload.sub, tenantId: payload.tenantId, role: payload.role };
  }
}
