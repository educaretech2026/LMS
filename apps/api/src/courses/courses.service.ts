import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CourseLevel } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(private prisma: DatabaseService) {}

  // ─── ADMIN ENDPOINTS ────────────────────────────────────────────────────────
  
  async createCourse(data: any, adminId: string) {
    const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
    
    return this.prisma.course.create({
      data: {
        title: data.title,
        description: data.description || '',
        price: data.price || 0,
        level: data.level || 'BEGINNER',
        slug,
        isPublished: false,
        createdByAdminId: adminId,
      }
    });
  }

  async getAllCourses(includeUnpublished = false) {
    return this.prisma.course.findMany({
      where: includeUnpublished ? {} : { isPublished: true },
      include: {
        modules: {
          include: {
            lessons: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateCourse(id: string, data: any) {
    return this.prisma.course.update({
      where: { id },
      data
    });
  }

  async addModule(courseId: string, data: { title: string, order: number }) {
    return this.prisma.courseModule.create({
      data: {
        courseId,
        title: data.title,
        order: data.order
      }
    });
  }

  async addLesson(moduleId: string, data: any) {
    return this.prisma.lesson.create({
      data: {
        moduleId,
        title: data.title,
        type: data.type,
        content: data.content,
        duration: data.duration,
        order: data.order,
        isFree: data.isFree || false
      }
    });
  }

  // ─── PUBLIC ENDPOINTS ────────────────────────────────────────────────────────

  async getPublicCatalog() {
    return this.prisma.course.findMany({
      where: { isPublished: true, archivedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getPublicCourseDetail(slug: string) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    if (!course || !course.isPublished) {
      throw new NotFoundException('Course not found');
    }

    // Hide content for non-free lessons in the public view
    const safeModules = course.modules.map(mod => ({
      ...mod,
      lessons: mod.lessons.map(lesson => ({
        ...lesson,
        content: lesson.isFree ? lesson.content : null
      }))
    }));

    return { ...course, modules: safeModules };
  }
}
