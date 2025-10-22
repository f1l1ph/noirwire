import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Request Logging Middleware
 * Logs all incoming requests with timing and request IDs
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
    // Generate unique request ID
    const requestId = Math.random().toString(36).substr(2, 9);
    req.requestId = requestId;

    const { method, originalUrl, ip } = req;
    const startTime = Date.now();

    // Log incoming request
    this.logger.log(
      `[${requestId}] ${method} ${originalUrl} - ${ip}`,
    );

    // Log response when it finishes
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      if (statusCode >= 500) {
        this.logger.error(
          `[${requestId}] ${method} ${originalUrl} => ${statusCode} (${duration}ms)`,
        );
      } else if (statusCode >= 400) {
        this.logger.warn(
          `[${requestId}] ${method} ${originalUrl} => ${statusCode} (${duration}ms)`,
        );
      } else {
        this.logger.log(
          `[${requestId}] ${method} ${originalUrl} => ${statusCode} (${duration}ms)`,
        );
      }
    });

    next();
  }
}
