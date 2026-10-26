import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { SyllabusService } from './syllabus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('syllabus')
@Permissions('SYLLABUS')
export class SyllabusController {
  constructor(private readonly syllabusService: SyllabusService) {}

  @Get('progress/:batchId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getProgress(@Param('batchId') batchId: string, @Req() req: any) {
    return this.syllabusService.getBatchSyllabusProgress(batchId, req.user);
  }

  @Post('progress/chapter')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  updateChapterProgress(@Body() data: { batchId: string; chapterId: string; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' }, @Req() req: any) {
    return this.syllabusService.updateChapterProgress(data.batchId, data.chapterId, data.status, req.user.id, req.user);
  }

  @Post('progress/topic')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  updateTopicProgress(@Body() data: { batchId: string; topicId: string; status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' }, @Req() req: any) {
    return this.syllabusService.updateTopicProgress(data.batchId, data.topicId, data.status, req.user.id, req.user);
  }

  @Get('student-progress/:batchId/:studentId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getStudentProgress(@Param('batchId') batchId: string, @Param('studentId') studentId: string, @Req() req: any) {
    return this.syllabusService.getStudentSyllabusProgress(batchId, studentId, req.user);
  }

  @Post('student-progress/event')
  @Roles('STUDENT', 'PUBLIC_LEARNER')
  recordStudentEvent(@Body() data: any, @Req() req: any) {
    return this.syllabusService.recordStudentEvent(req.user.id, data, req.user);
  }

  @Get('analytics/:batchId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  getBatchAnalytics(@Param('batchId') batchId: string, @Req() req: any) {
    return this.syllabusService.getBatchAnalytics(batchId, req.user);
  }
}
