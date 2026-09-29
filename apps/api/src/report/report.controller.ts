import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
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
}
