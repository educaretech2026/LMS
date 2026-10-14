import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  createStudent(@Body() data: any) {
    return this.studentsService.createStudent(data);
  }

  @Get('birthdays/today')
  getTodayBirthdays() {
    return this.studentsService.getTodayBirthdays();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyStudentProfile(@Req() req: any) {
    return this.studentsService.getStudentByUserId(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-id-card')
  getMyIdCard(@Req() req: any) {
    return this.studentsService.getStudentByUserId(req.user.id);
  }

  @Get('search')
  searchStudents(@Query('q') query: string) {
    return this.studentsService.searchStudents(query);
  }

  @Get()
  getStudents() {
    return this.studentsService.getStudents();
  }

  @Get(':id')
  getStudent(@Param('id') id: string) {
    return this.studentsService.getStudentById(id);
  }

  @Put(':id')
  updateStudent(@Param('id') id: string, @Body() data: any) {
    return this.studentsService.updateStudent(id, data);
  }

  @Put(':id/status')
  toggleStatus(@Param('id') id: string, @Body('status') status: 'ACTIVE' | 'INACTIVE') {
    return this.studentsService.toggleStatus(id, status);
  }

  @Delete(':id')
  deleteStudent(@Param('id') id: string) {
    return this.studentsService.deleteStudent(id);
  }
}
