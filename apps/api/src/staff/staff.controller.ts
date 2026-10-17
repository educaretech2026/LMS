import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  createStaff(@Body() data: any, @Req() req: any) {
    return this.staffService.createStaff(data, req.user);
  }

  @Get()
  getStaff(@Req() req: any) {
    return this.staffService.getStaff(req.user);
  }

  @Put(':id')
  updateStaff(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    return this.staffService.updateStaff(id, data, req.user);
  }

  @Delete(':id')
  deleteStaff(@Param('id') id: string, @Req() req: any) {
    return this.staffService.deleteStaff(id, req.user);
  }
}
