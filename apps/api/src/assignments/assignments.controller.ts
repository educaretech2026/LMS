import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
@Controller('assignments')
@Permissions('ASSIGNMENTS')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  @Get()
  getAll(@Req() req: any): Promise<any> {
    const roleName = req.user?.role?.name || req.user?.role || '';
    return this.assignmentsService.getAll(req.user.id, roleName, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  @Get(':id')
  getOne(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.assignmentsService.getOne(id, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Post()
  create(@Body() data: any, @Req() req: any): Promise<any> {
    return this.assignmentsService.create(data, req.user.id, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any, @Req() req: any): Promise<any> {
    const roleName = req.user?.role?.name || req.user?.role || '';
    return this.assignmentsService.update(id, data, req.user.id, roleName, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any): Promise<any> {
    const roleName = req.user?.role?.name || req.user?.role || '';
    return this.assignmentsService.delete(id, req.user.id, roleName, req.user);
  }

  @Roles('STUDENT', 'PUBLIC_LEARNER')
  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() data: any, @Req() req: any): Promise<any> {
    return this.assignmentsService.submit(id, req.user.id, data, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Patch('submissions/:id/grade')
  gradeSubmission(@Param('id') id: string, @Body() data: any, @Req() req: any): Promise<any> {
    return this.assignmentsService.gradeSubmission(id, data, req.user);
  }
}

