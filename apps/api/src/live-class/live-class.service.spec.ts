import { Test, TestingModule } from '@nestjs/testing';
import { LiveClassService } from './live-class.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';

const LiveClassStatus = {
  SCHEDULED: 'SCHEDULED',
  LIVE: 'LIVE',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
} as const;

describe('LiveClassService - Final Security Remediation & Production Verification', () => {
  let service: LiveClassService;
  let prisma: any;
  let mockRedis: any;
  let mockStorage: any;

  const mockLiveClass = {
    id: 'class-123',
    title: 'Physics Mechanics Masterclass',
    subject: 'Physics',
    teacherName: 'Prof. Sharma',
    teacherId: 'teacher-456',
    substituteTeacherId: 'substitute-789',
    scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // starts in 5 minutes
    duration: 60,
    roomId: 'edumeet-physics-123',
    deliveryProvider: 'LIVEKIT',
    externalMeetingUrl: null,
    isPublic: false,
    boardId: 'board-1',
    standardId: 'std-1',
    centreId: 'centre-alpha',
    status: LiveClassStatus.SCHEDULED,
    whiteboardData: null,
  };

  const mockPublicWebinar = {
    id: 'webinar-999',
    title: 'Careers in AI & Engineering',
    subject: 'Career Guidance',
    teacherName: 'Dr. Anand',
    teacherId: 'teacher-999',
    substituteTeacherId: null,
    scheduledAt: new Date(Date.now() + 5 * 60 * 1000),
    duration: 90,
    roomId: 'edumeet-webinar-999',
    deliveryProvider: 'LIVEKIT',
    isPublic: true,
    centreId: null,
    status: LiveClassStatus.SCHEDULED,
    whiteboardData: null,
  };

  beforeEach(async () => {
    prisma = {
      liveClass: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      liveClassRegistration: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      liveClassRecording: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      liveClassMessage: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      liveClassFile: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      studentProfile: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      notice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    mockRedis = {
      isConnected: true,
      getRaw: jest.fn().mockResolvedValue(null),
      setRaw: jest.fn().mockResolvedValue(undefined),
      delRaw: jest.fn().mockResolvedValue(undefined),
    };

    mockStorage = {
      getConfig: jest.fn().mockReturnValue({
        isConfigured: true,
        accountId: 'test-cf-acc',
        accessKeyId: 'test-r2-key',
        secretAccessKey: 'test-r2-secret',
        bucketName: 'educare-recordings',
        publicUrl: 'https://cdn.educare.test',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveClassService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get<LiveClassService>(LiveClassService);

    jest.spyOn(service, 'getRoomService').mockReturnValue({
      getParticipant: jest.fn().mockResolvedValue({ tracks: [] }),
      listParticipants: jest.fn().mockResolvedValue([]),
      mutePublishedTrack: jest.fn().mockResolvedValue({}),
      updateParticipant: jest.fn().mockResolvedValue({}),
      removeParticipant: jest.fn().mockResolvedValue({}),
    } as any);

    jest.spyOn(service, 'getEgressClient').mockReturnValue({
      startRoomCompositeEgress: jest.fn().mockResolvedValue({ egressId: 'EG_test_12345' }),
      stopEgress: jest.fn().mockResolvedValue({ egressId: 'EG_test_12345' }),
    } as any);

    process.env.LIVEKIT_API_KEY = 'test_api_key';
    process.env.LIVEKIT_API_SECRET = 'test_api_secret_123456789012345678901234567890';
    process.env.LIVEKIT_WS_URL = 'wss://livekit.educare.test';
  });

  /* ─────────────────────────────────────────────────────────────
   * 1. P0: Public Webinar Registration & Cryptographic Token Gating
   * ───────────────────────────────────────────────────────────── */
  describe('P0: Public Webinar Registration & Token Gating', () => {
    it('generates a cryptographic token and stores its SHA-256 hash upon registration', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockPublicWebinar);
      prisma.liveClassRegistration.upsert.mockImplementation((args: any) => {
        return Promise.resolve({
          id: 'reg-new-1',
          ...args.create,
        });
      });

      const res = await service.registerAttendee('webinar-999', {
        name: 'Aarav Nair',
        email: 'aarav@example.com',
        phone: '+91 9876543210',
        organization: 'IIT Madras',
      });

      expect(res.success).toBe(true);
      expect(res.registrationToken).toMatch(/^reg_[a-f0-9]{48}$/);

      // Verify that database stored the hashed token, not the plaintext
      const upsertCall = prisma.liveClassRegistration.upsert.mock.calls[0][0];
      const expectedHash = crypto.createHash('sha256').update(res.registrationToken!).digest('hex');
      expect(upsertCall.create.registrationToken).toBe(expectedHash);
    });

    it('NEGATIVE: rejects public join attempt without registration token (email-only fails)', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockPublicWebinar);

      await expect(
        service.generatePublicLiveKitToken('webinar-999', undefined, 'victim@example.com', 'Victim')
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.generatePublicLiveKitToken('webinar-999', '', 'victim@example.com', 'Victim')
      ).rejects.toThrow(ForbiddenException);
    });

    it('NEGATIVE: rejects invalid / non-existent registration token', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockPublicWebinar);
      prisma.liveClassRegistration.findFirst.mockResolvedValue(null);

      await expect(
        service.generatePublicLiveKitToken('webinar-999', 'reg_nonexistent_token_123')
      ).rejects.toThrow(ForbiddenException);
    });

    it('NEGATIVE: rejects valid credential that belongs to a different webinar', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockPublicWebinar);
      // findFirst returns null because liveClassId does not match
      prisma.liveClassRegistration.findFirst.mockResolvedValue(null);

      await expect(
        service.generatePublicLiveKitToken('webinar-999', 'reg_token_from_other_class')
      ).rejects.toThrow(ForbiddenException);
    });

    it('NEGATIVE: rejects revoked or cancelled registration credentials', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockPublicWebinar);
      prisma.liveClassRegistration.findFirst.mockResolvedValue({
        id: 'reg-revoked-1',
        liveClassId: 'webinar-999',
        status: 'REVOKED',
        registrationToken: 'hashed_token',
      });

      await expect(
        service.generatePublicLiveKitToken('webinar-999', 'reg_some_revoked_token')
      ).rejects.toThrow(ForbiddenException);
    });

    it('POSITIVE: succeeds when valid registration credential matches SHA-256 hash in DB', async () => {
      const rawToken = 'reg_valid_credential_1234567890abcdef1234567890abcdef';
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      prisma.liveClass.findUnique.mockResolvedValue(mockPublicWebinar);
      prisma.liveClassRegistration.findFirst.mockResolvedValue({
        id: 'reg-valid-1',
        liveClassId: 'webinar-999',
        name: 'Aarav Nair',
        status: 'REGISTERED',
        registrationToken: hashedToken,
      });

      const res = await service.generatePublicLiveKitToken('webinar-999', rawToken, undefined, 'Aarav Nair');
      expect(res).toBeDefined();
      expect(res.token).toBeDefined();
      expect(res.roomName).toBe('edumeet-webinar-999');
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * 2. P0: Class Scheduling Boundaries & Expired Sessions
   * ───────────────────────────────────────────────────────────── */
  describe('P0: Class Scheduling Boundaries & Expired Sessions', () => {
    it('NEGATIVE: rejects joining a class 2 hours before scheduled start (too early)', async () => {
      const futureClass = {
        ...mockLiveClass,
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours in future
      };
      prisma.liveClass.findUnique.mockResolvedValue(futureClass);

      const studentSession = {
        id: 'stud-1',
        role: { name: 'STUDENT' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      await expect(
        service.generateLiveKitToken('class-123', studentSession, 'STUDENT')
      ).rejects.toThrow(BadRequestException);
    });

    it('POSITIVE: allows student at exactly 15 minutes before scheduled start', async () => {
      const boundaryClass = {
        ...mockLiveClass,
        scheduledAt: new Date(Date.now() + 14 * 60 * 1000), // within 15 min window
      };
      prisma.liveClass.findUnique.mockResolvedValue(boundaryClass);
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        userId: 'stud-1',
        enrollments: [{ batch: { centreId: 'centre-alpha', standardId: 'std-1', boardId: 'board-1' } }],
      });

      const studentSession = {
        id: 'stud-1',
        role: { name: 'STUDENT' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const res = await service.generateLiveKitToken('class-123', studentSession, 'STUDENT');
      expect(res.token).toBeDefined();
    });

    it('POSITIVE: allows teacher host 25 minutes before start (within 30m prep window)', async () => {
      const teacherPrepClass = {
        ...mockLiveClass,
        scheduledAt: new Date(Date.now() + 25 * 60 * 1000), // 25 mins in future
      };
      prisma.liveClass.findUnique.mockResolvedValue(teacherPrepClass);

      const teacherSession = {
        id: 'teacher-456',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const res = await service.generateLiveKitToken('class-123', teacherSession, 'TEACHER');
      expect(res.token).toBeDefined();
      expect(res.isHost).toBe(true);
    });

    it('NEGATIVE: rejects past expired class even if its database status is SCHEDULED or LIVE', async () => {
      const expiredPastClass = {
        ...mockLiveClass,
        scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        duration: 60,
        status: LiveClassStatus.SCHEDULED, // Un-updated status defect in DB
      };
      prisma.liveClass.findUnique.mockResolvedValue(expiredPastClass);

      const teacherSession = {
        id: 'teacher-456',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      await expect(
        service.generateLiveKitToken('class-123', teacherSession, 'TEACHER')
      ).rejects.toThrow(BadRequestException);
    });

    it('NEGATIVE: rejects joining a class explicitly marked ENDED or CANCELLED', async () => {
      const endedClass = { ...mockLiveClass, status: LiveClassStatus.ENDED };
      prisma.liveClass.findUnique.mockResolvedValue(endedClass);

      await expect(
        service.generateLiveKitToken('class-123', { id: 'teacher-456', role: 'TEACHER' }, 'TEACHER')
      ).rejects.toThrow(BadRequestException);

      const cancelledClass = { ...mockLiveClass, status: LiveClassStatus.CANCELLED };
      prisma.liveClass.findUnique.mockResolvedValue(cancelledClass);

      await expect(
        service.generateLiveKitToken('class-123', { id: 'teacher-456', role: 'TEACHER' }, 'TEACHER')
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * 3. P1: Teacher Substitution Authorization
   * ───────────────────────────────────────────────────────────── */
  describe('P1: Teacher Substitution Authorization', () => {
    it('allows assigned teacher to host class', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const assignedSession = {
        id: 'teacher-456', // Matches mockLiveClass.teacherId
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const res = await service.generateLiveKitToken('class-123', assignedSession, 'TEACHER');
      expect(res.isHost).toBe(true);
    });

    it('allows designated substitute teacher to host class', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const substituteSession = {
        id: 'substitute-789', // Matches mockLiveClass.substituteTeacherId
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const res = await service.generateLiveKitToken('class-123', substituteSession, 'TEACHER');
      expect(res.isHost).toBe(true);
    });

    it('NEGATIVE: rejects unrelated teacher from same centre attempting to host', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const unrelatedTeacherSession = {
        id: 'teacher-intruder-007', // Different teacher
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }], // Same centre!
      };

      await expect(
        service.generateLiveKitToken('class-123', unrelatedTeacherSession, 'TEACHER')
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows CENTRE_ADMIN of the class centre to host', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const centreAdminSession = {
        id: 'admin-1',
        role: { name: 'CENTRE_ADMIN' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const res = await service.generateLiveKitToken('class-123', centreAdminSession, 'CENTRE_ADMIN');
      expect(res.isHost).toBe(true);
    });

    it('NEGATIVE: rejects CENTRE_ADMIN from a different centre', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const foreignAdminSession = {
        id: 'admin-beta',
        role: { name: 'CENTRE_ADMIN' },
        userCentres: [{ centreId: 'centre-beta' }], // Different centre!
      };

      await expect(
        service.generateLiveKitToken('class-123', foreignAdminSession, 'CENTRE_ADMIN')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * 4. P1: Authoritative Moderation & Persistent Blacklisting
   * ───────────────────────────────────────────────────────────── */
  describe('P1: Authoritative Moderation & Persistent Blacklisting', () => {
    it('sets persistent muted state and restricts SFU permissions when moderator mutes student', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const teacherSession = {
        id: 'teacher-456',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const res = await service.moderateParticipant('class-123', 'MUTE_STUDENT', 'user_stud-1', undefined, true, teacherSession);
      expect(res.success).toBe(true);

      // Verify moderation state is maintained
      const isMuted = await service.isParticipantMuted('class-123', 'user_stud-1');
      expect(isMuted).toBe(true);
    });

    it('enforces persistent mute upon student reconnection / token generation', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        userId: 'stud-1',
        enrollments: [{ batch: { centreId: 'centre-alpha', standardId: 'std-1', boardId: 'board-1' } }],
      });

      // Mute student in persistence
      await service.setModerationState('class-123', 'user_stud-1', { mutedAudio: true });

      const studentSession = {
        id: 'stud-1',
        role: { name: 'STUDENT' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const tokenRes = await service.generateLiveKitToken('class-123', studentSession, 'STUDENT');
      expect(tokenRes.token).toBeDefined();

      // Decode token claims to verify audio publishing is denied
      const payloadBase64 = tokenRes.token.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
      expect(payload.video.canPublish).toBe(false);
      expect(JSON.parse(payload.metadata).isMutedByHost).toBe(true);
    });

    it('blacklists kicked participant and rejects reconnection attempts', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const teacherSession = {
        id: 'teacher-456',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      // Moderator kicks participant
      await service.moderateParticipant('class-123', 'REMOVE_PARTICIPANT', 'user_stud-1', undefined, true, teacherSession);

      const isKicked = await service.isParticipantKicked('class-123', 'user_stud-1');
      expect(isKicked).toBe(true);

      // Reconnection attempt must fail
      const studentSession = {
        id: 'stud-1',
        role: { name: 'STUDENT' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      await expect(
        service.generateLiveKitToken('class-123', studentSession, 'STUDENT')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * 5. P2: Server-Side Recording Pipeline (LiveKit Egress)
   * ───────────────────────────────────────────────────────────── */
  describe('P2: Server-Side Recording Pipeline (LiveKit Egress)', () => {
    it('starts server-side egress recording when authorized teacher requests it', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);
      prisma.liveClassRecording.create.mockResolvedValue({
        id: 'rec-1',
        liveClassId: 'class-123',
        egressId: 'EG_test_12345',
        status: 'RECORDING',
      });
      prisma.liveClass.update.mockResolvedValue(mockLiveClass);

      const teacherSession = {
        id: 'teacher-456',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const res = await service.startServerRecording('class-123', teacherSession);
      expect(res.success).toBe(true);
      expect(res.egressId).toBe('EG_test_12345');
      expect(res.status).toBe('RECORDING');
      expect(prisma.liveClassRecording.create).toHaveBeenCalled();
    });

    it('NEGATIVE: rejects recording startup when caller is a student', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const studentSession = {
        id: 'stud-1',
        role: { name: 'STUDENT' },
      };

      await expect(
        service.startServerRecording('class-123', studentSession)
      ).rejects.toThrow(ForbiddenException);
    });

    it('POS: saves compressed cloud recording and marks class recording as COMPLETED', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);
      prisma.liveClass.update.mockResolvedValue({
        ...mockLiveClass,
        recordingUrl: 'https://r2.example.com/recordings/test.mp4',
        recordingStatus: 'COMPLETED',
      });
      prisma.liveClassRecording.create.mockResolvedValue({
        id: 'rec-1',
        liveClassId: 'class-123',
        recordingUrl: 'https://r2.example.com/recordings/test.mp4',
        status: 'COMPLETED',
      });

      const teacherSession = {
        id: 'teacher-456',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-1' }],
      };

      const res = await service.saveRecording('class-123', {
        recordingUrl: 'https://r2.example.com/recordings/test.mp4',
        duration: 120,
        fileSize: 1048576,
      }, teacherSession);

      expect(res.recordingUrl).toBe('https://r2.example.com/recordings/test.mp4');
      expect(res.recordingStatus).toBe('COMPLETED');
      expect(prisma.liveClass.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'class-123' },
          data: expect.objectContaining({
            recordingUrl: 'https://r2.example.com/recordings/test.mp4',
            recordingStatus: 'COMPLETED',
          }),
        })
      );
    });

    it('NEGATIVE: rejects saveRecording when caller is a student', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const studentSession = {
        id: 'stud-1',
        role: { name: 'STUDENT' },
      };

      await expect(
        service.saveRecording('class-123', {
          recordingUrl: 'https://r2.example.com/recordings/test.mp4',
        }, studentSession)
      ).rejects.toThrow(ForbiddenException);
    });

    it('POS: allows teacher to release recording to students', async () => {
      const recordedClass = {
        ...mockLiveClass,
        recordingUrl: 'https://r2.example.com/recordings/test.mp4',
        recordingStatus: 'COMPLETED',
        isRecordingReleased: false,
      };
      prisma.liveClass.findUnique.mockResolvedValue(recordedClass);
      prisma.liveClass.update.mockResolvedValue({
        ...recordedClass,
        isRecordingReleased: true,
      });

      const teacherSession = {
        id: 'teacher-456',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-1' }],
      };

      const res = await service.releaseRecording('class-123', true, teacherSession);
      expect(res.success).toBe(true);
      expect(res.isRecordingReleased).toBe(true);
      expect(prisma.liveClass.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'class-123' },
          data: { isRecordingReleased: true },
        })
      );
    });

    it('NEGATIVE: rejects student attempting to release recording', async () => {
      prisma.liveClass.findUnique.mockResolvedValue({
        ...mockLiveClass,
        recordingUrl: 'https://r2.example.com/recordings/test.mp4',
      });

      const studentSession = {
        id: 'stud-1',
        role: { name: 'STUDENT' },
      };

      await expect(
        service.releaseRecording('class-123', true, studentSession)
      ).rejects.toThrow(ForbiddenException);
    });

    it('SEC: masks recordingUrl for student when recording is not yet released', async () => {
      const unreleasedClass = {
        ...mockLiveClass,
        recordingUrl: 'https://r2.example.com/recordings/secret.mp4',
        recordingStatus: 'COMPLETED',
        isRecordingReleased: false,
      };

      const studentSession = {
        id: 'stud-1',
        role: { name: 'STUDENT' },
      };

      const sanitized = service.sanitizeForLearner(unreleasedClass, studentSession);
      expect(sanitized.recordingUrl).toBeNull();
      expect(sanitized.recordingStatus).toBe('UNRELEASED');
    });

    it('SEC: reveals recordingUrl for student when recording has been released', async () => {
      const releasedClass = {
        ...mockLiveClass,
        recordingUrl: 'https://r2.example.com/recordings/released.mp4',
        recordingStatus: 'COMPLETED',
        isRecordingReleased: true,
      };

      const studentSession = {
        id: 'stud-1',
        role: { name: 'STUDENT' },
      };

      const sanitized = service.sanitizeForLearner(releasedClass, studentSession);
      expect(sanitized.recordingUrl).toBe('https://r2.example.com/recordings/released.mp4');
      expect(sanitized.recordingStatus).toBe('COMPLETED');
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * 6. P0: Resilience & Zero-Downtime Database Migration Tolerance
   * ───────────────────────────────────────────────────────────── */
  describe('P0: Resilience & Zero-Downtime Database Migration Tolerance', () => {
    it('gracefully falls back to SAFE_LIVE_CLASS_SELECT when unmigrated columns throw column does not exist', async () => {
      // First call (with include) simulates PostgreSQL error 42703 (column live_classes.substituteTeacherId does not exist)
      prisma.liveClass.findMany
        .mockRejectedValueOnce(new Error('column live_classes.substituteTeacherId does not exist'))
        .mockResolvedValueOnce([mockLiveClass]);

      const adminSession = {
        id: 'admin-1',
        role: { name: 'SUPER_ADMIN' },
      };

      const classes = await service.getAll(adminSession);
      expect(classes).toHaveLength(1);
      expect(classes[0].id).toBe('class-123');
      expect(prisma.liveClass.findMany).toHaveBeenCalledTimes(2);
    });

    it('handles teacher without centre assignments safely without throwing 500 error', async () => {
      prisma.liveClass.findMany.mockResolvedValue([mockLiveClass]);

      const teacherWithoutCentres = {
        id: 'teacher-456',
        role: { name: 'TEACHER' },
        userCentres: [], // No centre assignments yet
      };

      const classes = await service.getAll(teacherWithoutCentres);
      expect(Array.isArray(classes)).toBe(true);
    });

    it('getStats returns { total: 0, live: 0 } resiliently even if count query encounters error', async () => {
      prisma.liveClass.count.mockRejectedValue(new Error('Database connection failed'));

      const adminSession = {
        id: 'admin-1',
        role: { name: 'SUPER_ADMIN' },
      };

      const stats = await service.getStats(adminSession);
      expect(stats).toEqual({ total: 0, live: 0 });
    });

    it('create gracefully falls back to SAFE_LIVE_CLASS_SELECT and baseline columns when unmigrated columns throw', async () => {
      // Tier 1 fails (unmigrated returning columns like substituteTeacherId)
      // Tier 2 fails (unmigrated insert columns like deliveryProvider)
      // Tier 3 succeeds with baseline columns
      prisma.liveClass.create
        .mockRejectedValueOnce(new Error('column live_classes.substituteTeacherId does not exist'))
        .mockRejectedValueOnce(new Error('column "deliveryProvider" of relation "live_classes" does not exist'))
        .mockResolvedValueOnce(mockLiveClass);

      const created = await service.create({
        title: 'Crash Course Physics',
        subject: 'Physics',
        teacherName: 'Dr. Anand',
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        duration: 60,
      }, { id: 'admin-1', role: { name: 'SUPER_ADMIN' } });

      expect(created).toBeDefined();
      expect(created.id).toBe('class-123');
      expect(prisma.liveClass.create).toHaveBeenCalledTimes(3);
    });

    it('create translates foreign key constraint violation (P2003) into BadRequestException', async () => {
      const p2003Err: any = new Error('Foreign key constraint failed on the field: `standardId`');
      p2003Err.code = 'P2003';
      p2003Err.meta = { field_name: 'standardId' };
      prisma.liveClass.create.mockRejectedValue(p2003Err);

      await expect(
        service.create({
          title: 'Chemistry 101',
          subject: 'Chemistry',
          teacherName: 'Prof. Miller',
          scheduledAt: new Date(Date.now() + 3600000).toISOString(),
          duration: 45,
          standardId: 'non-existent-standard-id',
        }, { id: 'admin-1', role: { name: 'SUPER_ADMIN' } })
      ).rejects.toThrow(BadRequestException);
    });

    it('create allows teacher to create a public webinar without throwing centre isolation error', async () => {
      prisma.liveClass.create.mockResolvedValue({
        ...mockPublicWebinar,
        id: 'webinar-new',
      });

      const teacherSession = {
        id: 'teacher-456',
        role: { name: 'TEACHER' },
        userCentres: [], // Empty centre assignments
      };

      const result = await service.create({
        title: 'Global NEET Orientation',
        subject: 'Orientation',
        teacherName: 'Dr. Anand',
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        duration: 90,
        isPublic: true,
      }, teacherSession);

      expect(result).toBeDefined();
      expect(result.id).toBe('webinar-new');
    });
  });
});
