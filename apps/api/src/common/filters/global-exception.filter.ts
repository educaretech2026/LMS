import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuditService } from '../../audit/audit.service';
import { AuditStatusEnum } from '../../audit/audit.dto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(@Optional() private readonly auditService?: AuditService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${
          exception instanceof Error ? exception.message : 'Unknown error'
        }`,
        exception instanceof Error ? exception.stack : '',
      );

      if (this.auditService) {
        try {
          const user: any = (request as any).user;
          const ipAddress = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || request.ip;
          this.auditService.record({
            userId: user?.id || null,
            userEmail: user?.email || null,
            userName: user?.name || null,
            userRole: user?.role?.name || user?.role || null,
            action: 'SYSTEM_ERROR',
            category: 'SYSTEM',
            status: AuditStatusEnum.FAILURE,
            statusCode: status,
            ipAddress,
            userAgent: request.headers['user-agent'] as string,
            details: {
              method: request.method,
              path: request.url,
              error: exception instanceof Error ? exception.message : 'Unknown error',
              stack: exception instanceof Error ? exception.stack?.slice(0, 1000) : null,
            },
          });
        } catch {
          // ignore error in audit logging
        }
      }
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'object' && message !== null && 'message' in message
        ? (message as any).message
        : message,
    });
  }
}
