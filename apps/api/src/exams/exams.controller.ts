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
  getExamsByTopic(@Param('topicId') topicId: string, @Req() req: any): Promise<any> {
    return this.examsService.getExamsByTopic(topicId, req.user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  createExam(@Body() data: any, @Req() req: any) {
    return this.examsService.createExam(data, req.user);
  }

  @Put(':examId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  updateExam(@Param('examId') examId: string, @Body() data: any, @Req() req: any) {
    return this.examsService.updateExam(examId, data, req.user);
  }

  @Delete(':examId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  deleteExam(@Param('examId') examId: string, @Req() req: any) {
    return this.examsService.deleteExam(examId, req.user);
  }

  @Get(':examId/results')
  getExamResults(@Param('examId') examId: string, @Req() req: any): Promise<any> {
    return this.examsService.getExamResults(examId, req.user);
  }

  @Get(':examId/students')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  getExamStudents(@Param('examId') examId: string, @Req() req: any): Promise<any> {
    return this.examsService.getExamStudents(examId, req.user);
  }

  @Post(':examId/results')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  saveExamResults(@Param('examId') examId: string, @Body() data: { results: any[] }, @Req() req: any) {
    return this.examsService.saveExamResults(examId, data.results, req.user);
  }

  @Post(':examId/submit')
  @Roles('STUDENT')
  submitExamAttempt(@Param('examId') examId: string, @Body() data: { answers: Record<string, string>, score?: any }, @Req() req: any) {
    return this.examsService.submitExamAttempt(examId, req.user.id, data.answers, data.score);
  }

  @Get('mcq')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  getMcqQuestions(@Req() req: any): Promise<any> {
    return this.examsService.getMcqQuestions(req.user);
  }

  @Post('mcq')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  createMcqQuestion(@Body() data: any, @Req() req: any): Promise<any> {
    return this.examsService.createMcqQuestion(data, req.user);
  }

  @Put('mcq/:questionId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  updateMcqQuestion(@Param('questionId') questionId: string, @Body() data: any, @Req() req: any): Promise<any> {
    return this.examsService.updateMcqQuestion(questionId, data, req.user);
  }

  @Delete('mcq/:questionId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  deleteMcqQuestion(@Param('questionId') questionId: string, @Req() req: any): Promise<any> {
    return this.examsService.deleteMcqQuestion(questionId, req.user);
  }

  @Get('upload-url')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  getUploadUrl(
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
    @Req() req: any,
  ) {
    return this.storageService.getPresignedUploadUrl(filename, contentType, req.user?.id, { prefix: 'materials' });
  }

  @Get(':examId/review')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getExamReview(@Param('examId') examId: string, @Req() req: any): Promise<any> {
    return this.examsService.getExamReview(examId, req.user);
  }

  @Post(':examId/release-answers')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  releaseAnswers(
    @Param('examId') examId: string,
    @Body('released') released: boolean,
    @Req() req: any
  ): Promise<any> {
    return this.examsService.releaseExamAnswers(examId, released !== false, req.user);
  }

  @Get(':examId')
  getExamById(@Param('examId') examId: string, @Req() req: any): Promise<any> {
    return this.examsService.getExamById(examId, req.user);
  }
}
