import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { InvalidFestivalStateError } from '../../festivals/domain/invalid-festival-state.error';

@Catch(InvalidFestivalStateError)
export class InvalidFestivalStateExceptionFilter implements ExceptionFilter {
  catch(exception: InvalidFestivalStateError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(409).json({
      statusCode: 409,
      message: exception.message,
    });
  }
}
