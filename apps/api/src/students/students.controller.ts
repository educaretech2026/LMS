import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { StudentsService } from './students.service';

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

  @Get()
  getStudents() {
    return this.studentsService.getStudents();
  }

  @Get(':id')
  getStudent(@Param('id') id: string) {
    return this.studentsService.getStudentById(id);
  }

  @Get('search')
  searchStudents(@Query('q') query: string) {
    return this.studentsService.searchStudents(query);
  }

  @Put(':id')
  updateStudent(@Param('id') id: string, @Body() data: any) {
    return this.studentsService.updateStudent(id, data);
  }

  @Delete(':id')
  deleteStudent(@Param('id') id: string) {
    return this.studentsService.deleteStudent(id);
  }
}
