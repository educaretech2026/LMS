import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { NoticesService } from './notices.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

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
