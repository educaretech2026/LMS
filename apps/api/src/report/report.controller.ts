import { Controller, Get, Query, Param, Req, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('report')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('fees')
  getFeeReport(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.reportService.getFeeCollectionReport(startDate, endDate);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('finance')
  getFinanceReport(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.reportService.getExpenseIncomeReport(startDate, endDate);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('enquiries')
  getEnquiryReport(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.reportService.getEnquiryConversionReport(startDate, endDate);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Get('performance')
  getPerformanceReport(@Query('batchId') batchId: string) {
    return this.reportService.getStudentPerformanceReport(batchId);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  @Get('student-performance/:studentId')
  getSingleStudentPerformance(@Param('studentId') studentId: string) {
    return this.reportService.getSingleStudentPerformance(studentId);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('dashboard')
  getDashboardStats() {
    return this.reportService.getDashboardStats();
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  @Get('overview')
  getOverviewAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('batchId') batchId?: string,
    @Query('centreId') centreId?: string,
  ) {
    return this.reportService.getOverviewAnalytics(startDate, endDate, batchId, centreId);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Get('exams-analytics')
  getExamsAnalytics(
    @Query('batchId') batchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportService.getExamsAnalytics(batchId, startDate, endDate);
  }

  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  @Get('attendance-analytics')
  getAttendanceAnalytics(
    @Query('batchId') batchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reportService.getAttendanceAnalytics(batchId, startDate, endDate);
  }

  @Roles('TEACHER')
  @Get('teacher-dashboard')
  getTeacherDashboard(@Req() req: any) {
    return this.reportService.getTeacherDashboard(req.user.id);
  }
}
