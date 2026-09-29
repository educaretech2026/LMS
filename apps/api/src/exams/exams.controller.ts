import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
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
  getExams(): Promise<any> {
    return this.examsService.getExams();
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

  @Get('upload-url')
  getUploadUrl(
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
  ) {
    return this.storageService.getPresignedUploadUrl(filename, contentType);
  }
}
