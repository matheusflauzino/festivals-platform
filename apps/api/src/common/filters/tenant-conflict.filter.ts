import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { TenantConflictError } from '../../tenants/domain/tenant-conflict.error';

@Catch(TenantConflictError)
export class TenantConflictExceptionFilter implements ExceptionFilter {
  catch(exception: TenantConflictError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(409).json({
      statusCode: 409,
      message: exception.message,
    });
  }
}
