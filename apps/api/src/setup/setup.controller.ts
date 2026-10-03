import { Controller, Get, Post, Body, Query, Delete, Param, UseGuards, Put } from '@nestjs/common';
import { SetupService } from './setup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('setup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('centres')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getCentres() {
    return this.setupService.getCentres();
  }

  @Post('centres')
  createCentre(@Body() data: any) {
    return this.setupService.createCentre(data);
  }

  @Put('centres/:id')
  updateCentre(@Param('id') id: string, @Body() data: any) {
    return this.setupService.updateCentre(id, data);
  }

  @Get('academic-years')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getAcademicYears() {
    return this.setupService.getAcademicYears();
  }

  @Post('academic-years')
  createAcademicYear(@Body() data: any) {
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    return this.setupService.createAcademicYear(data);
  }

  @Get('boards')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getBoards() {
    return this.setupService.getBoards();
  }

  @Post('boards')
  createBoard(@Body() data: any) {
    return this.setupService.createBoard(data);
  }

  @Get('standards')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getStandards(@Query('boardId') boardId?: string) {
    return this.setupService.getStandards(boardId);
  }

  @Post('standards')
  createStandard(@Body() data: any) {
    if (data.level) data.level = Number(data.level);
    return this.setupService.createStandard(data);
  }

  @Get('batches')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getBatches(@Query('boardId') boardId?: string, @Query('standardId') standardId?: string) {
    return this.setupService.getBatches(boardId, standardId);
  }

  @Post('batches')
  createBatch(@Body() data: any) {
    return this.setupService.createBatch(data);
  }

  @Delete('batches/:id')
  deleteBatch(@Param('id') id: string) {
    return this.setupService.deleteBatch(id);
  }

  @Get('tracks')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getTracks() {
    return this.setupService.getTracks();
  }

  @Post('tracks')
  createTrack(@Body() data: { name: string }) {
    return this.setupService.createTrack(data);
  }

  @Delete('tracks/:id')
  deleteTrack(@Param('id') id: string) {
    return this.setupService.deleteTrack(id);
  }

  @Get('subjects')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getSubjects() {
    return this.setupService.getSubjects();
  }

  @Post('subjects')
  createSubject(@Body() data: any) {
    return this.setupService.createSubject(data);
  }

  @Get('syllabi')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getSyllabi(@Query('boardId') boardId?: string, @Query('standardId') standardId?: string) {
    return this.setupService.getSyllabi(boardId, standardId);
  }

  @Post('syllabi')
  createSyllabus(@Body() data: any) {
    return this.setupService.createSyllabus(data);
  }

  @Get('chapters')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getChapters(@Query('syllabusId') syllabusId?: string) {
    return this.setupService.getChapters(syllabusId);
  }

  @Post('chapters')
  createChapter(@Body() data: any) {
    return this.setupService.createChapter(data);
  }

  @Get('topics')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getTopics(@Query('chapterId') chapterId?: string) {
    return this.setupService.getTopics(chapterId);
  }

  @Post('topics')
  createTopic(@Body() data: any) {
    return this.setupService.createTopic(data);
  }

  @Get('subtopics')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getSubtopics(@Query('topicId') topicId?: string) {
    return this.setupService.getSubtopics(topicId);
  }

  @Post('subtopics')
  createSubtopic(@Body() data: any) {
    return this.setupService.createSubtopic(data);
  }

  // DELETE endpoints for hierarchy
  @Delete('boards/:id')
  deleteBoard(@Param('id') id: string) {
    return this.setupService.deleteBoard(id);
  }

  @Delete('standards/:id')
  deleteStandard(@Param('id') id: string) {
    return this.setupService.deleteStandard(id);
  }

  @Delete('centres/:id')
  deleteCentre(@Param('id') id: string) {
    return this.setupService.deleteCentre(id);
  }

  @Delete('subjects/:id')
  deleteSubject(@Param('id') id: string) {
    return this.setupService.deleteSubject(id);
  }

  @Delete('syllabi/:id')
  deleteSyllabus(@Param('id') id: string) {
    return this.setupService.deleteSyllabus(id);
  }

  @Delete('chapters/:id')
  deleteChapter(@Param('id') id: string) {
    return this.setupService.deleteChapter(id);
  }

  @Delete('topics/:id')
  deleteTopic(@Param('id') id: string) {
    return this.setupService.deleteTopic(id);
  }

  @Delete('subtopics/:id')
  deleteSubtopic(@Param('id') id: string) {
    return this.setupService.deleteSubtopic(id);
  }
}
