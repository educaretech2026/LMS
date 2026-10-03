import { Controller, Get, Post, Body, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { FeeService } from './fee.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('fee')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
export class FeeController {
  constructor(private readonly feeService: FeeService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'STUDENT')
  findAll(@Req() req: any) {
    return this.feeService.findAll(req.user);
  }

  @Post()
  create(@Body() data: any) {
    return this.feeService.create(data);
  }

  @Post(':studentId/reminder')
  sendReminder(@Param('studentId') studentId: string, @Body() data: any) {
    return this.feeService.sendReminder(studentId, data);
  }

  @Post(':id/status')
  updateStatus(@Param('id') id: string, @Body() data: { status: string }) {
    return this.feeService.updateStatus(id, data.status);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Body() data: { password?: string }) {
    if (data.password !== 'delete123') {
      throw new Error('Unauthorized');
    }
    return this.feeService.delete(id);
  }
}
