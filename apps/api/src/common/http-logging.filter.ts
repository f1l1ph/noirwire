import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

/**
 * Global HTTP Exception Filter with comprehensive logging
 * Logs all HTTP requests, responses, and errors with request IDs and timing
 */
@Catch()
export class HttpLoggingFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpLoggingFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const requestId = request.requestId || Math.random().toString(36).substr(2, 9);
    const method = request.method;
    const url = request.originalUrl;
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorMessage = String(exception);

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || 'HTTP Exception';
      } else {
        message = exceptionResponse as string;
      }
      errorMessage = exception.message;
    }

    // Log the error with full context
    const errorLog = {
      timestamp,
      requestId,
      method,
      url,
      status,
      message,
      errorMessage,
      type: exception?.constructor?.name || 'unknown',
    };

    // Log at appropriate level
    if (status >= 500) {
      this.logger.error(`[${requestId}] ${method} ${url} => ${status}`, errorLog);
    } else if (status >= 400) {
      this.logger.warn(`[${requestId}] ${method} ${url} => ${status}`, errorLog);
    } else {
      this.logger.log(`[${requestId}] ${method} ${url} => ${status}`);
    }

    // Send response
    response.status(status).json({
      statusCode: status,
      timestamp,
      path: url,
      message,
      requestId,
      ...(process.env.NODE_ENV !== 'production' && {
        error: errorMessage,
        type: exception?.constructor?.name,
      }),
    });
  }
}
