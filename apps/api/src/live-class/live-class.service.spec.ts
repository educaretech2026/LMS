import { Test, TestingModule } from '@nestjs/testing';
import { LiveClassService } from './live-class.service';
import { PrismaService } from '../database/prisma.service';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

const LiveClassStatus = {
  SCHEDULED: 'SCHEDULED',
  LIVE: 'LIVE',
  ENDED: 'ENDED',
} as const;

describe('LiveClassService - Production Hardening & Security Audit Verification', () => {
  let service: LiveClassService;
  let prisma: any;

  const mockLiveClass = {
    id: 'class-123',
    title: 'Physics Mechanics Masterclass',
    subject: 'Physics',
    teacherName: 'Prof. Sharma',
    teacherId: 'teacher-456',
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

  beforeEach(async () => {
    prisma = {
      liveClass: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      liveClassRegistration: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
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
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveClassService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<LiveClassService>(LiveClassService);
    process.env.LIVEKIT_API_KEY = 'test_api_key';
    process.env.LIVEKIT_API_SECRET = 'test_api_secret_123456789012345678901234567890';
    process.env.LIVEKIT_WS_URL = 'wss://livekit.educare.test';
  });

  describe('A. Student Room Authorization & Schedule Window', () => {
    it('allows enrolled student to obtain token within the 15-minute start window', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        userId: 'user-stud-1',
        centreId: 'centre-alpha',
        standardId: 'std-1',
        enrollments: [
          {
            id: 'enr-1',
            centreId: 'centre-alpha',
            batch: {
              id: 'batch-1',
              centreId: 'centre-alpha',
              standardId: 'std-1',
              boardId: 'board-1',
            },
          },
        ],
      });

      const userSession = {
        id: 'user-stud-1',
        email: 'rahul@student.in',
        role: { name: 'STUDENT' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const tokenRes = await service.generateLiveKitToken(
        'class-123',
        userSession,
        'STUDENT',
        'user-stud-1',
        'Rahul Verma'
      );

      expect(tokenRes).toBeDefined();
      expect(tokenRes.token).toBeDefined();
      expect(tokenRes.wsUrl).toBe('wss://livekit.educare.test');
      expect(prisma.studentProfile.findUnique).toHaveBeenCalled();
    });

    it('rejects student attempting to join hours before permitted schedule window', async () => {
      const futureClass = {
        ...mockLiveClass,
        scheduledAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      };
      prisma.liveClass.findUnique.mockResolvedValue(futureClass);
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        userId: 'user-stud-1',
        centreId: 'centre-alpha',
        enrollments: [
          {
            centreId: 'centre-alpha',
            batch: {
              centreId: 'centre-alpha',
              standardId: 'std-1',
              boardId: 'board-1',
            },
          },
        ],
      });

      const userSession = {
        id: 'user-stud-1',
        email: 'rahul@student.in',
        role: { name: 'STUDENT' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      await expect(
        service.generateLiveKitToken(
          'class-123',
          userSession,
          'STUDENT',
          'user-stud-1',
          'Rahul Verma'
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects student from a different centre / unenrolled batch', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);
      // Student has no profile or is in centre-beta
      prisma.studentProfile.findUnique.mockResolvedValue(null);

      const userSession = {
        id: 'user-intruder',
        email: 'intruder@other.in',
        role: { name: 'STUDENT' },
        userCentres: [{ centreId: 'centre-beta' }],
      };

      await expect(
        service.generateLiveKitToken(
          'class-123',
          userSession,
          'STUDENT',
          'user-intruder',
          'Intruder'
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents student from claiming teacher role in query parameter', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);
      prisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        userId: 'user-stud-1',
        centreId: 'centre-alpha',
        enrollments: [
          {
            centreId: 'centre-alpha',
            batch: {
              centreId: 'centre-alpha',
              standardId: 'std-1',
              boardId: 'board-1',
            },
          },
        ],
      });

      const userSession = {
        id: 'user-stud-1',
        email: 'rahul@student.in',
        role: { name: 'STUDENT' }, // Session role is strictly STUDENT
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      // Client attempts clientRole: 'TEACHER'
      const tokenRes = await service.generateLiveKitToken(
        'class-123',
        userSession,
        'TEACHER',
        'user-stud-1',
        'Rahul Verma'
      );

      // Token is issued with student permissions (derived from userSession, not clientRole)
      expect(tokenRes.token).toBeDefined();
      expect(tokenRes.isHost).toBe(false);
    });
  });

  describe('B. Teacher Class Assignment & Centre Isolation', () => {
    it('allows assigned teacher to join and start class', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const teacherSession = {
        id: 'teacher-456',
        email: 'sharma@educare.in',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const tokenRes = await service.generateLiveKitToken(
        'class-123',
        teacherSession,
        'TEACHER',
        'teacher-456',
        'Prof. Sharma'
      );

      expect(tokenRes).toBeDefined();
      expect(tokenRes.token).toBeDefined();
      expect(tokenRes.isHost).toBe(true);
    });

    it('rejects a teacher trying to hijack another teacher class in a foreign centre', async () => {
      prisma.liveClass.findUnique.mockResolvedValue({
        ...mockLiveClass,
        centreId: 'centre-gamma',
        teacherId: 'teacher-other',
      });

      const foreignTeacher = {
        id: 'teacher-foreign',
        email: 'foreign@educare.in',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }], // Only authorized for centre-alpha
      };

      await expect(
        service.generateLiveKitToken(
          'class-123',
          foreignTeacher,
          'TEACHER',
          'teacher-foreign',
          'Prof. Foreign'
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('C. Public Webinar Registration & Gate Protection', () => {
    const mockWebinar = {
      ...mockLiveClass,
      id: 'webinar-999',
      isPublic: true,
      roomId: 'edumeet-public-999',
    };

    it('registers attendee and returns secure registrationToken', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockWebinar);
      prisma.liveClassRegistration.upsert.mockResolvedValue({
        id: 'reg-1',
        liveClassId: 'webinar-999',
        name: 'Ananya Roy',
        email: 'ananya@gmail.com',
        phone: '9876543210',
        registrationToken: 'cryptotoken-123456789012345678901234567890',
      });

      const res = await service.registerAttendee('webinar-999', {
        name: 'Ananya Roy',
        email: 'ananya@gmail.com',
        phone: '9876543210',
        organization: 'Apex College',
      });

      expect(res.success).toBe(true);
      expect(res.meetUrl).toBe('edumeet-public-999');
      expect(res.registrationToken).toBeDefined();
      expect(res.registrationToken?.length).toBeGreaterThanOrEqual(32);
    });

    it('rejects public token request when registrationToken is absent or invalid', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockWebinar);
      prisma.liveClassRegistration.findUnique.mockResolvedValue(null);
      prisma.liveClassRegistration.findFirst.mockResolvedValue(null);

      await expect(
        service.generatePublicLiveKitToken(
          'webinar-999',
          'fake-invalid-token',
          'sneaky@visitor.in',
          'Sneaky Visitor'
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('grants public token when valid registrationToken is provided', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockWebinar);
      prisma.liveClassRegistration.findFirst.mockResolvedValue({
        id: 'reg-valid',
        liveClassId: 'webinar-999',
        name: 'Ananya Roy',
        email: 'ananya@gmail.com',
        registrationToken: 'valid-crypto-token-abc',
      });

      const tokenRes = await service.generatePublicLiveKitToken(
        'webinar-999',
        'valid-crypto-token-abc',
        'ananya@gmail.com',
        'Ananya Roy'
      );

      expect(tokenRes).toBeDefined();
      expect(tokenRes.token).toBeDefined();
      expect(tokenRes.wsUrl).toBe('wss://livekit.educare.test');
    });
  });

  describe('D. Attendee PII Masking & Center Scoping', () => {
    it('masks phone numbers and emails for non-superadmin centre staff', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);
      prisma.liveClassRegistration.findMany.mockResolvedValue([
        {
          id: 'reg-1',
          name: 'Deepak Patel',
          email: 'deepak.patel@gmail.com',
          phone: '+91 9876543210',
          organization: 'St. Xavier',
          registeredAt: new Date(),
        },
      ]);

      const centreAdminSession = {
        id: 'admin-centre',
        role: { name: 'CENTRE_ADMIN' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const res = await service.getRegistrations('class-123', centreAdminSession);

      expect(res.registrations.length).toBe(1);
      // Email should be masked
      expect(res.registrations[0].email).toMatch(/^[a-z0-9]+\*{3}/);
      // Phone should be masked: ending with last 4 digits
      expect(res.registrations[0].phone).toContain('****');
    });

    it('keeps unmasked data for SUPER_ADMIN', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);
      prisma.liveClassRegistration.findMany.mockResolvedValue([
        {
          id: 'reg-1',
          name: 'Deepak Patel',
          email: 'deepak.patel@gmail.com',
          phone: '+91 9876543210',
          organization: 'St. Xavier',
          registeredAt: new Date(),
        },
      ]);

      const superAdminSession = {
        id: 'super-admin',
        role: { name: 'SUPER_ADMIN' },
      };

      const res = await service.getRegistrations('class-123', superAdminSession);

      expect(res.registrations.length).toBe(1);
      expect(res.registrations[0].email).toBe('deepak.patel@gmail.com');
      expect(res.registrations[0].phone).toBe('+91 9876543210');
    });
  });

  describe('E. Server-Side Classroom Moderation', () => {
    it('rejects student attempting to issue moderation action', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const studentSession = {
        id: 'student-1',
        role: { name: 'STUDENT' },
      };

      await expect(
        service.moderateParticipant('class-123', 'MUTE_ALL', undefined, undefined, true, studentSession)
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects invalid moderation action from teacher', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const teacherSession = {
        id: 'teacher-456',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      await expect(
        service.moderateParticipant('class-123', 'INVALID_ACTION' as any, undefined, undefined, true, teacherSession)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('F. Persistent Whiteboard Snapshot & Late Joiners', () => {
    it('persists whiteboard snapshot when authorized teacher saves it', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);
      prisma.liveClass.update.mockResolvedValue({
        id: 'class-123',
        updatedAt: new Date(),
      });

      const teacherSession = {
        id: 'teacher-456',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      const res = await service.saveWhiteboardSnapshot(
        'class-123',
        { shapes: [{ id: 'shape-1', type: 'draw' }] },
        teacherSession
      );

      expect(res.id).toBe('class-123');
      expect(prisma.liveClass.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'class-123' },
          data: { whiteboardData: { shapes: [{ id: 'shape-1', type: 'draw' }] } },
        })
      );
    });

    it('rejects student attempting to overwrite persistent whiteboard snapshot', async () => {
      prisma.liveClass.findUnique.mockResolvedValue(mockLiveClass);

      const studentSession = {
        id: 'student-1',
        role: { name: 'STUDENT' },
      };

      await expect(
        service.saveWhiteboardSnapshot('class-123', { shapes: [] }, studentSession)
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
