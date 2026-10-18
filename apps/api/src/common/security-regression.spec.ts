import { getJwtSecret } from './config/jwt.config';
import { StorageService } from '../storage/storage.service';
import { assertCentreAccess, isSuperAdmin, getUserCentreIds, getAuthorizedCentreIds, SAFE_USER_SELECT } from './utils/tenant.util';
import { ForbiddenException, BadRequestException, HttpException, HttpStatus, UnauthorizedException, ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import { ExamsService } from '../exams/exams.service';
import { StudentsService } from '../students/students.service';
import { LiveClassService } from '../live-class/live-class.service';
import { StudyMaterialService } from '../study-materials/study-materials.service';
import { StudyMaterialController } from '../study-materials/study-materials.controller';
import { AuthService } from '../auth/auth.service';
import { AuthController } from '../auth/auth.controller';
import { RedisService } from '../redis/redis.service';
import { FinanceService } from '../finance/finance.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ReportService } from '../report/report.service';
import { AssignmentsService } from '../assignments/assignments.service';
import { DoubtsService } from '../doubts/doubts.service';
import { FormsService } from '../forms/forms.service';
import { UsersService } from '../users/users.service';
import { EstudyService } from '../estudy/estudy.service';
import { SetupService } from '../setup/setup.service';
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

    it('should report false when revokeSession is called with mandatory Redis unavailable', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const redisService = new RedisService();
      const result = await redisService.revokeSession('u-1', 'jti-1');
      expect(result).toBe(false);
      delete process.env.REDIS_URL;
    });

    it('should report false when revokeAllSessions is called with mandatory Redis unavailable', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const redisService = new RedisService();
      const result = await redisService.revokeAllSessions('u-1');
      expect(result).toBe(false);
      delete process.env.REDIS_URL;
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
        batch: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
        },
        subject: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        chapter: {
          findUnique: jest.fn(),
        },
        topic: {
          findUnique: jest.fn(),
        },
        standard: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
        },
        board: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
        },
        academicYear: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
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

    it('should reject teacher access when exam subject does not match teacher subject assignment', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-chem',
        centreId: 'centre-alpha',
        subjectId: 'sub-chem',
        standardId: 'std-10',
      });
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp-1',
        userId: 'teacher-1',
        assignments: [
          { subjectId: 'sub-physics', standardId: 'std-10', boardId: null, batchId: null },
        ],
        user: {
          userCentres: [{ centreId: 'centre-alpha' }],
        },
      });

      const teacherUser = { id: 'teacher-1', role: { name: 'TEACHER' } };
      await expect(examsService.getExamById('exam-chem', teacherUser)).rejects.toThrow(ForbiddenException);
    });

    it('should reject teacher access when exam standard does not match teacher standard assignment', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-phys-12',
        centreId: 'centre-alpha',
        subjectId: 'sub-physics',
        standardId: 'std-12',
      });
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp-1',
        userId: 'teacher-1',
        assignments: [
          { subjectId: 'sub-physics', standardId: 'std-10', boardId: null, batchId: null },
        ],
        user: {
          userCentres: [{ centreId: 'centre-alpha' }],
        },
      });

      const teacherUser = { id: 'teacher-1', role: { name: 'TEACHER' } };
      await expect(examsService.getExamById('exam-phys-12', teacherUser)).rejects.toThrow(ForbiddenException);
    });

    it('should reject teacher access when teacher attempts to access an exam in another centre', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-phys-beta',
        centreId: 'centre-beta',
        subjectId: 'sub-physics',
        standardId: 'std-10',
      });
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp-1',
        userId: 'teacher-1',
        assignments: [
          { subjectId: 'sub-physics', standardId: 'std-10', boardId: null, batchId: null },
        ],
        user: {
          userCentres: [{ centreId: 'centre-alpha' }],
        },
      });

      const teacherUser = { id: 'teacher-1', role: { name: 'TEACHER' }, userCentres: [{ centreId: 'centre-alpha' }] };
      await expect(examsService.getExamById('exam-phys-beta', teacherUser)).rejects.toThrow(ForbiddenException);
    });

    it('should permit teacher access when all assignment dimensions (centre, subject, standard) match together', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-phys-10',
        centreId: 'centre-alpha',
        subjectId: 'sub-physics',
        standardId: 'std-10',
      });
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp-1',
        userId: 'teacher-1',
        assignments: [
          { subjectId: 'sub-physics', standardId: 'std-10', boardId: null, batchId: null },
        ],
        user: {
          userCentres: [{ centreId: 'centre-alpha' }],
        },
      });

      const teacherUser = { id: 'teacher-1', role: { name: 'TEACHER' }, userCentres: [{ centreId: 'centre-alpha' }] };
      const exam = await examsService.getExamById('exam-phys-10', teacherUser);
      expect(exam.id).toBe('exam-phys-10');
    });

    it('should reject exam updates that attempt to transfer an exam to an unauthorized destination centre', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        centreId: 'centre-alpha',
        subjectId: 'sub-physics',
      });
      const centreAUser = {
        id: 'admin-a',
        role: { name: 'CENTRE_ADMIN' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      await expect(
        examsService.updateExam('exam-1', { centreId: 'centre-beta' }, centreAUser)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject exam updates that specify a destination batch belonging to another centre', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        centreId: 'centre-alpha',
        subjectId: 'sub-physics',
      });
      mockPrisma.batch.findUnique.mockResolvedValue({
        id: 'batch-beta',
        centreId: 'centre-beta',
      });
      const centreAUser = {
        id: 'admin-a',
        role: { name: 'CENTRE_ADMIN' },
        userCentres: [{ centreId: 'centre-alpha' }],
      };

      await expect(
        examsService.updateExam('exam-1', { batchId: 'batch-beta' }, centreAUser)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject answer release by an unauthorized teacher', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-chem',
        centreId: 'centre-alpha',
        subjectId: 'sub-chem',
        standardId: 'std-10',
      });
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        id: 'tp-1',
        userId: 'teacher-1',
        assignments: [
          { subjectId: 'sub-physics', standardId: 'std-10', boardId: null, batchId: null },
        ],
        user: { userCentres: [{ centreId: 'centre-alpha' }] },
      });

      const teacherUser = { id: 'teacher-1', role: { name: 'TEACHER' }, userCentres: [{ centreId: 'centre-alpha' }] };
      await expect(
        examsService.releaseExamAnswers('exam-chem', true, teacherUser)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should fail fast and throw ServiceUnavailableException if Redis persistence fails during answer release', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        centreId: 'centre-alpha',
      });
      mockRedis.setRaw.mockRejectedValue(new Error('Redis connection failure'));

      const superAdmin = { id: 'sa', role: { name: 'SUPER_ADMIN' } };
      await expect(
        examsService.releaseExamAnswers('exam-1', true, superAdmin)
      ).rejects.toThrow(ServiceUnavailableException);

      delete process.env.REDIS_URL;
    });

    it('should reject bulk result saving when student does not belong to the batch effective centre', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        centreId: null,
        batchId: 'batch-1',
        batch: { centreId: 'centre-alpha' },
        mcqQuestions: [{ marks: 100 }],
      });
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's-other',
        enrollments: [{ batch: { centreId: 'centre-beta' } }],
      });
      const superAdmin = { id: 'sa', role: { name: 'SUPER_ADMIN' } };

      await expect(
        examsService.saveExamResults('exam-1', [{ studentId: 's-other', marksObtained: 80, maxMarks: 100 }], superAdmin)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject bulk results with negative or non-finite marks', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'exam-1',
        centreId: 'centre-alpha',
        mcqQuestions: [{ marks: 100 }],
      });
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }],
      });
      const superAdmin = { id: 'sa', role: { name: 'SUPER_ADMIN' } };

      await expect(
        examsService.saveExamResults('exam-1', [{ studentId: 's-1', marksObtained: -10, maxMarks: 100 }], superAdmin)
      ).rejects.toThrow(BadRequestException);

      await expect(
        examsService.saveExamResults('exam-1', [{ studentId: 's-1', marksObtained: NaN, maxMarks: 100 }], superAdmin)
      ).rejects.toThrow(BadRequestException);
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
      studyMaterialService = new StudyMaterialService(mockPrisma as any);
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
      const materials = await studyMaterialService.getAll(studentUser);

      expect(materials).toHaveLength(1);
      expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalled();
    });

    it('should reject access for a student not enrolled in the material standard', async () => {
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
        studyMaterialService.getById('mat-12', studentUser)
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SEC-08: Storage & File Upload Security', () => {
    let storageService: StorageService;

    const origAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const origKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const origSecretKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

    beforeEach(() => {
      process.env.CLOUDFLARE_ACCOUNT_ID = 'mock-account';
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'mock-key';
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'mock-secret';
      storageService = new StorageService();
    });

    afterAll(() => {
      process.env.CLOUDFLARE_ACCOUNT_ID = origAccountId;
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = origKeyId;
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = origSecretKey;
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
        expect(res).toHaveProperty('objectKey');
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

  describe('SEC-11: Fifth-Pass Security Remediations', () => {
    let mockPrisma: any;
    let mockRedis: any;
    let examsService: ExamsService;

    const superAdmin = {
      id: 'super-admin-1',
      role: { name: 'SUPER_ADMIN' },
      userCentres: []
    };

    const centreAAdmin = {
      id: 'admin-a',
      role: { name: 'CENTRE_ADMIN' },
      userCentres: [{ centreId: 'centre-alpha' }]
    };

    const teacherAlpha = {
      id: 'teacher-1',
      role: { name: 'TEACHER' },
      userCentres: [{ centreId: 'centre-alpha' }]
    };

    beforeEach(() => {
      mockPrisma = {
        exam: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        examResult: {
          findMany: jest.fn(),
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
        studentProfile: {
          findUnique: jest.fn(),
        },
        teacherProfile: {
          findUnique: jest.fn(),
        },
        batch: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
        },
        subject: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        chapter: {
          findUnique: jest.fn(),
        },
        topic: {
          findUnique: jest.fn(),
        },
        standard: {
          findUnique: jest.fn(),
        },
        board: {
          findUnique: jest.fn(),
        },
        academicYear: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
        },
        mcqQuestion: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
        },
        $transaction: jest.fn((cb) => cb(mockPrisma)),
      };

      mockRedis = {
        getRaw: jest.fn().mockResolvedValue(null),
        setRaw: jest.fn().mockResolvedValue(undefined),
        delRaw: jest.fn().mockResolvedValue(undefined),
      };

      examsService = new ExamsService(mockPrisma as any, mockRedis as any);
    });

    describe('1. Teacher Exam Analytics Scoping (getAllResults)', () => {
      it('should scope teacher results query to assigned subjects and classes and centre', async () => {
        mockPrisma.teacherProfile.findUnique.mockResolvedValue({
          id: 'tp-1',
          userId: 'teacher-1',
          assignments: [
            {
              subjectId: 'sub-phys',
              standardId: 'std-10',
              boardId: 'board-cbse',
              batchId: 'batch-1',
              isCombined: false,
            }
          ]
        });
        mockPrisma.examResult.findMany.mockResolvedValue([]);

        await examsService.getAllResults(teacherAlpha);

        expect(mockPrisma.examResult.findMany).toHaveBeenCalled();
        const callArgs = mockPrisma.examResult.findMany.mock.calls[0][0];
        expect(callArgs.where.exam).toBeDefined();
        expect(callArgs.where.exam.AND).toHaveLength(2);
        // First AND block: centre isolation
        expect(callArgs.where.exam.AND[0].OR).toEqual([
          { centreId: { in: ['centre-alpha'] } },
          { batch: { centreId: { in: ['centre-alpha'] } } },
        ]);
        // Second AND block: assignment condition
        const assignmentCond = callArgs.where.exam.AND[1].OR[0];
        expect(assignmentCond.subjectId).toBe('sub-phys');
        expect(assignmentCond.batchId).toBe('batch-1');
      });

      it('should return empty list immediately if teacher has no assignments', async () => {
        mockPrisma.teacherProfile.findUnique.mockResolvedValue({
          id: 'tp-1',
          userId: 'teacher-1',
          assignments: []
        });

        const results = await examsService.getAllResults(teacherAlpha);
        expect(results).toEqual([]);
        expect(mockPrisma.examResult.findMany).not.toHaveBeenCalled();
      });
    });

    describe('2. Exact Teacher Class Assignment Matching', () => {
      it('should reject substring class match (e.g. std-1 should not match std-10)', async () => {
        mockPrisma.teacherProfile.findUnique.mockResolvedValue({
          id: 'tp-1',
          userId: 'teacher-1',
          user: { userCentres: [{ centreId: 'centre-alpha' }] },
          assignments: [
            {
              subjectId: 'sub-phys',
              standardId: 'std-10',
              isCombined: true,
              combinedClasses: 'std-10,std-12',
            }
          ]
        });

        mockPrisma.exam.findUnique.mockResolvedValue({
          id: 'exam-1',
          centreId: 'centre-alpha',
          subjectId: 'sub-phys',
          standardId: 'std-1', // 'std-1' is a substring of 'std-10', but not exact match!
          batch: null,
          mcqQuestions: [],
        });

        await expect(examsService.getExamById('exam-1', teacherAlpha)).rejects.toThrow(ForbiddenException);
      });

      it('should accept exact class match in combined classes', async () => {
        mockPrisma.teacherProfile.findUnique.mockResolvedValue({
          id: 'tp-1',
          userId: 'teacher-1',
          user: { userCentres: [{ centreId: 'centre-alpha' }] },
          assignments: [
            {
              subjectId: 'sub-phys',
              standardId: 'std-10',
              isCombined: true,
              combinedClasses: 'std-10,std-12',
            }
          ]
        });

        mockPrisma.exam.findUnique.mockResolvedValue({
          id: 'exam-1',
          centreId: 'centre-alpha',
          subjectId: 'sub-phys',
          standardId: 'std-12', // Exactly in combinedClasses
          batch: null,
          mcqQuestions: [],
        });

        const exam = await examsService.getExamById('exam-1', teacherAlpha);
        expect(exam.id).toBe('exam-1');
      });
    });

    describe('3. Deny Unauthorized Operations on Centre-Less Exams', () => {
      const centreLessExam = {
        id: 'centre-less-1',
        title: 'Global Exam',
        centreId: null,
        batchId: null,
        batch: null,
        mcqQuestions: [],
      };

      it('should deny updateExam on centre-less exam for non-superadmin', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue(centreLessExam);
        await expect(
          examsService.updateExam('centre-less-1', { title: 'Hacked' }, centreAAdmin)
        ).rejects.toThrow('Exams without an assigned centre can only be managed by Super Administrators.');
      });

      it('should deny deleteExam on centre-less exam for non-superadmin', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue(centreLessExam);
        await expect(
          examsService.deleteExam('centre-less-1', centreAAdmin)
        ).rejects.toThrow('Exams without an assigned centre can only be managed by Super Administrators.');
      });

      it('should deny saveExamResults on centre-less exam for non-superadmin', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue(centreLessExam);
        await expect(
          examsService.saveExamResults('centre-less-1', [{ studentId: 's1', marksObtained: 50 }], centreAAdmin)
        ).rejects.toThrow('Exams without an assigned centre can only be managed by Super Administrators.');
      });

      it('should deny releaseExamAnswers on centre-less exam for non-superadmin', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue(centreLessExam);
        await expect(
          examsService.releaseExamAnswers('centre-less-1', true, centreAAdmin)
        ).rejects.toThrow('Exams without an assigned centre can only be managed by Super Administrators.');
      });

      it('should allow Super Admin to update centre-less exam', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue(centreLessExam);
        mockPrisma.exam.update.mockResolvedValue({ ...centreLessExam, title: 'Updated Global' });

        const res = await examsService.updateExam('centre-less-1', { title: 'Updated Global' }, superAdmin);
        expect(mockPrisma.exam.update).toHaveBeenCalled();
      });
    });

    describe('4. Destination Validation & Transaction Consistency in updateExam', () => {
      const existingExam = {
        id: 'exam-alpha',
        title: 'Alpha Exam',
        centreId: null,
        batchId: 'batch-alpha-1',
        subjectId: 'sub-1',
        standardId: 'std-1',
        boardId: 'brd-1',
        batch: { centreId: 'centre-alpha', standardId: 'std-1', boardId: 'brd-1' },
        mcqQuestions: [],
      };

      it('should reject removing batchId when centreId is null (preventing stripping centre scope)', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue(existingExam);

        await expect(
          examsService.updateExam('exam-alpha', { batchId: null }, centreAAdmin)
        ).rejects.toThrow('Cannot remove centre scope from an exam. Non-superadmin exams must have an effective centre.');
      });

      it('should reject placeholder dummy batchId on updateExam', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue(existingExam);

        await expect(
          examsService.updateExam('exam-alpha', { batchId: 'dummy' }, centreAAdmin)
        ).rejects.toThrow("Invalid batchId: 'dummy' is not a valid batch identifier.");
      });

      it('should execute updates inside transaction and fetch fresh response post-commit (Option A)', async () => {
        mockPrisma.exam.findUnique
          .mockResolvedValueOnce(existingExam) // Initial check
          .mockResolvedValueOnce({ ...existingExam, title: 'Fresh Title' }); // Post-commit getExamById

        mockPrisma.exam.update.mockResolvedValue({ ...existingExam, title: 'Fresh Title' });

        const result = await examsService.updateExam('exam-alpha', { title: 'Fresh Title' }, centreAAdmin);
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(result.title).toBe('Fresh Title');
      });
    });

    describe('5. Removal of Arbitrary dummy Batch Fallback in createExam', () => {
      it('should reject createExam with batchId = dummy', async () => {
        mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-1' });
        mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-1' });

        await expect(
          examsService.createExam({
            title: 'New Exam',
            academicYearId: 'ay-1',
            subjectId: 'sub-1',
            batchId: 'dummy',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow("Invalid batchId: 'dummy' is not a valid batch identifier.");

        expect(mockPrisma.batch.findFirst).not.toHaveBeenCalled();
      });

      it('should reject createExam with academicYearId = dummy', async () => {
        await expect(
          examsService.createExam({
            title: 'New Exam',
            academicYearId: 'dummy',
            subjectId: 'sub-1',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow("A valid academicYearId is required. Placeholder 'dummy' is not accepted.");
      });

      it('should reject createExam with subjectId = dummy', async () => {
        mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-1' });

        await expect(
          examsService.createExam({
            title: 'New Exam',
            academicYearId: 'ay-1',
            subjectId: 'dummy',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow("A valid subjectId is required. Placeholder 'dummy' is not accepted.");
      });

      it('should allow creating an unassigned batch exam without invoking findFirst', async () => {
        mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-1' });
        mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-1' });
        mockPrisma.exam.create.mockResolvedValue({ id: 'created-exam', batchId: null });

        const exam = await examsService.createExam({
          title: 'Unassigned Exam',
          academicYearId: 'ay-1',
          subjectId: 'sub-1',
          centreId: 'centre-alpha',
        }, centreAAdmin);

        expect(mockPrisma.batch.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.exam.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              batchId: null,
              centreId: 'centre-alpha',
            })
          })
        );
      });
    });

    describe('6. Validate Maximum Marks and Grades in saveExamResults', () => {
      const examWithQuestions = {
        id: 'exam-q',
        centreId: 'centre-alpha',
        batchId: null,
        batch: null,
        mcqQuestions: [
          { id: 'q1', marks: 10 },
          { id: 'q2', marks: 10 },
        ], // Total = 20
      };

      const validStudent = {
        id: 's-1',
        enrollments: [{ batch: { centreId: 'centre-alpha' } }]
      };

      it('should reject caller-supplied maxMarks contradicting exam questions total', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue(examWithQuestions);
        mockPrisma.studentProfile.findUnique.mockResolvedValue(validStudent);

        await expect(
          examsService.saveExamResults(
            'exam-q',
            [{ studentId: 's-1', marksObtained: 15, maxMarks: 100 }], // Configured total is 20!
            centreAAdmin
          )
        ).rejects.toThrow('Supplied maxMarks (100) does not match configured exam total marks (20)');
      });

      it('should reject inconsistent grade supplied by caller', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue(examWithQuestions);
        mockPrisma.studentProfile.findUnique.mockResolvedValue(validStudent);

        // 5 out of 20 = 25% (expected grade F), but caller claims 'A+'
        await expect(
          examsService.saveExamResults(
            'exam-q',
            [{ studentId: 's-1', marksObtained: 5, maxMarks: 20, grade: 'A+' }],
            centreAAdmin
          )
        ).rejects.toThrow("Inconsistent grade 'A+' for student 's-1'. Based on marks 5/20, expected grade is 'F'.");
      });

      it('should calculate grade authoritatively when omitted and persist atomically', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue(examWithQuestions);
        mockPrisma.studentProfile.findUnique.mockResolvedValue(validStudent);

        // 19 out of 20 = 95% -> A+
        const res = await examsService.saveExamResults(
          'exam-q',
          [{ studentId: 's-1', marksObtained: 19 }],
          centreAAdmin
        );

        expect(res.success).toBe(true);
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockPrisma.examResult.createMany).toHaveBeenCalledWith({
          data: [
            expect.objectContaining({
              studentId: 's-1',
              marksObtained: 19,
              maxMarks: 20,
              grade: 'A+',
            })
          ]
        });
      });
    });

    describe('7. Redis Pipeline Execution Verification in revokeAllSessions', () => {
      it('should report false when pipeline.exec() returns null on mandatory Redis', async () => {
        process.env.REDIS_URL = 'redis://localhost:6379';
        const redisService = new RedisService();
        (redisService as any).isAvailable = true;
        (redisService as any).client = {
          smembers: jest.fn().mockResolvedValue(['jti-1']),
          pipeline: jest.fn().mockReturnValue({
            del: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(null), // Null return from exec!
          }),
        };

        const result = await redisService.revokeAllSessions('u-1');
        expect(result).toBe(false);
        delete process.env.REDIS_URL;
      });

      it('should report false when pipeline.exec() contains a command error on mandatory Redis', async () => {
        process.env.REDIS_URL = 'redis://localhost:6379';
        const redisService = new RedisService();
        (redisService as any).isAvailable = true;
        (redisService as any).client = {
          smembers: jest.fn().mockResolvedValue(['jti-1']),
          pipeline: jest.fn().mockReturnValue({
            del: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([
              [new Error('READONLY You can\'t write against a read only replica.'), null]
            ]),
          }),
        };

        const result = await redisService.revokeAllSessions('u-1');
        expect(result).toBe(false);
        delete process.env.REDIS_URL;
      });

      it('should report true when pipeline.exec() succeeds completely', async () => {
        process.env.REDIS_URL = 'redis://localhost:6379';
        const redisService = new RedisService();
        (redisService as any).isAvailable = true;
        (redisService as any).client = {
          smembers: jest.fn().mockResolvedValue(['jti-1']),
          pipeline: jest.fn().mockReturnValue({
            del: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([
              [null, 1],
              [null, 1],
            ]),
          }),
        };

        const result = await redisService.revokeAllSessions('u-1');
        expect(result).toBe(true);
        delete process.env.REDIS_URL;
      });
    });
  });

  describe('SEC-12: Exam Creation Correctness, Batch Compatibility, and Subject Fallback', () => {
    let examsService: ExamsService;
    let mockPrisma: any;
    let mockRedis: any;

    const superAdmin = {
      id: 'super-admin-1',
      role: { name: 'SUPER_ADMIN' },
      userCentres: []
    };

    const centreAAdmin = {
      id: 'admin-a',
      role: { name: 'CENTRE_ADMIN' },
      userCentres: [{ centreId: 'centre-alpha' }]
    };

    beforeEach(() => {
      mockPrisma = {
        exam: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'created-exam-id', ...args.data })),
          update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
          delete: jest.fn(),
        },
        batch: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
        },
        subject: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
        chapter: {
          findUnique: jest.fn(),
        },
        topic: {
          findUnique: jest.fn(),
        },
        standard: {
          findUnique: jest.fn(),
        },
        board: {
          findUnique: jest.fn(),
        },
        academicYear: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
        },
        mcqQuestion: {
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
        },
        $transaction: jest.fn((cb) => cb(mockPrisma)),
      };

      mockRedis = {
        getRaw: jest.fn().mockResolvedValue(null),
        setRaw: jest.fn().mockResolvedValue(undefined),
        delRaw: jest.fn().mockResolvedValue(undefined),
      };

      examsService = new ExamsService(mockPrisma as any, mockRedis as any);
    });

    describe('1. Academic-Year Selection and Fallback', () => {
      it('should succeed and fall back to the active academic year (isActive: true) when academicYearId is omitted', async () => {
        mockPrisma.academicYear.findFirst.mockImplementation(({ where }: any) => {
          if (where?.isActive === true) {
            return Promise.resolve({ id: 'active-ay-2026', isActive: true });
          }
          return Promise.resolve(null);
        });
        mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'active-ay-2026', isActive: true });
        mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-math' });

        const result = await examsService.createExam({
          title: 'Midterm Exam',
          subjectId: 'sub-math',
          centreId: 'centre-alpha',
        }, centreAAdmin);

        expect(mockPrisma.academicYear.findFirst).toHaveBeenCalledWith({ where: { isActive: true } });
        expect(mockPrisma.exam.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({
            academicYearId: 'active-ay-2026',
          })
        }));
        expect(result.academicYearId).toBe('active-ay-2026');
      });

      it('should reject exam creation when academicYearId is omitted and no active academic year exists', async () => {
        mockPrisma.academicYear.findFirst.mockResolvedValue(null);
        mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-math' });

        await expect(
          examsService.createExam({
            title: 'Midterm Exam',
            subjectId: 'sub-math',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow('A valid academicYearId is required to create an exam. No active academic year is configured.');

        expect(mockPrisma.exam.create).not.toHaveBeenCalled();
      });

      it('should reject exam creation when specified academicYearId does not exist', async () => {
        mockPrisma.academicYear.findUnique.mockResolvedValue(null);
        mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-math' });

        await expect(
          examsService.createExam({
            title: 'Midterm Exam',
            academicYearId: 'non-existent-ay',
            subjectId: 'sub-math',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow("Specified academic year 'non-existent-ay' does not exist.");

        expect(mockPrisma.exam.create).not.toHaveBeenCalled();
      });
    });

    describe('2. Batch and Academic Year / Board / Standard / Track Compatibility', () => {
      it('should automatically derive academicYearId, boardId, and standardId from batch when omitted', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({
          id: 'batch-alpha-10',
          centreId: 'centre-alpha',
          academicYearId: 'ay-2026',
          boardId: 'board-cbse',
          standardId: 'std-10',
          trackId: 'track-science',
        });
        mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-2026' });
        mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-math' });
        mockPrisma.board.findUnique.mockResolvedValue({ id: 'board-cbse' });
        mockPrisma.standard.findUnique.mockResolvedValue({ id: 'std-10' });

        const result = await examsService.createExam({
          title: 'Class 10 Science Exam',
          batchId: 'batch-alpha-10',
          subjectId: 'sub-math',
        }, centreAAdmin);

        expect(result.academicYearId).toBe('ay-2026');
        expect(result.boardId).toBe('board-cbse');
        expect(result.standardId).toBe('std-10');
        expect(result.targetTrackId).toBe('track-science');
      });

      it('should reject exam creation when batch academicYearId does not match the submitted academicYearId', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({
          id: 'batch-alpha-10',
          centreId: 'centre-alpha',
          academicYearId: 'ay-2025',
        });

        await expect(
          examsService.createExam({
            title: 'Mismatched Year Exam',
            batchId: 'batch-alpha-10',
            academicYearId: 'ay-2026',
            subjectId: 'sub-math',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow("Selected batch belongs to academic year 'ay-2025', which does not match the exam academic year 'ay-2026'.");

        expect(mockPrisma.exam.create).not.toHaveBeenCalled();
      });

      it('should reject exam creation when batch boardId does not match the submitted boardId', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({
          id: 'batch-alpha-10',
          centreId: 'centre-alpha',
          academicYearId: 'ay-2026',
          boardId: 'board-state',
        });

        await expect(
          examsService.createExam({
            title: 'Mismatched Board Exam',
            batchId: 'batch-alpha-10',
            boardId: 'board-cbse',
            subjectId: 'sub-math',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow("Selected batch belongs to board 'board-state', which does not match the exam board 'board-cbse'.");

        expect(mockPrisma.exam.create).not.toHaveBeenCalled();
      });

      it('should reject exam creation when batch standardId does not match the submitted standardId', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({
          id: 'batch-alpha-10',
          centreId: 'centre-alpha',
          academicYearId: 'ay-2026',
          standardId: 'std-10',
        });

        await expect(
          examsService.createExam({
            title: 'Mismatched Standard Exam',
            batchId: 'batch-alpha-10',
            standardId: 'std-12',
            subjectId: 'sub-math',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow("Selected batch belongs to standard 'std-10', which does not match the exam standard 'std-12'.");

        expect(mockPrisma.exam.create).not.toHaveBeenCalled();
      });

      it('should reject exam creation when batch trackId does not match the submitted targetTrackId', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({
          id: 'batch-alpha-10',
          centreId: 'centre-alpha',
          academicYearId: 'ay-2026',
          trackId: 'track-engineering',
        });

        await expect(
          examsService.createExam({
            title: 'Mismatched Track Exam',
            batchId: 'batch-alpha-10',
            targetTrackId: 'track-medical',
            subjectId: 'sub-math',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow("Selected batch belongs to track 'track-engineering', which does not match the exam track 'track-medical'.");

        expect(mockPrisma.exam.create).not.toHaveBeenCalled();
      });

      it('should reject updateExam when destination batch academicYearId does not match exam academicYearId', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue({
          id: 'exam-1',
          centreId: 'centre-alpha',
          academicYearId: 'ay-2026',
          subjectId: 'sub-math',
          batchId: null,
          batch: null,
        });

        mockPrisma.batch.findUnique.mockResolvedValue({
          id: 'batch-incompatible',
          centreId: 'centre-alpha',
          academicYearId: 'ay-2024',
        });

        await expect(
          examsService.updateExam('exam-1', {
            batchId: 'batch-incompatible',
          }, centreAAdmin)
        ).rejects.toThrow("Destination batch belongs to academic year 'ay-2024', which does not match the exam academic year 'ay-2026'.");

        expect(mockPrisma.exam.update).not.toHaveBeenCalled();
      });
    });

    describe('3. Subject Resolution and Fallback', () => {
      it('should resolve subject by unique name fallback (case-insensitive)', async () => {
        mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-2026' });
        mockPrisma.subject.findMany.mockResolvedValue([
          { id: 'sub-phys-id', name: 'Physics' }
        ]);
        mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-phys-id', name: 'Physics' });

        const result = await examsService.createExam({
          title: 'Physics Test',
          academicYearId: 'ay-2026',
          subject: ' physics ',
          centreId: 'centre-alpha',
        }, centreAAdmin);

        expect(mockPrisma.subject.findMany).toHaveBeenCalledWith({
          where: { name: { equals: 'physics', mode: 'insensitive' } }
        });
        expect(result.subjectId).toBe('sub-phys-id');
      });

      it('should reject ambiguous subject name fallback when multiple subjects match', async () => {
        mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-2026' });
        mockPrisma.subject.findMany.mockResolvedValue([
          { id: 'sub-chem-1', name: 'Chemistry' },
          { id: 'sub-chem-2', name: 'Chemistry' },
        ]);

        await expect(
          examsService.createExam({
            title: 'Chemistry Test',
            academicYearId: 'ay-2026',
            subject: 'Chemistry',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow("Multiple subjects match the name 'Chemistry'. Ambiguous subject match; please specify an explicit subjectId.");

        expect(mockPrisma.exam.create).not.toHaveBeenCalled();
      });

      it('should reject subject name fallback when no subjects match', async () => {
        mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-2026' });
        mockPrisma.subject.findMany.mockResolvedValue([]);

        await expect(
          examsService.createExam({
            title: 'Astronomy Test',
            academicYearId: 'ay-2026',
            subject: 'Nonexistent Subject',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow("No subject found matching name 'Nonexistent Subject'.");

        expect(mockPrisma.exam.create).not.toHaveBeenCalled();
      });
    });

    describe('4. Curriculum Hierarchy Validation (Chapter & Topic)', () => {
      it('should reject exam creation when chapter does not belong to selected subject', async () => {
        mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-2026' });
        mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-math' });
        mockPrisma.chapter.findUnique.mockResolvedValue({
          id: 'chap-optics',
          syllabus: {
            subjectId: 'sub-physics',
            boardId: 'board-cbse',
            standardId: 'std-12',
          }
        });

        await expect(
          examsService.createExam({
            title: 'Calculus Quiz',
            academicYearId: 'ay-2026',
            subjectId: 'sub-math',
            chapterId: 'chap-optics',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow('Specified chapter does not belong to the selected subject.');

        expect(mockPrisma.exam.create).not.toHaveBeenCalled();
      });

      it('should reject exam creation when topic does not belong to selected chapter', async () => {
        mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-2026' });
        mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-math' });
        mockPrisma.chapter.findUnique.mockResolvedValue({
          id: 'chap-algebra',
          syllabus: {
            subjectId: 'sub-math',
          }
        });
        mockPrisma.topic.findUnique.mockResolvedValue({
          id: 'topic-trig',
          chapterId: 'chap-trigonometry',
        });

        await expect(
          examsService.createExam({
            title: 'Algebra Exam',
            academicYearId: 'ay-2026',
            subjectId: 'sub-math',
            chapterId: 'chap-algebra',
            topicId: 'topic-trig',
            centreId: 'centre-alpha',
          }, centreAAdmin)
        ).rejects.toThrow('Specified topic does not belong to the selected chapter.');

        expect(mockPrisma.exam.create).not.toHaveBeenCalled();
      });

      it('should reject updateExam when destination chapter does not belong to destination subject', async () => {
        mockPrisma.exam.findUnique.mockResolvedValue({
          id: 'exam-existing',
          centreId: 'centre-alpha',
          academicYearId: 'ay-2026',
          subjectId: 'sub-math',
          batchId: null,
          batch: null,
        });

        mockPrisma.chapter.findUnique.mockResolvedValue({
          id: 'chap-biology',
          syllabus: {
            subjectId: 'sub-bio',
          }
        });

        await expect(
          examsService.updateExam('exam-existing', {
            chapterId: 'chap-biology',
          }, centreAAdmin)
        ).rejects.toThrow('Specified chapter does not belong to the destination subject.');

        expect(mockPrisma.exam.update).not.toHaveBeenCalled();
      });
    });

    describe('5. Mobile Exam Creation Compatibility', () => {
      it('should create exam and persist nested mcqQuestions when provided by mobile payload', async () => {
        mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-2026' });
        mockPrisma.subject.findUnique.mockResolvedValue({ id: 'sub-math' });

        const result = await examsService.createExam({
          title: 'Mobile Quiz',
          academicYearId: 'ay-2026',
          subjectId: 'sub-math',
          centreId: 'centre-alpha',
          mcqQuestions: [
            {
              question: 'What is 2+2?',
              options: ['3', '4', '5'],
              correctAnswer: '4',
              marks: 4,
            }
          ]
        }, centreAAdmin);

        expect(mockPrisma.exam.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({
            title: 'Mobile Quiz',
            mcqQuestions: {
              create: [
                expect.objectContaining({
                  questionText: 'What is 2+2?',
                  correctOption: '4',
                  marks: 4,
                })
              ]
            }
          })
        }));
        expect(result.id).toBe('created-exam-id');
      });
    });
  });

  describe('SEC-13: Multi-Centre Tenant Isolation, Role Enforcement, IDOR Protection, and Session Revocation', () => {
    const superAdmin = {
      id: 'super-admin-1',
      role: { name: 'SUPER_ADMIN' },
      userCentres: []
    };

    const centreAAdmin = {
      id: 'admin-a',
      role: { name: 'CENTRE_ADMIN' },
      userCentres: [{ centreId: 'centre-alpha' }]
    };

    const centreBAdmin = {
      id: 'admin-b',
      role: { name: 'CENTRE_ADMIN' },
      userCentres: [{ centreId: 'centre-beta' }]
    };

    const studentUser = {
      id: 'student-user-1',
      role: { name: 'STUDENT' },
      userCentres: []
    };

    describe('1. Finance Multi-Centre Isolation', () => {
      let financeService: FinanceService;
      let mockPrisma: any;

      beforeEach(() => {
        mockPrisma = {
          transaction: {
            findMany: jest.fn(),
            create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'tx-1', ...args.data })),
          },
          feeRecord: {
            findMany: jest.fn(),
          },
        };
        financeService = new FinanceService(mockPrisma as any);
      });

      it('should scope getTransactions to authorized centre for centre admin', async () => {
        mockPrisma.transaction.findMany.mockResolvedValue([]);
        mockPrisma.feeRecord.findMany.mockResolvedValue([]);

        await financeService.getTransactions(centreAAdmin);

        expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: { centreId: { in: ['centre-alpha'] } },
        }));
        expect(mockPrisma.feeRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({
            status: 'PAID',
            student: {
              enrollments: {
                some: { batch: { centreId: { in: ['centre-alpha'] } } }
              }
            }
          }),
        }));
      });

      it('should allow superadmin to view all transactions and fees', async () => {
        mockPrisma.transaction.findMany.mockResolvedValue([]);
        mockPrisma.feeRecord.findMany.mockResolvedValue([]);

        await financeService.getTransactions(superAdmin);

        expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: {},
        }));
      });

      it('should reject transaction creation for unauthorized centre', async () => {
        await expect(
          financeService.createTransaction({
            category: 'Supplies',
            amount: 500,
            centreId: 'centre-beta',
          }, centreAAdmin)
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('2. Attendance Multi-Centre Isolation', () => {
      let attendanceService: AttendanceService;
      let mockPrisma: any;

      beforeEach(() => {
        mockPrisma = {
          batch: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
          },
          enrollment: {
            findMany: jest.fn(),
          },
          studentProfile: {
            findMany: jest.fn(),
          },
          attendance: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
          attendanceRecord: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        };
        attendanceService = new AttendanceService(mockPrisma as any);
      });

      it('should filter batch students to authorized centre when ALL is specified', async () => {
        mockPrisma.enrollment.findMany.mockResolvedValue([]);

        await attendanceService.getBatchStudents('ALL', undefined, centreAAdmin);

        expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({
            batch: { centreId: { in: ['centre-alpha'] } }
          })
        }));
        expect(mockPrisma.studentProfile.findMany).not.toHaveBeenCalled();
      });

      it('should reject filtering attendance by unauthorized centre', async () => {
        await expect(
          attendanceService.getAttendanceByFilter('centre-beta', 'b1', 's1', 't1', '2026-10-18', centreAAdmin)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject marking attendance for unauthorized batch', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({ id: 'batch-beta-1', centreId: 'centre-beta' });

        await expect(
          attendanceService.markAttendance({
            batchId: 'batch-beta-1',
            date: '2026-10-18',
            records: [],
          }, centreAAdmin)
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('3. Report IDOR Protection and Multi-Centre Scoping', () => {
      let reportService: ReportService;
      let mockPrisma: any;

      beforeEach(() => {
        mockPrisma = {
          studentProfile: {
            findUnique: jest.fn(),
            count: jest.fn().mockResolvedValue(10),
          },
          enquiry: {
            count: jest.fn().mockResolvedValue(5),
            findMany: jest.fn().mockResolvedValue([]),
          },
          attendanceRecord: {
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
          },
          transaction: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          feeRecord: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          studyMaterial: {
            count: jest.fn().mockResolvedValue(0),
          },
          examResult: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        reportService = new ReportService(mockPrisma as any);
      });

      it('should prevent student from accessing another student performance report', async () => {
        mockPrisma.studentProfile.findUnique.mockResolvedValue({
          id: 'sp-victim',
          userId: 'victim-user-id',
          user: { firstName: 'Victim', lastName: 'Student' },
          enrollments: [],
        });

        await expect(
          reportService.getSingleStudentPerformance('sp-victim', studentUser)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should allow student to access their own performance report', async () => {
        mockPrisma.studentProfile.findUnique.mockResolvedValue({
          id: 'sp-own',
          userId: 'student-user-1',
          user: { firstName: 'Own', lastName: 'Student' },
          enrollments: [],
        });

        const report = await reportService.getSingleStudentPerformance('sp-own', studentUser);
        expect(report.studentId).toBe('sp-own');
      });

      it('should prevent centre admin from accessing student performance outside their centre', async () => {
        mockPrisma.studentProfile.findUnique.mockResolvedValue({
          id: 'sp-beta',
          userId: 'user-beta',
          user: { firstName: 'Beta', lastName: 'Student' },
          enrollments: [{ batch: { id: 'b-beta', centreId: 'centre-beta' } }],
        });

        await expect(
          reportService.getSingleStudentPerformance('sp-beta', centreAAdmin)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should scope dashboard stats to authorized centre', async () => {
        await reportService.getDashboardStats(centreAAdmin);

        expect(mockPrisma.studentProfile.count).toHaveBeenCalledWith(expect.objectContaining({
          where: { enrollments: { some: { batch: { centreId: { in: ['centre-alpha'] } } } } }
        }));
        expect(mockPrisma.enquiry.count).toHaveBeenCalledWith(expect.objectContaining({
          where: { centreId: { in: ['centre-alpha'] } }
        }));
      });
    });

    describe('4. Assignment Grading Authorization and Scoping', () => {
      let assignmentsService: AssignmentsService;
      let mockPrisma: any;
      let mockNotifications: any;
      let mockSyllabus: any;

      beforeEach(() => {
        mockPrisma = {
          assignment: {
            findUnique: jest.fn(),
            create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'assign-1', ...args.data })),
          },
          assignmentSubmission: {
            findUnique: jest.fn(),
            update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
          },
          batch: {
            findUnique: jest.fn(),
          },
          enrollment: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        mockNotifications = { sendNotification: jest.fn().mockResolvedValue(true) };
        mockSyllabus = { recordStudentEvent: jest.fn() };
        assignmentsService = new AssignmentsService(mockPrisma as any, mockNotifications as any, mockSyllabus as any);
      });

      it('should reject grading submission from unauthorized centre', async () => {
        mockPrisma.assignmentSubmission.findUnique.mockResolvedValue({
          id: 'sub-beta',
          assignment: {
            batch: { centreId: 'centre-beta' }
          }
        });

        await expect(
          assignmentsService.gradeSubmission('sub-beta', { grade: 90 }, centreAAdmin)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject negative or non-numeric grade', async () => {
        mockPrisma.assignmentSubmission.findUnique.mockResolvedValue({
          id: 'sub-alpha',
          assignment: {
            batch: { centreId: 'centre-alpha' }
          }
        });

        await expect(
          assignmentsService.gradeSubmission('sub-alpha', { grade: -5 }, centreAAdmin)
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject creating assignment for batch in unauthorized centre', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({ id: 'batch-beta', centreId: 'centre-beta' });

        await expect(
          assignmentsService.create({
            title: 'Math Homework',
            batchId: 'batch-beta',
          }, 'admin-a', centreAAdmin)
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('5. Doubts Multi-Centre Isolation', () => {
      let doubtsService: DoubtsService;
      let mockPrisma: any;
      let mockNotifications: any;

      beforeEach(() => {
        mockPrisma = {
          doubt: {
            findMany: jest.fn().mockResolvedValue([]),
            findUnique: jest.fn(),
            update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
          },
          user: {
            findUnique: jest.fn(),
          },
          studentProfile: {
            findUnique: jest.fn(),
          },
        };
        mockNotifications = { sendNotification: jest.fn().mockResolvedValue(true) };
        doubtsService = new DoubtsService(mockPrisma as any, mockNotifications as any);
      });

      it('should scope getAll doubts to authorized centre for centre admin', async () => {
        await doubtsService.getAll('admin-a', 'CENTRE_ADMIN', {}, centreAAdmin);

        expect(mockPrisma.doubt.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({
            centreId: { in: ['centre-alpha'] }
          })
        }));
      });

      it('should reject centre admin accessing doubt from another centre', async () => {
        mockPrisma.doubt.findUnique.mockResolvedValue({
          id: 'doubt-beta',
          studentId: 'student-2',
          teacherId: 'teacher-2',
          centreId: 'centre-beta',
        });

        await expect(
          doubtsService.getById('doubt-beta', 'admin-a', 'CENTRE_ADMIN', centreAAdmin)
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('6. Forms Submission and Access Security', () => {
      let formsService: FormsService;
      let mockPrisma: any;
      let mockNotifications: any;

      beforeEach(() => {
        mockPrisma = {
          customForm: {
            findUnique: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'form-1', ...args.data })),
          },
          customFormResponse: {
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'resp-1', ...args.data })),
          },
          user: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        mockNotifications = { sendNotification: jest.fn().mockResolvedValue(true) };
        formsService = new FormsService(mockPrisma as any, mockNotifications as any);
      });

      it('should reject submission to an inactive form with BadRequestException', async () => {
        mockPrisma.customForm.findUnique.mockResolvedValue({ id: 'form-closed', isActive: false });

        await expect(
          formsService.submitResponse('form-closed', { answers: {} })
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject accessing responses for a form from another centre', async () => {
        mockPrisma.customForm.findUnique.mockResolvedValue({ id: 'form-beta', centreId: 'centre-beta' });

        await expect(
          formsService.getFormResponses('form-beta', centreAAdmin)
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('7. Session Revocation on Password Update', () => {
      let usersService: UsersService;
      let mockPrisma: any;
      let mockRedis: any;

      beforeEach(() => {
        mockPrisma = {
          user: {
            update: jest.fn().mockResolvedValue({
              id: 'user-1',
              firstName: 'Test',
              lastName: 'User',
              email: 'test@example.com',
            }),
          },
        };
        mockRedis = {
          revokeAllSessions: jest.fn().mockResolvedValue(true),
        };
        usersService = new UsersService(mockPrisma as any, mockRedis as any);
      });

      it('should revoke all active sessions when user updates password', async () => {
        await usersService.updateProfile('user-1', { password: 'NewSecurePassword123!' });

        expect(mockPrisma.user.update).toHaveBeenCalled();
        expect(mockRedis.revokeAllSessions).toHaveBeenCalledWith('user-1');
      });

      it('should not revoke sessions if password is not modified', async () => {
        await usersService.updateProfile('user-1', { firstName: 'Updated' });

        expect(mockPrisma.user.update).toHaveBeenCalled();
        expect(mockRedis.revokeAllSessions).not.toHaveBeenCalled();
      });
    });

    describe('8. Study Material Entity Integrity (No Dummy Entities)', () => {
      let estudyService: EstudyService;
      let mockPrisma: any;

      beforeEach(() => {
        mockPrisma = {
          syllabus: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          academicYear: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
          board: {
            findFirst: jest.fn(),
            create: jest.fn(),
          },
        };
        estudyService = new EstudyService(mockPrisma as any);
      });

      it('should reject material creation when no syllabus is configured instead of creating dummy entities', async () => {
        await expect(
          estudyService.createMaterial({ title: 'Physics Lecture 1' })
        ).rejects.toThrow(BadRequestException);

        expect(mockPrisma.board.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('SEC-14: Seventh-Pass Security Remediation Suite', () => {
    const superAdmin = {
      id: 'super-admin-1',
      role: { name: 'SUPER_ADMIN' },
      userCentres: []
    };

    const adminA = {
      id: 'admin-a',
      role: { name: 'CENTRE_ADMIN' },
      userCentres: [{ centreId: 'centre-alpha' }]
    };

    const adminB = {
      id: 'admin-b',
      role: { name: 'CENTRE_ADMIN' },
      userCentres: [{ centreId: 'centre-beta' }]
    };

    const teacherA = {
      id: 'teacher-a',
      role: { name: 'TEACHER' },
      userCentres: [{ centreId: 'centre-alpha' }]
    };

    const studentA1 = {
      id: 'student-u1',
      role: { name: 'STUDENT' },
      userCentres: [{ centreId: 'centre-alpha' }]
    };

    const studentA2 = {
      id: 'student-u2',
      role: { name: 'STUDENT' },
      userCentres: [{ centreId: 'centre-alpha' }]
    };

    describe('1. Assignment Access Control & Submission Privacy', () => {
      let assignmentsService: AssignmentsService;
      let mockPrisma: any;
      let mockNotifications: any;
      let mockSyllabus: any;

      beforeEach(() => {
        mockPrisma = {
          studentProfile: {
            findUnique: jest.fn(),
          },
          teacherProfile: {
            findUnique: jest.fn(),
          },
          assignment: {
            findUnique: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
            delete: jest.fn().mockResolvedValue({ id: 'asgn-1' }),
          },
          assignmentSubmission: {
            upsert: jest.fn().mockResolvedValue({ id: 'sub-1', status: 'SUBMITTED' }),
            findUnique: jest.fn(),
            update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
          },
          batch: {
            findUnique: jest.fn(),
          },
        };
        mockNotifications = { sendNotification: jest.fn().mockResolvedValue(true) };
        mockSyllabus = { recordStudentEvent: jest.fn().mockResolvedValue(true) };

        assignmentsService = new AssignmentsService(mockPrisma as any, mockNotifications as any, mockSyllabus as any);
      });

      it('should isolate student submissions so calling student only sees their own submission', async () => {
        mockPrisma.assignment.findUnique.mockResolvedValue({
          id: 'asgn-1',
          title: 'Math Homework',
          batchId: 'batch-alpha-1',
          batch: { centreId: 'centre-alpha' },
          submissions: [
            { id: 'sub-1', studentId: 'sp-1', student: { user: { firstName: 'Alice' } } },
            { id: 'sub-2', studentId: 'sp-2', student: { user: { firstName: 'Bob' } } },
          ]
        });

        mockPrisma.studentProfile.findUnique.mockResolvedValue({
          id: 'sp-1',
          userId: 'student-u1',
          enrollments: [{ batchId: 'batch-alpha-1' }]
        });

        const result = await assignmentsService.getOne('asgn-1', studentA1);
        expect(result.submissions).toHaveLength(1);
        expect(result.submissions[0].studentId).toBe('sp-1');
      });

      it('should reject getOne for student not enrolled in the assignment batch', async () => {
        mockPrisma.assignment.findUnique.mockResolvedValue({
          id: 'asgn-1',
          batchId: 'batch-alpha-other',
          batch: { centreId: 'centre-alpha' },
          submissions: []
        });

        mockPrisma.studentProfile.findUnique.mockResolvedValue({
          id: 'sp-1',
          userId: 'student-u1',
          enrollments: [{ batchId: 'batch-alpha-1' }]
        });

        await expect(
          assignmentsService.getOne('asgn-1', studentA1)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject student submitting on behalf of another user', async () => {
        await expect(
          assignmentsService.submit('asgn-1', 'other-student-id', { attachments: [] }, studentA1)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject submission if student is not enrolled in assignment batch', async () => {
        mockPrisma.studentProfile.findUnique.mockResolvedValue({
          id: 'sp-1',
          userId: 'student-u1',
          enrollments: [{ batchId: 'batch-alpha-1' }]
        });

        mockPrisma.assignment.findUnique.mockResolvedValue({
          id: 'asgn-1',
          batchId: 'batch-alpha-2',
          batch: { centreId: 'centre-alpha' },
        });

        await expect(
          assignmentsService.submit('asgn-1', 'student-u1', { attachments: [] }, studentA1)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should prevent Centre Admin of Centre A from updating Centre B assignment', async () => {
        mockPrisma.assignment.findUnique.mockResolvedValue({
          id: 'asgn-beta',
          batch: { centreId: 'centre-beta' },
          uploaderId: 'user-b'
        });

        await expect(
          assignmentsService.update('asgn-beta', { title: 'Hacked' }, adminA.id, 'CENTRE_ADMIN', adminA)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should prevent Centre Admin of Centre A from deleting Centre B assignment', async () => {
        mockPrisma.assignment.findUnique.mockResolvedValue({
          id: 'asgn-beta',
          batch: { centreId: 'centre-beta' },
          uploaderId: 'user-b'
        });

        await expect(
          assignmentsService.delete('asgn-beta', adminA.id, 'CENTRE_ADMIN', adminA)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should prevent teacher from grading an assignment in an unauthorized centre', async () => {
        mockPrisma.assignmentSubmission.findUnique.mockResolvedValue({
          id: 'sub-beta',
          assignment: {
            batch: { centreId: 'centre-beta' },
            uploaderId: 'other-teacher'
          }
        });

        await expect(
          assignmentsService.gradeSubmission('sub-beta', { grade: 90 }, teacherA)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject negative or non-finite grades during grading', async () => {
        mockPrisma.assignmentSubmission.findUnique.mockResolvedValue({
          id: 'sub-alpha',
          assignment: {
            batch: { centreId: 'centre-alpha' },
            uploaderId: teacherA.id
          }
        });

        await expect(
          assignmentsService.gradeSubmission('sub-alpha', { grade: -10 }, teacherA)
        ).rejects.toThrow(BadRequestException);

        await expect(
          assignmentsService.gradeSubmission('sub-alpha', { grade: NaN }, teacherA)
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('2. Exam, Attendance and Overview Analytics Isolation', () => {
      let reportService: ReportService;
      let mockPrisma: any;

      beforeEach(() => {
        mockPrisma = {
          exam: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          attendance: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          transaction: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          feeRecord: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          attendanceRecord: {
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
          },
          examResult: {
            findMany: jest.fn().mockResolvedValue([]),
          },
          enquiry: {
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
          },
          studentProfile: {
            count: jest.fn().mockResolvedValue(0),
          },
          studyMaterial: {
            count: jest.fn().mockResolvedValue(0),
          },
          teacherProfile: {
            findUnique: jest.fn(),
          },
        };
        reportService = new ReportService(mockPrisma as any);
      });

      it('should scope getExamsAnalytics to caller authorized centres when centreId is omitted', async () => {
        await reportService.getExamsAnalytics(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, adminA);

        expect(mockPrisma.exam.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              centreId: { in: ['centre-alpha'] }
            })
          })
        );
      });

      it('should reject getExamsAnalytics when caller requests an unauthorized centreId', async () => {
        await expect(
          reportService.getExamsAnalytics(undefined, undefined, undefined, undefined, 'centre-beta', undefined, undefined, undefined, undefined, undefined, adminA)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should scope getAttendanceAnalytics to caller authorized centres', async () => {
        await reportService.getAttendanceAnalytics(undefined, undefined, undefined, undefined, undefined, undefined, undefined, adminA);

        expect(mockPrisma.attendance.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              batch: expect.objectContaining({
                centreId: { in: ['centre-alpha'] }
              })
            })
          })
        );
      });

      it('should reject getAttendanceAnalytics for unauthorized cross-centre access', async () => {
        await expect(
          reportService.getAttendanceAnalytics(undefined, undefined, undefined, 'centre-beta', undefined, undefined, undefined, adminA)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should filter overview analytics active students and fees by authorized centres', async () => {
        await reportService.getOverviewAnalytics(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, adminA);

        expect(mockPrisma.studentProfile.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              enrollments: {
                some: {
                  batch: { centreId: { in: ['centre-alpha'] } }
                }
              }
            })
          })
        );
      });
    });

    describe('3. Setup and Academic-Configuration Permissions', () => {
      let setupService: SetupService;
      let mockPrisma: any;

      beforeEach(() => {
        mockPrisma = {
          batch: {
            create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'b-new', ...args.data })),
            findUnique: jest.fn(),
            delete: jest.fn().mockResolvedValue({ id: 'b-del' }),
          },
        };
        setupService = new SetupService(mockPrisma as any);
      });

      it('should reject Centre Admin creating a batch in another centre', async () => {
        await expect(
          setupService.createBatch(
            { name: 'Batch Beta', academicYearId: 'ay-1', boardId: 'bd-1', standardId: 'std-1', centreId: 'centre-beta' },
            adminA
          )
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject Centre Admin deleting a batch in another centre', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({
          id: 'batch-beta-1',
          centreId: 'centre-beta',
          _count: { enrollments: 0, assignments: 0, exams: 0 }
        });

        await expect(
          setupService.deleteBatch('batch-beta-1', adminA)
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('4. Attendance Authorization and Atomic Integrity', () => {
      let attendanceService: AttendanceService;
      let mockPrisma: any;

      beforeEach(() => {
        mockPrisma = {
          batch: {
            findUnique: jest.fn(),
          },
          studentProfile: {
            findMany: jest.fn(),
          },
          attendance: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'att-1' }),
            update: jest.fn().mockResolvedValue({ id: 'att-1' }),
          },
          attendanceRecord: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
        };
        attendanceService = new AttendanceService(mockPrisma as any);
      });

      it('should reject marking attendance when centre scope is unauthorized', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({
          id: 'batch-beta-1',
          centreId: 'centre-beta',
        });

        await expect(
          attendanceService.markAttendance(
            { batchId: 'batch-beta-1', date: '2026-10-18', records: [{ studentId: 'sp-1', status: 'PRESENT' }] },
            adminA
          )
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject attendance marking if duplicate students exist in the request', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({
          id: 'batch-alpha-1',
          centreId: 'centre-alpha',
        });

        await expect(
          attendanceService.markAttendance(
            {
              batchId: 'batch-alpha-1',
              date: '2026-10-18',
              records: [
                { studentId: 'sp-1', status: 'PRESENT' },
                { studentId: 'sp-1', status: 'ABSENT' },
              ]
            },
            adminA
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject attendance marking if invalid status enum is passed', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({
          id: 'batch-alpha-1',
          centreId: 'centre-alpha',
        });

        await expect(
          attendanceService.markAttendance(
            {
              batchId: 'batch-alpha-1',
              date: '2026-10-18',
              records: [{ studentId: 'sp-1', status: 'MAYBE' }]
            },
            adminA
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject attendance marking if student is not enrolled in the batch', async () => {
        mockPrisma.batch.findUnique.mockResolvedValue({
          id: 'batch-alpha-1',
          centreId: 'centre-alpha',
        });

        // Student exists but has no enrollment in batch-alpha-1
        mockPrisma.studentProfile.findMany.mockResolvedValue([
          { id: 'sp-1', enrollments: [] }
        ]);

        await expect(
          attendanceService.markAttendance(
            {
              batchId: 'batch-alpha-1',
              date: '2026-10-18',
              records: [{ studentId: 'sp-1', status: 'PRESENT' }]
            },
            adminA
          )
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('5. Doubt Threads & Reassignment Security', () => {
      let doubtsService: DoubtsService;
      let mockPrisma: any;
      let mockNotifications: any;

      beforeEach(() => {
        mockPrisma = {
          doubt: {
            findUnique: jest.fn(),
            update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
          },
          doubtMessage: {
            create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
          },
          user: {
            findUnique: jest.fn(),
          },
        };
        mockNotifications = { sendNotification: jest.fn().mockResolvedValue(true) };
        doubtsService = new DoubtsService(mockPrisma as any, mockNotifications as any);
      });

      it('should reject reassigning doubt thread to a non-teacher user', async () => {
        mockPrisma.doubt.findUnique.mockResolvedValue({
          id: 'doubt-1',
          centreId: 'centre-alpha',
          teacherId: 'teacher-a'
        });

        // Target user is a student, not a teacher
        mockPrisma.user.findUnique.mockResolvedValue({
          id: 'student-u1',
          role: { name: 'STUDENT' },
          status: 'ACTIVE',
          userCentres: [{ centreId: 'centre-alpha' }],
        });

        await expect(
          doubtsService.reassign('doubt-1', adminA.id, 'CENTRE_ADMIN', 'student-u1', adminA)
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject reassigning doubt thread to a teacher in another centre', async () => {
        mockPrisma.doubt.findUnique.mockResolvedValue({
          id: 'doubt-1',
          centreId: 'centre-alpha',
          teacherId: 'teacher-a'
        });

        // Target teacher belongs to centre-beta only
        mockPrisma.user.findUnique.mockResolvedValue({
          id: 'teacher-b',
          role: { name: 'TEACHER' },
          status: 'ACTIVE',
          userCentres: [{ centreId: 'centre-beta' }],
        });

        await expect(
          doubtsService.reassign('doubt-1', adminA.id, 'CENTRE_ADMIN', 'teacher-b', adminA)
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('6. Forms and Global vs Centre Ownership', () => {
      let formsService: FormsService;
      let mockPrisma: any;
      let mockNotifications: any;

      beforeEach(() => {
        mockPrisma = {
          customForm: {
            findUnique: jest.fn(),
            update: jest.fn().mockImplementation((args) => Promise.resolve({ id: args.where.id, ...args.data })),
            delete: jest.fn().mockResolvedValue({ id: 'form-1' }),
          },
          customFormResponse: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        mockNotifications = { sendNotification: jest.fn().mockResolvedValue(true) };
        formsService = new FormsService(mockPrisma as any, mockNotifications as any);
      });

      it('should reject non-superadmin modifying a global form (centreId null)', async () => {
        mockPrisma.customForm.findUnique.mockResolvedValue({
          id: 'form-global',
          centreId: null,
        });

        await expect(
          formsService.updateForm('form-global', { title: 'New Title' }, adminA)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject non-superadmin deleting a global form (centreId null)', async () => {
        mockPrisma.customForm.findUnique.mockResolvedValue({
          id: 'form-global',
          centreId: null,
        });

        await expect(
          formsService.deleteForm('form-global', adminA)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should reject non-superadmin viewing responses to a global form', async () => {
        mockPrisma.customForm.findUnique.mockResolvedValue({
          id: 'form-global',
          centreId: null,
        });

        await expect(
          formsService.getFormResponses('form-global', adminA)
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('7. Financial Validation & State Integrity', () => {
      let financeService: FinanceService;
      let mockPrisma: any;

      beforeEach(() => {
        mockPrisma = {
          transaction: {
            create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'tx-1', ...args.data })),
          },
        };
        financeService = new FinanceService(mockPrisma as any);
      });

      it('should reject transactions with negative or non-finite amounts', async () => {
        await expect(
          financeService.createTransaction(
            { category: 'Supplies', amount: -50, centreId: 'centre-alpha' },
            adminA
          )
        ).rejects.toThrow(BadRequestException);

        await expect(
          financeService.createTransaction(
            { category: 'Supplies', amount: 0, centreId: 'centre-alpha' },
            adminA
          )
        ).rejects.toThrow(BadRequestException);

        await expect(
          financeService.createTransaction(
            { category: 'Supplies', amount: Infinity, centreId: 'centre-alpha' },
            adminA
          )
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject transactions with invalid transaction type enum', async () => {
        await expect(
          financeService.createTransaction(
            { category: 'Supplies', amount: 100, type: 'INVALID_TYPE', centreId: 'centre-alpha' },
            adminA
          )
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('8. Storage Upload Security and Extension Validation', () => {
      let storageService: StorageService;

      beforeEach(() => {
        process.env.CLOUDFLARE_ACCOUNT_ID = 'mock-account';
        process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'mock-key';
        process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'mock-secret';
        storageService = new StorageService();
      });

      afterEach(() => {
        delete process.env.CLOUDFLARE_ACCOUNT_ID;
        delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
        delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
      });

      it('should reject disallowed executable extensions', async () => {
        await expect(
          storageService.getPresignedUploadUrl('malicious.exe', 'application/octet-stream')
        ).rejects.toThrow(BadRequestException);

        await expect(
          storageService.getPresignedUploadUrl('script.sh', 'application/x-sh')
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject unlisted file extensions outside the allowlist', async () => {
        await expect(
          storageService.getPresignedUploadUrl('payload.xyz', 'application/octet-stream')
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('9. SEC-15: Eighth-Pass Cross-Centre Authorization, Resource Scoping and IDOR Protection', () => {
      let mockPrisma: any;
      let studyMaterialService: StudyMaterialService;
      let storageService: StorageService;
      let reportService: ReportService;
      let assignmentsService: AssignmentsService;
      let attendanceService: AttendanceService;
      let setupService: SetupService;

      beforeEach(() => {
        mockPrisma = {
          studyMaterial: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
          },
          academicYear: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
          },
          syllabus: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
          },
          studentProfile: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
          },
          teacherProfile: {
            findUnique: jest.fn(),
          },
          attendance: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
          attendanceRecord: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
          assignment: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
          assignmentSubmission: {
            findUnique: jest.fn(),
            update: jest.fn(),
            upsert: jest.fn(),
          },
          batch: {
            findUnique: jest.fn(),
            delete: jest.fn(),
          },
          enrollment: {
            findMany: jest.fn(),
          },
          exam: {
            findMany: jest.fn(),
          },
          $transaction: jest.fn((cb) => cb(mockPrisma)),
        };

        studyMaterialService = new StudyMaterialService(mockPrisma);
        storageService = new StorageService();
        reportService = new ReportService(mockPrisma);
        assignmentsService = new AssignmentsService(mockPrisma, { sendNotification: jest.fn() } as any, {} as any);
        attendanceService = new AttendanceService(mockPrisma);
        setupService = new SetupService(mockPrisma);
      });

      describe('A. Study Material IDOR & Cross-Centre Access Control', () => {
        const materialCentreA: any = {
          id: 'mat-centre-a',
          title: 'Physics Chapter 1 Notes',
          url: 'https://cdn.example.com/materials/physics.pdf',
          thumbnailUrl: 'https://cdn.example.com/thumbnails/physics.jpg',
          uploaderId: 'teacher-a-id',
          syllabus: { subjectId: 'phys-id', standardId: 'std-10' },
          academicYearId: 'ay-2026',
          uploader: {
            userCentres: [{ centreId: 'centre-alpha' }],
          },
          targetTrack: {
            batches: [{ centreId: 'centre-alpha' }],
          },
        };

        const centreAdminB: any = {
          id: 'admin-b-id',
          role: { name: 'CENTRE_ADMIN' },
          userCentres: [{ centreId: 'centre-beta' }],
        };

        const teacherB: any = {
          id: 'teacher-b-id',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-beta' }],
        };

        it('should deny cross-centre material retrieval for Centre Admins', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue(materialCentreA);

          await expect(
            studyMaterialService.getById('mat-centre-a', centreAdminB)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should deny cross-centre material retrieval for Teachers from another centre', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue(materialCentreA);
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherB.id,
            assignments: [{ subjectId: 'phys-id', standardId: 'std-10', batch: { centreId: 'centre-beta' } }],
          });

          await expect(
            studyMaterialService.getById('mat-centre-a', teacherB)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should deny deletion of study material by Centre Admin of another centre', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue(materialCentreA);

          await expect(
            studyMaterialService.delete('mat-centre-a', centreAdminB)
          ).rejects.toThrow(ForbiddenException);
          expect(mockPrisma.studyMaterial.delete).not.toHaveBeenCalled();
        });

        it('should deny deletion of study material by a teacher who is not the uploader', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue(materialCentreA);
          const teacherAlphaOther: any = {
            id: 'teacher-a-other',
            role: { name: 'TEACHER' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherAlphaOther.id,
            assignments: [{ subjectId: 'phys-id', standardId: 'std-10', batch: { centreId: 'centre-alpha' } }],
          });

          await expect(
            studyMaterialService.delete('mat-centre-a', teacherAlphaOther)
          ).rejects.toThrow(ForbiddenException);
          expect(mockPrisma.studyMaterial.delete).not.toHaveBeenCalled();
        });

        it('should not delete storage files when controller delete fails authorization', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue(materialCentreA);
          const deleteFileSpy = jest.spyOn(storageService, 'deleteFile');

          const controller = new StudyMaterialController(
            studyMaterialService,
            storageService,
            { getDirectUploadUrl: jest.fn() } as any
          );

          await expect(
            controller.delete('mat-centre-a', { user: centreAdminB })
          ).rejects.toThrow(ForbiddenException);

          expect(deleteFileSpy).not.toHaveBeenCalled();
        });
      });

      describe('B. Teacher-Scoped Attendance & Exam Analytics Compound Tuples', () => {
        it('should scope teacher attendance analytics to exact compound (batchId AND subjectId) assignment tuples', async () => {
          const teacherUser: any = {
            id: 'teacher-1',
            role: { name: 'TEACHER' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };

          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherUser.id,
            assignments: [
              { batchId: 'batch-math', subjectId: 'subj-math' },
              { batchId: 'batch-sci', subjectId: 'subj-sci' },
            ],
          });
          mockPrisma.attendance.findMany.mockResolvedValue([]);

          await reportService.getAttendanceAnalytics(undefined, undefined, undefined, 'centre-alpha', undefined, undefined, undefined, teacherUser);

          expect(mockPrisma.attendance.findMany).toHaveBeenCalledTimes(1);
          const queryWhere = mockPrisma.attendance.findMany.mock.calls[0][0].where;

          expect(queryWhere.OR).toEqual([
            { subjectId: 'subj-math', batchId: 'batch-math' },
            { subjectId: 'subj-sci', batchId: 'batch-sci' },
          ]);
          expect(queryWhere.OR).not.toContainEqual({ batchId: { in: ['batch-math', 'batch-sci'] } });
        });

        it('should return empty attendance report if teacher has only incomplete assignments', async () => {
          const teacherUser: any = {
            id: 'teacher-incomplete',
            role: { name: 'TEACHER' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };

          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherUser.id,
            assignments: [
              { batchId: null, subjectId: null },
              { batchId: 'batch-1', subjectId: null },
            ],
          });

          const result = await reportService.getAttendanceAnalytics(undefined, undefined, undefined, 'centre-alpha', undefined, undefined, undefined, teacherUser);
          expect(result.summary.totalSessions).toBe(0);
          expect(mockPrisma.attendance.findMany).not.toHaveBeenCalled();
        });

        it('should prevent empty {} predicate in exam analytics when teacher assignment lacks subject or scope', async () => {
          const teacherUser: any = {
            id: 'teacher-exam',
            role: { name: 'TEACHER' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };

          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherUser.id,
            assignments: [
              { batchId: null, subjectId: null, standardId: null, boardId: null },
            ],
          });

          const result = await reportService.getExamsAnalytics(undefined, undefined, undefined, undefined, 'centre-alpha', undefined, undefined, undefined, undefined, undefined, teacherUser);
          expect(result.summary.totalExams).toBe(0);
          expect(mockPrisma.exam.findMany).not.toHaveBeenCalled();
        });
      });

      describe('C. Centre-Less Assignment Access Denial & Wildcard Removal', () => {
        const centrelessAssignment: any = {
          id: 'asg-centreless',
          title: 'Orphan Assignment',
          batchId: 'batch-no-centre',
          subjectId: 'subj-math',
          batch: {
            id: 'batch-no-centre',
            centreId: null,
          },
          submissions: [],
        };

        const centreAdminA: any = {
          id: 'admin-a',
          role: { name: 'CENTRE_ADMIN' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should fail closed when attempting to fetch centre-less assignment by ID', async () => {
          mockPrisma.assignment.findUnique.mockResolvedValue(centrelessAssignment);

          await expect(
            assignmentsService.getOne('asg-centreless', centreAdminA)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should deny updating centre-less assignments for non-superadmin users', async () => {
          mockPrisma.assignment.findUnique.mockResolvedValue(centrelessAssignment);

          await expect(
            assignmentsService.update('asg-centreless', { title: 'New Title' }, centreAdminA.id, 'CENTRE_ADMIN', centreAdminA)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should deny deleting centre-less assignments for non-superadmin users', async () => {
          mockPrisma.assignment.findUnique.mockResolvedValue(centrelessAssignment);

          await expect(
            assignmentsService.delete('asg-centreless', centreAdminA.id, 'CENTRE_ADMIN', centreAdminA)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should deny submission for centre-less assignments', async () => {
          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'std-profile-1',
            userId: 'student-user-1',
            user: { firstName: 'John', lastName: 'Doe' },
            enrollments: [{ batchId: 'batch-no-centre' }],
          });
          mockPrisma.assignment.findUnique.mockResolvedValue(centrelessAssignment);

          await expect(
            assignmentsService.submit('asg-centreless', 'student-user-1', { content: 'test' }, { id: 'student-user-1', role: 'STUDENT', userCentres: [{ centreId: 'centre-alpha' }] })
          ).rejects.toThrow(ForbiddenException);
        });

        it('should deny wildcard matching for teachers with incomplete or different subject assignments in getOne', async () => {
          const assignmentWithCentre: any = {
            id: 'asg-with-centre',
            title: 'Math Assignment',
            batchId: 'batch-alpha-1',
            subjectId: 'math-id',
            uploaderId: 'other-teacher',
            batch: {
              id: 'batch-alpha-1',
              centreId: 'centre-alpha',
              standardId: 'std-10',
            },
            submissions: [],
          };
          mockPrisma.assignment.findUnique.mockResolvedValue(assignmentWithCentre);

          const teacherUser: any = {
            id: 'teacher-chem',
            role: { name: 'TEACHER' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherUser.id,
            assignments: [
              { batchId: 'batch-alpha-1', subjectId: 'chem-id' },
              { batchId: 'batch-alpha-1', subjectId: null },
            ],
          });

          await expect(
            assignmentsService.getOne('asg-with-centre', teacherUser)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should deny wildcard matching for teachers in gradeSubmission', async () => {
          mockPrisma.assignmentSubmission.findUnique.mockResolvedValue({
            id: 'sub-1',
            assignment: {
              id: 'asg-math',
              subjectId: 'math-id',
              batchId: 'batch-alpha-1',
              uploaderId: 'uploader-t',
              batch: { centreId: 'centre-alpha', standardId: 'std-10' },
            },
          });

          const teacherUser: any = {
            id: 'teacher-chem',
            role: { name: 'TEACHER' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherUser.id,
            assignments: [
              { batchId: 'batch-alpha-1', subjectId: 'chem-id' },
            ],
          });

          await expect(
            assignmentsService.gradeSubmission('sub-1', { grade: 85 }, teacherUser)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('D. Attendance Operations with batchId = ALL', () => {
        it('should reject teachers attempting to mark centre-wide attendance with ALL batch path', async () => {
          const teacherUser: any = {
            id: 'teacher-1',
            role: { name: 'TEACHER' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };

          await expect(
            attendanceService.markAttendance(
              {
                batchId: 'ALL',
                centreId: 'centre-alpha',
                date: '2026-10-18',
                records: [{ studentId: 'student-1', status: 'PRESENT' }],
              },
              teacherUser
            )
          ).rejects.toThrow(ForbiddenException);
        });

        it('should reject teachers attempting to retrieve all students across centre using ALL', async () => {
          const teacherUser: any = {
            id: 'teacher-1',
            role: { name: 'TEACHER' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };

          await expect(
            attendanceService.getBatchStudents('ALL', undefined, teacherUser)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should validate all students belong to centre when Centre Admin marks attendance with ALL', async () => {
          const centreAdminA: any = {
            id: 'admin-a',
            role: { name: 'CENTRE_ADMIN' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };

          mockPrisma.studentProfile.findMany.mockResolvedValue([
            { id: 'student-1', enrollments: [{ id: 'enr-1', batch: { centreId: 'centre-alpha' } }] },
            { id: 'student-2', enrollments: [] },
          ]);

          await expect(
            attendanceService.markAttendance(
              {
                batchId: 'ALL',
                centreId: 'centre-alpha',
                date: '2026-10-18',
                records: [
                  { studentId: 'student-1', status: 'PRESENT' },
                  { studentId: 'student-2', status: 'PRESENT' },
                ],
              },
              centreAdminA
            )
          ).rejects.toThrow(BadRequestException);
        });
      });

      describe('E. Study-Material Creation Academic Resolution & Batch Deletion', () => {
        it('should reject study material creation when academicYearId cannot be deterministically found', async () => {
          mockPrisma.academicYear.findUnique.mockResolvedValue(null);

          await expect(
            studyMaterialService.create({
              title: 'Physics Book',
              type: 'PDF',
              academicYearId: 'invalid-year-id',
              syllabusId: 'syl-1',
            })
          ).rejects.toThrow(BadRequestException);
        });

        it('should reject study material creation when syllabus is missing and cannot be resolved', async () => {
          mockPrisma.academicYear.findUnique.mockResolvedValue({ id: 'ay-1', isActive: true });

          await expect(
            studyMaterialService.create({
              title: 'Physics Book',
              type: 'PDF',
              academicYearId: 'ay-1',
            })
          ).rejects.toThrow(BadRequestException);
        });

        it('should reject batch deletion when batch centre cannot be established for Centre Admin', async () => {
          const centreAdminA: any = {
            id: 'admin-a',
            role: { name: 'CENTRE_ADMIN' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };
          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-orphan',
            centreId: null,
            _count: { enrollments: 0, assignments: 0, exams: 0 },
          });

          await expect(
            setupService.deleteBatch('batch-orphan', centreAdminA)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('F. Storage Upload Extension & MIME Type Compatibility', () => {
        beforeEach(() => {
          process.env.CLOUDFLARE_ACCOUNT_ID = 'mock-account';
          process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'mock-key';
          process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'mock-secret';
        });

        afterEach(() => {
          delete process.env.CLOUDFLARE_ACCOUNT_ID;
          delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
          delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
        });

        it('should reject uploads where MIME type does not match file extension family', async () => {
          await expect(
            storageService.getPresignedUploadUrl('malicious.pdf', 'video/mp4')
          ).rejects.toThrow(BadRequestException);

          await expect(
            storageService.getPresignedUploadUrl('photo.jpg', 'application/pdf')
          ).rejects.toThrow(BadRequestException);
        });

        it('should reject excessively long filenames (>255 characters)', async () => {
          const longName = 'a'.repeat(256) + '.png';
          await expect(
            storageService.getPresignedUploadUrl(longName, 'image/png')
          ).rejects.toThrow(BadRequestException);
        });

        it('should accept valid and compatible file extension and MIME type', async () => {
          const res = await storageService.getPresignedUploadUrl('lecture_notes.pdf', 'application/pdf');
          expect(res).toHaveProperty('uploadUrl');
          expect(res).toHaveProperty('objectKey');
        });
      });
    });

    describe('SEC-16: Ninth-Pass Security Remediation & Storage Ownership Suite', () => {
      let mockPrisma: any;
      let studyMaterialService: StudyMaterialService;
      let storageService: StorageService;
      let attendanceService: AttendanceService;
      let reportService: ReportService;

      beforeEach(() => {
        mockPrisma = {
          studyMaterial: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
          },
          studyMaterialProgress: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
          },
          academicYear: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
          },
          syllabus: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
          },
          targetTrack: {
            findUnique: jest.fn(),
          },
          studentProfile: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
          },
          teacherProfile: {
            findUnique: jest.fn(),
          },
          batch: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
          },
          enrollment: {
            findMany: jest.fn(),
          },
          attendance: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
          },
          attendanceRecord: {
            findMany: jest.fn(),
          },
          $transaction: jest.fn((cb) => cb(mockPrisma)),
        };

        studyMaterialService = new StudyMaterialService(mockPrisma);
        storageService = new StorageService();
        attendanceService = new AttendanceService(mockPrisma);
        reportService = new ReportService(mockPrisma);

        process.env.CLOUDFLARE_ACCOUNT_ID = 'mock-account';
        process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'mock-key';
        process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'mock-secret';
        process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN = 'cdn.educare.test';
      });

      afterEach(() => {
        delete process.env.CLOUDFLARE_ACCOUNT_ID;
        delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
        delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
        delete process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN;
      });

      describe('A. Study Material Consistent Authorization (getAll & getByTopic & updateProgress)', () => {
        const centreAdminA: any = {
          id: 'admin-a',
          role: { name: 'CENTRE_ADMIN' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        const teacherA: any = {
          id: 'teacher-a',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should filter getByTopic by centre and uploader for Centre Admin', async () => {
          mockPrisma.studyMaterial.findMany.mockResolvedValue([]);

          await studyMaterialService.getByTopic('topic-1', centreAdminA);

          expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                topicId: 'topic-1',
                OR: expect.arrayContaining([
                  { uploader: { userCentres: { some: { centreId: { in: ['centre-alpha'] } } } } },
                  { uploaderId: 'admin-a' },
                ]),
              }),
            })
          );
        });

        it('should filter getByTopic by centre and teacher assignments for Teacher', async () => {
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [{ subjectId: 'math-subj', standardId: 'std-10' }],
          });
          mockPrisma.studyMaterial.findMany.mockResolvedValue([]);

          await studyMaterialService.getByTopic('topic-math', teacherA);

          expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                topicId: 'topic-math',
                AND: expect.arrayContaining([
                  expect.objectContaining({
                    OR: expect.arrayContaining([
                      { uploader: { userCentres: { some: { centreId: { in: ['centre-alpha'] } } } } },
                      { uploaderId: 'teacher-a' },
                    ]),
                  }),
                  expect.objectContaining({
                    OR: expect.arrayContaining([
                      { uploaderId: 'teacher-a' },
                      {
                        syllabus: {
                          subjectId: { in: ['math-subj'] },
                          standardId: { in: ['std-10'] },
                        },
                      },
                    ]),
                  }),
                ]),
              }),
            })
          );
        });

        it('should filter getAll for Centre Admin without bypassing on null track from other centres', async () => {
          mockPrisma.studyMaterial.findMany.mockResolvedValue([]);

          await studyMaterialService.getAll(centreAdminA);

          expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: {
                OR: [
                  { uploader: { userCentres: { some: { centreId: { in: ['centre-alpha'] } } } } },
                  { targetTrack: { batches: { some: { centreId: { in: ['centre-alpha'] } } } } },
                  { uploaderId: 'admin-a' },
                  { uploader: { role: { name: 'SUPER_ADMIN' } }, targetTrackId: null },
                  { uploaderId: null, targetTrackId: null },
                ],
              },
            })
          );
        });

        it('should prevent student from updating progress on unauthorized study material', async () => {
          const studentUser: any = { id: 'student-user-1', role: { name: 'STUDENT' } };
          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'student-profile-1',
            userId: 'student-user-1',
            enrollments: [{
              trackId: 'track-1',
              batch: { centreId: 'centre-alpha', standardId: 'std-9', boardId: 'board-cbse' },
            }],
          });
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-diff-centre',
            syllabus: { standardId: 'std-12', boardId: 'board-cbse' },
            uploader: { userCentres: [{ centreId: 'centre-beta' }] },
            targetTrack: { batches: [{ centreId: 'centre-beta' }] },
          });

          await expect(
            studyMaterialService.updateProgress('mat-diff-centre', studentUser.id, { isOpened: true }, studentUser)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('B. Secure Storage Object Ownership & Deletion', () => {
        it('should reject deleting objects via untrusted or external URLs', async () => {
          const result1 = await storageService.deleteFile('https://attacker-domain.com/materials/stolen.pdf');
          expect(result1).toBe(false);

          const result2 = await storageService.deleteFile('https://youtube.com/watch?v=12345');
          expect(result2).toBe(false);
        });

        it('should reject deleting objects with path traversal sequences', async () => {
          const result = await storageService.deleteFile('materials/../../etc/passwd');
          expect(result).toBe(false);
        });

        it('should reject deleting objects outside managed prefixes (materials/ and forms/)', async () => {
          const result = await storageService.deleteFile('users/avatars/admin.png');
          expect(result).toBe(false);
        });

        it('should reject generating download URLs for unmanaged or external keys', async () => {
          await expect(
            storageService.getPresignedDownloadUrl('https://evil.com/payload.exe')
          ).rejects.toThrow(BadRequestException);
        });
      });

      describe('C. Study Material Creation Scope & Deterministic Academic Year', () => {
        const centreAdminA: any = {
          id: 'admin-a',
          role: { name: 'CENTRE_ADMIN' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        const teacherA: any = {
          id: 'teacher-a',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should reject material creation when multiple active academic years exist and academicYearId is omitted', async () => {
          mockPrisma.academicYear.findMany.mockResolvedValue([
            { id: 'ay-2025', name: '2025-2026', isActive: true },
            { id: 'ay-2026', name: '2026-2027', isActive: true },
          ]);

          await expect(
            studyMaterialService.create({
              title: 'Chemistry Notes',
              type: 'PDF',
              syllabusId: 'syl-1',
            }, centreAdminA)
          ).rejects.toThrow(BadRequestException);
        });

        it('should reject target track outside caller centre', async () => {
          mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-2026', isActive: true }]);
          mockPrisma.syllabus.findUnique.mockResolvedValue({ id: 'syl-1' });
          mockPrisma.targetTrack.findUnique.mockResolvedValue({
            id: 'track-beta',
            batches: [{ centreId: 'centre-beta' }],
          });

          await expect(
            studyMaterialService.create({
              title: 'Chemistry Notes',
              type: 'PDF',
              syllabusId: 'syl-1',
              targetTrackId: 'track-beta',
            }, centreAdminA)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should reject target track when teacher is not assigned to any batch in that track', async () => {
          mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-2026', isActive: true }]);
          mockPrisma.syllabus.findUnique.mockResolvedValue({ id: 'syl-1', subjectId: 'chem', standardId: 'std-10' });
          mockPrisma.targetTrack.findUnique.mockResolvedValue({
            id: 'track-alpha-neet',
            batches: [{ id: 'batch-neet-1', centreId: 'centre-alpha', trackId: 'track-alpha-neet' }],
          });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [{
              subjectId: 'chem',
              standardId: 'std-10',
              batch: { id: 'batch-jee-1', trackId: 'track-alpha-jee' },
            }],
          });

          await expect(
            studyMaterialService.create({
              title: 'Chemistry Notes',
              type: 'PDF',
              syllabusId: 'syl-1',
              targetTrackId: 'track-alpha-neet',
            }, teacherA)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('D. Teacher Assignment Checks on Attendance Reads', () => {
        const teacherA: any = {
          id: 'teacher-a',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should reject getAttendanceForBatchAndDate when teacher is not assigned to batch', async () => {
          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-unassigned',
            centreId: 'centre-alpha',
            standardId: 'std-10',
          });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [{ batchId: 'batch-assigned-1', subjectId: 'math' }],
          });

          await expect(
            attendanceService.getAttendanceForBatchAndDate('batch-unassigned', '2026-10-18', undefined, teacherA)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should reject getStudentsByFilter when teacher is not assigned to standard/track in centre', async () => {
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [{
              standardId: 'std-11',
              batch: { centreId: 'centre-alpha', standardId: 'std-11', boardId: 'cbse', trackId: 'science' },
            }],
          });

          await expect(
            attendanceService.getStudentsByFilter('centre-alpha', 'cbse', 'std-10', 'commerce', teacherA)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should reject getAttendanceByFilter when teacher is not assigned to standard/track in centre', async () => {
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [{
              standardId: 'std-11',
              batch: { centreId: 'centre-alpha', standardId: 'std-11', boardId: 'cbse', trackId: 'science' },
            }],
          });

          await expect(
            attendanceService.getAttendanceByFilter('centre-alpha', 'cbse', 'std-10', 'commerce', '2026-10-18', teacherA)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('E. Student Performance Report Batch Scope for Teachers', () => {
        const teacherA: any = {
          id: 'teacher-a',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should reject getStudentPerformanceReport when teacher is not assigned to requested batch', async () => {
          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-not-mine',
            centreId: 'centre-alpha',
            standardId: 'std-10',
          });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [{ batchId: 'batch-mine-1', standardId: 'std-12' }],
          });

          await expect(
            reportService.getStudentPerformanceReport('batch-not-mine', teacherA)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should scope getStudentPerformanceReport to assigned batches when batchId is omitted', async () => {
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [{ batchId: 'batch-mine-1', batch: { id: 'batch-mine-1' } }],
          });
          mockPrisma.enrollment.findMany.mockResolvedValue([]);
          mockPrisma.attendanceRecord.findMany.mockResolvedValue([]);

          await reportService.getStudentPerformanceReport(undefined, teacherA);

          expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                batch: expect.objectContaining({
                  centreId: { in: ['centre-alpha'] },
                  OR: [{ id: { in: ['batch-mine-1'] } }],
                }),
              }),
            })
          );
        });

        it('should reject getSingleStudentPerformance when teacher is not assigned to student batch', async () => {
          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'student-1',
            userId: 'student-user-1',
            enrollments: [{
              batchId: 'batch-unassigned',
              batch: { id: 'batch-unassigned', centreId: 'centre-alpha', standardId: 'std-10' },
            }],
          });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [{ batchId: 'batch-assigned-2', standardId: 'std-12' }],
          });

          await expect(
            reportService.getSingleStudentPerformance('student-1', teacherA)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('F. Strict Storage MIME Validation & Parameter Handling', () => {
        it('should strip parameters cleanly from MIME type and accept valid pair', async () => {
          const res = await storageService.getPresignedUploadUrl('doc.txt', 'text/plain; charset=utf-8');
          expect(res).toHaveProperty('uploadUrl');
          expect(res).toHaveProperty('objectKey');
        });

        it('should reject prefix spoofed MIME types', async () => {
          await expect(
            storageService.getPresignedUploadUrl('image.jpg', 'image/jpeg.malicious')
          ).rejects.toThrow(BadRequestException);
        });
      });
    });
  });
});


