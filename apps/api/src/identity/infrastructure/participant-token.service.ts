import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface ParticipantTokenPayload {
  sub: string;
  tenantId: string;
}

type TokenType = 'access' | 'refresh';

@Injectable()
export class ParticipantTokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(payload: ParticipantTokenPayload): string {
    return this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: '15m' },
    );
  }

  signRefreshToken(payload: ParticipantTokenPayload): string {
    return this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: '7d' },
    );
  }

  verifyAccessToken(token: string): ParticipantTokenPayload {
    return this.verifyOfType(token, 'access');
  }

  verifyRefreshToken(token: string): ParticipantTokenPayload {
    return this.verifyOfType(token, 'refresh');
  }

  private verifyOfType(
    token: string,
    type: TokenType,
  ): ParticipantTokenPayload {
    const payload = this.jwtService.verify<
      ParticipantTokenPayload & { type?: string }
    >(token);
    if (payload.type !== type) {
      throw new Error('wrong token type');
    }
    return { sub: payload.sub, tenantId: payload.tenantId };
  }
}
