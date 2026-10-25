import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum AuditStatusEnum {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  WARNING = 'WARNING',
}

export interface CreateAuditLogDto {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  centreId?: string | null;
  action: string;
  category?: string;
  entityType?: string | null;
  entityId?: string | null;
  status?: AuditStatusEnum;
  statusCode?: number | null;
  executionMs?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: any;
}

export class QueryAuditLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(AuditStatusEnum)
  status?: AuditStatusEnum;

  @IsOptional()
  @IsString()
  centreId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export interface PaginatedAuditLogs {
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditStatsResponse {
  todayCount: number;
  past24hErrors: number;
  securityAlerts: number;
  categories: { category: string; count: number }[];
}
