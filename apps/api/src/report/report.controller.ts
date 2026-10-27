import { Controller, Get, Query, Param, Req, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('report')
@Permissions('REPORTS')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('fees')
  getFeeReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any
  ) {
    return this.reportService.getFeeCollectionReport(startDate, endDate, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('finance')
  getFinanceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('centreId') centreId: string,
    @Req() req: any
  ) {
    return this.reportService.getExpenseIncomeReport(startDate, endDate, centreId, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('enquiries')
  getEnquiryReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any
  ) {
    return this.reportService.getEnquiryConversionReport(startDate, endDate, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Get('performance')
  getPerformanceReport(
    @Query('batchId') batchId: string,
    @Req() req: any
  ) {
    return this.reportService.getStudentPerformanceReport(batchId, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  @Get('student-performance/:studentId')
  getSingleStudentPerformance(
    @Param('studentId') studentId: string,
    @Req() req: any
  ) {
    return this.reportService.getSingleStudentPerformance(studentId, req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('dashboard')
  getDashboardStats(@Req() req: any) {
    return this.reportService.getDashboardStats(req.user);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('overview')
  getOverviewAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('batchId') batchId?: string,
    @Query('centreId') centreId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('boardId') boardId?: string,
    @Query('standardId') standardId?: string,
    @Query('subjectId') subjectId?: string,
    @Req() req?: any
  ) {
    return this.reportService.getOverviewAnalytics(
      startDate,
      endDate,
      batchId,
      centreId,
      academicYearId,
      boardId,
      standardId,
      subjectId,
      req?.user
    );
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Get('exams-analytics')
  getExamsAnalytics(
    @Query('batchId') batchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('centreId') centreId?: string,
    @Query('boardId') boardId?: string,
    @Query('standardId') standardId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('chapterId') chapterId?: string,
    @Query('topicId') topicId?: string,
    @Req() req?: any,
  ) {
    return this.reportService.getExamsAnalytics(
      batchId,
      startDate,
      endDate,
      academicYearId,
      centreId,
      boardId,
      standardId,
      subjectId,
      chapterId,
      topicId,
      req?.user,
    );
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Get('attendance-analytics')
  getAttendanceAnalytics(
    @Query('batchId') batchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('centreId') centreId?: string,
    @Query('boardId') boardId?: string,
    @Query('standardId') standardId?: string,
    @Query('subjectId') subjectId?: string,
    @Req() req?: any,
  ) {
    return this.reportService.getAttendanceAnalytics(
      batchId,
      startDate,
      endDate,
      centreId,
      boardId,
      standardId,
      subjectId,
      req?.user,
    );
  }

  @Roles('TEACHER')
  @Get('teacher-dashboard')
  getTeacherDashboard(@Req() req: any) {
    return this.reportService.getTeacherDashboard(req.user.id);
  }

  @Roles('STUDENT')
  @Get('my-report')
  getMyReport(@Req() req: any) {
    return this.reportService.getMyStudentReport(req.user.id, req.user);
  }
}
