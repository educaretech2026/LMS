import { Controller, Get, Post, Body, Query, Delete, Param, UseGuards, Put, Patch, Req } from '@nestjs/common';
import { SetupService } from './setup.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('setup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
@Permissions('SETUP')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('settings')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  async getSettings() {
    return this.setupService.getSettings();
  }

  @Put('settings')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  async updateSettings(@Body() data: any) {
    return this.setupService.updateSettings(data);
  }

  // Star Achievers
  @Get('achievers')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  getAchievers() {
    return this.setupService.getAchievers();
  }

  @Post('achievers')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  createAchiever(@Body() data: { name: string; rankOrScore?: string; examOrCourse?: string; imageUrl?: string; badgeColor?: string; order?: number }) {
    return this.setupService.createAchiever(data);
  }

  @Put('achievers/order')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  reorderAchievers(@Body('orderedIds') orderedIds: string[]) {
    return this.setupService.reorderAchievers(orderedIds);
  }

  @Patch('achievers/:id/toggle')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  toggleAchiever(@Param('id') id: string) {
    return this.setupService.toggleAchieverActive(id);
  }

  @Delete('achievers/:id')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  deleteAchiever(@Param('id') id: string) {
    return this.setupService.deleteAchiever(id);
  }

  @Public()
  @Get('public/achievers')
  getPublicAchievers() {
    return this.setupService.getPublicAchievers();
  }

  @Get('roles')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getRoles() {
    return this.setupService.getRoles();
  }

  @Post('roles')
  @Roles('SUPER_ADMIN')
  createRole(@Body() data: { name: string }) {
    return this.setupService.createRole(data);
  }

  @Delete('roles/:id')
  @Roles('SUPER_ADMIN')
  deleteRole(@Param('id') id: string) {
    return this.setupService.deleteRole(id);
  }

  @Post('roles/:id/permissions')
  @Roles('SUPER_ADMIN')
  toggleRolePermission(@Param('id') id: string, @Body() data: { module: string, active: boolean }) {
    return this.setupService.toggleRolePermission(id, data.module, data.active);
  }

  @Post('roles/:id/permissions/bulk')
  @Roles('SUPER_ADMIN')
  bulkSetRolePermissions(@Param('id') id: string, @Body() data: { modules: string[] }) {
    return this.setupService.bulkSetRolePermissions(id, data.modules || []);
  }

  @Get('centres')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getCentres() {
    return this.setupService.getCentres();
  }

  @Post('centres')
  @Roles('SUPER_ADMIN')
  createCentre(@Body() data: any) {
    return this.setupService.createCentre(data);
  }

  @Put('centres/:id')
  @Roles('SUPER_ADMIN')
  updateCentre(@Param('id') id: string, @Body() data: any) {
    return this.setupService.updateCentre(id, data);
  }

  @Get('academic-years')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getAcademicYears() {
    return this.setupService.getAcademicYears();
  }

  @Post('academic-years')
  @Roles('SUPER_ADMIN')
  createAcademicYear(@Body() data: any) {
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.endDate) data.endDate = new Date(data.endDate);
    return this.setupService.createAcademicYear(data);
  }

  @Get('boards')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getBoards() {
    return this.setupService.getBoards();
  }

  @Post('boards')
  @Roles('SUPER_ADMIN')
  createBoard(@Body() data: any) {
    return this.setupService.createBoard(data);
  }

  @Get('standards')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getStandards(@Query('boardId') boardId?: string) {
    return this.setupService.getStandards(boardId);
  }

  @Post('standards')
  @Roles('SUPER_ADMIN')
  createStandard(@Body() data: any) {
    if (data.level) data.level = Number(data.level);
    return this.setupService.createStandard(data);
  }

  @Get('batches')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getBatches(
    @Query('boardId') boardId?: string,
    @Query('standardId') standardId?: string,
    @Query('centreId') centreId?: string,
    @Req() req?: any,
  ) {
    return this.setupService.getBatches(boardId, standardId, req?.user, centreId);
  }

  @Post('batches')
  createBatch(@Body() data: any, @Req() req?: any) {
    return this.setupService.createBatch(data, req?.user);
  }

  @Delete('batches/:id')
  deleteBatch(@Param('id') id: string, @Req() req?: any) {
    return this.setupService.deleteBatch(id, req?.user);
  }

  @Get('tracks')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getTracks() {
    return this.setupService.getTracks();
  }

  @Post('tracks')
  @Roles('SUPER_ADMIN')
  createTrack(@Body() data: { name: string }) {
    return this.setupService.createTrack(data);
  }

  @Delete('tracks/:id')
  @Roles('SUPER_ADMIN')
  deleteTrack(@Param('id') id: string) {
    return this.setupService.deleteTrack(id);
  }

  @Get('subjects')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getSubjects() {
    return this.setupService.getSubjects();
  }

  @Post('subjects')
  @Roles('SUPER_ADMIN')
  createSubject(@Body() data: any) {
    return this.setupService.createSubject(data);
  }

  @Get('syllabi')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getSyllabi(@Query('boardId') boardId?: string, @Query('standardId') standardId?: string) {
    return this.setupService.getSyllabi(boardId, standardId);
  }

  @Post('syllabi')
  @Roles('SUPER_ADMIN')
  createSyllabus(@Body() data: any) {
    return this.setupService.createSyllabus(data);
  }

  @Get('chapters')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getChapters(@Query('syllabusId') syllabusId?: string) {
    return this.setupService.getChapters(syllabusId);
  }

  @Post('chapters')
  @Roles('SUPER_ADMIN')
  createChapter(@Body() data: any) {
    return this.setupService.createChapter(data);
  }

  @Get('topics')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getTopics(@Query('chapterId') chapterId?: string) {
    return this.setupService.getTopics(chapterId);
  }

  @Post('topics')
  @Roles('SUPER_ADMIN')
  createTopic(@Body() data: any) {
    return this.setupService.createTopic(data);
  }

  @Get('subtopics')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getSubtopics(@Query('topicId') topicId?: string) {
    return this.setupService.getSubtopics(topicId);
  }

  @Post('subtopics')
  @Roles('SUPER_ADMIN')
  createSubtopic(@Body() data: any) {
    return this.setupService.createSubtopic(data);
  }

  // DELETE endpoints for hierarchy
  @Delete('boards/:id')
  @Roles('SUPER_ADMIN')
  deleteBoard(@Param('id') id: string) {
    return this.setupService.deleteBoard(id);
  }

  @Delete('standards/:id')
  @Roles('SUPER_ADMIN')
  deleteStandard(@Param('id') id: string) {
    return this.setupService.deleteStandard(id);
  }

  @Delete('centres/:id')
  @Roles('SUPER_ADMIN')
  deleteCentre(@Param('id') id: string) {
    return this.setupService.deleteCentre(id);
  }

  @Delete('subjects/:id')
  @Roles('SUPER_ADMIN')
  deleteSubject(@Param('id') id: string) {
    return this.setupService.deleteSubject(id);
  }

  @Delete('syllabi/:id')
  @Roles('SUPER_ADMIN')
  deleteSyllabus(@Param('id') id: string) {
    return this.setupService.deleteSyllabus(id);
  }

  @Delete('chapters/:id')
  @Roles('SUPER_ADMIN')
  deleteChapter(@Param('id') id: string) {
    return this.setupService.deleteChapter(id);
  }

  @Delete('topics/:id')
  @Roles('SUPER_ADMIN')
  deleteTopic(@Param('id') id: string) {
    return this.setupService.deleteTopic(id);
  }

  @Delete('subtopics/:id')
  @Roles('SUPER_ADMIN')
  deleteSubtopic(@Param('id') id: string) {
    return this.setupService.deleteSubtopic(id);
  }
}
