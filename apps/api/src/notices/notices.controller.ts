import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { NoticesService } from './notices.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STUDENT')
  getAll(@Query('activeOnly') activeOnly: string) {
    return this.noticesService.getAll(activeOnly === 'true');
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@Body() data: { title: string; content: string; type?: string; isActive?: boolean }) {
    return this.noticesService.create(data);
  }

  @Put(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @Body() data: { title?: string; content?: string; type?: string; isActive?: boolean }) {
    return this.noticesService.update(id, data);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  delete(@Param('id') id: string) {
    return this.noticesService.delete(id);
  }
}
