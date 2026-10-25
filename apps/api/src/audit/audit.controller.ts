import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto, PaginatedAuditLogs, AuditStatsResponse } from './audit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
@Permissions('AUDIT_LOGS')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(@Query() query: QueryAuditLogsDto, @Req() req: any): Promise<PaginatedAuditLogs> {
    return this.auditService.findAll(query, req.user);
  }

  @Get('stats')
  async getStats(@Req() req: any): Promise<AuditStatsResponse> {
    return this.auditService.getStats(req.user);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  async exportCsv(
    @Query() query: QueryAuditLogsDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const csvData = await this.auditService.exportCsv(query, req.user);
    const filename = `educare_audit_logs_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvData);
  }
}
