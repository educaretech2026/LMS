import { Injectable, HttpException, HttpStatus, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDoubtDto } from './dto/create-doubt.dto';
import { CreateDoubtMessageDto } from './dto/create-message.dto';

@Injectable()
export class DoubtsService {
  private readonly logger = new Logger(DoubtsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private normalizeRole(role: any): string {
    const roleStr = typeof role === 'object' && role !== null
      ? String(role.name || '')
      : String(role || '');
    return roleStr.toUpperCase().replace(/\s+/g, '_');
  }

  async getAll(userId: string, role: any, query: any = {}): Promise<any> {
    try {
      const normalizedRole = this.normalizeRole(role);
      const isStudent = normalizedRole === 'STUDENT' || normalizedRole === 'PUBLIC_LEARNER';
      const isTeacher = normalizedRole === 'TEACHER';
      const isAdmin = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'ADMIN'].includes(normalizedRole);

      const where: any = {};

      if (isStudent) {
        where.studentId = userId;
      } else if (isTeacher) {
        where.teacherId = userId;
      } else if (isAdmin) {
        // Admins can filter by specific teacher or student if provided
        if (query.teacherId && query.teacherId !== 'ALL') {
          where.teacherId = query.teacherId;
        }
        if (query.studentId && query.studentId !== 'ALL') {
          where.studentId = query.studentId;
        }
      }

      if (query.status && query.status !== 'ALL') {
        where.status = query.status;
      }

      if (query.priority && query.priority !== 'ALL') {
        where.priority = query.priority;
      }

      if (query.subjectId && query.subjectId !== 'ALL') {
        where.subjectId = query.subjectId;
      }

      if (query.search && query.search.trim()) {
        const term = query.search.trim();
        where.OR = [
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { student: { firstName: { contains: term, mode: 'insensitive' } } },
          { student: { lastName: { contains: term, mode: 'insensitive' } } },
          { teacher: { firstName: { contains: term, mode: 'insensitive' } } },
          { teacher: { lastName: { contains: term, mode: 'insensitive' } } },
        ];
      }

      const doubts = await this.prisma.doubt.findMany({
        where,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, avatar: true, email: true },
          },
          teacher: {
            select: { id: true, firstName: true, lastName: true, avatar: true, email: true },
          },
          subject: { select: { id: true, name: true } },
          chapter: { select: { id: true, name: true } },
          topic: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, createdAt: true, senderRole: true, senderId: true },
          },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return doubts;
    } catch (error) {
      this.logger.error('Failed to fetch doubts', error);
      throw new HttpException('Failed to fetch doubt threads', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getById(id: string, userId: string, role: any): Promise<any> {
    try {
      const normalizedRole = this.normalizeRole(role);
      const isStudent = normalizedRole === 'STUDENT' || normalizedRole === 'PUBLIC_LEARNER';
      const isTeacher = normalizedRole === 'TEACHER';
      const isAdmin = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'ADMIN'].includes(normalizedRole);

      const doubt = await this.prisma.doubt.findUnique({
        where: { id },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, avatar: true, email: true },
          },
          teacher: {
            select: { id: true, firstName: true, lastName: true, avatar: true, email: true },
          },
          subject: { select: { id: true, name: true } },
          chapter: { select: { id: true, name: true } },
          topic: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              sender: {
                select: { id: true, firstName: true, lastName: true, avatar: true, role: { select: { name: true } } },
              },
            },
          },
        },
      });

      if (!doubt) {
        throw new HttpException('Doubt thread not found', HttpStatus.NOT_FOUND);
      }

      // Strict access enforcement
      if (isStudent && doubt.studentId !== userId) {
        throw new ForbiddenException('You do not have permission to view this doubt thread');
      }

      if (isTeacher && doubt.teacherId !== userId && !isAdmin) {
        throw new ForbiddenException('You are not assigned to this doubt thread');
      }

      return doubt;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to fetch doubt ${id}`, error);
      throw new HttpException('Failed to fetch doubt thread', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async create(userId: string, role: any, dto: CreateDoubtDto): Promise<any> {
    try {
      const targetTeacherId = dto.teacherId || dto.assignedTeacherId;
      if (!targetTeacherId) {
        throw new HttpException('Please select a teacher to ask your doubt.', HttpStatus.BAD_REQUEST);
      }

      // 1. Strict Recipient Verification: Recipient MUST be a Teacher
      const recipient = await this.prisma.user.findUnique({
        where: { id: targetTeacherId },
        include: { role: true, teacherProfile: true },
      });

      if (!recipient) {
        throw new HttpException('Selected teacher not found', HttpStatus.BAD_REQUEST);
      }

      const recipientRole = String(recipient.role?.name || '').toUpperCase();
      if (recipientRole !== 'TEACHER' && !recipient.teacherProfile) {
        throw new HttpException(
          'Students can only ask doubts to verified teachers. Student-to-student messaging is not permitted.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2. Fetch student details for notification
      const student = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });

      const attachmentsData = dto.attachments || dto.attachmentUrls || null;

      // 3. Create Doubt Thread and initial message
      const doubt = await this.prisma.doubt.create({
        data: {
          title: dto.title,
          description: dto.description || null,
          priority: (dto.priority as any) || 'MEDIUM',
          studentId: userId,
          teacherId: targetTeacherId,
          subjectId: dto.subjectId || null,
          chapterId: dto.chapterId || null,
          topicId: dto.topicId || null,
          centreId: dto.centreId || null,
          status: 'OPEN',
          messages: {
            create: {
              senderId: userId,
              senderRole: 'STUDENT',
              content: dto.description || dto.title,
              attachments: attachmentsData,
            },
          },
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          teacher: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          subject: true,
          messages: true,
        },
      });

      // 4. Send in-app notification to teacher
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'A student';
      this.notificationsService.sendNotification({
        userId: targetTeacherId,
        title: 'New Student Doubt',
        message: `${studentName} asked: "${dto.title}"`,
        type: 'DOUBT',
        link: `/doubts?id=${doubt.id}`,
      }).catch(err => this.logger.warn('Failed to notify teacher', err));

      return doubt;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to create doubt thread', error);
      throw new HttpException('Failed to create doubt thread', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async postMessage(doubtId: string, userId: string, role: any, dto: CreateDoubtMessageDto): Promise<any> {
    try {
      const normalizedRole = this.normalizeRole(role);
      const isStudent = normalizedRole === 'STUDENT' || normalizedRole === 'PUBLIC_LEARNER';
      const isTeacher = normalizedRole === 'TEACHER';
      const isAdmin = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'ADMIN'].includes(normalizedRole);

      const doubt = await this.prisma.doubt.findUnique({
        where: { id: doubtId },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!doubt) {
        throw new HttpException('Doubt thread not found', HttpStatus.NOT_FOUND);
      }

      // Check access
      if (isStudent && doubt.studentId !== userId) {
        throw new ForbiddenException('You cannot message in another student\'s doubt thread');
      }

      if (isTeacher && doubt.teacherId !== userId && !isAdmin) {
        throw new ForbiddenException('You are not assigned to this doubt thread');
      }

      let senderRole = 'STUDENT';
      if (isAdmin) {
        senderRole = 'ADMIN';
      } else if (isTeacher) {
        senderRole = 'TEACHER';
      }

      const messageContent = dto.content || dto.message;
      if (!messageContent || !messageContent.trim()) {
        throw new HttpException('Message content cannot be empty', HttpStatus.BAD_REQUEST);
      }
      const attachmentsData = dto.attachments || dto.attachmentUrls || null;

      // Create message
      const message = await this.prisma.doubtMessage.create({
        data: {
          doubtId,
          senderId: userId,
          senderRole,
          content: messageContent.trim(),
          attachments: attachmentsData,
          isInternalAdminNote: Boolean(dto.isInternalAdminNote && isAdmin),
        },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, avatar: true, role: { select: { name: true } } },
          },
        },
      });

      // Update thread status based on who replied
      const updateData: any = { updatedAt: new Date() };
      if (isTeacher && (doubt.status === 'OPEN' || doubt.status === 'IN_PROGRESS')) {
        updateData.status = 'ANSWERED';
      } else if (isStudent && doubt.status === 'ANSWERED') {
        updateData.status = 'IN_PROGRESS';
      }

      await this.prisma.doubt.update({
        where: { id: doubtId },
        data: updateData,
      });

      // Notify counterparty
      const senderUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const senderName = senderUser ? `${senderUser.firstName} ${senderUser.lastName}` : 'User';

      if (senderRole === 'TEACHER') {
        this.notificationsService.sendNotification({
          userId: doubt.studentId,
          title: 'Teacher Replied to Your Doubt',
          message: `${senderName}: "${messageContent.slice(0, 80)}"`,
          type: 'DOUBT',
          link: `/doubts?id=${doubt.id}`,
        }).catch(err => this.logger.warn('Failed to notify student', err));
      } else if (senderRole === 'STUDENT') {
        this.notificationsService.sendNotification({
          userId: doubt.teacherId,
          title: 'Student Follow-up on Doubt',
          message: `${senderName}: "${messageContent.slice(0, 80)}"`,
          type: 'DOUBT',
          link: `/doubts?id=${doubt.id}`,
        }).catch(err => this.logger.warn('Failed to notify teacher', err));
      } else if (senderRole === 'ADMIN') {
        // Admin supervisor note/reply
        this.notificationsService.sendNotification({
          userId: doubt.studentId,
          title: 'Academic Supervisor Message',
          message: `Supervisor: "${messageContent.slice(0, 80)}"`,
          type: 'SUPERVISOR',
          link: `/doubts?id=${doubt.id}`,
        }).catch(err => this.logger.warn('Failed to notify student', err));
      }

      return message;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to post message to doubt ${doubtId}`, error);
      throw new HttpException('Failed to post message', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateStatus(doubtId: string, userId: string, role: any, status: any): Promise<any> {
    try {
      const normalizedRole = this.normalizeRole(role);
      const isStudent = normalizedRole === 'STUDENT' || normalizedRole === 'PUBLIC_LEARNER';
      const isTeacher = normalizedRole === 'TEACHER';
      const isAdmin = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'ADMIN'].includes(normalizedRole);

      const doubt = await this.prisma.doubt.findUnique({ where: { id: doubtId } });
      if (!doubt) {
        throw new HttpException('Doubt thread not found', HttpStatus.NOT_FOUND);
      }

      if (isStudent && doubt.studentId !== userId) {
        throw new ForbiddenException('Not permitted');
      }
      if (isTeacher && doubt.teacherId !== userId && !isAdmin) {
        throw new ForbiddenException('Not permitted');
      }

      let mappedStatus = String(status || '').toUpperCase();
      if (mappedStatus === 'PENDING') mappedStatus = 'OPEN';

      const updateData: any = {
        status: mappedStatus,
        updatedAt: new Date(),
      };

      if (status === 'RESOLVED' || status === 'CLOSED') {
        updateData.resolvedAt = new Date();
      }

      return await this.prisma.doubt.update({
        where: { id: doubtId },
        data: updateData,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to update status', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async reassign(doubtId: string, userId: string, role: any, newTeacherId: string): Promise<any> {
    try {
      const normalizedRole = this.normalizeRole(role);
      const isAdmin = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'ADMIN'].includes(normalizedRole);
      const isTeacher = normalizedRole === 'TEACHER';

      const existingDoubt = await this.prisma.doubt.findUnique({
        where: { id: doubtId },
        include: { teacher: true },
      });

      if (!existingDoubt) {
        throw new HttpException('Doubt session not found', HttpStatus.NOT_FOUND);
      }

      const isAssignedTeacher = isTeacher && existingDoubt.teacherId === userId;
      if (!isAdmin && !isAssignedTeacher) {
        throw new ForbiddenException('Only administrators or the assigned faculty can reassign this doubt');
      }

      const newTeacher = await this.prisma.user.findUnique({
        where: { id: newTeacherId },
        include: { role: true, teacherProfile: true },
      });

      if (!newTeacher) {
        throw new HttpException('Selected teacher not found', HttpStatus.BAD_REQUEST);
      }

      const actor = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      const actorName = actor ? `${actor.firstName} ${actor.lastName}` : (isAdmin ? 'Academic Supervisor' : 'Assigned Faculty');

      const doubt = await this.prisma.doubt.update({
        where: { id: doubtId },
        data: {
          teacherId: newTeacherId,
          updatedAt: new Date(),
        },
        include: {
          student: true,
          teacher: true,
        },
      });

      // Post moderation/audit message in doubt thread
      await this.prisma.doubtMessage.create({
        data: {
          doubtId,
          senderId: userId,
          senderRole: isAdmin ? 'ADMIN' : 'TEACHER',
          content: `Reassigned to Prof. ${newTeacher.firstName} ${newTeacher.lastName} by ${actorName}.`,
          isInternalAdminNote: false,
        },
      });

      // Notify new teacher
      this.notificationsService.sendNotification({
        userId: newTeacherId,
        title: 'Doubt Reassigned to You',
        message: `${actorName} reassigned doubt "${doubt.title}" to you.`,
        type: 'DOUBT',
        link: `/doubts?id=${doubt.id}`,
      }).catch(err => this.logger.warn('Failed to notify new teacher', err));

      return doubt;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException('Failed to reassign doubt', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAvailableTeachers(userId: string, role: any): Promise<any> {
    try {
      // Find all active teachers in the system with their subjects
      const teachers = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { role: { name: 'TEACHER' } },
            { teacherProfile: { isNot: null } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          email: true,
          teacherProfile: {
            select: {
              qualification: true,
              experience: true,
              assignments: {
                include: {
                  subject: { select: { id: true, name: true } },
                  batch: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { firstName: 'asc' },
      });

      return teachers;
    } catch (error) {
      this.logger.error('Failed to fetch available teachers', error);
      throw new HttpException('Failed to fetch available teachers', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
