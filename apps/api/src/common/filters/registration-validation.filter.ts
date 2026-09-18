import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { RegistrationValidationError } from '../../registrations/domain/registration-validation.error';

@Catch(RegistrationValidationError)
export class RegistrationValidationExceptionFilter implements ExceptionFilter {
  catch(exception: RegistrationValidationError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(400).json({
      statusCode: 400,
      message: exception.message,
    });
  }
}
