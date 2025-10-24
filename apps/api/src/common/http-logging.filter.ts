import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AppException } from './exceptions';

/**
 * Global HTTP Exception Filter with comprehensive logging and error codes
 * - Handles custom AppException with error codes
 * - Provides structured error responses
 * - Logs with request IDs for tracing
 * - Includes diagnostics in development mode
 */
@Catch()
export class HttpLoggingFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpLoggingFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const requestId =
      request.requestId || Math.random().toString(36).substr(2, 9);
    const method = request.method;
    const url = request.originalUrl;
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let userMessage = 'An unexpected error occurred. Please try again.';
    let details: Record<string, any> | null = null;

    if (exception instanceof AppException) {
      // Handle custom application exception
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      errorCode = exceptionResponse.errorCode || 'INTERNAL_ERROR';
      message = exceptionResponse.message || 'Error';
      userMessage = exceptionResponse.userMessage || message;
      details = exceptionResponse.details || null;

      // Log with context
      this._logError(
        requestId,
        method,
        url,
        status,
        errorCode,
        message,
        details,
      );
    } else if (exception instanceof HttpException) {
      // Handle standard NestJS HttpException
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || 'HTTP Exception';
      } else {
        message = exceptionResponse as string;
      }
      userMessage = message;

      this._logError(requestId, method, url, status, errorCode, message);
    } else if (exception instanceof Error) {
      // Handle generic JavaScript errors
      message = exception.message || 'Unknown error';
      userMessage = 'An unexpected error occurred. Please try again.';

      this.logger.error(
        `[${requestId}] ${method} ${url} => ${status} (${exception.name})`,
        {
          message,
          stack: exception.stack,
        },
      );
    } else {
      // Unknown error type
      message = String(exception) || 'Unknown error';
      userMessage = 'An unexpected error occurred. Please try again.';

      this.logger.error(`[${requestId}] ${method} ${url} => ${status}`, {
        exception,
      });
    }

    // Build response
    const responseBody: any = {
      statusCode: status,
      timestamp,
      path: url,
      errorCode,
      message,
      userMessage,
      requestId,
    };

    // Add details in development mode
    if (process.env.NODE_ENV !== 'production' && details) {
      responseBody.details = details;
    }

    // Send response
    response.status(status).json(responseBody);
  }

  /**
   * Log error with appropriate level
   */
  private _logError(
    requestId: string,
    method: string,
    url: string,
    status: number,
    errorCode: string,
    message: string,
    details?: Record<string, any> | null,
  ) {
    const logData = {
      timestamp: new Date().toISOString(),
      requestId,
      method,
      url,
      status,
      errorCode,
      message,
      ...(details && { details }),
    };

    const prefix = `[${requestId}] ${method} ${url} => ${status}`;

    if (status >= 500) {
      this.logger.error(`${prefix} (${errorCode})`, logData);
    } else if (status >= 400) {
      this.logger.warn(`${prefix} (${errorCode})`, logData);
    } else {
      this.logger.log(`${prefix} (${errorCode})`);
    }
  }
}
