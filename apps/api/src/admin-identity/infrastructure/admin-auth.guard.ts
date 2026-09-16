import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminRole } from '../domain/admin-user.entity';
import { AdminTokenService } from './admin-token.service';

export interface RequestWithAdmin extends Request {
  admin?: { id: string; tenantId: string; role: AdminRole };
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly tokenService: AdminTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = this.tokenService.verifyAccessToken(token);
      request.admin = {
        id: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
