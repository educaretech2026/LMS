import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { DoubtsService } from './doubts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateDoubtDto } from './dto/create-doubt.dto';
import { CreateDoubtMessageDto } from './dto/create-message.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
@Controller('doubts')
export class DoubtsController {
  constructor(private readonly doubtsService: DoubtsService) {}

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  @Get()
  getAll(@Req() req: any, @Query() query: any): Promise<any> {
    const role = req.user?.role?.name || req.user?.role || '';
    return this.doubtsService.getAll(req.user.id, role, query, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  @Get('teachers/available')
  getAvailableTeachers(@Req() req: any): Promise<any> {
    const role = req.user?.role?.name || req.user?.role || '';
    return this.doubtsService.getAvailableTeachers(req.user.id, role);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  @Get(':id')
  getById(@Param('id') id: string, @Req() req: any): Promise<any> {
    const role = req.user?.role?.name || req.user?.role || '';
    return this.doubtsService.getById(id, req.user.id, role, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'STUDENT', 'PUBLIC_LEARNER')
  @Post()
  create(@Body() dto: CreateDoubtDto, @Req() req: any): Promise<any> {
    const role = req.user?.role?.name || req.user?.role || '';
    return this.doubtsService.create(req.user.id, role, dto, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  @Post(':id/messages')
  postMessage(
    @Param('id') id: string,
    @Body() dto: CreateDoubtMessageDto,
    @Req() req: any,
  ): Promise<any> {
    const role = req.user?.role?.name || req.user?.role || '';
    return this.doubtsService.postMessage(id, req.user.id, role, dto);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() req: any,
  ): Promise<any> {
    const role = req.user?.role?.name || req.user?.role || '';
    return this.doubtsService.updateStatus(id, req.user.id, role, status, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Patch(':id/reassign')
  reassign(
    @Param('id') id: string,
    @Body('teacherId') teacherId: string,
    @Req() req: any,
  ): Promise<any> {
    const role = req.user?.role?.name || req.user?.role || '';
    return this.doubtsService.reassign(id, req.user.id, role, teacherId, req.user);
  }
}
