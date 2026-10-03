import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Get('students/filter')
  getStudentsByFilter(
    @Query('centreId') centreId: string,
    @Query('boardId') boardId: string,
    @Query('standardId') standardId: string,
    @Query('trackId') trackId: string
  ) {
    return this.attendanceService.getStudentsByFilter(centreId, boardId, standardId, trackId);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Get('batches/filter')
  getBatches(
    @Query('centreId') centreId: string,
    @Query('boardId') boardId: string,
    @Query('standardId') standardId: string,
    @Query('trackId') trackId: string
  ) {
    return this.attendanceService.getBatches(centreId, boardId, standardId, trackId);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Get('students/:batchId')
  getStudents(@Param('batchId') batchId: string, @Query('subjectId') subjectId: string) {
    return this.attendanceService.getBatchStudents(batchId, subjectId);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Get('filter')
  getAttendanceByFilter(
    @Query('centreId') centreId: string,
    @Query('boardId') boardId: string,
    @Query('standardId') standardId: string,
    @Query('trackId') trackId: string,
    @Query('date') date: string
  ) {
    return this.attendanceService.getAttendanceByFilter(centreId, boardId, standardId, trackId, date);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Get(':batchId')
  getAttendance(
    @Param('batchId') batchId: string, 
    @Query('date') date: string,
    @Query('subjectId') subjectId: string
  ) {
    return this.attendanceService.getAttendanceForBatchAndDate(batchId, date, subjectId);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Post()
  markAttendance(@Body() data: any, @Req() req: any) {
    return this.attendanceService.markAttendance(data, req.user.id);
  }
}
