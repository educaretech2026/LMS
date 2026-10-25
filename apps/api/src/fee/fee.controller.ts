import { Controller, Get, Post, Body, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { FeeService } from './fee.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('fee')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
@Permissions('FEES')
export class FeeController {
  constructor(private readonly feeService: FeeService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'STUDENT')
  findAll(@Req() req: any) {
    return this.feeService.findAll(req.user);
  }

  @Post()
  create(@Body() data: any, @Req() req: any) {
    return this.feeService.create(data, req.user);
  }

  @Post(':studentId/reminder')
  sendReminder(@Param('studentId') studentId: string, @Body() data: any, @Req() req: any) {
    return this.feeService.sendReminder(studentId, data, req.user);
  }

  @Post(':id/status')
  updateStatus(@Param('id') id: string, @Body() data: { status: string }, @Req() req: any) {
    return this.feeService.updateStatus(id, data.status, req.user);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.feeService.delete(id, req.user);
  }
}
