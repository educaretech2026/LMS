import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Permissions('STUDENTS')
  createStudent(@Body() data: any, @Req() req: any) {
    return this.studentsService.createStudent(data, req.user);
  }

  @Get('birthdays/today')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'ACCOUNTANT', 'COUNSELOR')
  getTodayBirthdays(@Req() req: any) {
    return this.studentsService.getTodayBirthdays(req.user);
  }

  @Get('me')
  @Roles('STUDENT')
  getMyStudentProfile(@Req() req: any) {
    return this.studentsService.getStudentByUserId(req.user.id);
  }

  @Get('my-id-card')
  @Roles('STUDENT')
  getMyIdCard(@Req() req: any) {
    return this.studentsService.getStudentByUserId(req.user.id);
  }

  @Get('search')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Permissions('STUDENTS')
  searchStudents(@Query('q') query: string, @Req() req: any) {
    return this.studentsService.searchStudents(query, req.user);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Permissions('STUDENTS')
  getStudents(@Req() req: any) {
    return this.studentsService.getStudents(req.user);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getStudent(@Param('id') id: string, @Req() req: any) {
    return this.studentsService.getStudentById(id, req.user);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Permissions('STUDENTS')
  updateStudent(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    return this.studentsService.updateStudent(id, data, req.user);
  }

  @Put(':id/status')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Permissions('STUDENTS')
  toggleStatus(@Param('id') id: string, @Body('status') status: 'ACTIVE' | 'INACTIVE', @Req() req: any) {
    return this.studentsService.toggleStatus(id, status, req.user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Permissions('STUDENTS')
  deleteStudent(@Param('id') id: string, @Req() req: any) {
    return this.studentsService.deleteStudent(id, req.user);
  }
}
