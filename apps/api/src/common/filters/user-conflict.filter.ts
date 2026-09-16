import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { UserConflictError } from '../../identity/domain/user-conflict.error';

@Catch(UserConflictError)
export class UserConflictExceptionFilter implements ExceptionFilter {
  catch(exception: UserConflictError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(409).json({
      statusCode: 409,
      message: exception.message,
    });
  }
}
