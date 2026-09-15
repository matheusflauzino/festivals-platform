import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface ParticipantTokenPayload {
  sub: string;
  tenantId: string;
}

@Injectable()
export class ParticipantTokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(payload: ParticipantTokenPayload): string {
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  signRefreshToken(payload: ParticipantTokenPayload): string {
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  verify(token: string): ParticipantTokenPayload {
    return this.jwtService.verify<ParticipantTokenPayload>(token);
  }
}
