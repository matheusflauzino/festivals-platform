import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { FestivalConflictError } from '../../festivals/domain/festival-conflict.error';

@Catch(FestivalConflictError)
export class FestivalConflictExceptionFilter implements ExceptionFilter {
  catch(exception: FestivalConflictError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(409).json({
      statusCode: 409,
      message: exception.message,
    });
  }
}
