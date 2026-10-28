import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { isSuperAdmin, getAuthorizedCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

@Injectable()
export class LiveClassService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(user?: any) {
    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');

    if (normalizedRole === 'PUBLIC_LEARNER') {
      const classes = await this.prisma.liveClass.findMany({
        where: { isPublic: true },
        include: {
          board: { select: { id: true, name: true } },
          standard: { select: { id: true, name: true } },
          centre: { select: { id: true, name: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      });

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

    const isStudent = normalizedRole === 'STUDENT';
    
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
        return this.prisma.liveClass.findMany({
          where: { isPublic: true },
          include: {
            board: { select: { id: true, name: true } },
            standard: { select: { id: true, name: true } },
            centre: { select: { id: true, name: true } },
          },
          orderBy: { scheduledAt: 'asc' },
        });
      }

      const centreIds = profile.enrollments.map(e => e.batch?.centreId).filter(Boolean) as string[];
      const standardIds = profile.enrollments.map(e => e.batch?.standardId).filter(Boolean) as string[];
      const boardIds = profile.enrollments.map(e => e.batch?.boardId).filter(Boolean) as string[];

      const andConditions: any[] = [];
      andConditions.push({ OR: [{ centreId: null }, { centreId: { in: centreIds } }] });
      andConditions.push({ OR: [{ standardId: null }, { standardId: { in: standardIds } }] });
      andConditions.push({ OR: [{ boardId: null }, { boardId: { in: boardIds } }] });

      const classes = await this.prisma.liveClass.findMany({
        where: {
          OR: [
            { AND: andConditions },
            { isPublic: true },
          ],
        },
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

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');

    if (normalizedRole === 'PUBLIC_LEARNER') {
      if (!cls.isPublic) {
        throw new ForbiddenException('Access denied: Public learners can only access public live classes.');
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

    const isStudent = normalizedRole === 'STUDENT';
    if (isStudent && user?.id) {
      if (cls.isPublic) {
        const now = Date.now();
        const classTime = new Date(cls.scheduledAt).getTime();
        const isLiveNow = cls.status === 'LIVE';
        const isStartingSoon = (classTime - now) <= 15 * 60 * 1000 && (classTime - now) >= -cls.duration * 60 * 1000;
        if (!isLiveNow && !isStartingSoon) {
          return { ...cls, roomId: null };
        }
        return cls;
      }

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

      if (!matchesCentre || !matchesStandard || !matchesBoard) {
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
    isPublic?: boolean;
    description?: string;
    backgroundImageUrl?: string;
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
        isPublic: Boolean(data.isPublic),
        description: data.description ? data.description.trim() : null,
        backgroundImageUrl: data.backgroundImageUrl ? data.backgroundImageUrl.trim() : null,
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

  async update(id: string, data: any, user?: any) {
    const cls = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Live class not found');

    if (user && !isSuperAdmin(user)) {
      if (cls.centreId) {
        assertCentreAccess(user, cls.centreId);
      } else {
        throw new ForbiddenException('Cannot modify a global live class');
      }
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.teacherName !== undefined) updateData.teacherName = data.teacherName;
    if (data.duration !== undefined) updateData.duration = Number(data.duration);
    if (data.zoomLink !== undefined) updateData.roomId = data.zoomLink;
    if (data.isPublic !== undefined) updateData.isPublic = Boolean(data.isPublic);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.backgroundImageUrl !== undefined) updateData.backgroundImageUrl = data.backgroundImageUrl;
    if (data.scheduledAt !== undefined) {
      const d = new Date(data.scheduledAt);
      if (isNaN(d.getTime())) throw new BadRequestException('Invalid scheduledAt date');
      updateData.scheduledAt = d;
    }

    return this.prisma.liveClass.update({
      where: { id },
      data: updateData,
    });
  }

  async updateStatus(id: string, status: 'SCHEDULED' | 'LIVE' | 'ENDED', user?: any) {
    const cls = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Live class not found');

    if (user && !isSuperAdmin(user)) {
      if (cls.centreId) {
        assertCentreAccess(user, cls.centreId);
      } else {
        throw new ForbiddenException('Cannot alter status of a global live class');
      }
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

    if (user && !isSuperAdmin(user)) {
      if (cls.centreId) {
        assertCentreAccess(user, cls.centreId);
      } else {
        throw new ForbiddenException('Cannot delete a global live class');
      }
    }

    return this.prisma.liveClass.delete({ where: { id } });
  }

  async getStats(user?: any) {
    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');

    if (normalizedRole === 'PUBLIC_LEARNER') {
      const [total, live] = await Promise.all([
        this.prisma.liveClass.count({ where: { isPublic: true } }),
        this.prisma.liveClass.count({ where: { isPublic: true, status: 'LIVE' } }),
      ]);
      return { total, live };
    }

    if (normalizedRole === 'STUDENT' && user?.id) {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { enrollments: { include: { batch: true } } }
      });

      if (!profile || !profile.enrollments || profile.enrollments.length === 0) {
        const [total, live] = await Promise.all([
          this.prisma.liveClass.count({ where: { isPublic: true } }),
          this.prisma.liveClass.count({ where: { isPublic: true, status: 'LIVE' } }),
        ]);
        return { total, live };
      }

      const centreIds = profile.enrollments.map(e => e.batch?.centreId).filter(Boolean) as string[];
      const standardIds = profile.enrollments.map(e => e.batch?.standardId).filter(Boolean) as string[];
      const boardIds = profile.enrollments.map(e => e.batch?.boardId).filter(Boolean) as string[];

      const andConditions: any[] = [];
      andConditions.push({ OR: [{ centreId: null }, { centreId: { in: centreIds } }] });
      andConditions.push({ OR: [{ standardId: null }, { standardId: { in: standardIds } }] });
      andConditions.push({ OR: [{ boardId: null }, { boardId: { in: boardIds } }] });

      const [total, live] = await Promise.all([
        this.prisma.liveClass.count({
          where: {
            OR: [
              { AND: andConditions },
              { isPublic: true },
            ],
          },
        }),
        this.prisma.liveClass.count({
          where: {
            status: 'LIVE',
            OR: [
              { AND: andConditions },
              { isPublic: true },
            ],
          },
        }),
      ]);
      return { total, live };
    }

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

  /**
   * Public View: Retrieves public live class/webinar details.
   * Does NOT leak the Google Meet URL before registration to prevent scraping.
   */
  async getPublicClass(id: string) {
    const cls = await this.prisma.liveClass.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        subject: true,
        teacherName: true,
        description: true,
        scheduledAt: true,
        duration: true,
        status: true,
        isPublic: true,
        backgroundImageUrl: true,
        createdAt: true,
      },
    });

    if (!cls || !cls.isPublic) {
      throw new NotFoundException('Public live class / webinar not found or is private.');
    }

    const achieverNotices = await this.prisma.notice.findMany({
      where: { type: 'STAR_ACHIEVER', isActive: true },
      take: 25,
    });
    const achievers = achieverNotices.map(item => {
      let meta: any = {};
      try { meta = JSON.parse(item.content); } catch { meta = { rankOrScore: item.content, examOrCourse: '', order: 999 }; }
      return {
        id: item.id,
        name: item.title,
        title: item.title,
        rankOrScore: meta.rankOrScore || '',
        examOrCourse: meta.examOrCourse || '',
        imageUrl: item.imageUrl || undefined,
        badgeColor: meta.badgeColor || '#0162b1',
        order: typeof meta.order === 'number' ? meta.order : 999,
      };
    });
    achievers.sort((a, b) => a.order - b.order);

    return { ...cls, achievers };
  }

  /**
   * Public Registration: Captures attendee details and unlocks the Google Meet URL.
   */
  async registerAttendee(
    id: string,
    data: { name: string; email: string; phone?: string; organization?: string; honeypot?: string },
  ) {
    // Honeypot check for bots
    if (data.honeypot && data.honeypot.trim().length > 0) {
      return { success: true, meetUrl: 'https://meet.google.com', message: 'Registration confirmed.' };
    }

    if (!data.name || !data.name.trim()) {
      throw new BadRequestException('Full name is required.');
    }

    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      throw new BadRequestException('A valid email address is required.');
    }

    if (!data.phone || !data.phone.trim()) {
      throw new BadRequestException('Mobile or WhatsApp number is required.');
    }

    if (!data.organization || !data.organization.trim()) {
      throw new BadRequestException('School, College, or Organization name is required.');
    }

    const cls = await this.prisma.liveClass.findUnique({
      where: { id },
    });

    if (!cls || !cls.isPublic) {
      throw new NotFoundException('Live class / webinar not found or is private.');
    }

    const trimmedName = data.name.trim().slice(0, 100);
    const trimmedEmail = data.email.trim().toLowerCase().slice(0, 150);
    const trimmedPhone = data.phone ? data.phone.trim().slice(0, 25) : null;
    const trimmedOrg = data.organization ? data.organization.trim().slice(0, 100) : null;

    // Check if attendee is already registered with this email
    const existing = await this.prisma.liveClassRegistration.findFirst({
      where: {
        liveClassId: id,
        email: trimmedEmail,
      },
    });

    if (!existing) {
      await this.prisma.liveClassRegistration.create({
        data: {
          liveClassId: id,
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          organization: trimmedOrg,
        },
      });
    }

    return {
      success: true,
      meetUrl: cls.roomId,
      title: cls.title,
      scheduledAt: cls.scheduledAt,
      status: cls.status,
      message: 'Registration successful! You may now join the session.',
    };
  }

  /**
   * Admin View: Returns all registered attendees for a live class.
   */
  async getRegistrations(id: string, user?: any) {
    const cls = await this.prisma.liveClass.findUnique({
      where: { id },
    });

    if (!cls) {
      throw new NotFoundException('Live class not found.');
    }

    if (user && !isSuperAdmin(user) && cls.centreId) {
      assertCentreAccess(user, cls.centreId);
    }

    const registrations = await this.prisma.liveClassRegistration.findMany({
      where: { liveClassId: id },
      orderBy: { registeredAt: 'desc' },
    });

    return {
      total: registrations.length,
      classId: cls.id,
      title: cls.title,
      registrations,
    };
  }
}
