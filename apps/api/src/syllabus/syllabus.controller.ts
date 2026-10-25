import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { SyllabusService } from './syllabus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard)
@Controller('syllabus')
@Permissions('SYLLABUS')
export class SyllabusController {
  constructor(private readonly syllabusService: SyllabusService) {}

  @Get('progress/:batchId')
  getProgress(@Param('batchId') batchId: string) {
    return this.syllabusService.getBatchSyllabusProgress(batchId);
  }

  @Post('progress/chapter')
  updateChapterProgress(@Body() data: { batchId: string; chapterId: string; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' }, @Req() req: any) {
    return this.syllabusService.updateChapterProgress(data.batchId, data.chapterId, data.status, req.user.id);
  }

  @Post('progress/topic')
  updateTopicProgress(@Body() data: { batchId: string; topicId: string; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' }, @Req() req: any) {
    return this.syllabusService.updateTopicProgress(data.batchId, data.topicId, data.status, req.user.id);
  }

  @Get('student-progress/:batchId/:studentId')
  getStudentProgress(@Param('batchId') batchId: string, @Param('studentId') studentId: string) {
    // This will fetch the full syllabus tree and overlay StudentTopicProgress and TopicRevisionTask
    return this.syllabusService.getStudentSyllabusProgress(batchId, studentId);
  }

  @Post('student-progress/event')
  recordStudentEvent(@Body() data: any, @Req() req: any) {
    return this.syllabusService.recordStudentEvent(req.user.id, data);
  }

  @Get('analytics/:batchId')
  getBatchAnalytics(@Param('batchId') batchId: string) {
    return this.syllabusService.getBatchAnalytics(batchId);
  }
}
