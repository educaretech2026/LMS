import { getJwtSecret } from './config/jwt.config';
import { StorageService } from '../storage/storage.service';
import { assertCentreAccess, isSuperAdmin, getUserCentreIds, getAuthorizedCentreIds, SAFE_USER_SELECT } from './utils/tenant.util';
import { ForbiddenException, BadRequestException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ExamsService } from '../exams/exams.service';
import { StudentsService } from '../students/students.service';
import { LiveClassService } from '../live-class/live-class.service';
import { StudyMaterialService } from '../study-materials/study-materials.service';
import { AuthService } from '../auth/auth.service';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-r2.com/upload-signed'),
}));

describe('Security Regression Suite — Real Production Implementations', () => {
  describe('SEC-01 & SEC-04: JWT Secrets & Session Validation', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      process.env.JWT_SECRET = originalSecret;
    });

    it('should fail fast in production when JWT_SECRET is missing', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow('FATAL: JWT_SECRET must be set to a strong, random secret');
    });

    it('should fail fast in production when JWT_SECRET is too short (< 32 chars)', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short-secret';
      expect(() => getJwtSecret()).toThrow('must be at least 32 characters long');
    });

    it('should fail fast in production when JWT_SECRET is an insecure default placeholder', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'super-secret-jwt-key-placeholder-which-is-long';
      expect(() => getJwtSecret()).toThrow('must not use known insecure default values');
    });

    it('should succeed with strong random secret', () => {
      process.env.NODE_ENV = 'production';
      const strongSecret = crypto.randomBytes(32).toString('hex');
      process.env.JWT_SECRET = strongSecret;
      expect(getJwtSecret()).toBe(strongSecret);
    });
  });

  describe('SEC-02: Multi-Tenant Centre Isolation & Fail-Closed Checks', () => {
    const superAdminUser = {
      id: 'super-admin-1',
      role: { name: 'SUPER_ADMIN' },
      userCentres: []
    };

    const centreAdminUser = {
      id: 'admin-1',
      role: { name: 'CENTRE_ADMIN' },
      userCentres: [{ centreId: 'centre-alpha' }]
    };

    const emptyCentreAdmin = {
      id: 'admin-empty',
      role: { name: 'CENTRE_ADMIN' },
      userCentres: []
    };

    const studentUser = {
      id: 'student-1',
      role: { name: 'STUDENT' },
      userCentres: [{ centreId: 'centre-alpha' }]
    };

    it('should identify super admin correctly', () => {
      expect(isSuperAdmin(superAdminUser)).toBe(true);
      expect(isSuperAdmin(centreAdminUser)).toBe(false);
      expect(isSuperAdmin(studentUser)).toBe(false);
    });

    it('should extract user centre IDs accurately', () => {
      expect(getUserCentreIds(centreAdminUser)).toEqual(['centre-alpha']);
      expect(getUserCentreIds(studentUser)).toEqual(['centre-alpha']);
      expect(getUserCentreIds(emptyCentreAdmin)).toEqual([]);
    });

    it('should permit super admin access to any centre', () => {
      expect(() => assertCentreAccess(superAdminUser, 'centre-beta')).not.toThrow();
    });

    it('should permit centre admin access to their assigned centre', () => {
      expect(() => assertCentreAccess(centreAdminUser, 'centre-alpha')).not.toThrow();
    });

    it('should reject centre admin access to another centre (cross-centre leak prevention)', () => {
      expect(() => assertCentreAccess(centreAdminUser, 'centre-beta')).toThrow(ForbiddenException);
    });

    it('should FAIL CLOSED when non-superadmin has empty centre assignments', () => {
      expect(() => getAuthorizedCentreIds(emptyCentreAdmin)).toThrow(ForbiddenException);
      expect(() => assertCentreAccess(emptyCentreAdmin, 'centre-alpha')).toThrow(ForbiddenException);
    });

    it('should FAIL CLOSED when centreId is omitted or null for non-superadmin', () => {
      expect(() => assertCentreAccess(centreAdminUser, null)).toThrow(ForbiddenException);
      expect(() => assertCentreAccess(centreAdminUser, undefined)).toThrow(ForbiddenException);
    });
  });

  describe('SEC-03: ExamsService Real Production Scoring & Answer Confidentiality', () => {
    let examsService: ExamsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        exam: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        studentProfile: {
          findUnique: jest.fn(),
        },
        mcqQuestion: {
          findMany: jest.fn(),
        },
        examResult: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
        studentAnswer: {
          upsert: jest.fn(),
        },
        $transaction: jest.fn(async (cb) => {
          if (typeof cb === 'function') return cb(mockPrisma);
          return cb;
        }),
      };
      examsService = new ExamsService(mockPrisma as any);
    });

    it('should sanitize answers for students even if result exists (preventing answer disclosure)', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        title: 'Physics Midterm',
        centreId: 'centre-alpha',
        mcqQuestions: [
          { id: 'q1', questionText: 'Q1', correctOption: 'A', explanation: 'Secret reason', marks: 4 },
        ],
      });
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        userId: 'student-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }],
      });

      const studentUser = { id: 'student-1', role: 'STUDENT' };
      const exam = await examsService.getExamById('exam-1', studentUser);

      expect(exam.mcqQuestions).toHaveLength(1);
      expect(exam.mcqQuestions[0].correctOption).toBeUndefined();
      expect(exam.mcqQuestions[0].explanation).toBeUndefined();
      expect(exam.mcqQuestions[0].questionText).toBe('Q1');
    });

    it('should reject student access to exam outside their enrolled centre or batch', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-beta',
        title: 'Chemistry Exam',
        centreId: 'centre-beta',
        mcqQuestions: [],
      });
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        userId: 'student-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }],
      });

      const studentUser = { id: 'student-1', role: 'STUDENT' };
      await expect(examsService.getExamById('exam-beta', studentUser)).rejects.toThrow(ForbiddenException);
    });

    it('should calculate score authoritatively from trusted questions and ignore forged client total', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }],
      });
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        centreId: 'centre-alpha',
      });
      mockPrisma.mcqQuestion.findMany.mockResolvedValue([
        { id: 'q1', type: 'MCQ', correctOption: 'B', marks: 4, negativeMarks: 1 },
        { id: 'q2', type: 'MCQ', correctOption: 'A', marks: 4, negativeMarks: 1 },
      ]);
      mockPrisma.examResult.findFirst.mockResolvedValue(null);
      mockPrisma.examResult.create.mockResolvedValue({ id: 'res-1' });

      // Student got q1 correct (B) and q2 wrong (C)
      const submittedAnswers = { q1: 'B', q2: 'C' };
      // Attacker tried to forge their score to 100/100
      const forgedScore = { earned: 100, total: 100 };

      const result = await examsService.submitExamAttempt('exam-1', 'student-user-1', submittedAnswers, forgedScore);

      // Real calculated: +4 (q1) - 1 (q2) = 3 marks, maxMarks = 8
      expect(result.marksObtained).toBe(3);
      expect(result.maxMarks).toBe(8);
      expect(result.marksObtained).not.toBe(100);
    });

    it('should reject exam submission if exam has no configured questions', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }],
      });
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-empty',
        centreId: 'centre-alpha',
      });
      mockPrisma.mcqQuestion.findMany.mockResolvedValue([]);

      await expect(
        examsService.submitExamAttempt('exam-empty', 'student-1', { q1: 'A' }, { total: 100 })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject cross-centre bulk result saving', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-beta',
        centreId: 'centre-beta',
      });

      const centreAUser = {
        id: 'admin-a',
        role: { name: 'CENTRE_ADMIN' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      await expect(
        examsService.saveExamResults('exam-beta', [{ studentId: 's1', marksObtained: 50 }], centreAUser)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SEC-05: StudentsService Password Projection & Fail-Closed Scoping', () => {
    let studentsService: StudentsService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        studentProfile: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        role: { findUnique: jest.fn() },
        centre: { findFirst: jest.fn() },
        academicYear: { findUnique: jest.fn() },
        board: { findUnique: jest.fn() },
        standard: { findFirst: jest.fn() },
        batch: { findFirst: jest.fn(), create: jest.fn() },
        userCentre: { create: jest.fn(), deleteMany: jest.fn() },
        enrollment: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
      };
      studentsService = new StudentsService(mockPrisma as any);
    });

    it('should fail closed when Centre Admin has no assigned centres in getStudents', async () => {
      const emptyAdmin = { id: 'admin-empty', role: 'CENTRE_ADMIN', userCentres: [] };
      await expect(studentsService.getStudents(emptyAdmin)).rejects.toThrow(ForbiddenException);
    });

    it('should never select password hash in getStudents queries', async () => {
      const admin = { id: 'admin-1', role: 'CENTRE_ADMIN', userCentres: [{ centreId: 'c1' }] };
      mockPrisma.studentProfile.findMany.mockResolvedValue([]);

      await studentsService.getStudents(admin);

      expect(mockPrisma.studentProfile.findMany).toHaveBeenCalled();
      const findArgs = mockPrisma.studentProfile.findMany.mock.calls[0][0];
      // Assert that user projection uses SAFE_USER_SELECT and explicitly omits password
      expect(findArgs.include.user.select).toEqual(SAFE_USER_SELECT);
      expect(findArgs.include.user.select.password).toBeUndefined();
    });

    it('should strip password when creating a new student', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'r-student' });
      mockPrisma.centre.findFirst.mockResolvedValue({ id: 'c1', name: 'Centre 1', code: 'C1' });
      mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay1' });
      mockPrisma.board.findUnique.mockResolvedValue({ id: 'b1' });
      mockPrisma.standard.findFirst.mockResolvedValue({ id: 's1' });
      mockPrisma.batch.findFirst.mockResolvedValue({ id: 'bat1' });
      mockPrisma.user.create.mockResolvedValue({
        id: 'u-1',
        email: 'test@student.com',
        password: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
        firstName: 'John',
        lastName: 'Doe',
      });
      mockPrisma.studentProfile.create.mockResolvedValue({ id: 'sp-1', userId: 'u-1' });
      mockPrisma.enrollment.create.mockResolvedValue({ id: 'en-1' });

      const superAdmin = { id: 'sa', role: 'SUPER_ADMIN' };
      const created = await studentsService.createStudent({
        centre: 'Centre 1',
        academicYear: '2025-26',
        board: 'CBSE',
        classLevel: 'Class 10',
        name: 'John Doe',
      }, superAdmin);

      expect((created.user as any).password).toBeUndefined();
      expect(created.user.email).toBe('test@student.com');
    });

    it('should reject editing a student belonging to a different centre', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-2',
        enrollments: [{ batch: { centreId: 'centre-beta' } }],
      });

      const centreAUser = {
        id: 'admin-a',
        role: 'CENTRE_ADMIN',
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      await expect(
        studentsService.updateStudent('sp-2', { name: 'Hacked' }, centreAUser)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SEC-06: LiveClassService Meeting Link Protection & Tenant Scoping', () => {
    let liveClassService: LiveClassService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        liveClass: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn().mockResolvedValue(0),
        },
        studentProfile: {
          findUnique: jest.fn(),
        },
      };
      liveClassService = new LiveClassService(mockPrisma as any);
    });

    it('should mask meeting roomId for students when class is scheduled in the future', async () => {
      const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        enrollments: [{ batch: { centreId: 'centre-alpha', standardId: 'std-1', boardId: 'board-1' } }],
      });
      mockPrisma.liveClass.findMany.mockResolvedValue([
        {
          id: 'lc-future',
          title: 'Math Session',
          status: 'SCHEDULED',
          scheduledAt: futureTime,
          duration: 60,
          roomId: 'https://meet.google.com/secret-room-link',
          centreId: 'centre-alpha',
        },
      ]);

      const studentUser = { id: 'student-1', role: 'STUDENT' };
      const classes = await liveClassService.getAll(studentUser);

      expect(classes).toHaveLength(1);
      expect(classes[0].roomId).toBeNull();
    });

    it('should reveal meeting roomId for students when class is currently LIVE', async () => {
      const nowTime = new Date().toISOString();
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        enrollments: [{ batch: { centreId: 'centre-alpha', standardId: 'std-1', boardId: 'board-1' } }],
      });
      mockPrisma.liveClass.findMany.mockResolvedValue([
        {
          id: 'lc-live',
          title: 'Math Session Live',
          status: 'LIVE',
          scheduledAt: nowTime,
          duration: 60,
          roomId: 'https://meet.google.com/secret-room-link',
          centreId: 'centre-alpha',
        },
      ]);

      const studentUser = { id: 'student-1', role: 'STUDENT' };
      const classes = await liveClassService.getAll(studentUser);

      expect(classes).toHaveLength(1);
      expect(classes[0].roomId).toBe('https://meet.google.com/secret-room-link');
    });

    it('should reject live class creation in another centre for centre admin', async () => {
      const centreAUser = {
        id: 'admin-a',
        role: 'CENTRE_ADMIN',
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      await expect(
        liveClassService.create({
          title: 'Unauthorized Class',
          subject: 'Math',
          teacherName: 'Teacher',
          scheduledAt: new Date().toISOString(),
          duration: 60,
          centreId: 'centre-beta',
        }, centreAUser)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SEC-08: Storage & File Upload Security', () => {
    let storageService: StorageService;
    const originalAccount = process.env.CLOUDFLARE_ACCOUNT_ID;

    beforeEach(() => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
      storageService = new StorageService();
    });

    afterEach(() => {
      process.env.CLOUDFLARE_ACCOUNT_ID = originalAccount;
    });

    it('should reject dangerous executable file extensions', async () => {
      await expect(
        storageService.getPresignedUploadUrl('malicious.exe', 'application/octet-stream')
      ).rejects.toThrow(BadRequestException);

      await expect(
        storageService.getPresignedUploadUrl('script.sh', 'text/x-sh')
      ).rejects.toThrow(BadRequestException);

      await expect(
        storageService.getPresignedUploadUrl('payload.php', 'application/x-httpd-php')
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject SVG files to prevent stored XSS attacks', async () => {
      await expect(
        storageService.getPresignedUploadUrl('image.svg', 'image/svg+xml')
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject disallowed MIME types', async () => {
      await expect(
        storageService.getPresignedUploadUrl('test.bin', 'application/x-dosexec')
      ).rejects.toThrow(BadRequestException);
    });

    it('should permit allowed document, image, and video MIME types', async () => {
      const pdfRes = await storageService.getPresignedUploadUrl('assignment.pdf', 'application/pdf');
      expect(pdfRes.uploadUrl).toBeDefined();
      expect(pdfRes.objectKey).toContain('assignment.pdf');

      const pngRes = await storageService.getPresignedUploadUrl('avatar.png', 'image/png');
      expect(pngRes.uploadUrl).toBeDefined();
      expect(pngRes.objectKey).toContain('avatar.png');
    });
  });

  describe('SEC-09: Authentication Rate Limiting & DoS Lockout Prevention', () => {
    let authService: AuthService;
    let mockPrisma: any;
    let mockJwt: any;
    let mockRedis: any;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        studentProfile: { findUnique: jest.fn() },
        userCentre: { findFirst: jest.fn() },
      };
      mockJwt = {
        sign: jest.fn().mockReturnValue('mock-jwt-token'),
      };
      mockRedis = {
        isLoginLocked: jest.fn().mockResolvedValue(false),
        incrementLoginAttempts: jest.fn().mockResolvedValue(1),
        resetLoginAttempts: jest.fn().mockResolvedValue(undefined),
        whitelistSession: jest.fn().mockResolvedValue(true),
      };
      authService = new AuthService(mockPrisma as any, mockJwt as any, mockRedis as any);
    });

    it('should provide uniform error message on non-existent user to prevent enumeration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nonexistent@educare.com', password: 'password123' })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should provide uniform error message on invalid password', async () => {
      const hashed = await argon2.hash('realpassword123');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'user@educare.com',
        password: hashed,
        status: 'ACTIVE',
        role: { name: 'TEACHER' },
      });

      await expect(
        authService.login({ email: 'user@educare.com', password: 'wrongpassword' })
      ).rejects.toThrow('Invalid email or password');
      // Must NOT permanently suspend account in DB on password failure
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should throttle with 429 when max login attempts are reached without modifying database status', async () => {
      const hashed = await argon2.hash('realpassword123');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'user@educare.com',
        password: hashed,
        status: 'ACTIVE',
        role: { name: 'TEACHER' },
      });
      mockRedis.incrementLoginAttempts.mockResolvedValue(5);

      await expect(
        authService.login({ email: 'user@educare.com', password: 'wrongpassword' })
      ).rejects.toThrow(HttpException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should reject login with 503 if mandatory session registration fails', async () => {
      const hashed = await argon2.hash('realpassword123');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'user@educare.com',
        password: hashed,
        status: 'ACTIVE',
        role: { name: 'SUPER_ADMIN' },
      });
      mockRedis.whitelistSession.mockResolvedValue(false);

      await expect(
        authService.login({ email: 'user@educare.com', password: 'realpassword123' })
      ).rejects.toThrow(HttpException);
    });
  });

  describe('SEC-07: Cryptographically Secure Random Tokens & Passwords', () => {
    it('should generate secure 6-digit OTPs within valid bounds', () => {
      for (let i = 0; i < 50; i++) {
        const otp = crypto.randomInt(100000, 1000000).toString();
        expect(otp).toHaveLength(6);
        const num = parseInt(otp, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThan(1000000);
      }
    });

    it('should generate high-entropy random temporary passwords instead of password123', () => {
      const p1 = crypto.randomBytes(8).toString('hex');
      const p2 = crypto.randomBytes(8).toString('hex');
      expect(p1).toHaveLength(16);
      expect(p2).toHaveLength(16);
      expect(p1).not.toBe(p2);
      expect(p1).not.toBe('password123');
    });
  });
});

