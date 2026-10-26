import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
@Permissions('FINANCE')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Post('transaction')
  createTransaction(@Body() data: any, @Req() req: any) {
    return this.financeService.createTransaction(data, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('transactions')
  getTransactions(@Req() req: any) {
    return this.financeService.getTransactions(req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('summary')
  getSummary(@Req() req: any) {
    return this.financeService.getSummary(req.user);
  }
}
