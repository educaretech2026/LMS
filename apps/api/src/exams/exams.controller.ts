import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
export class ExamsController {
  constructor(
    private readonly examsService: ExamsService,
    private readonly storageService: StorageService
  ) { }

  @Get()
  getExams(@Req() req: any): Promise<any> {
    return this.examsService.getExams(req.user);
  }

  @Get('analytics/results')
  getAllResults(@Req() req: any): Promise<any> {
    return this.examsService.getAllResults(req.user);
  }

  @Get('by-topic/:topicId')
  getExamsByTopic(@Param('topicId') topicId: string): Promise<any> {
    return this.examsService.getExamsByTopic(topicId);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  createExam(@Body() data: any) {
    return this.examsService.createExam(data);
  }

  @Put(':examId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  updateExam(@Param('examId') examId: string, @Body() data: any) {
    return this.examsService.updateExam(examId, data);
  }

  @Delete(':examId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  deleteExam(@Param('examId') examId: string) {
    return this.examsService.deleteExam(examId);
  }

  @Get(':examId/results')
  getExamResults(@Param('examId') examId: string): Promise<any> {
    return this.examsService.getExamResults(examId);
  }

  @Get(':examId/students')
  getExamStudents(@Param('examId') examId: string): Promise<any> {
    return this.examsService.getExamStudents(examId);
  }

  @Post(':examId/results')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  saveExamResults(@Param('examId') examId: string, @Body() data: { results: any[] }) {
    return this.examsService.saveExamResults(examId, data.results);
  }

  @Post(':examId/submit')
  @Roles('STUDENT')
  submitExamAttempt(@Param('examId') examId: string, @Body() data: { answers: Record<string, string>, score: any }, @Req() req: any) {
    return this.examsService.submitExamAttempt(examId, req.user.id, data.answers, data.score);
  }

  @Get('mcq')
  getMcqQuestions(): Promise<any> {
    return this.examsService.getMcqQuestions();
  }

  @Post('mcq')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  createMcqQuestion(@Body() data: any): Promise<any> {
    return this.examsService.createMcqQuestion(data);
  }

  @Put('mcq/:questionId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  updateMcqQuestion(@Param('questionId') questionId: string, @Body() data: any): Promise<any> {
    return this.examsService.updateMcqQuestion(questionId, data);
  }

  @Delete('mcq/:questionId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  deleteMcqQuestion(@Param('questionId') questionId: string): Promise<any> {
    return this.examsService.deleteMcqQuestion(questionId);
  }

  @Get('upload-url')
  getUploadUrl(
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
  ) {
    return this.storageService.getPresignedUploadUrl(filename, contentType);
  }

  @Get(':examId')
  getExamById(@Param('examId') examId: string): Promise<any> {
    return this.examsService.getExamById(examId);
  }
}
