import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ParticipantTokenService } from './participant-token.service';

interface RequestWithParticipant extends Request {
  participant?: { id: string; tenantId: string };
}

@Injectable()
export class ParticipantAuthGuard implements CanActivate {
  constructor(private readonly tokenService: ParticipantTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithParticipant>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = this.tokenService.verifyAccessToken(token);
      request.participant = { id: payload.sub, tenantId: payload.tenantId };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
