import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { isSuperAdmin, getAuthorizedCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

@Injectable()
export class LiveClassService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(user?: any) {
    const isStudent = user?.role === 'STUDENT' || user?.role?.name === 'STUDENT';
    
    if (isStudent && user?.id) {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: {
          enrollments: {
            include: { batch: true }
          }
        }
      });

      if (!profile || !profile.enrollments || profile.enrollments.length === 0) {
        return [];
      }

      const centreIds = profile.enrollments.map(e => e.batch?.centreId).filter(Boolean) as string[];
      const standardIds = profile.enrollments.map(e => e.batch?.standardId).filter(Boolean) as string[];
      const boardIds = profile.enrollments.map(e => e.batch?.boardId).filter(Boolean) as string[];

      const orConditions: any[] = [];
      if (centreIds.length > 0) orConditions.push({ centreId: { in: centreIds } });
      if (standardIds.length > 0) orConditions.push({ standardId: { in: standardIds } });
      if (boardIds.length > 0) orConditions.push({ boardId: { in: boardIds } });
      orConditions.push({ centreId: null, standardId: null, boardId: null });

      const classes = await this.prisma.liveClass.findMany({
        where: { OR: orConditions },
        include: {
          board: { select: { id: true, name: true } },
          standard: { select: { id: true, name: true } },
          centre: { select: { id: true, name: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      });

      // SEC: Protect meeting links for students - only reveal if class is currently LIVE or starting within 15 minutes
      const now = Date.now();
      return classes.map(c => {
        const classTime = new Date(c.scheduledAt).getTime();
        const isLiveNow = c.status === 'LIVE';
        const isStartingSoon = (classTime - now) <= 15 * 60 * 1000 && (classTime - now) >= -c.duration * 60 * 1000;
        const canAccessLink = isLiveNow || isStartingSoon;

        if (!canAccessLink) {
          return { ...c, roomId: null };
        }
        return c;
      });
    }

    const where: any = {};
    if (user && !isSuperAdmin(user)) {
      const allowedCentres = getAuthorizedCentreIds(user);
      where.OR = [
        { centreId: { in: allowedCentres } },
        { centreId: null }
      ];
    }

    return this.prisma.liveClass.findMany({
      where,
      include: {
        board: { select: { id: true, name: true } },
        standard: { select: { id: true, name: true } },
        centre: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getById(id: string, user?: any) {
    const cls = await this.prisma.liveClass.findUnique({
      where: { id },
      include: {
        board: { select: { id: true, name: true } },
        standard: { select: { id: true, name: true } },
        centre: { select: { id: true, name: true } },
      },
    });

    if (!cls) throw new NotFoundException('Live class not found');

    const isStudent = user?.role === 'STUDENT' || user?.role?.name === 'STUDENT';
    if (isStudent && user?.id) {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { enrollments: { include: { batch: true } } }
      });

      const centreIds = profile?.enrollments?.map(e => e.batch?.centreId).filter(Boolean) || [];
      const standardIds = profile?.enrollments?.map(e => e.batch?.standardId).filter(Boolean) || [];
      const boardIds = profile?.enrollments?.map(e => e.batch?.boardId).filter(Boolean) || [];

      const matchesCentre = !cls.centreId || centreIds.includes(cls.centreId);
      const matchesStandard = !cls.standardId || standardIds.includes(cls.standardId);
      const matchesBoard = !cls.boardId || boardIds.includes(cls.boardId);

      if (!matchesCentre && !matchesStandard && !matchesBoard) {
        throw new ForbiddenException('Access denied: You are not eligible for this live class.');
      }

      const now = Date.now();
      const classTime = new Date(cls.scheduledAt).getTime();
      const isLiveNow = cls.status === 'LIVE';
      const isStartingSoon = (classTime - now) <= 15 * 60 * 1000 && (classTime - now) >= -cls.duration * 60 * 1000;

      if (!isLiveNow && !isStartingSoon) {
        return { ...cls, roomId: null };
      }
      return cls;
    }

    if (user && !isSuperAdmin(user) && cls.centreId) {
      assertCentreAccess(user, cls.centreId);
    }

    return cls;
  }

  async create(data: {
    title: string;
    subject: string;
    teacherName: string;
    scheduledAt: string;
    duration: number;
    boardId?: string;
    standardId?: string;
    centreId?: string;
    zoomLink?: string;
  }, user?: any) {
    if (!data.title || !data.subject || !data.teacherName || !data.scheduledAt) {
      throw new BadRequestException('Required fields missing for live class.');
    }

    const scheduledDate = new Date(data.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException('Invalid scheduledAt date format.');
    }

    if (!data.duration || Number(data.duration) <= 0) {
      throw new BadRequestException('Duration must be a positive number.');
    }

    let centreId = data.centreId;
    if (user && !isSuperAdmin(user)) {
      if (centreId) {
        assertCentreAccess(user, centreId);
      } else {
        const allowed = getAuthorizedCentreIds(user);
        centreId = allowed[0];
      }
    }

    return this.prisma.liveClass.create({
      data: {
        title: data.title,
        subject: data.subject,
        teacherName: data.teacherName,
        scheduledAt: scheduledDate,
        duration: Number(data.duration),
        roomId: data.zoomLink || undefined,
        boardId: data.boardId || null,
        standardId: data.standardId || null,
        centreId: centreId || null,
      },
      include: {
        board: { select: { id: true, name: true } },
        standard: { select: { id: true, name: true } },
        centre: { select: { id: true, name: true } },
      },
    });
  }

  async updateStatus(id: string, status: 'SCHEDULED' | 'LIVE' | 'ENDED', user?: any) {
    const cls = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Live class not found');

    if (user && !isSuperAdmin(user) && cls.centreId) {
      assertCentreAccess(user, cls.centreId);
    }

    if (!['SCHEDULED', 'LIVE', 'ENDED'].includes(status)) {
      throw new BadRequestException('Invalid live class status.');
    }

    if (cls.status === 'ENDED' && status !== 'ENDED') {
      throw new BadRequestException('Cannot modify status of an already ended live class.');
    }

    return this.prisma.liveClass.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string, user?: any) {
    const cls = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Live class not found');

    if (user && !isSuperAdmin(user) && cls.centreId) {
      assertCentreAccess(user, cls.centreId);
    }

    return this.prisma.liveClass.delete({ where: { id } });
  }

  async getStats(user?: any) {
    const where: any = {};
    if (user && !isSuperAdmin(user)) {
      const allowedCentres = getAuthorizedCentreIds(user);
      where.centreId = { in: allowedCentres };
    }

    const [total, live] = await Promise.all([
      this.prisma.liveClass.count({ where }),
      this.prisma.liveClass.count({ where: { ...where, status: 'LIVE' } }),
    ]);
    return { total, live };
  }
}

