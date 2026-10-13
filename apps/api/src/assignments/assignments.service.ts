import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SyllabusService } from '../syllabus/syllabus.service';

@Injectable()
export class AssignmentsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private syllabusService: SyllabusService,
  ) {}

  async getAll(userId: string, role: any): Promise<any> {
    try {
      const roleStr = typeof role === 'object' && role !== null
        ? String(role.name || '')
        : String(role || '');
      const normalizedRole = roleStr.toUpperCase().replace(/\s+/g, '_');

      // Check if student profile exists for this user
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId },
        include: { enrollments: true },
      });

      const isStudent = normalizedRole === 'STUDENT' || normalizedRole === 'PUBLIC_LEARNER' || !!profile;

      if (isStudent && profile) {
        // Students see assignments for their batches, or unbatched, or assignments they've already submitted to
        const batchIds = profile.enrollments.map(e => e.batchId).filter(Boolean);
        
        return await this.prisma.assignment.findMany({
          where: {
            OR: [
              ...(batchIds.length > 0 ? [{ batchId: { in: batchIds } }] : []),
              { batchId: null },
              { submissions: { some: { studentId: profile.id } } }
            ]
          },
          include: {
            uploader: { select: { firstName: true, lastName: true } },
            subject: true,
            chapter: true,
            topic: true,
            targetTrack: true,
            batch: {
              include: {
                board: true,
                standard: true,
                centre: true,
                track: true,
              }
            },
            submissions: {
              where: { studentId: profile.id }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
      }

      // Teachers/Admins see all assignments they have access to
      return await this.prisma.assignment.findMany({
        include: {
          uploader: { select: { firstName: true, lastName: true } },
          subject: true,
          chapter: true,
          topic: true,
          targetTrack: true,
          batch: {
            include: {
              board: true,
              standard: true,
              centre: true,
              track: true,
            }
          },
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
        chapter: true,
        topic: true,
        targetTrack: true,
        batch: {
          include: {
            board: true,
            standard: true,
            centre: true,
            track: true,
          }
        },
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
          chapterId: data.chapterId || null,
          topicId: data.topicId || null,
          uploaderId,
          targetTrackId: data.targetTrackId || null,
        },
        include: {
          uploader: { select: { firstName: true, lastName: true } },
          subject: true,
          chapter: true,
          topic: true,
          targetTrack: true,
          batch: {
            include: {
              board: true,
              standard: true,
              centre: true,
              track: true,
            }
          },
        }
      });

      // Notify students in the batch
      try {
        const enrollments = await this.prisma.enrollment.findMany({ 
          where: { batchId: data.batchId },
          include: { studentProfile: true }
        });
        for (const enr of enrollments) {
          if (enr.studentProfile.userId) {
            await this.notificationsService.sendNotification({
              userId: enr.studentProfile.userId,
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

  async update(id: string, data: any, userId: string, role: string): Promise<any> {
    try {
      const existing = await this.prisma.assignment.findUnique({ where: { id } });
      if (!existing) throw new HttpException('Assignment not found', HttpStatus.NOT_FOUND);
      
      const isPrivileged = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'ADMIN'].includes(role);
      if (!isPrivileged && existing.uploaderId !== userId) {
        throw new HttpException('Unauthorized to edit this assignment', HttpStatus.FORBIDDEN);
      }

      return await this.prisma.assignment.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          attachments: data.attachments !== undefined ? data.attachments : existing.attachments,
          batchId: data.batchId,
          subjectId: data.subjectId,
          chapterId: data.chapterId || null,
          topicId: data.topicId || null,
          targetTrackId: data.targetTrackId || null,
        },
        include: {
          uploader: { select: { firstName: true, lastName: true } },
          subject: true,
          chapter: true,
          topic: true,
          targetTrack: true,
          batch: {
            include: {
              board: true,
              standard: true,
              centre: true,
              track: true,
            }
          },
        }
      });
    } catch (error) {
      console.error(error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to update assignment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async delete(id: string, userId: string, role: string): Promise<any> {
    try {
      const existing = await this.prisma.assignment.findUnique({ where: { id } });
      if (!existing) throw new HttpException('Assignment not found', HttpStatus.NOT_FOUND);

      const isPrivileged = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'ADMIN'].includes(role);
      if (!isPrivileged && existing.uploaderId !== userId) {
        throw new HttpException('Unauthorized to delete this assignment', HttpStatus.FORBIDDEN);
      }

      return await this.prisma.assignment.delete({ where: { id } });
    } catch (error) {
      console.error(error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to delete assignment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async submit(assignmentId: string, studentUserId: string, data: any): Promise<any> {
    try {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: studentUserId },
        include: { user: true }
      });

      if (!profile) throw new Error("Student profile not found");

      const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
      if (!assignment) throw new Error("Assignment not found");

      const isLate = assignment.dueDate ? new Date() > new Date(assignment.dueDate) : false;
      const submissionStatus = isLate ? 'LATE' : 'SUBMITTED';

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
          status: submissionStatus,
          updatedAt: new Date()
        },
        create: {
          assignmentId,
          studentId: profile.id,
          attachments: data.attachments,
          notes: data.notes,
          status: submissionStatus,
        }
      });

      // Synchronize with syllabus progress if assigned to a topic
      if (assignment.topicId && assignment.batchId) {
        try {
          await this.syllabusService.recordStudentEvent(studentUserId, {
            batchId: assignment.batchId,
            topicId: assignment.topicId,
          });
        } catch (err) {
          console.error("Failed to automatically update syllabus progress on assignment submit", err);
        }
      }

      // Notify the teacher who created it
      try {
        if (assignment.uploaderId) {
          await this.notificationsService.sendNotification({
            userId: assignment.uploaderId,
            title: isLate ? 'Late Assignment Submitted' : 'Assignment Submitted',
            message: `${profile.user.firstName} submitted "${assignment.title}"${isLate ? ' (Late)' : ''}.`,
            type: isLate ? 'WARNING' : 'SUCCESS',
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
      const submission = await this.prisma.assignmentSubmission.update({
        where: { id: submissionId },
        data: {
          grade: Number(data.grade),
          feedback: data.feedback,
          status: 'GRADED'
        },
        include: {
          student: { include: { user: true } },
          assignment: true
        }
      });

      // Notify the student
      try {
        if (submission.student?.userId) {
          await this.notificationsService.sendNotification({
            userId: submission.student.userId,
            title: 'Assignment Graded',
            message: `Your assignment "${submission.assignment?.title}" has been graded: ${data.grade} marks.`,
            type: 'SUCCESS',
            link: `/assignments`,
          });
        }
      } catch (e) {}

      return submission;
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to grade submission', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
