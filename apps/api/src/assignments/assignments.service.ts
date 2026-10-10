import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService, private notificationsService: NotificationsService) {}

  async getAll(userId: string, role: string): Promise<any> {
    try {
      if (role === 'STUDENT') {
        // Students see assignments for their batches
        const profile = await this.prisma.studentProfile.findUnique({
          where: { userId },
          include: { enrollments: true },
        });

        if (!profile) return [];

        const batchIds = profile.enrollments.map(e => e.batchId);
        
        return await this.prisma.assignment.findMany({
          where: { batchId: { in: batchIds } },
          include: {
            uploader: { select: { firstName: true, lastName: true } },
            subject: true,
            batch: true,
            submissions: {
              where: { studentId: profile.id }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
      }

      // Teachers/Admins see all assignments they have access to (for simplicity, all for now)
      return await this.prisma.assignment.findMany({
        include: {
          uploader: { select: { firstName: true, lastName: true } },
          subject: true,
          batch: true,
          _count: { select: { submissions: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to fetch assignments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getOne(id: string): Promise<any> {
    return await this.prisma.assignment.findUnique({
      where: { id },
      include: {
        uploader: { select: { firstName: true, lastName: true } },
        subject: true,
        batch: true,
        submissions: {
          include: {
            student: {
              include: { user: { select: { firstName: true, lastName: true } } }
            }
          }
        }
      }
    });
  }

  async create(data: any, uploaderId: string): Promise<any> {
    try {
      const assignment = await this.prisma.assignment.create({
        data: {
          title: data.title,
          description: data.description,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          attachments: data.attachments || null,
          batchId: data.batchId,
          subjectId: data.subjectId,
          uploaderId,
          targetTrackId: data.targetTrackId || null,
        }
      });

      // Notify students in the batch
      try {
        const enrollments = await this.prisma.enrollment.findMany({ 
          where: { batchId: data.batchId },
          include: { student: true }
        });
        for (const enr of enrollments) {
          if (enr.student.userId) {
            await this.notificationsService.sendNotification({
              userId: enr.student.userId,
              title: 'New Assignment',
              message: `A new assignment "${data.title}" was posted in your batch.`,
              type: 'INFO',
              link: `/assignments`,
            });
          }
        }
      } catch (e) {}

      return assignment;
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to create assignment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async submit(assignmentId: string, studentUserId: string, data: any): Promise<any> {
    try {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: studentUserId },
        include: { user: true }
      });

      if (!profile) throw new Error("Student profile not found");

      const submission = await this.prisma.assignmentSubmission.upsert({
        where: {
          assignmentId_studentId: {
            assignmentId,
            studentId: profile.id
          }
        },
        update: {
          attachments: data.attachments,
          notes: data.notes,
          status: 'SUBMITTED',
          updatedAt: new Date()
        },
        create: {
          assignmentId,
          studentId: profile.id,
          attachments: data.attachments,
          notes: data.notes,
        }
      });

      // Notify the teacher who created it
      try {
        const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
        if (assignment && assignment.uploaderId) {
          await this.notificationsService.sendNotification({
            userId: assignment.uploaderId,
            title: 'Assignment Submitted',
            message: `${profile.user.firstName} submitted "${assignment.title}".`,
            type: 'SUCCESS',
            link: `/assignments`,
          });
        }
      } catch (e) {}

      return submission;
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to submit assignment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async gradeSubmission(submissionId: string, data: any): Promise<any> {
    try {
      return await this.prisma.assignmentSubmission.update({
        where: { id: submissionId },
        data: {
          grade: data.grade,
          feedback: data.feedback,
          status: 'GRADED'
        }
      });
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to grade submission', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
