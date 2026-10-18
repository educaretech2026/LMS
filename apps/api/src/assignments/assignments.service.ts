import { Injectable, HttpException, HttpStatus, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SyllabusService } from '../syllabus/syllabus.service';
import { SAFE_USER_SELECT, isSuperAdmin, assertCentreAccess, getAuthorizedCentreIds } from '../common/utils/tenant.util';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private syllabusService: SyllabusService,
  ) {}

  async getAll(userId: string, role: any, user?: any): Promise<any> {
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

      if (isStudent) {
        if (!profile) {
          return [];
        }

        // Students ONLY see assignments directly assigned to their enrolled batches
        const batchIds = profile.enrollments.map(e => e.batchId).filter(Boolean);
        const trackIds = profile.enrollments.map(e => e.trackId).filter(Boolean);

        const conditions: any[] = [];
        if (batchIds.length > 0) {
          conditions.push({
            batchId: { in: batchIds },
            ...(trackIds.length > 0
              ? {
                  OR: [
                    { targetTrackId: null },
                    { targetTrackId: { in: trackIds } },
                  ],
                }
              : {}),
          });
        }
        // Also include any assignments where the student already has a submission
        conditions.push({
          submissions: { some: { studentId: profile.id } },
        });

        return await this.prisma.assignment.findMany({
          where: conditions.length > 1 ? { OR: conditions } : (conditions[0] || { id: 'impossible_id' }),
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

      // Scope non-student users
      let where: any = {};
      const isSuper = user ? isSuperAdmin(user) : normalizedRole === 'SUPER_ADMIN';

      if (!isSuper) {
        const authorizedCentres = getAuthorizedCentreIds(user);
        if (normalizedRole === 'TEACHER') {
          const teacherProfile = await this.prisma.teacherProfile.findUnique({
            where: { userId },
            include: { assignments: true },
          });

          const teacherConditions: any[] = [
            { uploaderId: userId, batch: { centreId: { in: authorizedCentres } } }
          ];

          if (teacherProfile?.assignments && teacherProfile.assignments.length > 0) {
            for (const ta of teacherProfile.assignments) {
              if (!ta.subjectId || (!ta.batchId && !ta.standardId)) continue;
              const cond: any = {
                batch: { centreId: { in: authorizedCentres } },
                subjectId: ta.subjectId,
              };
              if (ta.batchId) cond.batchId = ta.batchId;
              if (ta.standardId) {
                cond.batch = { ...cond.batch, standardId: ta.standardId };
              }
              teacherConditions.push(cond);
            }
          }

          where = { OR: teacherConditions };
        } else {
          // Centre Admin / Admin
          where = {
            batch: {
              centreId: { in: authorizedCentres }
            }
          };
        }
      }

      return await this.prisma.assignment.findMany({
        where,
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
      if (error instanceof HttpException) throw error;
      console.error(error);
      throw new HttpException('Failed to fetch assignments', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getOne(id: string, user?: any): Promise<any> {
    const assignment = await this.prisma.assignment.findUnique({
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
              include: { user: { select: SAFE_USER_SELECT } }
            }
          }
        }
      }
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (!user) {
      return assignment;
    }

    const roleStr = typeof user.role === 'object' && user.role !== null
      ? String(user.role.name || '')
      : String(user.role || '');
    const normalizedRole = roleStr.toUpperCase().replace(/\s+/g, '_');

    if (isSuperAdmin(user)) {
      return assignment;
    }

    // Verify centre access
    const effectiveCentreId = assignment.batch?.centreId;
    if (!isSuperAdmin(user)) {
      if (!effectiveCentreId) {
        throw new ForbiddenException('Access denied: Centre assignment cannot be established for this resource.');
      }
      assertCentreAccess(user, effectiveCentreId);
    }

    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: { enrollments: true },
    });

    const isStudent = normalizedRole === 'STUDENT' || normalizedRole === 'PUBLIC_LEARNER' || !!profile;

    if (isStudent) {
      if (!profile) {
        throw new ForbiddenException('Access denied: Student profile not found.');
      }

      if (assignment.batchId) {
        const isEnrolled = profile.enrollments.some(e => e.batchId === assignment.batchId);
        if (!isEnrolled) {
          throw new ForbiddenException('Access denied: You are not enrolled in the batch for this assignment.');
        }
      }

      // Filter submissions to ONLY the student's own submission
      return {
        ...assignment,
        submissions: (assignment.submissions || []).filter(s => s.studentId === profile.id),
      };
    }

    if (normalizedRole === 'TEACHER') {
      const isUploader = assignment.uploaderId === user.id;
      if (!isUploader) {
        const teacherProfile = await this.prisma.teacherProfile.findUnique({
          where: { userId: user.id },
          include: { assignments: true },
        });

        const isAssigned = teacherProfile?.assignments?.some(a => {
          if (!a.subjectId || a.subjectId !== assignment.subjectId) return false;
          if (assignment.batchId) {
            if (a.batchId && a.batchId === assignment.batchId) return true;
            if (a.standardId && assignment.batch?.standardId === a.standardId) return true;
            return false;
          }
          return false;
        });

        if (!isAssigned) {
          throw new ForbiddenException('You are not authorized to view this assignment.');
        }
      }
    }

    return assignment;
  }

  async create(data: any, uploaderId: string, user?: any): Promise<any> {
    try {
      if (user && !isSuperAdmin(user)) {
        if (!data.batchId) {
          throw new BadRequestException('batchId is required to create an assignment');
        }
        const batch = await this.prisma.batch.findUnique({ where: { id: data.batchId } });
        if (!batch || !batch.centreId) {
          throw new ForbiddenException('Cannot create assignment for a batch without an identifiable centre');
        }
        assertCentreAccess(user, batch.centreId);

        const roleStr = typeof user.role === 'object' && user.role !== null ? user.role.name : user.role;
        const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');
        if (normalizedRole === 'TEACHER') {
          const teacherProfile = await this.prisma.teacherProfile.findUnique({
            where: { userId: user.id },
            include: { assignments: true },
          });
          const isAssigned = teacherProfile?.assignments?.some(a => {
            if (!a.subjectId || a.subjectId !== data.subjectId) return false;
            if (a.batchId && a.batchId === data.batchId) return true;
            if (a.standardId && batch.standardId === a.standardId) return true;
            return false;
          });
          if (!isAssigned) {
            throw new ForbiddenException('Teachers can only create assignments for batches and subjects they are assigned to teach.');
          }
        }
      }

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
              type: 'ASSIGNMENT',
              link: `/assignments`,
            });
          }
        }
      } catch (e) {}

      return assignment;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error(error);
      throw new HttpException('Failed to create assignment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async update(id: string, data: any, userId: string, role: string, user?: any): Promise<any> {
    try {
      const existing = await this.prisma.assignment.findUnique({
        where: { id },
        include: { batch: true }
      });
      if (!existing) throw new NotFoundException('Assignment not found');
      
      const normalizedRole = (typeof role === 'string' ? role : (role as any)?.name || '').toUpperCase().replace(/\s+/g, '_');
      const isSuper = user ? isSuperAdmin(user) : normalizedRole === 'SUPER_ADMIN';
      const isPrivileged = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'ADMIN'].includes(normalizedRole);

      if (!isSuper) {
        const effectiveCentreId = existing.batch?.centreId;
        if (!effectiveCentreId) {
          throw new ForbiddenException('Access denied: Centre assignment cannot be established for this resource.');
        }
        if (user) {
          assertCentreAccess(user, effectiveCentreId);
        }
        if (!isPrivileged && existing.uploaderId !== userId) {
          throw new ForbiddenException('Unauthorized to edit this assignment');
        }
        if (data.batchId && data.batchId !== existing.batchId && user) {
          const targetBatch = await this.prisma.batch.findUnique({ where: { id: data.batchId } });
          if (!targetBatch || !targetBatch.centreId) {
            throw new ForbiddenException('Target batch must belong to an identifiable centre.');
          }
          assertCentreAccess(user, targetBatch.centreId);
        }
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
      if (error instanceof HttpException) throw error;
      console.error(error);
      throw new HttpException('Failed to update assignment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async delete(id: string, userId: string, role: string, user?: any): Promise<any> {
    try {
      const existing = await this.prisma.assignment.findUnique({
        where: { id },
        include: { batch: true }
      });
      if (!existing) throw new NotFoundException('Assignment not found');

      const normalizedRole = (typeof role === 'string' ? role : (role as any)?.name || '').toUpperCase().replace(/\s+/g, '_');
      const isSuper = user ? isSuperAdmin(user) : normalizedRole === 'SUPER_ADMIN';
      const isPrivileged = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'ADMIN'].includes(normalizedRole);

      if (!isSuper) {
        const effectiveCentreId = existing.batch?.centreId;
        if (!effectiveCentreId) {
          throw new ForbiddenException('Access denied: Centre assignment cannot be established for this resource.');
        }
        if (user) {
          assertCentreAccess(user, effectiveCentreId);
        }
        if (!isPrivileged && existing.uploaderId !== userId) {
          throw new ForbiddenException('Unauthorized to delete this assignment');
        }
      }

      return await this.prisma.assignment.delete({ where: { id } });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error(error);
      throw new HttpException('Failed to delete assignment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async submit(assignmentId: string, studentUserId: string, data: any, user?: any): Promise<any> {
    try {
      if (user && user.id && user.id !== studentUserId) {
        throw new ForbiddenException('Cannot submit assignment on behalf of another user');
      }

      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: studentUserId },
        include: { user: { select: SAFE_USER_SELECT }, enrollments: true }
      });

      if (!profile) throw new NotFoundException("Student profile not found");

      const assignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: { batch: true }
      });
      if (!assignment) throw new NotFoundException("Assignment not found");

      if (user && !isSuperAdmin(user)) {
        const effectiveCentreId = assignment.batch?.centreId;
        if (!effectiveCentreId) {
          throw new ForbiddenException('Access denied: Centre assignment cannot be established for this resource.');
        }
        assertCentreAccess(user, effectiveCentreId);
      }

      // Verify student is enrolled in the assignment's batch
      if (assignment.batchId) {
        const isEnrolled = profile.enrollments.some(e => e.batchId === assignment.batchId);
        if (!isEnrolled) {
          throw new ForbiddenException('You are not enrolled in the batch for this assignment.');
        }
      }

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
            type: isLate ? 'WARNING' : 'SUBMISSION',
            link: `/assignments`,
          });
        }
      } catch (e) {}

      return submission;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error(error);
      throw new HttpException('Failed to submit assignment', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async gradeSubmission(submissionId: string, data: any, user?: any): Promise<any> {
    try {
      const existing = await this.prisma.assignmentSubmission.findUnique({
        where: { id: submissionId },
        include: {
          assignment: {
            include: {
              batch: { select: { centreId: true, standardId: true } }
            }
          }
        }
      });

      if (!existing) {
        throw new NotFoundException('Assignment submission not found');
      }

      if (user && !isSuperAdmin(user)) {
        const centreId = existing.assignment?.batch?.centreId;
        if (!centreId) {
          throw new ForbiddenException('Access denied: Centre assignment cannot be established for this resource.');
        }
        assertCentreAccess(user, centreId);

        const roleStr = typeof user.role === 'object' && user.role !== null ? user.role.name : user.role;
        const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');
        if (normalizedRole === 'TEACHER') {
          const isUploader = existing.assignment?.uploaderId === user.id;
          if (!isUploader) {
            const teacherProfile = await this.prisma.teacherProfile.findUnique({
              where: { userId: user.id },
              include: { assignments: true },
            });
            const isAssigned = teacherProfile?.assignments?.some(a => {
              if (!a.subjectId || a.subjectId !== existing.assignment?.subjectId) return false;
              if (existing.assignment?.batchId) {
                if (a.batchId && a.batchId === existing.assignment.batchId) return true;
                if (a.standardId && existing.assignment?.batch?.standardId === a.standardId) return true;
                return false;
              }
              return false;
            });
            if (!isAssigned) {
              throw new ForbiddenException('You are not authorized to grade this assignment');
            }
          }
        }
      }

      const gradeNum = Number(data.grade);
      if (data.grade === undefined || !Number.isFinite(gradeNum) || gradeNum < 0) {
        throw new BadRequestException('A valid non-negative numeric grade is required');
      }

      const submission = await this.prisma.assignmentSubmission.update({
        where: { id: submissionId },
        data: {
          grade: gradeNum,
          feedback: data.feedback || null,
          status: 'GRADED'
        },
        include: {
          student: { include: { user: { select: SAFE_USER_SELECT } } },
          assignment: true
        }
      });

      this.logger.log(`Submission ${submissionId} graded by user ${user?.id || 'unknown'}: ${gradeNum} marks`);

      // Notify the student
      try {
        if (submission.student?.userId) {
          await this.notificationsService.sendNotification({
            userId: submission.student.userId,
            title: 'Assignment Graded',
            message: `Your assignment "${submission.assignment?.title}" has been graded: ${data.grade} marks.`,
            type: 'GRADE',
            link: `/assignments`,
          });
        }
      } catch (e) {}

      return submission;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error(error);
      throw new HttpException('Failed to grade submission', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

