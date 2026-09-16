import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AdminConflictError } from '../../admin-identity/domain/admin-conflict.error';

@Catch(AdminConflictError)
export class AdminConflictExceptionFilter implements ExceptionFilter {
  catch(exception: AdminConflictError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(409).json({
      statusCode: 409,
      message: exception.message,
    });
  }
}
