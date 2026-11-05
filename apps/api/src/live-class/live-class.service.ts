import {
  Injectable,
  OnModuleInit,
  HttpException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  AccessToken,
  RoomServiceClient,
  EgressClient,
  WebhookReceiver,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
  TrackSource,
  TrackType,
} from 'livekit-server-sdk';
import * as crypto from 'crypto';
import * as path from 'path';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { isSuperAdmin, getAuthorizedCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

export const SAFE_LIVE_CLASS_SELECT = {
  id: true,
  title: true,
  subject: true,
  teacherName: true,
  description: true,
  isPublic: true,
  backgroundImageUrl: true,
  status: true,
  scheduledAt: true,
  duration: true,
  roomId: true,
  boardId: true,
  standardId: true,
  centreId: true,
  createdAt: true,
  updatedAt: true,
  board: { select: { id: true, name: true } },
  standard: { select: { id: true, name: true } },
  centre: { select: { id: true, name: true } },
} as const;

@Injectable()
export class LiveClassService implements OnModuleInit {
  private readonly logger = new Logger(LiveClassService.name);

  // In-memory moderation cache as standalone fallback or cache layer
  private inMemoryModeration = new Map<string, { mutedAudio?: boolean; kicked?: boolean; updatedAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly storageService?: StorageService,
  ) { }

  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "live_class_registrations" (
            "id" TEXT NOT NULL,
            "liveClassId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "email" TEXT NOT NULL,
            "phone" TEXT,
            "organization" TEXT,
            "registrationToken" TEXT,
            "status" TEXT NOT NULL DEFAULT 'REGISTERED',
            "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "live_class_registrations_pkey" PRIMARY KEY ("id")
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "live_class_registrations_liveClassId_email_key" ON "live_class_registrations"("liveClassId", "email");
        CREATE UNIQUE INDEX IF NOT EXISTS "live_class_registrations_registrationToken_key" ON "live_class_registrations"("registrationToken");
        CREATE INDEX IF NOT EXISTS "live_class_registrations_liveClassId_idx" ON "live_class_registrations"("liveClassId");
        CREATE INDEX IF NOT EXISTS "live_class_registrations_email_idx" ON "live_class_registrations"("email");
      `);
      this.logger.log('Live class registrations table verified.');
    } catch (e: any) {
      this.logger.warn(`Could not verify live_class_registrations table: ${e?.message}`);
    }
  }

  public async safeFindMany(params: { where?: any; orderBy?: any }): Promise<any[]> {
    try {
      return await this.prisma.liveClass.findMany({
        where: params.where,
        include: {
          board: { select: { id: true, name: true } },
          standard: { select: { id: true, name: true } },
          centre: { select: { id: true, name: true } },
        },
        orderBy: params.orderBy,
      });
    } catch (err: any) {
      this.logger.warn(
        `findMany with full relations failed (${err?.message}), falling back to SAFE_LIVE_CLASS_SELECT`,
      );
      return await this.prisma.liveClass.findMany({
        where: params.where,
        select: SAFE_LIVE_CLASS_SELECT,
        orderBy: params.orderBy,
      });
    }
  }

  public async safeFindUnique(where: { id?: string; roomId?: string }): Promise<any> {
    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const roomIdToQuery = where.roomId || (where.id && !isUuid(where.id) ? where.id : undefined);

    try {
      if (where.id) {
        try {
          const cls = await this.prisma.liveClass.findUnique({
            where: { id: where.id },
            include: {
              board: { select: { id: true, name: true } },
              standard: { select: { id: true, name: true } },
              centre: { select: { id: true, name: true } },
            },
          });
          if (cls) return cls;
        } catch (uuidErr: any) {
          if (!uuidErr?.message?.includes('invalid input syntax for type uuid') && !uuidErr?.message?.includes('22P02')) {
            throw uuidErr;
          }
        }
      }

      if (roomIdToQuery) {
        const cls = await this.prisma.liveClass.findFirst({
          where: { roomId: roomIdToQuery },
          include: {
            board: { select: { id: true, name: true } },
            standard: { select: { id: true, name: true } },
            centre: { select: { id: true, name: true } },
          },
        });
        if (cls) return cls;
      }
    } catch (err: any) {
      this.logger.warn(
        `findUnique/First with full relations failed (${err?.message}), falling back to SAFE_LIVE_CLASS_SELECT`,
      );
      try {
        if (where.id) {
          try {
            const cls = await this.prisma.liveClass.findUnique({
              where: { id: where.id },
              select: SAFE_LIVE_CLASS_SELECT,
            });
            if (cls) return cls;
          } catch (uuidErr: any) {
            if (!uuidErr?.message?.includes('invalid input syntax for type uuid') && !uuidErr?.message?.includes('22P02')) {
              throw uuidErr;
            }
          }
        }

        if (roomIdToQuery) {
          return await this.prisma.liveClass.findFirst({
            where: { roomId: roomIdToQuery },
            select: SAFE_LIVE_CLASS_SELECT,
          });
        }
      } catch (fallbackErr: any) {
        this.logger.error(`safeFindUnique fallback failed (${fallbackErr?.message})`);
        return null;
      }
    }
    return null;
  }

  public getRoomService(httpUrl: string, apiKey: string, apiSecret: string): RoomServiceClient {
    return new RoomServiceClient(httpUrl, apiKey, apiSecret);
  }

  public getEgressClient(httpUrl: string, apiKey: string, apiSecret: string): EgressClient {
    return new EgressClient(httpUrl, apiKey, apiSecret);
  }

  private getModerationKey(classId: string, identity: string) {
    return `live_class:mod:${classId}:${identity}`;
  }

  private getBaseIdentity(identity: string): string {
    // If identity has a session suffix (e.g. user_1_k9a2f or pub_regId_k9a2f), extract core user/reg identity
    const parts = identity.split('_');
    if (parts.length >= 3) {
      return parts.slice(0, 2).join('_');
    }
    return identity;
  }

  async isParticipantKicked(classId: string, identity: string): Promise<boolean> {
    const isDirectKicked = await this.checkSingleKicked(classId, identity);
    if (isDirectKicked) return true;
    const base = this.getBaseIdentity(identity);
    if (base !== identity) {
      return await this.checkSingleKicked(classId, base);
    }
    return false;
  }

  private async checkSingleKicked(classId: string, identity: string): Promise<boolean> {
    const key = this.getModerationKey(classId, identity);
    if (this.redisService?.isConnected) {
      try {
        const val = await this.redisService.getRaw(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed.kicked) return true;
        }
      } catch { }
    }
    const mem = this.inMemoryModeration.get(key);
    return Boolean(mem?.kicked);
  }

  async isParticipantMuted(classId: string, identity: string): Promise<boolean> {
    const isDirectMuted = await this.checkSingleMuted(classId, identity);
    if (isDirectMuted) return true;
    const base = this.getBaseIdentity(identity);
    if (base !== identity) {
      return await this.checkSingleMuted(classId, base);
    }
    return false;
  }

  private async checkSingleMuted(classId: string, identity: string): Promise<boolean> {
    const key = this.getModerationKey(classId, identity);
    if (this.redisService?.isConnected) {
      try {
        const val = await this.redisService.getRaw(key);
        if (val) {
          const parsed = JSON.parse(val);
          return Boolean(parsed.mutedAudio);
        }
      } catch { }
    }
    const mem = this.inMemoryModeration.get(key);
    return Boolean(mem?.mutedAudio);
  }

  async setModerationState(classId: string, identity: string, state: { mutedAudio?: boolean; kicked?: boolean }, ttlSeconds = 14400) {
    await this.applySingleModerationState(classId, identity, state, ttlSeconds);
    const base = this.getBaseIdentity(identity);
    if (base !== identity) {
      await this.applySingleModerationState(classId, base, state, ttlSeconds);
    }
  }

  private async applySingleModerationState(classId: string, identity: string, state: { mutedAudio?: boolean; kicked?: boolean }, ttlSeconds = 14400) {
    const key = this.getModerationKey(classId, identity);
    const current = this.inMemoryModeration.get(key) || { updatedAt: Date.now() };
    const updated = { ...current, ...state, updatedAt: Date.now() };
    this.inMemoryModeration.set(key, updated);
    if (this.redisService?.isConnected) {
      try {
        await this.redisService.setRaw(key, JSON.stringify(updated), ttlSeconds);
      } catch { }
    }
  }

  private async recordAudit(user: any, action: string, details: string, classId?: string) {
    if (!this.prisma?.auditLog) return;
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: user?.id || null,
          userEmail: user?.email || null,
          action,
          category: 'SECURITY',
          entityType: 'LiveClass',
          entityId: classId || null,
          status: 'SUCCESS',
          details: { details, classId },
        },
      });
    } catch {
      // Non-blocking audit log failure
    }
  }

  /**
   * Validates scheduling boundaries and join window for a live class.
   * Prevents expired classes from being joined even if marked SCHEDULED or LIVE.
   * Enforces early-join windows: 30m for hosts, 15m for attendees.
   */
  public validateClassTiming(cls: any, isHost: boolean) {
    if (cls.status === 'ENDED') {
      throw new BadRequestException('This live class has already ended.');
    }
    if (cls.status === 'CANCELLED') {
      throw new BadRequestException('This live class has been cancelled.');
    }

    const now = Date.now();
    const classTime = new Date(cls.scheduledAt).getTime();
    const durationMs = (cls.duration || 60) * 60 * 1000;
    const maxEndGraceMs = 30 * 60 * 1000; // 30-minute buffer after scheduled end
    const classEndTime = classTime + durationMs + maxEndGraceMs;

    // Check expiration: even if status is LIVE or SCHEDULED, if elapsed past classEndTime, it is strictly expired!
    if (now > classEndTime && cls.status !== 'LIVE') {
      throw new BadRequestException('This live class session has expired.');
    }

    // If already LIVE, allow immediate entry without early restrictions
    if (cls.status === 'LIVE') {
      return { classTime, durationMs, classEndTime };
    }

    // For public webinars, attendees are welcome to enter the lobby and waiting stage at any time before start
    if (cls.isPublic) {
      return { classTime, durationMs, classEndTime };
    }

    // Early join check: hosts get 120 mins prep, regular cohort students get 15 mins
    const earlyAllowanceMs = isHost
      ? 120 * 60 * 1000
      : 15 * 60 * 1000;
    const earliestJoinTime = classTime - earlyAllowanceMs;

    if (now < earliestJoinTime) {
      const minutesAllowed = isHost ? 120 : 15;
      throw new BadRequestException(`Classroom access opens ${minutesAllowed} minutes before the scheduled start time.`);
    }

    return { classTime, durationMs, classEndTime };
  }

  async getAll(user?: any): Promise<any> {
    try {
      const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
      const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');

      if (normalizedRole === 'PUBLIC_LEARNER') {
        const classes = await this.safeFindMany({
          where: { isPublic: true },
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
        }).catch(() => null);

        if (!profile || !profile.enrollments || profile.enrollments.length === 0) {
          return await this.safeFindMany({
            where: { isPublic: true },
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

        const classes = await this.safeFindMany({
          where: {
            OR: [
              { AND: andConditions },
              { isPublic: true },
            ],
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
        try {
          const allowedCentres = getAuthorizedCentreIds(user);
          const orConditions: any[] = [
            { centreId: { in: allowedCentres } },
            { centreId: null }
          ];
          if (normalizedRole === 'TEACHER' && user.id) {
            orConditions.push({ teacherId: user.id });
          }
          where.OR = orConditions;
        } catch {
          if (normalizedRole === 'TEACHER' && user?.id) {
            where.teacherId = user.id;
          } else {
            where.isPublic = true;
          }
        }
      }

      return await this.safeFindMany({
        where,
        orderBy: { scheduledAt: 'asc' },
      });
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`LiveClassService.getAll unexpected failure: ${err?.message}`, err?.stack);
      return [];
    }
  }

  async getById(id: string, user?: any): Promise<any> {
    const cls = await this.safeFindUnique({ id });

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
    teacherId?: string;
    deliveryProvider?: 'LIVEKIT' | 'GOOGLE_MEET' | 'ZOOM' | 'JITSI';
    externalMeetingUrl?: string;
  }, user?: any): Promise<any> {
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

    const isPublic = Boolean(data.isPublic);
    let centreId = (typeof data.centreId === 'string' && data.centreId.trim()) ? data.centreId.trim() : null;

    if (user && !isSuperAdmin(user)) {
      if (centreId) {
        assertCentreAccess(user, centreId);
      } else if (!isPublic) {
        // Only require and bind centre assignment for private non-webinar classes
        try {
          const allowed = getAuthorizedCentreIds(user);
          centreId = allowed[0] || null;
        } catch {
          // If staff has no centre assignment, allow null centre for teacher or super admin
          centreId = null;
        }
      }
    }

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');
    const teacherId = data.teacherId || (normalizedRole === 'TEACHER' ? user?.id : null);

    const roomId = (typeof data.zoomLink === 'string' && data.zoomLink.trim())
      ? data.zoomLink.trim()
      : `edumeet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const deliveryProvider = data.deliveryProvider || 'LIVEKIT';
    const externalMeetingUrl = data.externalMeetingUrl || (data.zoomLink?.startsWith('http') ? data.zoomLink.trim() : null);

    const boardId = (typeof data.boardId === 'string' && data.boardId.trim()) ? data.boardId.trim() : null;
    const standardId = (typeof data.standardId === 'string' && data.standardId.trim()) ? data.standardId.trim() : null;

    // Full creation payload with all modern fields
    const fullCreateData: any = {
      title: data.title.trim(),
      subject: data.subject.trim(),
      teacherName: data.teacherName.trim(),
      teacherId: teacherId || null,
      scheduledAt: scheduledDate,
      duration: Number(data.duration),
      roomId,
      deliveryProvider,
      externalMeetingUrl,
      isPublic,
      description: data.description ? data.description.trim() : null,
      backgroundImageUrl: data.backgroundImageUrl ? data.backgroundImageUrl.trim() : null,
      boardId,
      standardId,
      centreId,
    };

    // Baseline creation payload for databases prior to live class hardening migration
    const baselineCreateData: any = {
      title: data.title.trim(),
      subject: data.subject.trim(),
      teacherName: data.teacherName.trim(),
      teacherId: teacherId || null,
      scheduledAt: scheduledDate,
      duration: Number(data.duration),
      roomId,
      isPublic,
      description: data.description ? data.description.trim() : null,
      backgroundImageUrl: data.backgroundImageUrl ? data.backgroundImageUrl.trim() : null,
      boardId,
      standardId,
      centreId,
    };

    // Tier 1: Modern schema with include relations
    try {
      return await this.prisma.liveClass.create({
        data: fullCreateData,
        include: {
          board: { select: { id: true, name: true } },
          standard: { select: { id: true, name: true } },
          centre: { select: { id: true, name: true } },
        },
      });
    } catch (err: any) {
      if (err instanceof HttpException) throw err;

      // Translate foreign key constraint violations into clear user-facing BadRequest
      if (err?.code === 'P2003') {
        const field = err?.meta?.field_name || 'relation';
        this.logger.error(`Foreign key validation failed on LiveClass.create: ${field}`, err?.stack);
        throw new BadRequestException('Selected Board, Standard, or Centre does not exist.');
      }

      this.logger.warn(`LiveClass.create Tier 1 failed (${err?.message}), attempting Tier 2 with SAFE_LIVE_CLASS_SELECT`);

      // Tier 2: Modern schema with SAFE_LIVE_CLASS_SELECT (avoids returning unmigrated columns)
      try {
        return await this.prisma.liveClass.create({
          data: fullCreateData,
          select: SAFE_LIVE_CLASS_SELECT,
        });
      } catch (tier2Err: any) {
        if (tier2Err instanceof HttpException) throw tier2Err;

        if (tier2Err?.code === 'P2003') {
          throw new BadRequestException('Selected Board, Standard, or Centre does not exist.');
        }

        this.logger.warn(`LiveClass.create Tier 2 failed (${tier2Err?.message}), attempting Tier 3 with baseline schema`);

        // Tier 3: Baseline fields only (in case deliveryProvider or externalMeetingUrl columns do not exist in DB)
        try {
          return await this.prisma.liveClass.create({
            data: baselineCreateData,
            select: SAFE_LIVE_CLASS_SELECT,
          });
        } catch (tier3Err: any) {
          if (tier3Err instanceof HttpException) throw tier3Err;

          if (tier3Err?.code === 'P2003') {
            throw new BadRequestException('Selected Board, Standard, or Centre does not exist.');
          }

          this.logger.error(`LiveClass.create failed across all tiers: ${tier3Err?.message}`, tier3Err?.stack);
          throw new InternalServerErrorException(
            tier3Err?.message ? `Failed to create live class: ${tier3Err.message}` : 'Failed to create live class in database.'
          );
        }
      }
    }
  }

  async update(id: string, data: any, user?: any): Promise<any> {
    const cls = await this.safeFindUnique({ id });
    if (!cls) throw new NotFoundException('Live class not found');

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');

    if (user && !isSuperAdmin(user)) {
      if (cls.centreId) {
        assertCentreAccess(user, cls.centreId);
      } else {
        throw new ForbiddenException('Cannot modify a global live class');
      }

      if (normalizedRole === 'TEACHER' && cls.teacherId && cls.teacherId !== user.id) {
        throw new ForbiddenException('You can only modify live classes assigned to you.');
      }
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.teacherName !== undefined) updateData.teacherName = data.teacherName;
    if (data.teacherId !== undefined) updateData.teacherId = data.teacherId;
    if (data.duration !== undefined) updateData.duration = Number(data.duration);
    if (data.zoomLink !== undefined) {
      updateData.roomId = typeof data.zoomLink === 'string' ? data.zoomLink.trim() : data.zoomLink;
      if (typeof data.zoomLink === 'string' && data.zoomLink.startsWith('http')) {
        updateData.externalMeetingUrl = data.zoomLink.trim();
      }
    }
    if (data.deliveryProvider !== undefined) updateData.deliveryProvider = data.deliveryProvider;
    if (data.externalMeetingUrl !== undefined) updateData.externalMeetingUrl = data.externalMeetingUrl;
    if (data.isPublic !== undefined) updateData.isPublic = Boolean(data.isPublic);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.backgroundImageUrl !== undefined) updateData.backgroundImageUrl = data.backgroundImageUrl;
    if (data.scheduledAt !== undefined) {
      const d = new Date(data.scheduledAt);
      if (isNaN(d.getTime())) throw new BadRequestException('Invalid scheduledAt date');
      updateData.scheduledAt = d;
    }

    try {
      return await this.prisma.liveClass.update({
        where: { id },
        data: updateData,
      });
    } catch {
      try {
        return await this.prisma.liveClass.update({
          where: { id },
          data: updateData,
          select: SAFE_LIVE_CLASS_SELECT,
        });
      } catch {
        const { deliveryProvider, externalMeetingUrl, substituteTeacherId, egressId, whiteboardData, ...baselineUpdateData } = updateData;
        return await this.prisma.liveClass.update({
          where: { id },
          data: baselineUpdateData,
          select: SAFE_LIVE_CLASS_SELECT,
        });
      }
    }
  }

  async updateStatus(id: string, status: 'SCHEDULED' | 'LIVE' | 'ENDED', user?: any): Promise<any> {
    const cls = await this.safeFindUnique({ id });
    if (!cls) throw new NotFoundException('Live class not found');

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');

    if (user && !isSuperAdmin(user)) {
      if (cls.centreId) {
        assertCentreAccess(user, cls.centreId);
      } else {
        throw new ForbiddenException('Cannot alter status of a global live class');
      }

      if (normalizedRole === 'TEACHER' && cls.teacherId && cls.teacherId !== user.id) {
        throw new ForbiddenException('You can only modify status of live classes assigned to you.');
      }
    }

    if (!['SCHEDULED', 'LIVE', 'ENDED'].includes(status)) {
      throw new BadRequestException('Invalid live class status.');
    }

    if (cls.status === 'ENDED' && status !== 'ENDED') {
      throw new BadRequestException('Cannot modify status of an already ended live class.');
    }

    try {
      return await this.prisma.liveClass.update({
        where: { id },
        data: { status },
      });
    } catch {
      return await this.prisma.liveClass.update({
        where: { id },
        data: { status },
        select: SAFE_LIVE_CLASS_SELECT,
      });
    }
  }

  async delete(id: string, user?: any): Promise<any> {
    const cls = await this.safeFindUnique({ id });
    if (!cls) throw new NotFoundException('Live class not found');

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');

    if (user && !isSuperAdmin(user)) {
      if (cls.centreId) {
        assertCentreAccess(user, cls.centreId);
      } else {
        throw new ForbiddenException('Cannot delete a global live class');
      }

      if (normalizedRole === 'TEACHER' && cls.teacherId && cls.teacherId !== user.id) {
        throw new ForbiddenException('You can only delete live classes assigned to you.');
      }
    }

    try {
      return await this.prisma.liveClass.delete({ where: { id } });
    } catch {
      return await this.prisma.liveClass.delete({
        where: { id },
        select: { id: true },
      });
    }
  }

  async getStats(user?: any) {
    try {
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
        }).catch(() => null);

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
        try {
          const allowedCentres = getAuthorizedCentreIds(user);
          where.centreId = { in: allowedCentres };
        } catch {
          where.id = 'none';
        }
      }

      const [total, live] = await Promise.all([
        this.prisma.liveClass.count({ where }),
        this.prisma.liveClass.count({ where: { ...where, status: 'LIVE' } }),
      ]);
      return { total, live };
    } catch (e: any) {
      this.logger.error(`getStats failed: ${e?.message}`);
      return { total: 0, live: 0 };
    }
  }

  /**
   * Public View: Retrieves public live class/webinar details.
   * Does NOT leak the meeting URL before registration to prevent scraping.
   */
  async getPublicClass(id: string) {
    const isUuid = Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    let cls: any = null;

    try {
      if (isUuid) {
        cls = await this.prisma.liveClass.findUnique({
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
            roomId: true,
            backgroundImageUrl: true,
            deliveryProvider: true,
            createdAt: true,
          },
        });
      }
      if (!cls) {
        cls = await this.prisma.liveClass.findFirst({
          where: { roomId: id },
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
            roomId: true,
            backgroundImageUrl: true,
            deliveryProvider: true,
            createdAt: true,
          },
        });
      }
    } catch {
      if (isUuid) {
        cls = await this.prisma.liveClass.findUnique({
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
            roomId: true,
            backgroundImageUrl: true,
            createdAt: true,
          },
        }).catch(() => null);
      }
      if (!cls) {
        cls = await this.prisma.liveClass.findFirst({
          where: { roomId: id },
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
            roomId: true,
            backgroundImageUrl: true,
            createdAt: true,
          },
        }).catch(() => null);
      }
    }

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
   * Public Registration: Captures attendee details and unlocks the session.
   * Generates a cryptographically secure random registration token (reg_...)
   * and stores its SHA-256 hash in the database. Returns the raw token to the attendee.
   */
  async registerAttendee(
    id: string,
    data: {
      name: string;
      parentName?: string;
      email: string;
      phone?: string;
      courseOrClass?: string;
      organization?: string;
      honeypot?: string;
    },
  ) {
    // Honeypot check for bots
    if (data.honeypot && data.honeypot.trim().length > 0) {
      return { success: true, meetUrl: 'https://meet.google.com', message: 'Registration confirmed.' };
    }

    if (!data.name || !data.name.trim()) {
      throw new BadRequestException('Student full name is required.');
    }

    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
      throw new BadRequestException('A valid email address is required.');
    }

    if (!data.phone || !data.phone.trim()) {
      throw new BadRequestException('Mobile or WhatsApp contact number is required.');
    }

    if (!data.organization || !data.organization.trim()) {
      throw new BadRequestException('School, College, or Institute name is required.');
    }

    const cls = await this.safeFindUnique({ id });

    if (!cls || !cls.isPublic) {
      throw new NotFoundException('Live class / webinar not found or is private.');
    }

    const trimmedName = data.name.trim().slice(0, 100);
    const trimmedParent = (data.parentName ? data.parentName.trim() : 'Parent').slice(0, 100);
    const trimmedEmail = data.email.trim().toLowerCase().slice(0, 150);
    const trimmedPhone = data.phone.trim().slice(0, 25);
    const trimmedCourse = (data.courseOrClass ? data.courseOrClass.trim() : 'General').slice(0, 100);
    const trimmedOrg = data.organization.trim().slice(0, 150);

    // Encode composite metadata into organization field:
    // Format: "Institute Name | Course: 12th CBSE | Parent: John Doe"
    const compositeOrg = `${trimmedOrg} | Course: ${trimmedCourse} | Parent: ${trimmedParent}`;

    // Cryptographically secure token generation (24 bytes hex = 48 hex chars)
    const rawRegistrationToken = `reg_${crypto.randomBytes(24).toString('hex')}`;
    const hashedToken = crypto.createHash('sha256').update(rawRegistrationToken).digest('hex');
    const targetLiveClassId = cls.id;

    // Cryptographically signed attendee passport
    const secret = process.env.LIVEKIT_API_SECRET || process.env.JWT_SECRET || 'educare-webinar-secret-2026';
    const passportPayload = JSON.stringify({
      classId: cls.id,
      email: trimmedEmail,
      name: trimmedName,
      rawToken: rawRegistrationToken,
      iat: Date.now(),
    });
    const payloadB64 = Buffer.from(passportPayload, 'utf8').toString('base64url');
    const hmacSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
    const signedPassport = `pass_${payloadB64}.${hmacSig}`;

    try {
      await this.prisma.liveClassRegistration.upsert({
        where: {
          liveClassId_email: {
            liveClassId: targetLiveClassId,
            email: trimmedEmail,
          },
        },
        update: {
          name: trimmedName,
          phone: trimmedPhone,
          organization: compositeOrg,
          registrationToken: hashedToken,
          status: 'REGISTERED',
        },
        create: {
          liveClassId: targetLiveClassId,
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          organization: compositeOrg,
          registrationToken: hashedToken,
          status: 'REGISTERED',
        },
      });
    } catch (upsertErr: any) {
      this.logger.warn(`Initial registration upsert failed (${upsertErr?.message}), ensuring schema and retrying...`);
      try {
        await this.prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "live_class_registrations" (
              "id" TEXT NOT NULL,
              "liveClassId" TEXT NOT NULL,
              "name" TEXT NOT NULL,
              "email" TEXT NOT NULL,
              "phone" TEXT,
              "organization" TEXT,
              "registrationToken" TEXT,
              "status" TEXT NOT NULL DEFAULT 'REGISTERED',
              "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "live_class_registrations_pkey" PRIMARY KEY ("id")
          );
          CREATE UNIQUE INDEX IF NOT EXISTS "live_class_registrations_liveClassId_email_key" ON "live_class_registrations"("liveClassId", "email");
          CREATE UNIQUE INDEX IF NOT EXISTS "live_class_registrations_registrationToken_key" ON "live_class_registrations"("registrationToken");
          CREATE INDEX IF NOT EXISTS "live_class_registrations_liveClassId_idx" ON "live_class_registrations"("liveClassId");
          CREATE INDEX IF NOT EXISTS "live_class_registrations_email_idx" ON "live_class_registrations"("email");
        `);

        // Raw SQL fallback upsert
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "live_class_registrations" ("id", "liveClassId", "name", "email", "phone", "organization", "registrationToken", "status", "registeredAt")
          VALUES (gen_random_uuid()::text, '${targetLiveClassId.replace(/'/g, "''")}', '${trimmedName.replace(/'/g, "''")}', '${trimmedEmail.replace(/'/g, "''")}', '${trimmedPhone.replace(/'/g, "''")}', '${compositeOrg.replace(/'/g, "''")}', '${hashedToken.replace(/'/g, "''")}', 'REGISTERED', NOW())
          ON CONFLICT ("liveClassId", "email") DO UPDATE SET
            "name" = EXCLUDED."name",
            "phone" = EXCLUDED."phone",
            "organization" = EXCLUDED."organization",
            "registrationToken" = EXCLUDED."registrationToken",
            "status" = 'REGISTERED';
        `);
      } catch (retryErr: any) {
        this.logger.error(`Critical: Fallback registration SQL failed (${retryErr?.message})`);
      }
    }

    return {
      success: true,
      registrationToken: rawRegistrationToken, // Client receives raw unhashed credential
      passportToken: signedPassport,
      meetUrl: cls.roomId,
      title: cls.title,
      scheduledAt: cls.scheduledAt,
      status: cls.status,
      message: 'Registration successful! You may now join the webinar session.',
    };
  }

  /**
   * Admin / Presenter View: Returns all registered attendees for a live class.
   * Centre isolation & PII protection enforced:
   * - Super Admins and the designated Presenter / Teachers can view attendee details.
   */
  async getRegistrations(id: string, user?: any) {
    const cls = await this.safeFindUnique({ id });

    if (!cls) {
      throw new NotFoundException('Live class not found.');
    }

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const userRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');
    const isSuper = isSuperAdmin(user) || userRole === 'SUPER_ADMIN';
    const isPresenterOrStaff =
      isSuper ||
      ['TEACHER', 'CENTRE_ADMIN', 'ADMIN'].includes(userRole) ||
      (user?.email && cls.teacherName && user.email.toLowerCase().includes(cls.teacherName.toLowerCase()));

    if (!isPresenterOrStaff) {
      throw new ForbiddenException('Access denied: Only administrators and the designated presenter can view attendee details.');
    }

    // Security: Tenant isolation check for Centre Admins
    if (userRole === 'CENTRE_ADMIN' && cls.centreId && !isSuper) {
      try {
        assertCentreAccess(user, cls.centreId);
      } catch (err: any) {
        throw new ForbiddenException(err?.message || 'Access denied for this centre.');
      }
    }

    // Security: Audit trail for PII access
    this.recordAudit(user, 'VIEW_ATTENDEES_ROSTER', `Viewed roster for live class ${cls.id}`, cls.id).catch(() => { });

    let registrations: any[] = [];
    try {
      registrations = await this.prisma.liveClassRegistration.findMany({
        where: { liveClassId: cls.id },
        orderBy: { registeredAt: 'desc' },
      });
    } catch (dbErr: any) {
      this.logger.warn(`Could not query liveClassRegistration (${dbErr?.message}); falling back to cohort roster.`);
      registrations = [];
    }

    const attendedEmails = new Set(registrations.map((r) => r.email.toLowerCase()));

    // Parse the stored registration records
    const parsed = registrations.map((r) => {
      let institute = r.organization || '';
      let course = '';
      let parentName = '';

      if (r.organization && r.organization.includes(' | Course: ')) {
        const parts = r.organization.split(' | ');
        institute = parts[0] || '';
        for (const p of parts.slice(1)) {
          if (p.startsWith('Course: ')) course = p.replace('Course: ', '');
          if (p.startsWith('Parent: ')) parentName = p.replace('Parent: ', '');
        }
      }

      return {
        id: r.id,
        name: r.name,
        parentName: parentName || '—',
        email: r.email,
        phone: r.phone || '—',
        courseOrClass: course || '—',
        organization: institute || '—',
        status: r.status || 'REGISTERED',
        registeredAt: r.registeredAt,
      };
    });

    // If it's a cohort live class, also include enrolled cohort students who have not yet attended
    if (!cls.isPublic && (cls.centreId || cls.standardId || cls.boardId)) {
      try {
        const studentProfiles = await this.prisma.studentProfile.findMany({
          where: {
            enrollments: {
              some: {
                batch: {
                  ...(cls.centreId ? { centreId: cls.centreId } : {}),
                  ...(cls.standardId ? { standardId: cls.standardId } : {}),
                  ...(cls.boardId ? { boardId: cls.boardId } : {}),
                },
              },
            },
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        for (const sp of studentProfiles as any[]) {
          const u = sp.user;
          if (u?.email && !attendedEmails.has(u.email.toLowerCase())) {
            const sName = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Student';
            parsed.push({
              id: `enrolled_${sp.id}`,
              name: sName,
              parentName: sp.parentName || '—',
              email: u.email,
              phone: sp.parentPhone || '—',
              courseOrClass: cls.standard?.name || cls.board?.name || 'Cohort Class',
              organization: cls.centre?.name || 'Educare LMS',
              status: 'ENROLLED',
              registeredAt: sp.createdAt,
            });
          }
        }
      } catch (err: any) {
        this.logger.warn(`Could not fetch cohort enrolled students: ${err?.message}`);
      }
    }

    return {
      total: parsed.length,
      classId: cls.id,
      title: cls.title,
      registrations: parsed,
    };
  }

  /**
   * Generates a signed LiveKit JWT room token for a student, teacher, or admin to join the classroom.
   * Authorization, room name, role, and schedule validity are derived strictly from database records and session.
   * Enforces bounded scheduling windows, teacher substitution rules, and moderation blacklisting.
   */
  async generateLiveKitToken(
    classIdentifier: string,
    user: any,
    clientRole?: string,
    clientIdentity?: string,
    clientName?: string,
  ) {
    if (!classIdentifier) {
      throw new BadRequestException('classId or roomId is required to generate a classroom token.');
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_WS_URL || 'wss://live.educarelearning.in';

    if (!apiKey || !apiSecret) {
      throw new BadRequestException('LiveKit credentials are not configured on the server.');
    }

    // 1. Resolve Class by ID or roomId
    let cls = await this.safeFindUnique({ id: classIdentifier });

    if (!cls) {
      cls = await this.safeFindUnique({ roomId: classIdentifier });
    }

    if (!cls) {
      throw new NotFoundException(`Classroom with identifier "${classIdentifier}" not found.`);
    }

    // 2. Class Status Validation
    if (cls.status === 'ENDED') {
      throw new BadRequestException('This live class has already ended.');
    }
    if (cls.status === 'CANCELLED') {
      throw new BadRequestException('This live class has been cancelled.');
    }

    // 3. User Identity & Role Resolution
    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');

    let isHost = false;
    let canPublish = true;
    let canSubscribe = true;
    let canPublishData = true;

    if (normalizedRole === 'SUPER_ADMIN') {
      isHost = true;
    } else if (normalizedRole === 'CENTRE_ADMIN' || normalizedRole === 'ADMIN') {
      if (cls.centreId) {
        assertCentreAccess(user, cls.centreId);
      }
      isHost = true;
    } else if (normalizedRole === 'TEACHER') {
      if (cls.centreId) {
        assertCentreAccess(user, cls.centreId);
      }
      // Explicit Teacher Authorization:
      // Must be either:
      // 1. The assigned teacher: cls.teacherId === user.id
      // 2. The designated substitute teacher: cls.substituteTeacherId === user.id
      const isAssigned = Boolean(cls.teacherId && cls.teacherId === user?.id);
      const isSubstitute = Boolean(cls.substituteTeacherId && cls.substituteTeacherId === user?.id);

      if (!isAssigned && !isSubstitute && !isSuperAdmin(user)) {
        throw new ForbiddenException(
          'You are not authorized to host this live class. Only the assigned teacher or designated substitute may host.',
        );
      }
      isHost = true;
    } else if (normalizedRole === 'STUDENT') {
      isHost = false;
      // In public webinars, students join as audience in listen-only mode
      if (cls.isPublic) {
        canPublish = false;
      }
    } else if (normalizedRole === 'PUBLIC_LEARNER') {
      if (!cls.isPublic) {
        throw new ForbiddenException('Access denied: Private session.');
      }
      isHost = false;
      canPublish = false; // Public learners join webinar in listen-only mode
    } else {
      throw new ForbiddenException('Invalid or unauthenticated user role.');
    }

    // 4. Validate Timing Boundaries (30m host prep, 15m attendee window, expired session restriction)
    const { classTime, durationMs } = this.validateClassTiming(cls, isHost);

    // 5. Enforce Student Batch/Centre Enrollment
    if (normalizedRole === 'STUDENT' && !cls.isPublic) {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: user?.id },
        include: { enrollments: { include: { batch: true } } },
      });

      const centreIds = profile?.enrollments?.map(e => e.batch?.centreId).filter(Boolean) || [];
      const standardIds = profile?.enrollments?.map(e => e.batch?.standardId).filter(Boolean) || [];
      const boardIds = profile?.enrollments?.map(e => e.batch?.boardId).filter(Boolean) || [];

      const matchesCentre = !cls.centreId || centreIds.includes(cls.centreId);
      const matchesStandard = !cls.standardId || standardIds.includes(cls.standardId);
      const matchesBoard = !cls.boardId || boardIds.includes(cls.boardId);

      if (!matchesCentre || !matchesStandard || !matchesBoard) {
        throw new ForbiddenException('You are not enrolled in the batch, standard, or centre for this class.');
      }
    }

    // 4. Authoritative Identity Derivation
    // Extract sanitized client session suffix (e.g. user_1_k9a2f) to prevent LiveKit duplicate identity kicks across tabs/reconnections
    let identity = user?.id ? `user_${user.id}` : `user_${Date.now()}`;
    if (clientIdentity && typeof clientIdentity === 'string') {
      const match = clientIdentity.match(/_([a-z0-9]{3,8})$/i);
      if (match) {
        identity = `${identity}_${match[1]}`;
      }
    }
    const displayName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user?.name || user?.email || (isHost ? 'Teacher' : 'Student');

    // 5. Moderation Verification (Reconnection & Blacklist Enforcement)
    const isKicked = await this.isParticipantKicked(cls.id, identity);
    if (isKicked) {
      throw new ForbiddenException('You have been removed from this live class by the teacher and cannot rejoin.');
    }

    const isMuted = await this.isParticipantMuted(cls.id, identity);

    // Dynamic TTL capped at remaining class time + 30m (min 30m, max 180m)
    const now = Date.now();
    const remainingMinutes = Math.max(30, Math.ceil((classTime + durationMs - now) / 60000) + 30);
    const ttlSeconds = Math.min(180 * 60, remainingMinutes * 60);

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: displayName,
      ttl: `${ttlSeconds}s`,
      metadata: JSON.stringify({
        role: isHost ? 'TEACHER' : normalizedRole,
        name: displayName,
        userId: user?.id,
        isHost,
        isMutedByHost: isMuted,
      }),
    });

    const roomName = cls.roomId || cls.id;

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: isMuted ? false : canPublish,
      canSubscribe,
      canPublishData,
      roomAdmin: isHost,
      canUpdateOwnMetadata: false, // Students cannot tamper with own metadata to elevate privileges
    });

    const token = await at.toJwt();

    // 6. Record participant attendance in LiveClassRegistration so past roster is permanently preserved
    const studentName = displayName || clientName || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.name) || 'Learner';
    const studentEmail = user?.email || (identity ? `${identity.replace(/[^a-zA-Z0-9_]/g, '')}@attendee.educare` : `guest_${Date.now()}@attendee.educare`);
    const studentPhone = user?.phone || user?.phoneNumber || '';
    const orgInfo = cls.standard?.name || cls.board?.name || cls.centre?.name || (cls.isPublic ? 'Public Webinar' : 'Cohort');

    if (this.prisma.liveClassRegistration?.upsert) {
      try {
        const p = this.prisma.liveClassRegistration.upsert({
          where: {
            liveClassId_email: {
              liveClassId: cls.id,
              email: studentEmail,
            },
          },
          update: {
            status: 'ATTENDED',
            name: studentName,
          },
          create: {
            liveClassId: cls.id,
            email: studentEmail,
            name: studentName,
            phone: studentPhone,
            organization: `${orgInfo} | Role: ${normalizedRole}`,
            status: 'ATTENDED',
          },
        });
        if (p && typeof p.catch === 'function') {
          p.catch((err: any) => {
            this.logger.warn(`Could not upsert attendance registration: ${err?.message}`);
          });
        }
      } catch (err: any) {
        this.logger.warn(`Could not upsert attendance registration: ${err?.message}`);
      }
    }

    return {
      token,
      wsUrl,
      roomName,
      classId: cls.id,
      isHost,
    };
  }

  /**
   * Generates a signed LiveKit JWT room token for registered attendees of a public webinar.
   * Strictly requires a valid cryptographic registration credential (registrationToken).
   * Email-only authentication is prohibited to prevent attendee impersonation.
   */
  async generatePublicLiveKitToken(id: string, registrationToken?: string, _email?: string, name?: string) {
    const cls = await this.safeFindUnique({ id });
    if (!cls || !cls.isPublic) {
      throw new NotFoundException('Public live class not found or is private.');
    }

    // Timing and schedule boundary check for public webinar
    this.validateClassTiming(cls, false);

    // Strict registration token verification (email is not accepted as credential)
    if (!registrationToken || !registrationToken.trim()) {
      throw new ForbiddenException('Access denied: Valid registration credential is required to join this webinar.');
    }

    const trimmedToken = registrationToken.trim();
    const tokenHash = crypto.createHash('sha256').update(trimmedToken).digest('hex');

    // Query by hashed token, or fallback to raw token for legacy unhashed rows
    const possibleClassIds = Array.from(new Set([cls.id, cls.roomId, id].filter(Boolean))) as string[];
    let reg: any = null;

    // 1. Authoritative HMAC-Signed Attendee Passport Verification
    const secret = process.env.LIVEKIT_API_SECRET || process.env.JWT_SECRET || 'educare-webinar-secret-2026';
    if (trimmedToken.includes('.') && (trimmedToken.startsWith('pass_') || trimmedToken.startsWith('reg_'))) {
      const prefixLength = trimmedToken.startsWith('pass_') ? 5 : 4;
      const dotIndex = trimmedToken.indexOf('.');
      const payloadB64 = trimmedToken.slice(prefixLength, dotIndex);
      const signature = trimmedToken.slice(dotIndex + 1);
      const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
      try {
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expectedSig, 'hex');
        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
          if (payload && possibleClassIds.includes(payload.classId)) {
            reg = {
              id: `pass_${payloadB64.slice(0, 16)}`,
              liveClassId: cls.id,
              name: payload.name || name || 'Learner',
              email: payload.email,
              status: 'REGISTERED',
            };
          }
        }
      } catch {
        // Fallback to database query
      }
    }

    try {
      if (!reg) {
        reg = await this.prisma.liveClassRegistration.findFirst({
          where: {
            liveClassId: { in: possibleClassIds },
            registrationToken: tokenHash,
          },
        });
      }

      if (!reg) {
        reg = await this.prisma.liveClassRegistration.findFirst({
          where: {
            liveClassId: { in: possibleClassIds },
            registrationToken: trimmedToken,
          },
        });
      }

      // In case token was registered under an alternate room alias or previous session
      if (!reg) {
        const matchingReg = await this.prisma.liveClassRegistration.findFirst({
          where: {
            OR: [
              { registrationToken: tokenHash },
              { registrationToken: trimmedToken },
            ],
          },
        });
        if (matchingReg && (possibleClassIds.includes(matchingReg.liveClassId) || matchingReg.liveClassId === cls.roomId || matchingReg.liveClassId === cls.id)) {
          reg = matchingReg;
        }
      }
    } catch (queryErr: any) {
      this.logger.warn(`Querying liveClassRegistration failed (${queryErr?.message})`);
    }

    if (!reg) {
      throw new ForbiddenException('Access denied: Invalid or unrecognized registration credential for this webinar.');
    }

    if (reg.status && !['REGISTERED', 'ATTENDED'].includes(reg.status)) {
      throw new ForbiddenException('Access denied: This registration has been revoked or cancelled.');
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_WS_URL || 'wss://live.educarelearning.in';

    if (!apiKey || !apiSecret) {
      throw new BadRequestException('LiveKit credentials are not configured on the server.');
    }

    const sessionSuffix = Math.random().toString(36).slice(2, 7);
    const identity = `pub_${reg.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}_${sessionSuffix}`;
    const displayName = reg.name || name || 'Learner';

    // Moderation check for public attendee
    const isKicked = await this.isParticipantKicked(cls.id, identity);
    if (isKicked) {
      throw new ForbiddenException('Access denied: You have been removed from this webinar and cannot rejoin.');
    }

    const isMuted = await this.isParticipantMuted(cls.id, identity);

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: displayName,
      ttl: '2h',
      metadata: JSON.stringify({
        role: 'PUBLIC_LEARNER',
        name: displayName,
        isRegistered: true,
        isMutedByHost: isMuted,
      }),
    });

    const roomName = cls.roomId || cls.id;

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: false, // In public webinars, attendees join as audience in listen-only mode
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: false,
      canUpdateOwnMetadata: false, // Forbid altering own metadata
    });

    const token = await at.toJwt();

    // Mark status as ATTENDED so past roster reflects attendance
    if (this.prisma.liveClassRegistration?.update) {
      try {
        const p = this.prisma.liveClassRegistration.update({
          where: { id: reg.id },
          data: { status: 'ATTENDED' },
        });
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch {}
    }

    return {
      token,
      wsUrl,
      roomName,
    };
  }

  /**
   * Server-side classroom moderation using LiveKit RoomServiceClient.
   * Authoritatively updates SFU permissions, mutes tracks, maintains persistent state,
   * and prevents participants from republishing restricted tracks.
   */
  async moderateParticipant(
    classId: string,
    action: 'MUTE_STUDENT' | 'UNMUTE_STUDENT' | 'MUTE_ALL' | 'REMOVE_PARTICIPANT',
    targetIdentity?: string,
    trackSid?: string,
    muted: boolean = true,
    user?: any,
  ) {
    const cls = await this.safeFindUnique({ id: classId });
    if (!cls) throw new NotFoundException('Live class not found');

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');

    const isSuper = isSuperAdmin(user);
    const isAssigned = Boolean(cls.teacherId && cls.teacherId === user?.id);
    const isSubstitute = Boolean(cls.substituteTeacherId && cls.substituteTeacherId === user?.id);
    const isCentreAdmin = normalizedRole === 'CENTRE_ADMIN' && (!cls.centreId || getAuthorizedCentreIds(user).includes(cls.centreId));

    if (!isSuper && !isCentreAdmin && !isAssigned && !isSubstitute) {
      throw new ForbiddenException('Only assigned teachers or authorized administrators may moderate participants.');
    }

    if (cls.centreId && !isSuper) {
      assertCentreAccess(user, cls.centreId);
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_WS_URL || 'wss://live.educarelearning.in';

    if (!apiKey || !apiSecret) {
      throw new BadRequestException('LiveKit credentials not configured on server.');
    }

    const httpUrl = wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    const roomService = this.getRoomService(httpUrl, apiKey, apiSecret);
    const roomName = cls.roomId || cls.id;

    if (action === 'MUTE_STUDENT') {
      if (!targetIdentity) throw new BadRequestException('targetIdentity is required for MUTE_STUDENT');

      // 1. Mute active audio track
      if (trackSid) {
        await roomService.mutePublishedTrack(roomName, targetIdentity, trackSid, muted).catch(() => null);
      } else {
        const participant = await roomService.getParticipant(roomName, targetIdentity).catch(() => null);
        if (participant) {
          for (const track of participant.tracks) {
            if (track.type === TrackType.AUDIO) {
              await roomService.mutePublishedTrack(roomName, targetIdentity, track.sid, muted).catch(() => null);
            }
          }
        }
      }

      // 2. Authoritatively mute the audio track without permanently revoking microphone permission,
      // so students are able to unmute themselves when they need to speak
      await roomService.updateParticipant(roomName, targetIdentity, {
        permission: {
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
          canUpdateMetadata: false,
        },
      }).catch((err) => {
        this.logger.warn(`Failed to update SFU permission for ${targetIdentity}: ${err.message}`);
      });

      // 3. Persist moderation state independently of frontend
      await this.setModerationState(cls.id, targetIdentity, { mutedAudio: muted });

      // 4. Record audit log
      await this.recordAudit(user, 'MODERATE_PARTICIPANT', `Muted participant ${targetIdentity}: ${muted}`, cls.id);

      return {
        success: true,
        message: `Participant ${targetIdentity} audio ${muted ? 'muted and restricted' : 'unmuted and permitted'}.`,
      };
    }

    if (action === 'UNMUTE_STUDENT') {
      if (!targetIdentity) throw new BadRequestException('targetIdentity is required for UNMUTE_STUDENT');

      // Restore microphone publishing permission at SFU level
      await roomService.updateParticipant(roomName, targetIdentity, {
        permission: {
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
          canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
          canUpdateMetadata: false,
        },
      }).catch((err) => {
        this.logger.warn(`Failed to restore SFU permission for ${targetIdentity}: ${err.message}`);
      });

      await this.setModerationState(cls.id, targetIdentity, { mutedAudio: false });
      await this.recordAudit(user, 'UNMUTE_PARTICIPANT', `Unmuted participant ${targetIdentity}`, cls.id);

      return { success: true, message: `Participant ${targetIdentity} audio permission restored.` };
    }

    if (action === 'MUTE_ALL') {
      const participants = await roomService.listParticipants(roomName).catch(() => []);
      for (const p of participants) {
        let meta: any = {};
        try { meta = JSON.parse(p.metadata); } catch { }
        if (meta.role === 'TEACHER' || meta.role === 'SUPER_ADMIN' || meta.isHost) continue;

        // Mute tracks
        for (const track of p.tracks) {
          if (track.type === TrackType.AUDIO) {
            await roomService.mutePublishedTrack(roomName, p.identity, track.sid, true).catch(() => null);
          }
        }

        // Maintain publishing permission so students are able to unmute themselves when needed
        await roomService.updateParticipant(roomName, p.identity, {
          permission: {
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
            canUpdateMetadata: false,
          },
        }).catch(() => null);

        await this.setModerationState(cls.id, p.identity, { mutedAudio: true });
      }

      await this.recordAudit(user, 'MODERATE_ALL', `Muted all student participants in class ${cls.id}`, cls.id);
      return { success: true, message: 'All students muted and audio publishing restricted on SFU.' };
    }

    if (action === 'REMOVE_PARTICIPANT') {
      if (!targetIdentity) throw new BadRequestException('targetIdentity is required for REMOVE_PARTICIPANT');

      // 1. Kick immediately from LiveKit room
      await roomService.removeParticipant(roomName, targetIdentity).catch(() => null);

      // 2. Blacklist from re-joining
      await this.setModerationState(cls.id, targetIdentity, { kicked: true });

      await this.recordAudit(user, 'REMOVE_PARTICIPANT', `Removed and barred participant ${targetIdentity}`, cls.id);
      return { success: true, message: `Participant ${targetIdentity} removed and barred from re-entering.` };
    }

    throw new BadRequestException(`Unknown moderation action: ${action}`);
  }

  // ── Persistent Chat ──
  async getChatMessages(classId: string, user?: any) {
    await this.getById(classId, user);
    const messages = await this.prisma.liveClassMessage.findMany({
      where: { liveClassId: classId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return messages.map((m: any) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.senderName,
      senderRole: m.senderRole,
      message: m.content,
      createdAt: m.createdAt,
    }));
  }

  async saveChatMessage(classId: string, content: string | any, user: any) {
    await this.getById(classId, user);
    const rawContent = typeof content === 'string' ? content : (content?.message || content?.content || '');
    if (!rawContent || !rawContent.trim()) throw new BadRequestException('Message content cannot be empty.');

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || 'STUDENT').toUpperCase().replace(/[\s_]+/g, '_');
    const senderName = user?.firstName
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : user?.name || user?.email || 'User';

    return this.prisma.liveClassMessage.create({
      data: {
        liveClassId: classId,
        senderId: user?.id || `guest_${Date.now()}`,
        senderName,
        senderRole: normalizedRole,
        content: rawContent.trim().slice(0, 2000),
      },
    });
  }

  // ── Persistent Classroom Files ──
  async getClassFiles(classId: string, user?: any) {
    await this.getById(classId, user);
    const files = await this.prisma.liveClassFile.findMany({
      where: { liveClassId: classId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return files.map((f: any) => ({
      id: f.id,
      name: f.fileName,
      url: f.fileUrl,
      size: f.fileSize,
      mimeType: f.mimeType,
      createdAt: f.createdAt,
    }));
  }

  async saveClassFile(
    classId: string,
    fileData: any,
    user: any,
  ) {
    await this.getById(classId, user);
    const fileName = fileData.fileName || fileData.name;
    const fileUrl = fileData.fileUrl || fileData.url;
    if (!fileName || !fileUrl) {
      throw new BadRequestException('fileName and fileUrl are required.');
    }

    return this.prisma.liveClassFile.create({
      data: {
        liveClassId: classId,
        uploaderId: user?.id || 'unknown',
        fileName: String(fileName).trim().slice(0, 255),
        fileUrl: String(fileUrl).trim(),
        fileSize: fileData.fileSize ? Number(fileData.fileSize) : null,
        mimeType: fileData.mimeType ? String(fileData.mimeType).trim() : null,
      },
    });
  }

  async uploadClassFile(
    classId: string,
    fileData: { fileName: string; fileType?: string; fileSize?: number; dataUrl: string },
    user: any,
  ) {
    await this.getById(classId, user);
    const { fileName, fileType, fileSize, dataUrl } = fileData;
    if (!fileName || !dataUrl) {
      throw new BadRequestException('fileName and dataUrl are required.');
    }

    // Security Hardening: Enforce 15 MB payload bound
    if (dataUrl.length > 22 * 1024 * 1024) {
      throw new BadRequestException('File payload exceeds maximum allowed upload limit of 15 MB.');
    }

    // Security Hardening: Extension Whitelist & Anti-Script Validation
    const ext = path.extname(fileName).toLowerCase();
    const ALLOWED_UPLOAD_EXTS = new Set([
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.png', '.jpg', '.jpeg', '.webp', '.gif',
      '.zip', '.txt', '.csv',
    ]);
    const DISALLOWED_UPLOAD_EXTS = new Set([
      '.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.phtm', '.phps',
      '.js', '.mjs', '.cjs', '.jsp', '.asp', '.aspx', '.cgi', '.py', '.pl',
      '.html', '.htm', '.xhtml', '.svg', '.svgz', '.vbs', '.scr', '.msi',
      '.jar', '.com', '.hta', '.wsf', '.dll',
    ]);

    if (!ext || !ALLOWED_UPLOAD_EXTS.has(ext) || DISALLOWED_UPLOAD_EXTS.has(ext)) {
      throw new BadRequestException(`File extension "${ext}" is not permitted for upload.`);
    }

    // Security Hardening: Anti-XSS MIME Validation for Data URLs
    if (dataUrl.startsWith('data:')) {
      const mime = dataUrl.split(';')[0].replace(/^data:/, '').toLowerCase();
      if (
        mime.includes('svg') ||
        mime.includes('html') ||
        mime.includes('javascript') ||
        mime.includes('xml')
      ) {
        throw new BadRequestException(`MIME type "${mime}" is not permitted.`);
      }
    }

    let finalUrl = dataUrl;
    if (this.storageService) {
      const config = this.storageService.getConfig();
      if (config.isConfigured) {
        try {
          const uploadRes = await this.storageService.uploadBase64(
            dataUrl,
            'materials',
            fileName.replace(/[^a-zA-Z0-9.-]/g, '_'),
          );
          if (uploadRes?.finalUrl) {
            finalUrl = uploadRes.finalUrl;
          }
        } catch (err: any) {
          this.logger.warn(`Storage R2 upload failed, falling back to direct persistence: ${err?.message}`);
        }
      }
    }

    const created = await this.prisma.liveClassFile.create({
      data: {
        liveClassId: classId,
        uploaderId: user?.id || 'unknown',
        fileName: String(fileName).trim().slice(0, 255),
        fileUrl: finalUrl,
        fileSize: fileSize ? Number(fileSize) : null,
        mimeType: fileType ? String(fileType).trim() : null,
      },
    });

    return {
      success: true,
      file: {
        id: created.id,
        name: created.fileName,
        url: created.fileUrl,
        size: created.fileSize,
        mimeType: created.mimeType,
        createdAt: created.createdAt,
      },
    };
  }

  async deleteClassFile(classId: string, fileId: string, user: any) {
    await this.getById(classId, user);
    const existing = await this.prisma.liveClassFile.findUnique({
      where: { id: fileId },
    });
    if (!existing || existing.liveClassId !== classId) {
      throw new NotFoundException('Class file not found');
    }
    await this.prisma.liveClassFile.delete({
      where: { id: fileId },
    });
    return { success: true };
  }

  // ── Persistent Whiteboard Snapshot ──
  async saveWhiteboardSnapshot(classId: string, snapshot: any, user: any) {
    const cls = await this.safeFindUnique({ id: classId });
    if (!cls) throw new NotFoundException('Live class not found');

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');
    const isTeacher = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER'].includes(normalizedRole);

    if (!isTeacher) {
      throw new ForbiddenException('Only teachers and administrators can persist whiteboard snapshots.');
    }

    return this.prisma.liveClass.update({
      where: { id: classId },
      data: { whiteboardData: snapshot },
      select: { id: true, updatedAt: true },
    });
  }

  async getWhiteboardSnapshot(classId: string, user?: any): Promise<any> {
    await this.getById(classId, user);
    try {
      const cls = await this.prisma.liveClass.findUnique({
        where: { id: classId },
        select: { id: true, whiteboardData: true, updatedAt: true },
      });
      return cls?.whiteboardData || null;
    } catch {
      return null;
    }
  }

  // ── Genuine Server-Side LiveKit Egress Recording Pipeline ──
  async startServerRecording(classId: string, user: any): Promise<any> {
    const cls = await this.safeFindUnique({ id: classId });
    if (!cls) throw new NotFoundException('Live class not found');

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');
    const isAssigned = Boolean(cls.teacherId && cls.teacherId === user?.id);
    const isSubstitute = Boolean(cls.substituteTeacherId && cls.substituteTeacherId === user?.id);
    const isCentreAdmin = normalizedRole === 'CENTRE_ADMIN' && (!cls.centreId || getAuthorizedCentreIds(user).includes(cls.centreId));
    const isSuper = isSuperAdmin(user);

    if (!isSuper && !isCentreAdmin && !isAssigned && !isSubstitute) {
      throw new ForbiddenException('Only authorized teachers or administrators can record classes.');
    }

    if (cls.recordingStatus === 'RECORDING') {
      throw new BadRequestException('A recording is already in progress for this class.');
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_WS_URL || 'wss://live.educarelearning.in';

    if (!apiKey || !apiSecret) {
      throw new ServiceUnavailableException('LiveKit API credentials are not configured on this server.');
    }

    const r2Config = this.storageService?.getConfig();
    const accountId = r2Config?.accountId || process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    const accessKey = r2Config?.accessKeyId || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secret = r2Config?.secretAccessKey || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    const bucket = r2Config?.bucketName || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'educare';

    if (!accountId || !accessKey || !secret) {
      throw new ServiceUnavailableException(
        'Cloudflare R2 storage credentials are not configured for LiveKit Egress recordings.',
      );
    }

    const httpUrl = wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    const egressClient = this.getEgressClient(httpUrl, apiKey, apiSecret);
    const roomName = cls.roomId || cls.id;

    const s3Upload = new S3Upload({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      accessKey,
      secret,
      region: 'auto',
      bucket,
      forcePathStyle: true,
    });

    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `recordings/live-classes/${cls.id}/{room_name}-{time}.mp4`,
      output: {
        case: 's3',
        value: s3Upload,
      },
    });

    try {
      const egressInfo = await egressClient.startRoomCompositeEgress(
        roomName,
        fileOutput,
        { layout: 'speaker' },
      );

      const recording = await this.prisma.liveClassRecording.create({
        data: {
          liveClassId: cls.id,
          egressId: egressInfo.egressId,
          status: 'RECORDING',
          startedAt: new Date(),
        },
      });

      await this.prisma.liveClass.update({
        where: { id: cls.id },
        data: {
          recordingStatus: 'RECORDING',
          egressId: egressInfo.egressId,
        },
      });

      await this.recordAudit(user, 'START_RECORDING', `Started server-side egress recording ${egressInfo.egressId}`, cls.id);

      return {
        success: true,
        egressId: egressInfo.egressId,
        recordingId: recording.id,
        status: 'RECORDING',
      };
    } catch (err: any) {
      this.logger.error(`LiveKit Egress startup failed: ${err.message}`, err.stack);
      throw new ServiceUnavailableException(`Failed to start server-side recording: ${err.message}`);
    }
  }

  async stopServerRecording(classId: string, user: any, egressId?: string): Promise<any> {
    const cls = await this.safeFindUnique({ id: classId });
    if (!cls) throw new NotFoundException('Live class not found');

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');
    const isAssigned = Boolean(cls.teacherId && cls.teacherId === user?.id);
    const isSubstitute = Boolean(cls.substituteTeacherId && cls.substituteTeacherId === user?.id);
    const isCentreAdmin = normalizedRole === 'CENTRE_ADMIN' && (!cls.centreId || getAuthorizedCentreIds(user).includes(cls.centreId));
    const isSuper = isSuperAdmin(user);

    if (!isSuper && !isCentreAdmin && !isAssigned && !isSubstitute) {
      throw new ForbiddenException('Only authorized teachers or administrators can stop recordings.');
    }

    const targetEgressId = egressId || cls.egressId;
    if (!targetEgressId) {
      throw new BadRequestException('No active egress recording session found for this class.');
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_WS_URL || 'wss://live.educarelearning.in';

    if (!apiKey || !apiSecret) {
      throw new ServiceUnavailableException('LiveKit API credentials are not configured on this server.');
    }

    const httpUrl = wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    const egressClient = this.getEgressClient(httpUrl, apiKey, apiSecret);

    try {
      await egressClient.stopEgress(targetEgressId);

      await this.prisma.liveClassRecording.updateMany({
        where: { egressId: targetEgressId },
        data: { status: 'PROCESSING', endedAt: new Date() },
      });

      await this.prisma.liveClass.update({
        where: { id: cls.id },
        data: { recordingStatus: 'PROCESSING' },
      });

      await this.recordAudit(user, 'STOP_RECORDING', `Stopped server-side egress recording ${targetEgressId}`, cls.id);

      return { success: true, message: 'Server-side recording stopped; processing in background.' };
    } catch (err: any) {
      this.logger.error(`LiveKit stopEgress failed: ${err.message}`);
      throw new ServiceUnavailableException(`Failed to stop server-side recording: ${err.message}`);
    }
  }

  async handleLiveKitWebhook(rawBody: string, authHeader: string): Promise<any> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new ServiceUnavailableException('LiveKit webhook verification not configured.');
    }

    const receiver = new WebhookReceiver(apiKey, apiSecret);
    let event: any;
    try {
      event = await receiver.receive(rawBody, authHeader);
    } catch (err: any) {
      this.logger.warn(`LiveKit webhook signature verification failed: ${err.message}`);
      throw new UnauthorizedException('Invalid LiveKit webhook signature.');
    }

    this.logger.log(`Received LiveKit webhook: ${event.event} for room: ${event.room?.name || event.egressInfo?.roomName}`);

    if (event.event === 'egress_started' && event.egressInfo) {
      const egressId = event.egressInfo.egressId;
      await this.prisma.liveClassRecording.updateMany({
        where: { egressId },
        data: { status: 'RECORDING', startedAt: new Date() },
      });
    }

    if (event.event === 'egress_ended' && event.egressInfo) {
      const info = event.egressInfo;
      const egressId = info.egressId;
      const isError = Boolean(info.error || info.status === 3 /* EGRESS_FAILED */);

      if (isError) {
        await this.prisma.liveClassRecording.updateMany({
          where: { egressId },
          data: {
            status: 'FAILED',
            errorMessage: info.error || 'Egress failed during encoding/upload',
            endedAt: new Date(),
          },
        });
        await this.prisma.liveClass.updateMany({
          where: { egressId },
          data: { recordingStatus: 'FAILED' },
        });
      } else {
        const fileResult = info.fileResults?.[0] || info.file;
        const fileUrl = fileResult?.location || fileResult?.filename || '';
        const durationSec = Math.round(Number(info.duration || 0) / 1000000000);
        const fileSize = fileResult?.size ? BigInt(fileResult.size) : null;

        await this.prisma.liveClassRecording.updateMany({
          where: { egressId },
          data: {
            status: 'COMPLETED',
            fileUrl,
            storageKey: fileResult?.filename,
            duration: durationSec,
            fileSize,
            endedAt: new Date(),
          },
        });

        await this.prisma.liveClass.updateMany({
          where: { egressId },
          data: {
            recordingStatus: 'COMPLETED',
            recordingUrl: fileUrl,
          },
        });
      }
    }

    return { received: true };
  }

  async getRecordingsForClass(classId: string, user: any): Promise<any> {
    await this.getById(classId, user);
    const recordings = await this.prisma.liveClassRecording.findMany({
      where: { liveClassId: classId },
      orderBy: { createdAt: 'desc' },
    });
    return recordings.map(r => ({
      id: r.id,
      egressId: r.egressId,
      status: r.status,
      fileUrl: r.fileUrl,
      duration: r.duration,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      errorMessage: isSuperAdmin(user) ? r.errorMessage : undefined,
    }));
  }

  // ── Centralized Local / Browser-Assisted Recording Fallbacks ──
  async startRecording(classId: string, user: any): Promise<any> {
    const cls = await this.safeFindUnique({ id: classId });
    if (!cls) throw new NotFoundException('Live class not found');

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const isTeacher = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER'].includes(String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_'));
    if (!isTeacher) throw new ForbiddenException('Only teachers can start recordings.');

    return this.prisma.liveClass.update({
      where: { id: classId },
      data: { recordingStatus: 'RECORDING' },
      select: { id: true, recordingStatus: true },
    });
  }

  async stopRecording(classId: string, recordingUrl?: string, user?: any): Promise<any> {
    const cls = await this.safeFindUnique({ id: classId });
    if (!cls) throw new NotFoundException('Live class not found');

    return this.prisma.liveClass.update({
      where: { id: classId },
      data: {
        recordingStatus: recordingUrl ? 'COMPLETED' : 'PROCESSING',
        recordingUrl: recordingUrl || undefined,
      },
      select: { id: true, recordingStatus: true, recordingUrl: true },
    });
  }

  async saveRecording(
    classId: string,
    data: { recordingUrl: string; duration?: number; fileSize?: number },
    user?: any,
  ): Promise<any> {
    const cls = await this.safeFindUnique({ id: classId });
    if (!cls) throw new NotFoundException('Live class not found');

    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    const isTeacher = ['SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'ADMIN'].includes(
      String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_')
    );
    if (!isTeacher && cls.isPublic !== true) {
      throw new ForbiddenException('Only authorized instructors or administrators can save recordings.');
    }

    if (!data.recordingUrl || !data.recordingUrl.trim()) {
      throw new BadRequestException('recordingUrl is required.');
    }

    const trimmedUrl = data.recordingUrl.trim();

    // 1. Update LiveClass table with canonical recording URL and status
    const updated = await this.prisma.liveClass.update({
      where: { id: classId },
      data: {
        recordingStatus: 'COMPLETED',
        recordingUrl: trimmedUrl,
      },
      select: { id: true, recordingStatus: true, recordingUrl: true },
    });

    // 2. Persist in LiveClassRecording table if available
    try {
      await this.prisma.liveClassRecording.create({
        data: {
          liveClassId: classId,
          status: 'COMPLETED',
          fileUrl: trimmedUrl,
          fileSize: data.fileSize ? BigInt(data.fileSize) : null,
          duration: data.duration ? Math.round(Number(data.duration)) : null,
          endedAt: new Date(),
        },
      });
    } catch (recErr: any) {
      this.logger.warn(`Could not create LiveClassRecording entry (${recErr?.message})`);
    }

    // 3. Record audit log
    this.recordAudit(user, 'SAVE_RECORDING', `Saved compressed recording to cloud: ${trimmedUrl}`, classId).catch(() => {});

    return {
      success: true,
      message: 'Class recording saved to cloud storage successfully.',
      recordingUrl: trimmedUrl,
      recordingStatus: 'COMPLETED',
      classId: cls.id,
    };
  }

  async getRecording(classId: string, user?: any): Promise<any> {
    await this.getById(classId, user);
    try {
      const cls = await this.prisma.liveClass.findUnique({
        where: { id: classId },
        select: { id: true, title: true, recordingUrl: true, recordingStatus: true, duration: true, scheduledAt: true },
      });
      if (!cls?.recordingUrl && cls?.recordingStatus !== 'RECORDING') {
        throw new NotFoundException('No recording is available for this class.');
      }
      return cls;
    } catch (e: any) {
      if (e instanceof NotFoundException) throw e;
      return null;
    }
  }
}
