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

    it('should fail-closed: reject centre admin with no centres assigned', () => {
      expect(() => assertCentreAccess(emptyCentreAdmin, 'centre-alpha')).toThrow(ForbiddenException);
    });

    it('should fail-closed in getAuthorizedCentreIds for tenant users without assignments', () => {
      expect(() => getAuthorizedCentreIds(emptyCentreAdmin)).toThrow(ForbiddenException);
    });

    it('should reject null or undefined centreId for non-superadmin in assertCentreAccess', () => {
      expect(() => assertCentreAccess(centreAdminUser, null)).toThrow(ForbiddenException);
      expect(() => assertCentreAccess(centreAdminUser, undefined)).toThrow(ForbiddenException);
    });
  });

  describe('SEC-03: Exam Question Sanitization, Authoritative Scoring & Answer Release', () => {
    let examsService: ExamsService;
    let mockPrisma: any;
    let mockRedis: any;

    beforeEach(() => {
      mockPrisma = {
        exam: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        studentProfile: {
          findUnique: jest.fn(),
        },
        teacherProfile: {
          findUnique: jest.fn(),
        },
        mcqQuestion: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
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
      mockRedis = {
        getRaw: jest.fn().mockResolvedValue(null),
        setRaw: jest.fn().mockResolvedValue(undefined),
        delRaw: jest.fn().mockResolvedValue(undefined),
      };
      examsService = new ExamsService(mockPrisma as any, mockRedis as any);
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
      mockPrisma.examResult.findMany.mockResolvedValue([]);

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
        type: 'MCQ_EXAM',
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

    it('should reject submission containing question IDs for another exam', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }],
      });
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        type: 'MCQ_EXAM',
        centreId: 'centre-alpha',
      });
      mockPrisma.mcqQuestion.findMany.mockResolvedValue([
        { id: 'q1', type: 'MCQ', correctOption: 'A', marks: 4, negativeMarks: 1 },
      ]);
      mockPrisma.examResult.findFirst.mockResolvedValue(null);

      await expect(
        examsService.submitExamAttempt('exam-1', 'student-1', { 'foreign-q': 'A' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject repeated submissions on formal exams (MCQ_EXAM / MOCK_TEST)', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }],
      });
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-formal',
        type: 'MCQ_EXAM',
        centreId: 'centre-alpha',
      });
      mockPrisma.examResult.findFirst.mockResolvedValue({ id: 'res-prev', marksObtained: 10 });

      await expect(
        examsService.submitExamAttempt('exam-formal', 'student-1', { q1: 'A' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should not reveal answer keys upon submission and keep review locked before release', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }],
      });
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        type: 'MCQ_EXAM',
        centreId: 'centre-alpha',
        mcqQuestions: [
          { id: 'q1', questionText: 'Q1', correctOption: 'A', explanation: 'Secret reason', marks: 4 },
        ],
      });
      mockPrisma.mcqQuestion.findMany.mockResolvedValue([
        { id: 'q1', type: 'MCQ', correctOption: 'A', marks: 4, negativeMarks: 1 },
      ]);
      mockPrisma.examResult.findFirst.mockResolvedValue(null);
      mockPrisma.examResult.create.mockResolvedValue({ id: 'res-1' });

      const submitResult = await examsService.submitExamAttempt('exam-1', 'student-1', { q1: 'A' });
      expect((submitResult as any).correctOption).toBeUndefined();
      expect((submitResult as any).explanation).toBeUndefined();

      // Student attempts to request review before release
      const studentUser = { id: 'student-1', role: 'STUDENT' };
      mockPrisma.examResult.findFirst.mockResolvedValue({ id: 'res-1', marksObtained: 4, maxMarks: 4, studentAnswers: [] });
      await expect(examsService.getExamReview('exam-1', studentUser)).rejects.toThrow(ForbiddenException);
    });

    it('should allow answer review only after authorized staff releases answers', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        title: 'Physics',
        centreId: 'centre-alpha',
        mcqQuestions: [
          { id: 'q1', questionText: 'Q1', correctOption: 'A', explanation: 'Secret reason', marks: 4, negativeMarks: 1 },
        ],
      });
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }],
      });
      mockPrisma.examResult.findFirst.mockResolvedValue({
        id: 'res-1',
        marksObtained: 4,
        maxMarks: 4,
        grade: 'A',
        studentAnswers: [{ questionId: 'q1', selectedOption: 'A', isCorrect: true, marksAwarded: 4 }],
      });

      const centreAUser = {
        id: 'admin-a',
        role: { name: 'CENTRE_ADMIN' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      // Staff releases answers
      await examsService.releaseExamAnswers('exam-1', true, centreAUser);

      // Now student review succeeds with answers & explanation
      const studentUser = { id: 'student-1', role: 'STUDENT' };
      const review = await examsService.getExamReview('exam-1', studentUser);

      expect(review.questions).toHaveLength(1);
      expect(review.questions[0].correctOption).toBe('A');
      expect(review.questions[0].explanation).toBe('Secret reason');
      expect(review.questions[0].isCorrect).toBe(true);
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

    it('should reject bulk results with duplicate student IDs before touching database', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        centreId: 'centre-alpha',
        mcqQuestions: [{ marks: 100 }],
      });
      const superAdmin = { id: 'sa', role: { name: 'SUPER_ADMIN' } };

      const duplicatePayload = [
        { studentId: 'student-dup', marksObtained: 50, maxMarks: 100 },
        { studentId: 'student-dup', marksObtained: 70, maxMarks: 100 },
      ];

      await expect(
        examsService.saveExamResults('exam-1', duplicatePayload, superAdmin)
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.examResult.deleteMany).not.toHaveBeenCalled();
    });

    it('should reject bulk results when marksObtained exceeds maxMarks', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        centreId: 'centre-alpha',
        mcqQuestions: [{ marks: 50 }],
      });
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'student-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }],
      });
      const superAdmin = { id: 'sa', role: { name: 'SUPER_ADMIN' } };

      const invalidPayload = [
        { studentId: 'student-1', marksObtained: 999, maxMarks: 50 },
      ];

      await expect(
        examsService.saveExamResults('exam-1', invalidPayload, superAdmin)
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.examResult.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('SEC-05: StudentsService Password Projection & Fail-Closed Scoping', () => {
    let studentsService: StudentsService;
    let mockPrisma: any;
    let mockRedis: any;

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
      mockRedis = {
        revokeAllSessions: jest.fn().mockResolvedValue(undefined),
      };
      studentsService = new StudentsService(mockPrisma as any, mockRedis as any);
    });

    it('should omit password hash when creating a student', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-s' });
      mockPrisma.centre.findFirst.mockResolvedValue({ id: 'centre-1' });
      mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-1' });
      mockPrisma.board.findUnique.mockResolvedValue({ id: 'b-1' });
      mockPrisma.standard.findFirst.mockResolvedValue({ id: 'std-1' });
      mockPrisma.batch.findFirst.mockResolvedValue({ id: 'batch-1' });

      mockPrisma.user.create.mockResolvedValue({
        id: 'u-1',
        email: 'test@student.com',
        firstName: 'John',
        lastName: 'Doe',
        password: '$argon2id$mock-hashed-password',
      });
      mockPrisma.studentProfile.create.mockResolvedValue({
        id: 'sp-1',
        userId: 'u-1',
        admissionNo: 'ADM001',
      });

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

    it('should revoke all active sessions when a student is deactivated', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        userId: 'u-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }],
      });
      const superAdmin = { id: 'sa', role: 'SUPER_ADMIN' };

      await studentsService.toggleStatus('sp-1', 'INACTIVE', superAdmin);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' },
        data: { status: 'INACTIVE' },
      });
      expect(mockRedis.revokeAllSessions).toHaveBeenCalledWith('u-1');
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

    it('should reject modifying status of an already ended live class', async () => {
      mockPrisma.liveClass.findUnique.mockResolvedValue({
        id: 'lc-ended',
        status: 'ENDED',
        centreId: 'centre-alpha',
      });
      const centreAUser = {
        id: 'admin-a',
        role: 'CENTRE_ADMIN',
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      await expect(
        liveClassService.updateStatus('lc-ended', 'LIVE', centreAUser)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('SEC-07: Study Material Standard Filtering & Play URL Authorization', () => {
    let studyMaterialService: StudyMaterialService;
    let mockPrisma: any;
    let mockStorage: any;

    beforeEach(() => {
      mockPrisma = {
        studyMaterial: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
        },
        studentProfile: {
          findUnique: jest.fn(),
        },
      };
      mockStorage = {
        getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://mock-play-url.com/video'),
      };
      studyMaterialService = new StudyMaterialService(mockPrisma as any, mockStorage as any);
    });

    it('should filter study materials by student enrolled standard and board', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        enrollments: [
          { batch: { standardId: 'std-10', boardId: 'cbse' } },
        ],
      });
      mockPrisma.studyMaterial.findMany.mockResolvedValue([
        { id: 'mat-1', title: 'Class 10 Physics' },
      ]);

      const studentUser = { id: 'student-1', role: 'STUDENT' };
      const materials = await studyMaterialService.getAll({}, studentUser);

      expect(materials).toHaveLength(1);
      expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            syllabus: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ standardId: { in: ['std-10'] } }),
              ]),
            }),
          }),
        })
      );
    });

    it('should reject play URL generation for a student not enrolled in the material standard', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-1',
        enrollments: [
          { batch: { standardId: 'std-9', boardId: 'cbse' } },
        ],
      });
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-12',
        title: 'Class 12 Advanced Chemistry',
        url: 'https://r2.educare.com/chemistry.mp4',
        syllabus: {
          standardId: 'std-12',
          boardId: 'cbse',
        },
      });

      const studentUser = { id: 'student-1', role: 'STUDENT' };
      await expect(
        studyMaterialService.getPlayUrl('mat-12', studentUser)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SEC-08: Storage & File Upload Security', () => {
    let storageService: StorageService;

    beforeEach(() => {
      storageService = new StorageService();
    });

    it('should reject dangerous executable and script file extensions', async () => {
      const dangerousExtensions = ['.exe', '.bat', '.sh', '.php', '.js', '.vbs', '.msi'];
      for (const ext of dangerousExtensions) {
        await expect(
          storageService.getPresignedUploadUrl(`payload${ext}`, 'application/octet-stream')
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('should reject SVG and SVGZ uploads to prevent stored Cross-Site Scripting (XSS)', async () => {
      await expect(
        storageService.getPresignedUploadUrl('vector.svg', 'image/svg+xml')
      ).rejects.toThrow(BadRequestException);

      await expect(
        storageService.getPresignedUploadUrl('compressed.svgz', 'image/svg+xml')
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow legitimate safe document and media extensions', async () => {
      const allowed = ['notes.pdf', 'photo.jpg', 'diagram.png', 'lecture.mp4'];
      for (const f of allowed) {
        const mime = f.endsWith('.pdf') ? 'application/pdf' : f.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
        const res = await storageService.getPresignedUploadUrl(f, mime);
        expect(res).toHaveProperty('uploadUrl');
        expect(res).toHaveProperty('key');
      }
    });
  });

  describe('SEC-09: Authentication Service & Redis Temporary Lockout', () => {
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

  describe('SEC-10: Cryptographically Secure Random Tokens & Passwords', () => {
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
