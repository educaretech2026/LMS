import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

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
      return await this.prisma.assignment.create({
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
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to create assignment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async submit(assignmentId: string, studentUserId: string, data: any): Promise<any> {
    try {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: studentUserId }
      });

      if (!profile) throw new Error("Student profile not found");

      return await this.prisma.assignmentSubmission.upsert({
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
