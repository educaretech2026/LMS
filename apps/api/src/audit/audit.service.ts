import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAuditLogDto, QueryAuditLogsDto, AuditStatusEnum, PaginatedAuditLogs, AuditStatsResponse } from './audit.dto';
import { isSuperAdmin, getAuthorizedCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

const REDACTED_KEYS = new Set([
  'password',
  'confirmpassword',
  'token',
  'secret',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'creditcard',
  'cardnumber',
  'cvv',
  'apikey',
  'privatekey',
]);

/**
 * Recursively redacts sensitive keys from objects and arrays.
 */
function redactSensitiveData(data: any, depth: number = 0): any {
  if (depth > 6 || data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.slice(0, 50).map((item) => redactSensitiveData(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z]/g, '');
    if (REDACTED_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactSensitiveData(value, depth + 1);
    } else if (typeof value === 'string' && value.length > 2000) {
      // Truncate giant string values (e.g. base64 images)
      sanitized[key] = `${value.slice(0, 100)}... [truncated ${value.length} chars]`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Neutralizes CSV formula injection attacks by prepending a quote
 * if a cell begins with =, +, -, or @
 */
function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  if (/^[=\+\-@]/.test(str)) {
    return `"'${str}"`;
  }
  return `"${str}"`;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Non-blocking record creation. Executes asynchronously so caller
   * throughput is never affected by log writing.
   */
  record(entry: CreateAuditLogDto): void {
    setImmediate(async () => {
      try {
        let sanitizedDetails: any = null;
        if (entry.details !== undefined && entry.details !== null) {
          const redacted = redactSensitiveData(entry.details);
          const jsonStr = JSON.stringify(redacted);
          // Cap payload at 16KB
          sanitizedDetails = jsonStr.length > 16384 ? { summary: 'Payload exceeds 16KB limit' } : redacted;
        }

        await this.prisma.auditLog.create({
          data: {
            userId: entry.userId || null,
            userEmail: entry.userEmail ? entry.userEmail.slice(0, 255) : null,
            userName: entry.userName ? entry.userName.slice(0, 255) : null,
            userRole: entry.userRole ? entry.userRole.slice(0, 50) : null,
            centreId: entry.centreId || null,
            action: (entry.action || 'UNKNOWN').slice(0, 100),
            category: (entry.category || 'GENERAL').slice(0, 50),
            entityType: entry.entityType ? entry.entityType.slice(0, 100) : null,
            entityId: entry.entityId ? entry.entityId.slice(0, 100) : null,
            status: entry.status || AuditStatusEnum.SUCCESS,
            statusCode: entry.statusCode || null,
            executionMs: entry.executionMs || null,
            ipAddress: entry.ipAddress ? entry.ipAddress.slice(0, 60) : null,
            userAgent: entry.userAgent ? entry.userAgent.slice(0, 500) : null,
            details: sanitizedDetails,
          },
        });
      } catch (err: any) {
        // Safe fail: Never throw from background logger
        this.logger.warn(`Failed to write audit log (${entry.action}): ${err?.message || err}`);
      }
    });
  }

  /**
   * Paginated log query with multi-tenant isolation and text search.
   */
  async findAll(query: QueryAuditLogsDto, user: any): Promise<PaginatedAuditLogs> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const skip = (page - 1) * limit;

    const where: any = {};

    // Multi-tenant Centre isolation
    if (!isSuperAdmin(user)) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      if (query.centreId) {
        assertCentreAccess(user, query.centreId);
        where.centreId = query.centreId;
      } else {
        where.centreId = { in: authorizedCentres };
      }
    } else if (query.centreId) {
      where.centreId = query.centreId;
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    // Date range filtering
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Full-text search
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { userEmail: { contains: term, mode: 'insensitive' } },
        { userName: { contains: term, mode: 'insensitive' } },
        { action: { contains: term, mode: 'insensitive' } },
        { entityType: { contains: term, mode: 'insensitive' } },
        { ipAddress: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          centre: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Aggregate statistics for dashboard summary cards.
   */
  async getStats(user: any): Promise<AuditStatsResponse> {
    const where: any = {};
    if (!isSuperAdmin(user)) {
      where.centreId = { in: getAuthorizedCentreIds(user) };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [todayCount, past24hErrors, securityAlerts, categoryBreakdown] = await Promise.all([
      this.prisma.auditLog.count({
        where: {
          ...where,
          createdAt: { gte: startOfToday },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          ...where,
          createdAt: { gte: past24Hours },
          OR: [{ status: AuditStatusEnum.FAILURE }, { statusCode: { gte: 500 } }],
        },
      }),
      this.prisma.auditLog.count({
        where: {
          ...where,
          createdAt: { gte: past24Hours },
          OR: [
            { category: 'SECURITY' },
            { action: { contains: 'FAIL' } },
            { status: AuditStatusEnum.WARNING },
          ],
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['category'],
        where,
        _count: { _all: true },
      }),
    ]);

    return {
      todayCount,
      past24hErrors,
      securityAlerts,
      categories: categoryBreakdown.map((c) => ({
        category: c.category,
        count: c._count._all,
      })),
    };
  }

  /**
   * Exports filtered audit log records to CSV with formula injection protection.
   */
  async exportCsv(query: QueryAuditLogsDto, user: any): Promise<string> {
    const result = await this.findAll({ ...query, limit: 1000, page: 1 }, user);

    const headers = [
      'Timestamp (UTC)',
      'Action',
      'Category',
      'Status',
      'Status Code',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Centre',
      'Target Entity',
      'Target ID',
      'IP Address',
      'Duration (ms)',
    ];

    const rows = result.items.map((log) => [
      sanitizeCsvCell(log.createdAt.toISOString()),
      sanitizeCsvCell(log.action),
      sanitizeCsvCell(log.category),
      sanitizeCsvCell(log.status),
      sanitizeCsvCell(log.statusCode || ''),
      sanitizeCsvCell(log.userName || ''),
      sanitizeCsvCell(log.userEmail || ''),
      sanitizeCsvCell(log.userRole || ''),
      sanitizeCsvCell(log.centre?.name || ''),
      sanitizeCsvCell(log.entityType || ''),
      sanitizeCsvCell(log.entityId || ''),
      sanitizeCsvCell(log.ipAddress || ''),
      sanitizeCsvCell(log.executionMs || ''),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }
}
