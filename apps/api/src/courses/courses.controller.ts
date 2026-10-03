import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // ─── ADMIN ENDPOINTS ────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('admin/lms/courses')
  async createCourse(@Body() body: any, @Req() req: any): Promise<any> {
    return this.coursesService.createCourse(body, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/lms/courses')
  async getAdminCourses(): Promise<any> {
    return this.coursesService.getAllCourses(true); // includes unpublished
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/lms/courses/:id')
  async updateCourse(@Param('id') id: string, @Body() body: any): Promise<any> {
    return this.coursesService.updateCourse(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/lms/courses/:id/modules')
  async addModule(@Param('id') id: string, @Body() body: any): Promise<any> {
    return this.coursesService.addModule(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/lms/courses/:id/modules/:moduleId/lessons')
  async addLesson(@Param('moduleId') moduleId: string, @Body() body: any): Promise<any> {
    return this.coursesService.addLesson(moduleId, body);
  }

  // ─── PUBLIC ENDPOINTS ────────────────────────────────────────────────────────

  @Get('public/courses')
  async getPublicCatalog(): Promise<any> {
    return this.coursesService.getPublicCatalog();
  }

  @Get('public/courses/:slug')
  async getPublicCourseDetail(@Param('slug') slug: string): Promise<any> {
    return this.coursesService.getPublicCourseDetail(slug);
  }
}
