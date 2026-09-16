import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { FestivalValidationError } from '../../festivals/domain/festival-validation.error';

@Catch(FestivalValidationError)
export class FestivalValidationExceptionFilter implements ExceptionFilter {
  catch(exception: FestivalValidationError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(400).json({
      statusCode: 400,
      message: exception.message,
    });
  }
}
