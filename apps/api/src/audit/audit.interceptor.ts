import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { AuditStatusEnum } from './audit.dto';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Derives a human-readable action name and category from HTTP method and path.
 */
function deriveActionAndCategory(method: string, path: string): { action: string; category: string; entityType?: string } {
  const cleanPath = path.split('?')[0].replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const segments = cleanPath.split('/').filter(Boolean);
  const resource = segments[0]?.toUpperCase() || 'SYSTEM';

  let category = 'GENERAL';
  if (['AUTH', 'USERS', 'ROLES', 'PERMISSIONS'].includes(resource)) {
    category = 'SECURITY';
  } else if (['FEE', 'FINANCE', 'EXPENSE', 'PAYMENT'].includes(resource)) {
    category = 'FINANCIAL';
  } else if (['STUDENTS', 'STAFF', 'EXAM', 'EXAMS', 'ATTENDANCE', 'SYLLABUS', 'COURSES', 'LIVE-CLASS'].includes(resource)) {
    category = 'ACADEMIC';
  }

  const actionVerb = {
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'MODIFY',
    DELETE: 'DELETE',
  }[method] || method;

  const action = `${resource}_${actionVerb}`;
  return { action, category, entityType: segments[0] || 'System' };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method?.toUpperCase();

    // Only audit state-modifying requests
    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const path = request.originalUrl || request.url || '';
    
    // Ignore internal metrics or health checks
    if (path.includes('/health') || path.includes('/metrics')) {
      return next.handle();
    }

    const startTime = Date.now();
    const user: any = (request as any).user;
    const ipAddress = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || request.ip || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'] as string;
    const { action, category, entityType } = deriveActionAndCategory(method, path);

    return next.handle().pipe(
      tap(() => {
        const executionMs = Date.now() - startTime;
        const statusCode = (request.res as any)?.statusCode || 200;

        this.auditService.record({
          userId: user?.id || null,
          userEmail: user?.email || null,
          userName: user?.name || null,
          userRole: user?.role?.name || user?.role || null,
          centreId: user?.centreId || request.body?.centreId || null,
          action,
          category,
          entityType,
          status: AuditStatusEnum.SUCCESS,
          statusCode,
          executionMs,
          ipAddress,
          userAgent,
          details: {
            method,
            path,
            body: request.body,
            query: request.query,
            params: request.params,
          },
        });
      }),
      catchError((error) => {
        const executionMs = Date.now() - startTime;
        const statusCode = error?.status || error?.statusCode || 500;

        this.auditService.record({
          userId: user?.id || null,
          userEmail: user?.email || null,
          userName: user?.name || null,
          userRole: user?.role?.name || user?.role || null,
          centreId: user?.centreId || request.body?.centreId || null,
          action: `${action}_FAILED`,
          category,
          entityType,
          status: AuditStatusEnum.FAILURE,
          statusCode,
          executionMs,
          ipAddress,
          userAgent,
          details: {
            method,
            path,
            errorMessage: error?.message || 'Unknown error',
            body: request.body,
          },
        });

        return throwError(() => error);
      }),
    );
  }
}
