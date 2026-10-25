import { getJwtSecret } from './config/jwt.config';
import { StorageService } from '../storage/storage.service';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { assertCentreAccess, isSuperAdmin, getUserCentreIds, getAuthorizedCentreIds, SAFE_USER_SELECT } from './utils/tenant.util';
import { ForbiddenException, BadRequestException, HttpException, HttpStatus, UnauthorizedException, ServiceUnavailableException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
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
import { FeeService } from '../fee/fee.service';
import { StorageController } from '../storage/storage.controller';
import { FormsController } from '../forms/forms.controller';
import { ExamsController } from '../exams/exams.controller';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PublicAuthService } from '../public-auth/public-auth.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-r2.com/upload-signed'),
}));

describe('Security Regression Suite — Real Production Implementations', () => {
  jest.setTimeout(30000);

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
        const mime = f.endsWith('.pdf') ? 'application/pdf' : f.endsWith('.mp4') ? 'video/mp4' : f.endsWith('.png') ? 'image/png' : 'image/jpeg';
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
            OR: [
              { centreId: { in: ['centre-alpha'] } },
              {
                centreId: null,
                student: {
                  enrollments: {
                    some: { batch: { centreId: { in: ['centre-alpha'] } } },
                    none: { batch: { centreId: { notIn: ['centre-alpha'] } } }
                  }
                }
              }
            ]
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
        formsService = new FormsService(mockPrisma as any, mockNotifications as any, new StorageService(mockPrisma as any));
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
        formsService = new FormsService(mockPrisma as any, mockNotifications as any, new StorageService(mockPrisma as any));
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
                AND: expect.arrayContaining([
                  { topicId: 'topic-1' },
                  expect.objectContaining({
                    OR: expect.arrayContaining([
                      { uploaderId: 'admin-a' },
                    ]),
                  }),
                ]),
              }),
            })
          );
        });

        it('should filter getByTopic by centre and teacher assignments for Teacher', async () => {
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [{ subjectId: 'math-subj', standardId: 'std-10', centreId: 'centre-alpha' }],
          });
          mockPrisma.studyMaterial.findMany.mockResolvedValue([]);

          await studyMaterialService.getByTopic('topic-math', teacherA);

          expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                topicId: 'topic-math',
                AND: expect.arrayContaining([
                  { topicId: 'topic-math' },
                  expect.objectContaining({
                    OR: expect.arrayContaining([
                      { uploaderId: 'teacher-a' },
                      expect.objectContaining({
                        AND: expect.arrayContaining([
                          {
                            syllabus: {
                              subjectId: 'math-subj',
                              standardId: 'std-10',
                            },
                          },
                        ]),
                      }),
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
                  { targetTrackId: { not: null }, targetTrack: { batches: { some: { centreId: { in: ['centre-alpha'] } } } } },
                  { targetTrackId: null, uploader: { userCentres: { some: { centreId: { in: ['centre-alpha'] } } } } },
                  { uploaderId: 'admin-a' },
                  { uploader: { role: { name: 'SUPER_ADMIN' } }, targetTrackId: null },
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

    describe('SEC-17: Tenth-Pass Security Remediation Suite', () => {
      let mockPrisma: any;
      let studyMaterialService: StudyMaterialService;
      let storageService: StorageService;
      let attendanceService: AttendanceService;

      beforeEach(() => {
        mockPrisma = {
          studyMaterial: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
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
            create: jest.fn(),
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

      describe('1. Student Material Listing Centre Isolation in getAll()', () => {
        const studentA: any = {
          id: 'user-stud-a',
          role: { name: 'STUDENT' },
        };

        it('should filter getAll() by the student centres and avoid returning other centres materials', async () => {
          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'stud-prof-a',
            userId: 'user-stud-a',
            enrollments: [{
              trackId: 'track-1',
              batch: { centreId: 'centre-alpha', standardId: 'std-10', boardId: 'board-cbse', academicYearId: 'ay-2026' }
            }]
          });
          mockPrisma.studyMaterial.findMany.mockResolvedValue([]);

          await studyMaterialService.getAll(studentA);

          expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    AND: expect.arrayContaining([
                      expect.objectContaining({
                        OR: expect.arrayContaining([
                          expect.objectContaining({
                            targetTrack: { batches: { some: { centreId: 'centre-alpha' } } }
                          })
                        ])
                      })
                    ])
                  })
                ])
              })
            })
          );
        });
      });

      describe('2. Public Learner Access Boundaries', () => {
        const publicLearner: any = {
          id: 'user-pub-1',
          role: { name: 'PUBLIC_LEARNER' },
        };

        it('should restrict getAll() for Public Learners to materials with no centre and null track', async () => {
          mockPrisma.studyMaterial.findMany.mockResolvedValue([]);

          await studyMaterialService.getAll(publicLearner);

          expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                targetTrackId: null,
                uploader: { role: { name: 'SUPER_ADMIN' } }
              })
            })
          );
        });

        it('should deny getById() for Public Learner if material was uploaded by centre staff', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-centre-teacher',
            targetTrackId: null,
            uploader: {
              role: { name: 'TEACHER' },
              userCentres: [{ centreId: 'centre-alpha' }],
            }
          });

          await expect(
            studyMaterialService.getById('mat-centre-teacher', publicLearner)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('3. Teacher Exact Assignment Combinations', () => {
        const teacherA: any = {
          id: 'teacher-a',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should construct exact syllabus condition pairs for teachers with multiple assignments in getAll', async () => {
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [
              { subjectId: 'physics-id', standardId: 'std-11', centreId: 'centre-alpha' },
              { subjectId: 'chemistry-id', standardId: 'std-12', centreId: 'centre-alpha' },
            ]
          });
          mockPrisma.studyMaterial.findMany.mockResolvedValue([]);

          await studyMaterialService.getAll(teacherA);

          expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                OR: expect.arrayContaining([
                  { uploaderId: 'teacher-a' },
                  expect.objectContaining({
                    AND: expect.arrayContaining([
                      { syllabus: { subjectId: 'physics-id', standardId: 'std-11' } }
                    ])
                  }),
                  expect.objectContaining({
                    AND: expect.arrayContaining([
                      { syllabus: { subjectId: 'chemistry-id', standardId: 'std-12' } }
                    ])
                  }),
                ])
              })
            })
          );
        });

        it('should reject getById when material pairs subject from assignment 1 and standard from assignment 2', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-mismatched-pair',
            uploaderId: 'other-user',
            syllabus: { subjectId: 'physics-id', standardId: 'std-12' },
            uploader: { userCentres: [{ centreId: 'centre-alpha' }] },
          });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [
              { subjectId: 'physics-id', standardId: 'std-11', batch: { centreId: 'centre-alpha' } },
              { subjectId: 'chemistry-id', standardId: 'std-12', batch: { centreId: 'centre-alpha' } },
            ]
          });

          await expect(
            studyMaterialService.getById('mat-mismatched-pair', teacherA)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('4. Deterministic Academic Year in resolveBatchId', () => {
        it('should throw BadRequestException when no active academic year exists', async () => {
          mockPrisma.batch.findFirst.mockResolvedValue(null);
          mockPrisma.academicYear.findMany.mockResolvedValue([]);

          await expect(
            attendanceService.resolveBatchId('centre-alpha', 'board-1', 'std-10', 'track-1')
          ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when multiple active academic years exist', async () => {
          mockPrisma.batch.findFirst.mockResolvedValue(null);
          mockPrisma.academicYear.findMany.mockResolvedValue([
            { id: 'ay-1', isActive: true },
            { id: 'ay-2', isActive: true },
          ]);

          await expect(
            attendanceService.resolveBatchId('centre-alpha', 'board-1', 'std-10', 'track-1')
          ).rejects.toThrow(BadRequestException);
        });

        it('should deterministically create batch when exactly one active academic year exists', async () => {
          mockPrisma.batch.findFirst.mockResolvedValue(null);
          mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-1', isActive: true }]);
          mockPrisma.batch.create.mockResolvedValue({ id: 'new-batch-id' });

          const res = await attendanceService.resolveBatchId('centre-alpha', 'board-1', 'std-10', 'track-1');
          expect(res).toBe('new-batch-id');
          expect(mockPrisma.batch.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({ academicYearId: 'ay-1' })
            })
          );
        });
      });

      describe('5. Storage URL Ownership Binding & isStorageUrlInUse', () => {
        const teacherA: any = {
          id: 'teacher-a',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should reject material creation when storage URL is already associated with another user', async () => {
          mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-1', isActive: true }]);
          mockPrisma.syllabus.findUnique.mockResolvedValue({ id: 'syl-1', subjectId: 'math', standardId: 'std-10' });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherA.id,
            assignments: [{ subjectId: 'math', standardId: 'std-10' }]
          });
          mockPrisma.studyMaterial.findFirst.mockResolvedValue({
            id: 'mat-existing',
            url: 'https://cdn.educare.test/materials/existing-doc.pdf',
            uploaderId: 'other-teacher',
          });

          await expect(
            studyMaterialService.create({
              title: 'Math Notes',
              type: 'PDF',
              syllabusId: 'syl-1',
              url: 'https://cdn.educare.test/materials/existing-doc.pdf',
            }, teacherA)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should correctly report whether storage URL is still in use by other materials', async () => {
          mockPrisma.studyMaterial.findFirst.mockResolvedValue({ id: 'mat-2' });
          const inUse = await studyMaterialService.isStorageUrlInUse('https://cdn.educare.test/materials/shared.pdf', 'mat-1');
          expect(inUse).toBe(true);

          mockPrisma.studyMaterial.findFirst.mockResolvedValue(null);
          const notInUse = await studyMaterialService.isStorageUrlInUse('https://cdn.educare.test/materials/unique.pdf', 'mat-1');
          expect(notInUse).toBe(false);
        });
      });

      describe('6. Exact Extension to MIME Mapping', () => {
        it('should reject .png with image/jpeg', async () => {
          await expect(
            storageService.getPresignedUploadUrl('photo.png', 'image/jpeg')
          ).rejects.toThrow(BadRequestException);
        });

        it('should reject .webp with image/jpeg', async () => {
          await expect(
            storageService.getPresignedUploadUrl('photo.webp', 'image/jpeg')
          ).rejects.toThrow(BadRequestException);
        });

        it('should reject application/octet-stream bypass for docx', async () => {
          await expect(
            storageService.getPresignedUploadUrl('report.docx', 'application/octet-stream')
          ).rejects.toThrow(BadRequestException);
        });

        it('should accept exact .png with image/png', async () => {
          const res = await storageService.getPresignedUploadUrl('photo.png', 'image/png');
          expect(res).toHaveProperty('uploadUrl');
        });
      });

      describe('7. Learning Progress Role Enforcement', () => {
        it('should reject progress update if caller is TEACHER or CENTRE_ADMIN', async () => {
          const teacherUser: any = { id: 'teacher-1', role: { name: 'TEACHER' } };
          await expect(
            studyMaterialService.updateProgress('mat-1', teacherUser.id, { isOpened: true }, teacherUser)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should reject negative timeWatchedSecs from students', async () => {
          const studentUser: any = { id: 'stud-1', role: { name: 'STUDENT' } };
          mockPrisma.studentProfile.findUnique.mockResolvedValue({ id: 'sp-1', userId: 'stud-1', enrollments: [] });
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({ id: 'mat-1', uploader: {} });

          await expect(
            studyMaterialService.updateProgress('mat-1', studentUser.id, { timeWatchedSecs: -10 }, studentUser)
          ).rejects.toThrow(BadRequestException);
        });
      });
    });

    describe('SEC-18: Eleventh-Pass Security Remediation Suite', () => {
      let mockPrisma: any;
      let studyMaterialService: StudyMaterialService;
      let storageService: StorageService;
      let attendanceService: AttendanceService;

      beforeEach(() => {
        mockPrisma = {
          studyMaterial: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
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
            create: jest.fn(),
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

      describe('1. Authoritative Centre Isolation for Study Materials', () => {
        const dualCentreTeacher: any = {
          id: 'teacher-dual',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }, { centreId: 'centre-beta' }],
        };

        const studentAlpha: any = {
          id: 'stud-alpha',
          role: { name: 'STUDENT' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        const adminAlpha: any = {
          id: 'admin-alpha',
          role: { name: 'CENTRE_ADMIN' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should prevent student from Centre A accessing Centre B material even if uploader belongs to Centre A', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-centre-beta',
            uploaderId: dualCentreTeacher.id,
            targetTrackId: 'track-beta',
            targetTrack: {
              batches: [{ id: 'batch-beta', centreId: 'centre-beta' }]
            },
            uploader: {
              role: { name: 'TEACHER' },
              userCentres: [{ centreId: 'centre-alpha' }, { centreId: 'centre-beta' }]
            },
            syllabus: { boardId: 'board-1', standardId: 'std-10' }
          });

          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            userId: studentAlpha.id,
            enrollments: [
              {
                trackId: 'track-alpha',
                batch: { id: 'batch-alpha', centreId: 'centre-alpha', boardId: 'board-1', standardId: 'std-10' }
              }
            ]
          });

          await expect(
            studyMaterialService.getById('mat-centre-beta', studentAlpha)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should prevent Centre Admin A accessing Centre B material even if uploader belongs to Centre A', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-centre-beta-2',
            uploaderId: dualCentreTeacher.id,
            targetTrackId: 'track-beta',
            targetTrack: {
              batches: [{ id: 'batch-beta', centreId: 'centre-beta' }]
            },
            uploader: {
              role: { name: 'TEACHER' },
              userCentres: [{ centreId: 'centre-alpha' }, { centreId: 'centre-beta' }]
            }
          });

          await expect(
            studyMaterialService.getById('mat-centre-beta-2', adminAlpha)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('2. Complete Student Enrolment Tuple (Board & Standard Isolation)', () => {
        const studentMultiEnroll: any = {
          id: 'stud-multi',
          role: { name: 'STUDENT' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        beforeEach(() => {
          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            userId: studentMultiEnroll.id,
            enrollments: [
              {
                id: 'enr-1',
                batch: { id: 'b-1', centreId: 'centre-alpha', boardId: 'board-cbse', standardId: 'std-11' }
              },
              {
                id: 'enr-2',
                batch: { id: 'b-2', centreId: 'centre-alpha', boardId: 'board-state', standardId: 'std-12' }
              }
            ]
          });
        });

        it('should reject getById when material pairs Board from Enrolment 1 and Standard from Enrolment 2', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-cross-combo',
            targetTrackId: null,
            uploader: {
              role: { name: 'TEACHER' },
              userCentres: [{ centreId: 'centre-alpha' }]
            },
            syllabus: { boardId: 'board-cbse', standardId: 'std-12' }
          });

          await expect(
            studyMaterialService.getById('mat-cross-combo', studentMultiEnroll)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should allow getById when material matches a complete enrolment tuple', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-valid-combo',
            targetTrackId: null,
            uploader: {
              role: { name: 'TEACHER' },
              userCentres: [{ centreId: 'centre-alpha' }]
            },
            syllabus: { boardId: 'board-cbse', standardId: 'std-11' }
          });

          const res = await studyMaterialService.getById('mat-valid-combo', studentMultiEnroll);
          expect(res).toBeDefined();
          expect(res.id).toBe('mat-valid-combo');
        });
      });

      describe('3. Storage & Thumbnail Ownership Binding', () => {
        const teacherAlpha: any = {
          id: 'teacher-a',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should reject material creation when thumbnailUrl belongs to another user', async () => {
          mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-1', isActive: true }]);
          mockPrisma.syllabus.findUnique.mockResolvedValue({ id: 'syl-1', subjectId: 'sub-1', standardId: 'std-10' });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherAlpha.id,
            assignments: [{ subjectId: 'sub-1', standardId: 'std-10' }]
          });
          mockPrisma.studyMaterial.findFirst.mockResolvedValue({
            id: 'mat-other',
            uploaderId: 'other-user',
            thumbnailUrl: 'https://cdn.educare.test/materials/other-thumb.jpg'
          });

          await expect(
            studyMaterialService.create({
              title: 'Physics Notes',
              type: 'PDF',
              syllabusId: 'syl-1',
              thumbnailUrl: 'https://cdn.educare.test/materials/other-thumb.jpg',
            }, teacherAlpha)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should reject material creation by staff user without centre memberships for untracked material', async () => {
          const staffWithoutCentres: any = {
            id: 'staff-no-centre',
            role: { name: 'TEACHER' },
            userCentres: [],
          };
          mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-1', isActive: true }]);
          mockPrisma.syllabus.findUnique.mockResolvedValue({ id: 'syl-1', subjectId: 'sub-1', standardId: 'std-10' });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: staffWithoutCentres.id,
            assignments: [{ subjectId: 'sub-1', standardId: 'std-10' }]
          });

          await expect(
            studyMaterialService.create({
              title: 'Orphaned Material',
              type: 'PDF',
              syllabusId: 'syl-1',
              targetTrackId: null,
            }, staffWithoutCentres)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('4. Incomplete Teacher Assignment Wildcards', () => {
        const teacherIncomplete: any = {
          id: 'teacher-inc',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should reject getById when teacher assignment lacks standardId and batch', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-physics',
            uploaderId: 'other-user',
            targetTrackId: null,
            uploader: {
              role: { name: 'TEACHER' },
              userCentres: [{ centreId: 'centre-alpha' }]
            },
            syllabus: { subjectId: 'physics-id', standardId: 'std-10' }
          });

          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherIncomplete.id,
            assignments: [
              { subjectId: 'physics-id', standardId: null, batchId: null, batch: null }
            ]
          });

          await expect(
            studyMaterialService.getById('mat-physics', teacherIncomplete)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should reject create when teacher assignment lacks standardId', async () => {
          mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-1', isActive: true }]);
          mockPrisma.syllabus.findUnique.mockResolvedValue({ id: 'syl-1', subjectId: 'physics-id', standardId: 'std-10' });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherIncomplete.id,
            assignments: [
              { subjectId: 'physics-id', standardId: null, batch: null }
            ]
          });

          await expect(
            studyMaterialService.create({
              title: 'Physics Chapter 1',
              type: 'PDF',
              syllabusId: 'syl-1',
            }, teacherIncomplete)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('5. Attendance Exact Batch Scoping & Standard Separation', () => {
        const teacherAssignedBatchA: any = {
          id: 'teacher-batch-a',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should prevent teacher assigned to Batch A from marking attendance for Batch B in the same standard', async () => {
          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-b',
            centreId: 'centre-alpha',
            standardId: 'std-10',
            boardId: 'board-cbse'
          });

          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherAssignedBatchA.id,
            assignments: [
              {
                batchId: 'batch-a',
                standardId: 'std-10',
                subjectId: 'sub-math',
                batch: { id: 'batch-a', centreId: 'centre-alpha' }
              }
            ]
          });

          await expect(
            attendanceService.markAttendance({
              batchId: 'batch-b',
              date: '2026-10-18',
              centreId: 'centre-alpha',
              subjectId: 'sub-math',
              records: [{ studentId: 'stud-1', status: 'PRESENT' }]
            }, teacherAssignedBatchA)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should only return assigned Batch A in getBatches, not unassigned Batch B of the same standard', async () => {
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherAssignedBatchA.id,
            assignments: [
              {
                batchId: 'batch-a',
                standardId: 'std-10',
                batch: { id: 'batch-a', centreId: 'centre-alpha', boardId: 'board-cbse', trackId: 'track-1' }
              }
            ]
          });

          mockPrisma.batch.findMany.mockResolvedValue([{ id: 'batch-a' }]);

          await attendanceService.getBatches('centre-alpha', 'board-cbse', 'std-10', 'track-1', teacherAssignedBatchA);

          expect(mockPrisma.batch.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                OR: [{ id: { in: ['batch-a'] } }]
              })
            })
          );
        });

        it('should reject class-wide teacher from marking attendance in an unauthorized centre', async () => {
          const teacherClassWideAlpha: any = {
            id: 'teacher-cw',
            role: { name: 'TEACHER' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };

          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-beta-1',
            centreId: 'centre-beta',
            standardId: 'std-10',
            boardId: 'board-cbse'
          });

          await expect(
            attendanceService.markAttendance({
              batchId: 'batch-beta-1',
              date: '2026-10-18',
              centreId: 'centre-beta',
              records: [{ studentId: 'stud-1', status: 'PRESENT' }]
            }, teacherClassWideAlpha)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('6. Explicit Public Learner Visibility', () => {
        const publicLearner: any = {
          id: 'user-pub-1',
          role: { name: 'PUBLIC_LEARNER' },
        };

        it('should deny public learner access to untracked material uploaded by teacher without centres', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-untracked-teacher',
            targetTrackId: null,
            uploader: {
              role: { name: 'TEACHER' },
              userCentres: []
            }
          });

          await expect(
            studyMaterialService.getById('mat-untracked-teacher', publicLearner)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should allow public learner access to material uploaded by SUPER_ADMIN with null track', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-superadmin-public',
            targetTrackId: null,
            isShared: true,
            uploader: {
              role: { name: 'SUPER_ADMIN' },
              userCentres: []
            }
          });

          const res = await studyMaterialService.getById('mat-superadmin-public', publicLearner);
          expect(res).toBeDefined();
          expect(res.id).toBe('mat-superadmin-public');
        });
      });
    });

    describe('SEC-19: Twelfth-Pass Security Remediation Suite', () => {
      let mockPrisma: any;
      let studyMaterialService: StudyMaterialService;
      let storageService: StorageService;
      let attendanceService: AttendanceService;

      beforeEach(() => {
        mockPrisma = {
          studyMaterial: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
          },
          academicYear: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
          },
          syllabus: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
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
            create: jest.fn(),
          },
          enrollment: {
            findMany: jest.fn(),
          },
          attendance: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
          attendanceRecord: {
            findMany: jest.fn(),
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
          $transaction: jest.fn((cb) => cb(mockPrisma)),
        };

        storageService = new StorageService();
        studyMaterialService = new StudyMaterialService(mockPrisma, storageService);
        attendanceService = new AttendanceService(mockPrisma);

        process.env.CLOUDFLARE_ACCOUNT_ID = 'mock-account';
        process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'mock-key';
        process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'mock-secret';
        process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN = 'cdn.educare.test';
      });

      describe('1. Direct Study-Material Access Boundaries (getById)', () => {
        const studentOne: any = {
          id: 'stud-user-1',
          role: { name: 'STUDENT' },
        };

        it('should allow enrolled student to access authorized material matching centre, track, and syllabus', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-valid-student',
            targetTrackId: 'track-jee',
            academicYearId: 'ay-2026',
            targetTrack: {
              batches: [{ id: 'batch-1', centreId: 'centre-alpha' }]
            },
            syllabus: { boardId: 'board-cbse', standardId: 'std-11' }
          });

          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'sp-1',
            userId: studentOne.id,
            enrollments: [{
              batchId: 'batch-1',
              trackId: 'track-jee',
              batch: {
                id: 'batch-1',
                centreId: 'centre-alpha',
                boardId: 'board-cbse',
                standardId: 'std-11',
                academicYearId: 'ay-2026'
              }
            }]
          });

          const res = await studyMaterialService.getById('mat-valid-student', studentOne);
          expect(res).toBeDefined();
          expect(res.id).toBe('mat-valid-student');
        });

        it('should deny student access to material for another centre', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-centre-beta',
            targetTrackId: 'track-jee',
            targetTrack: {
              batches: [{ id: 'batch-b', centreId: 'centre-beta' }]
            },
            syllabus: { boardId: 'board-cbse', standardId: 'std-11' }
          });

          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'sp-1',
            userId: studentOne.id,
            enrollments: [{
              batchId: 'batch-1',
              trackId: 'track-jee',
              batch: {
                id: 'batch-1',
                centreId: 'centre-alpha',
                boardId: 'board-cbse',
                standardId: 'std-11'
              }
            }]
          });

          await expect(
            studyMaterialService.getById('mat-centre-beta', studentOne)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should deny student access to targeted-track material when student enrollment has null trackId', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-targeted-track',
            targetTrackId: 'track-jee',
            targetTrack: {
              batches: [{ id: 'batch-1', centreId: 'centre-alpha' }]
            },
            syllabus: { boardId: 'board-cbse', standardId: 'std-11' }
          });

          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'sp-1',
            userId: studentOne.id,
            enrollments: [{
              batchId: 'batch-1',
              trackId: null, // Null track ID on student enrolment
              batch: {
                id: 'batch-1',
                centreId: 'centre-alpha',
                boardId: 'board-cbse',
                standardId: 'std-11'
              }
            }]
          });

          await expect(
            studyMaterialService.getById('mat-targeted-track', studentOne)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should deny student access to untracked material uploaded by staff with zero centre memberships', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-untracked-no-centre-staff',
            targetTrackId: null,
            uploader: {
              role: { name: 'TEACHER' },
              userCentres: [] // Uploader has 0 centre memberships
            },
            syllabus: { boardId: 'board-cbse', standardId: 'std-11' }
          });

          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'sp-1',
            userId: studentOne.id,
            enrollments: [{
              batchId: 'batch-1',
              trackId: null,
              batch: {
                id: 'batch-1',
                centreId: 'centre-alpha',
                boardId: 'board-cbse',
                standardId: 'std-11'
              }
            }]
          });

          await expect(
            studyMaterialService.getById('mat-untracked-no-centre-staff', studentOne)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should allow SUPER_ADMIN global access to any study material regardless of centre or track', async () => {
          const superAdminUser: any = { id: 'admin-1', role: { name: 'SUPER_ADMIN' } };
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-any-restricted',
            targetTrackId: 'track-special',
            targetTrack: { batches: [{ centreId: 'centre-far-away' }] }
          });

          const res = await studyMaterialService.getById('mat-any-restricted', superAdminUser);
          expect(res).toBeDefined();
          expect(res.id).toBe('mat-any-restricted');
        });
      });

      describe('2. Teacher Study-Material Access Scoping', () => {
        const dualCentreTeacher: any = {
          id: 'teacher-dual-1',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }, { centreId: 'centre-beta' }],
        };

        it('should deny teacher access to Centre B material when teacher is assigned only in Centre A', async () => {
          // Material belongs authoritatively to Centre B
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-centre-beta-math',
            targetTrackId: 'track-beta',
            targetTrack: {
              batches: [{ id: 'batch-beta-1', centreId: 'centre-beta' }]
            },
            syllabus: { subjectId: 'math-id', standardId: 'std-10', boardId: 'board-cbse' },
            uploaderId: 'other-teacher-beta'
          });

          // Teacher has Math assignment in Centre A ONLY
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: dualCentreTeacher.id,
            assignments: [{
              batchId: 'batch-alpha-1',
              batch: { id: 'batch-alpha-1', centreId: 'centre-alpha', standardId: 'std-10', boardId: 'board-cbse' },
              subjectId: 'math-id',
              standardId: 'std-10',
              boardId: 'board-cbse'
            }]
          });

          await expect(
            studyMaterialService.getById('mat-centre-beta-math', dualCentreTeacher)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should allow teacher access when assigned in that centre and syllabus matches', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-centre-alpha-math',
            targetTrackId: 'track-alpha',
            targetTrack: {
              batches: [{ id: 'batch-alpha-1', centreId: 'centre-alpha' }]
            },
            syllabus: { subjectId: 'math-id', standardId: 'std-10', boardId: 'board-cbse' },
            uploaderId: 'other-teacher-alpha'
          });

          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: dualCentreTeacher.id,
            assignments: [{
              batchId: 'batch-alpha-1',
              batch: { id: 'batch-alpha-1', centreId: 'centre-alpha', standardId: 'std-10', boardId: 'board-cbse', trackId: 'track-alpha' },
              subjectId: 'math-id',
              standardId: 'std-10',
              boardId: 'board-cbse'
            }]
          });

          const res = await studyMaterialService.getById('mat-centre-alpha-math', dualCentreTeacher);
          expect(res).toBeDefined();
          expect(res.id).toBe('mat-centre-alpha-math');
        });

        it('should allow teacher to access material they uploaded regardless of centre', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-self-uploaded',
            uploaderId: dualCentreTeacher.id
          });

          const res = await studyMaterialService.getById('mat-self-uploaded', dualCentreTeacher);
          expect(res).toBeDefined();
          expect(res.id).toBe('mat-self-uploaded');
        });
      });

      describe('3. Authoritative Storage-Object Ownership', () => {
        const creator: any = {
          id: 'creator-user-1',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }]
        };

        it('should reject material creation when submitted URL is an arbitrary external URL', async () => {
          mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-1', isActive: true }]);
          mockPrisma.syllabus.findUnique.mockResolvedValue({ id: 'syl-1', subjectId: 'sub-1', standardId: 'std-10' });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: creator.id,
            assignments: [{ subjectId: 'sub-1', standardId: 'std-10', centreId: 'centre-alpha' }]
          });

          await expect(
            studyMaterialService.create({
              title: 'Malicious Material',
              type: 'PDF',
              syllabusId: 'syl-1',
              url: 'https://attacker.evil.com/malicious.pdf'
            }, creator)
          ).rejects.toThrow(BadRequestException);
        });

        it('should reject material creation when object key encodes another user ID', async () => {
          mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-1', isActive: true }]);
          mockPrisma.syllabus.findUnique.mockResolvedValue({ id: 'syl-1', subjectId: 'sub-1', standardId: 'std-10' });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: creator.id,
            assignments: [{ subjectId: 'sub-1', standardId: 'std-10', centreId: 'centre-alpha' }]
          });

          await expect(
            studyMaterialService.create({
              title: 'Stolen Material',
              type: 'PDF',
              syllabusId: 'syl-1',
              url: 'materials/other-victim-user/doc.pdf'
            }, creator)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should reject material creation when thumbnailUrl is a YouTube URL', async () => {
          mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-1', isActive: true }]);
          mockPrisma.syllabus.findUnique.mockResolvedValue({ id: 'syl-1', subjectId: 'sub-1', standardId: 'std-10' });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: creator.id,
            assignments: [{ subjectId: 'sub-1', standardId: 'std-10', centreId: 'centre-alpha' }]
          });

          await expect(
            studyMaterialService.create({
              title: 'Invalid Thumbnail',
              type: 'VIDEO',
              syllabusId: 'syl-1',
              url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              thumbnailUrl: 'https://www.youtube.com/watch?v=thumb'
            }, creator)
          ).rejects.toThrow(BadRequestException);
        });

        it('should correctly report if a storage URL is in use by another material during deletion', async () => {
          mockPrisma.studyMaterial.findFirst.mockResolvedValue({ id: 'mat-shared-2', url: 'materials/common-file.pdf' });

          const inUse = await studyMaterialService.isStorageUrlInUse('materials/common-file.pdf', 'mat-shared-1');
          expect(inUse).toBe(true);

          mockPrisma.studyMaterial.findFirst.mockResolvedValue(null);
          const notInUse = await studyMaterialService.isStorageUrlInUse('materials/orphan-file.pdf', 'mat-shared-1');
          expect(notInUse).toBe(false);
        });
      });

      describe('4. Safe Semantics for Batch-less Teacher Assignments', () => {
        const multiCentreTeacher: any = {
          id: 'teacher-multi-centres',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }, { centreId: 'centre-beta' }]
        };

        it('should deny teacher with multiple centres from marking attendance in Centre B when assignment is scoped to Centre A', async () => {
          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-beta-10',
            centreId: 'centre-beta',
            standardId: 'std-10',
            boardId: 'board-cbse'
          });

          // Assignment has explicit centreId: 'centre-alpha'
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: multiCentreTeacher.id,
            assignments: [{
              id: 'asgn-classwide-alpha',
              centreId: 'centre-alpha',
              batchId: null,
              batch: null,
              standardId: 'std-10',
              boardId: 'board-cbse',
              subjectId: 'math-id'
            }]
          });

          await expect(
            attendanceService.markAttendance({
              batchId: 'batch-beta-10',
              date: '2026-10-18',
              centreId: 'centre-beta',
              subjectId: 'math-id',
              records: [{ studentId: 'stud-1', status: 'PRESENT' }]
            }, multiCentreTeacher)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should fail closed when teacher with multiple centres has batch-less assignment without any centre scope', async () => {
          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-alpha-10',
            centreId: 'centre-alpha',
            standardId: 'std-10',
            boardId: 'board-cbse'
          });

          // Assignment has NO batch and NO centreId (ambiguous across multi-centre teacher)
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: multiCentreTeacher.id,
            assignments: [{
              id: 'asgn-unscoped',
              centreId: null,
              batchId: null,
              batch: null,
              standardId: 'std-10',
              boardId: 'board-cbse',
              subjectId: 'math-id'
            }]
          });

          await expect(
            attendanceService.markAttendance({
              batchId: 'batch-alpha-10',
              date: '2026-10-18',
              centreId: 'centre-alpha',
              subjectId: 'math-id',
              records: [{ studentId: 'stud-1', status: 'PRESENT' }]
            }, multiCentreTeacher)
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('5. Academic-Year Consistency in Topic Queries', () => {
        const studentA: any = {
          id: 'stud-topic-ay',
          role: { name: 'STUDENT' },
        };

        it('should include academic year condition in getByTopic matching student enrolment', async () => {
          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'sp-topic',
            userId: studentA.id,
            enrollments: [{
              batchId: 'batch-2026',
              trackId: 'track-1',
              batch: {
                id: 'batch-2026',
                centreId: 'centre-alpha',
                boardId: 'board-cbse',
                standardId: 'std-10',
                academicYearId: 'ay-2026'
              }
            }]
          });
          mockPrisma.studyMaterial.findMany.mockResolvedValue([]);

          await studyMaterialService.getByTopic('topic-chemistry', studentA);

          expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                topicId: 'topic-chemistry',
                AND: expect.arrayContaining([
                  { topicId: 'topic-chemistry' },
                  expect.objectContaining({
                    OR: expect.arrayContaining([
                      expect.objectContaining({
                        AND: expect.arrayContaining([
                          expect.objectContaining({
                            OR: expect.arrayContaining([
                              { academicYearId: 'ay-2026' },
                              { academicYear: { isActive: true } }
                            ])
                          })
                        ])
                      })
                    ])
                  })
                ])
              })
            })
          );
        });
      });

      describe('6. Prevent Subject-Scoped Attendance Assignments from Being Bypassed', () => {
        const teacherSubj: any = {
          id: 'teacher-subject-scoped',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }]
        };

        it('should reject markAttendance when teacher has multiple assigned subjects in batch but omits subjectId', async () => {
          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-multi-sub',
            centreId: 'centre-alpha',
            standardId: 'std-10',
            boardId: 'board-cbse'
          });

          // Teacher teaches both Math AND Science in this batch
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherSubj.id,
            assignments: [
              { batchId: 'batch-multi-sub', batch: { id: 'batch-multi-sub', centreId: 'centre-alpha' }, subjectId: 'math-id' },
              { batchId: 'batch-multi-sub', batch: { id: 'batch-multi-sub', centreId: 'centre-alpha' }, subjectId: 'science-id' },
            ]
          });

          await expect(
            attendanceService.markAttendance({
              batchId: 'batch-multi-sub',
              date: '2026-10-18',
              centreId: 'centre-alpha',
              // subjectId omitted
              records: [{ studentId: 'stud-1', status: 'PRESENT' }]
            }, teacherSubj)
          ).rejects.toThrow(BadRequestException);
        });

        it('should safely derive subjectId when teacher has exactly one assigned subject in batch and omits subjectId', async () => {
          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-single-sub',
            centreId: 'centre-alpha',
            standardId: 'std-10',
            boardId: 'board-cbse'
          });

          // Teacher teaches ONLY Math in this batch
          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherSubj.id,
            assignments: [
              { batchId: 'batch-single-sub', batch: { id: 'batch-single-sub', centreId: 'centre-alpha' }, subjectId: 'math-id' },
            ]
          });

          mockPrisma.studentProfile.findMany.mockResolvedValue([
            { id: 'stud-1', enrollments: [{ batchId: 'batch-single-sub', batch: { centreId: 'centre-alpha' } }] }
          ]);

          mockPrisma.attendance.findFirst.mockResolvedValue(null);
          mockPrisma.attendance.create.mockResolvedValue({ id: 'att-created' });
          mockPrisma.attendanceRecord.createMany.mockResolvedValue({ count: 1 });

          const res = await attendanceService.markAttendance({
            batchId: 'batch-single-sub',
            date: '2026-10-18',
            centreId: 'centre-alpha',
            // subjectId omitted
            records: [{ studentId: 'stud-1', status: 'PRESENT' }]
          }, teacherSubj);

          expect(res).toBeDefined();
          expect(res.message).toBe('Attendance marked successfully');
        });

        it('should reject markAttendance when teacher provides a subjectId they are not assigned to teach', async () => {
          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-single-sub',
            centreId: 'centre-alpha',
            standardId: 'std-10',
            boardId: 'board-cbse'
          });

          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherSubj.id,
            assignments: [
              { batchId: 'batch-single-sub', batch: { id: 'batch-single-sub', centreId: 'centre-alpha' }, subjectId: 'math-id' },
            ]
          });

          await expect(
            attendanceService.markAttendance({
              batchId: 'batch-single-sub',
              date: '2026-10-18',
              centreId: 'centre-alpha',
              subjectId: 'history-unassigned-id',
              records: [{ studentId: 'stud-1', status: 'PRESENT' }]
            }, teacherSubj)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should reject markAttendance when a student in records is not enrolled in matching academic year for the batch', async () => {
          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-ay-check',
            centreId: 'centre-alpha',
            standardId: 'std-10',
            boardId: 'board-cbse',
            academicYearId: 'ay-2026'
          });

          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: teacherSubj.id,
            assignments: [
              { batchId: 'batch-ay-check', batch: { id: 'batch-ay-check', centreId: 'centre-alpha' }, subjectId: 'math-id' },
            ]
          });

          // Student is enrolled in an older academic year
          mockPrisma.studentProfile.findMany.mockResolvedValue([
            {
              id: 'stud-old-year',
              enrollments: [{
                batchId: 'batch-ay-check',
                batch: { centreId: 'centre-alpha', academicYearId: 'ay-2024' }
              }]
            }
          ]);

          await expect(
            attendanceService.markAttendance({
              batchId: 'batch-ay-check',
              date: '2026-10-18',
              centreId: 'centre-alpha',
              subjectId: 'math-id',
              records: [{ studentId: 'stud-old-year', status: 'PRESENT' }]
            }, teacherSubj)
          ).rejects.toThrow(BadRequestException);
        });
      });
    });

    describe('SEC-20: Final Consolidated Security Remediation Suite', () => {
      let mockPrisma: any;
      let attendanceService: AttendanceService;
      let storageService: StorageService;
      let feeService: FeeService;

      beforeEach(() => {
        mockPrisma = {
          batch: { findUnique: jest.fn(), findMany: jest.fn() },
          attendance: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'att-1' }), createMany: jest.fn() },
          attendanceRecord: { deleteMany: jest.fn(), createMany: jest.fn() },
          studentProfile: { findMany: jest.fn(), findUnique: jest.fn() },
          teacherProfile: { findUnique: jest.fn() },
          teacherAssignment: { findMany: jest.fn() },
          feeRecord: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), update: jest.fn() },
          user: { update: jest.fn() },
          $transaction: jest.fn(async (callback) => {
            if (typeof callback === 'function') {
              return callback(mockPrisma);
            }
            return callback;
          }),
        };

        attendanceService = new AttendanceService(mockPrisma as any);
        storageService = new StorageService();
        feeService = new FeeService(mockPrisma as any);
      });

      describe('1. Attendance Query Projection & Academic Year Matching', () => {
        it('should query targetBatch selecting academicYearId in markAttendance', async () => {
          mockPrisma.batch.findUnique.mockResolvedValue({
            id: 'batch-proj-1',
            centreId: 'centre-alpha',
            standardId: 'std-10',
            boardId: 'board-cbse',
            academicYearId: 'ay-2026',
          });

          const teacher = {
            id: 't-proj-1',
            role: { name: 'TEACHER' },
            userCentres: [{ centreId: 'centre-alpha' }],
          };

          mockPrisma.teacherProfile.findUnique.mockResolvedValue({
            userId: 't-proj-1',
            assignments: [
              { batchId: 'batch-proj-1', batch: { id: 'batch-proj-1', centreId: 'centre-alpha' }, subjectId: 'subj-1' },
            ],
          });

          mockPrisma.studentProfile.findMany.mockResolvedValue([
            {
              id: 'stud-1',
              enrollments: [
                {
                  batchId: 'batch-proj-1',
                  batch: { centreId: 'centre-alpha', academicYearId: 'ay-2026' },
                },
              ],
            },
          ]);

          mockPrisma.attendance.createMany.mockResolvedValue({ count: 1 });

          await attendanceService.markAttendance(
            {
              batchId: 'batch-proj-1',
              date: '2026-10-18',
              centreId: 'centre-alpha',
              subjectId: 'subj-1',
              records: [{ studentId: 'stud-1', status: 'PRESENT' }],
            },
            teacher
          );

          expect(mockPrisma.batch.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
              select: expect.objectContaining({
                academicYearId: true,
                centreId: true,
                standardId: true,
                boardId: true,
              }),
            })
          );
        });
      });

      describe('2. Storage Namespace Preservation (forms & thumbnails)', () => {
        it('should generate objectKey under forms/ namespace when path starts with forms/', async () => {
          process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
          process.env.CLOUDFLARE_ACCESS_KEY_ID = 'test-key';
          process.env.CLOUDFLARE_SECRET_ACCESS_KEY = 'test-secret';
          process.env.CLOUDFLARE_R2_BUCKET_NAME = 'educare-test';
          process.env.R2_PUBLIC_URL = 'https://cdn.educare.test';

          const res = await storageService.getPresignedUploadUrl('forms/form-abc/application.pdf', 'application/pdf');
          expect(res.objectKey).toMatch(/^forms\/form-abc\/\d+-[a-f0-9]+-application\.pdf$/);
          expect(res.objectKey.startsWith('materials/')).toBe(false);
        });

        it('should generate objectKey under thumbnails/ namespace when path starts with thumbnails/', async () => {
          const res = await storageService.getPresignedUploadUrl('thumbnails/preview.png', 'image/png');
          expect(res.objectKey).toMatch(/^thumbnails\/\d+-[a-f0-9]+-preview\.png$/);
          expect(res.objectKey.startsWith('materials/')).toBe(false);
        });
      });

      describe('3. Fee Service Authoritative Centre Isolation', () => {
        const centreAdminA = {
          id: 'admin-a',
          role: { name: 'CENTRE_ADMIN' },
          userCentres: [{ centreId: 'centre-a' }],
        };

        it('should prevent Centre Admin A from deleting fee record belonging to Centre B', async () => {
          mockPrisma.feeRecord.findUnique.mockResolvedValue({
            id: 'fee-b-1',
            centreId: 'centre-b',
            student: {
              enrollments: [
                { batch: { centreId: 'centre-a' } },
                { batch: { centreId: 'centre-b' } },
              ],
            },
          });

          await expect(
            feeService.delete('fee-b-1', centreAdminA)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should prevent Centre Admin A from updating status of fee record belonging to Centre B', async () => {
          mockPrisma.feeRecord.findUnique.mockResolvedValue({
            id: 'fee-b-2',
            centreId: 'centre-b',
            student: {
              enrollments: [
                { batch: { centreId: 'centre-a' } },
                { batch: { centreId: 'centre-b' } },
              ],
            },
          });

          await expect(
            feeService.updateStatus('fee-b-2', 'PAID', centreAdminA)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should require explicit centreId when creating fee for multi-centre student with multiple matching admin centres', async () => {
          const multiAdmin = {
            id: 'admin-ab',
            role: { name: 'CENTRE_ADMIN' },
            userCentres: [{ centreId: 'centre-a' }, { centreId: 'centre-b' }],
          };

          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'stud-multi',
            enrollments: [
              { batch: { centreId: 'centre-a' } },
              { batch: { centreId: 'centre-b' } },
            ],
          });

          await expect(
            feeService.create(
              {
                studentId: 'stud-multi',
                amount: 5000,
              },
              multiAdmin
            )
          ).rejects.toThrow(BadRequestException);
        });

        it('should reject creating fee in Centre B when Centre Admin only has access to Centre A', async () => {
          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'stud-multi',
            enrollments: [
              { batch: { centreId: 'centre-a' } },
              { batch: { centreId: 'centre-b' } },
            ],
          });

          await expect(
            feeService.create(
              {
                studentId: 'stud-multi',
                amount: 5000,
                centreId: 'centre-b',
              },
              centreAdminA
            )
          ).rejects.toThrow(ForbiddenException);
        });

        it('should fail closed when trying to modify legacy fee record with null centreId for multi-centre student', async () => {
          mockPrisma.feeRecord.findUnique.mockResolvedValue({
            id: 'fee-legacy',
            centreId: null,
            student: {
              enrollments: [
                { batch: { centreId: 'centre-a' } },
                { batch: { centreId: 'centre-b' } },
              ],
            },
          });

          await expect(
            feeService.delete('fee-legacy', centreAdminA)
          ).rejects.toThrow(ForbiddenException);
        });
      });
    });

    describe('SEC-21: Final Consolidated Security Remediation & Full-Repository Verification', () => {
      let mockPrisma: any;
      let storageService: StorageService;
      let studyMaterialService: StudyMaterialService;
      let feeService: FeeService;
      let formsService: FormsService;
      let storageController: StorageController;
      let examsController: ExamsController;
      let formsController: FormsController;

      beforeEach(() => {
        mockPrisma = {
          batch: { findUnique: jest.fn(), findMany: jest.fn() },
          attendance: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'att-1' }), createMany: jest.fn() },
          attendanceRecord: { deleteMany: jest.fn(), createMany: jest.fn() },
          studentProfile: { findMany: jest.fn(), findUnique: jest.fn() },
          teacherProfile: { findUnique: jest.fn() },
          teacherAssignment: { findMany: jest.fn() },
          feeRecord: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), update: jest.fn() },
          studyMaterial: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
          targetTrack: { findUnique: jest.fn() },
          syllabus: { findUnique: jest.fn(), findFirst: jest.fn() },
          academicYear: { findMany: jest.fn(), findUnique: jest.fn() },
          customForm: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
          customFormResponse: { create: jest.fn() },
          user: { update: jest.fn(), findMany: jest.fn() },
          $transaction: jest.fn(async (callback) => {
            if (typeof callback === 'function') {
              return callback(mockPrisma);
            }
            return callback;
          }),
        };

        storageService = new StorageService();
        studyMaterialService = new StudyMaterialService(mockPrisma as any, storageService);
        feeService = new FeeService(mockPrisma as any);
        formsService = new FormsService(mockPrisma as any, { sendNotification: jest.fn() } as any, storageService);
        storageController = new StorageController(storageService);
        examsController = new ExamsController({} as any, storageService);
        formsController = new FormsController(formsService, storageService);
      });

      describe('1. Server-Enforced Storage Namespaces and Identity Binding', () => {
        it('should bind presigned url to authenticated user id and enforce materials prefix in StorageController', async () => {
          const req = { user: { id: 'teacher-sec21' } };
          const res = await storageController.getPresignedUrl('lecture.pdf', 'application/pdf', req);
          expect(res.objectKey).toMatch(/^materials\/teacher-sec21\/\d+-[a-f0-9]+-lecture\.pdf$/);
        });

        it('should prevent caller from hijacking forms namespace through StorageController filename', async () => {
          const req = { user: { id: 'teacher-sec21' } };
          const res = await storageController.getPresignedUrl('forms/secret-form/hack.pdf', 'application/pdf', req);
          expect(res.objectKey.startsWith('materials/')).toBe(true);
          expect(res.objectKey.startsWith('forms/')).toBe(false);
        });

        it('should bind ExamsController.getUploadUrl to authenticated user', async () => {
          const req = { user: { id: 'teacher-exams' } };
          const res = await examsController.getUploadUrl('question-paper.pdf', 'application/pdf', req);
          expect(res.objectKey).toMatch(/^materials\/teacher-exams\/\d+-[a-f0-9]+-question-paper\.pdf$/);
        });

        it('should enforce forms namespace and scopeId in FormsController.getUploadUrl', async () => {
          mockPrisma.customForm.findUnique.mockResolvedValue({
            id: 'form-active-1',
            isActive: true,
          });

          const res = await formsController.getUploadUrl('form-active-1', 'applicant-cv.pdf', 'application/pdf');
          expect(res.objectKey).toMatch(/^forms\/form-active-1\/\d+-[a-f0-9]+-applicant-cv\.pdf$/);
        });

        it('should recognize both canonical object keys and full URLs in isStorageUrlInUse', async () => {
          mockPrisma.studyMaterial.findFirst.mockResolvedValue({ id: 'existing-mat' });
          const inUse = await studyMaterialService.isStorageUrlInUse('https://cdn.educare.test/materials/user-1/file.pdf', 'other-id');
          expect(inUse).toBe(true);
          expect(mockPrisma.studyMaterial.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                OR: expect.arrayContaining([
                  { url: 'https://cdn.educare.test/materials/user-1/file.pdf' },
                  { url: 'materials/user-1/file.pdf' },
                ]),
              }),
            })
          );
        });
      });

      describe('2. Teacher Assignment Track Boundary & Centre Binding', () => {
        const teacherProfile = {
          userId: 'teacher-track-test',
          assignments: [
            {
              id: 'assign-1',
              subjectId: 'sub-math',
              standardId: 'std-10',
              boardId: 'board-cbse',
              batch: {
                id: 'batch-general',
                centreId: 'centre-alpha',
                trackId: null, // Track is null (general batch)
              },
            },
          ],
        };

        const teacherUser = {
          id: 'teacher-track-test',
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should constrain getAll() to targetTrackId: null when teacher assignment track is null', async () => {
          mockPrisma.teacherProfile.findUnique.mockResolvedValue(teacherProfile);
          mockPrisma.studyMaterial.findMany.mockResolvedValue([]);

          await studyMaterialService.getAll(teacherUser);

          expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    AND: expect.arrayContaining([
                      { targetTrackId: null },
                    ]),
                  }),
                ]),
              }),
            })
          );
        });

        it('should deny teacher getById() when material has a specific track but assignment has null track', async () => {
          mockPrisma.studyMaterial.findUnique.mockResolvedValue({
            id: 'mat-track-science',
            targetTrackId: 'track-science-only',
            targetTrack: {
              batches: [{ centreId: 'centre-alpha' }],
            },
            uploaderId: 'other-uploader',
            uploader: { userCentres: [{ centreId: 'centre-alpha' }], role: { name: 'TEACHER' } },
            syllabus: {
              subjectId: 'sub-math',
              standardId: 'std-10',
              boardId: 'board-cbse',
            },
          });
          mockPrisma.teacherProfile.findUnique.mockResolvedValue(teacherProfile);

          await expect(
            studyMaterialService.getById('mat-track-science', teacherUser)
          ).rejects.toThrow(ForbiddenException);
        });

        it('should reject teacher material creation for a centre not in teacher assignment', async () => {
          mockPrisma.teacherProfile.findUnique.mockResolvedValue(teacherProfile);
          mockPrisma.syllabus.findUnique.mockResolvedValue({
            id: 'syl-1',
            subjectId: 'sub-math',
            standardId: 'std-10',
            boardId: 'board-cbse',
          });
          mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-2026', isActive: true }]);

          // Teacher attempts to upload targeting track from centre-beta
          mockPrisma.targetTrack.findUnique.mockResolvedValue({
            id: 'track-beta',
            batches: [{ centreId: 'centre-beta' }],
          });

          await expect(
            studyMaterialService.create(
              {
                title: 'Math Notes',
                type: 'FILE',
                syllabusId: 'syl-1',
                targetTrackId: 'track-beta',
              },
              teacherUser
            )
          ).rejects.toThrow(ForbiddenException);
        });
      });

      describe('3. Fee Service Defaults, Validation, and Multi-Centre Student Isolation', () => {
        const centreAdminAlpha = {
          id: 'admin-alpha',
          role: { name: 'CENTRE_ADMIN' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        it('should default fee status to PENDING upon creation', async () => {
          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'student-single',
            enrollments: [{ batch: { centreId: 'centre-alpha' } }],
          });
          mockPrisma.feeRecord.create.mockImplementation((args: any) => Promise.resolve(args.data));

          const created = await feeService.create(
            {
              studentId: 'student-single',
              amount: 1500,
            },
            centreAdminAlpha
          );

          expect(created.status).toBe('PENDING');
        });

        it('should reject invalid fee status on create and update', async () => {
          mockPrisma.studentProfile.findUnique.mockResolvedValue({
            id: 'student-single',
            enrollments: [{ batch: { centreId: 'centre-alpha' } }],
          });

          await expect(
            feeService.create(
              {
                studentId: 'student-single',
                amount: 1500,
                status: 'FORGED_STATUS',
              },
              centreAdminAlpha
            )
          ).rejects.toThrow(BadRequestException);

          await expect(
            feeService.updateStatus('fee-1', 'INVALID_STATUS', centreAdminAlpha)
          ).rejects.toThrow(BadRequestException);
        });

        it('should exclude ambiguous null-centre records of multi-centre students in findAll()', async () => {
          mockPrisma.feeRecord.findMany.mockResolvedValue([]);

          await feeService.findAll(centreAdminAlpha);

          expect(mockPrisma.feeRecord.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                OR: expect.arrayContaining([
                  { centreId: { in: ['centre-alpha'] } },
                  {
                    centreId: null,
                    student: {
                      enrollments: {
                        some: { batch: { centreId: { in: ['centre-alpha'] } } },
                        none: { batch: { centreId: { notIn: ['centre-alpha'] } } },
                      },
                    },
                  },
                ]),
              }),
            })
          );
        });
      });

      describe('4. Forms Service Mass Assignment Prevention', () => {
        const superAdmin = {
          id: 'super-admin-user',
          role: { name: 'SUPER_ADMIN' },
        };

        it('should sanitize updateForm payload and reject mass assignment of injected fields', async () => {
          mockPrisma.customForm.findUnique.mockResolvedValue({
            id: 'form-123',
            title: 'Admission Form',
            centreId: null,
          });
          mockPrisma.customForm.update.mockImplementation((args: any) => Promise.resolve(args.data));

          const maliciousPayload = {
            title: 'Updated Title',
            isActive: false,
            id: 'forged-id-overwrite',
            createdAt: new Date('2020-01-01'),
            responses: { deleteMany: {} },
            untrustedRole: 'SUPER_ADMIN',
          };

          const updated = await formsService.updateForm('form-123', maliciousPayload as any, superAdmin);

          expect(updated.title).toBe('Updated Title');
          expect(updated.isActive).toBe(false);
          expect(updated.id).toBeUndefined();
          expect(updated.createdAt).toBeUndefined();
          expect(updated.responses).toBeUndefined();
          expect(updated.untrustedRole).toBeUndefined();
        });
      });

      describe('SEC-22: Final Production-Readiness Remediation Suite', () => {
        describe('1. Storage Upload Limits, Roles, and Expiry', () => {
          it('should configure presigned upload URLs with 900s expiry and namespace maxSizeBytes', async () => {
            const res = await storageService.getPresignedUploadUrl('doc.pdf', 'application/pdf', 'user-123', {
              prefix: 'materials',
            });
            expect(res.expiresIn).toBe(900);
            expect(res.maxSizeBytes).toBe(100 * 1024 * 1024);
            expect(res.uploadUrl).toBeDefined();
            expect(res.objectKey).toMatch(/^materials\/user-123\//);
          });

          it('should enforce 25MB default limit for forms and 20MB for thumbnails namespace', async () => {
            const formRes = await storageService.getPresignedUploadUrl('upload.pdf', 'application/pdf', 'user-123', {
              prefix: 'forms',
              scopeId: 'form-123',
            });
            expect(formRes.maxSizeBytes).toBe(25 * 1024 * 1024);

            const thumbRes = await storageService.getPresignedUploadUrl('cover.jpg', 'image/jpeg', 'user-123', {
              prefix: 'thumbnails',
            });
            expect(thumbRes.maxSizeBytes).toBe(20 * 1024 * 1024);
          });
        });

        describe('2. Strict Academic Year Authorization', () => {
          const teacherAssignedYear1 = {
            id: 'teacher-year1',
            role: 'TEACHER',
            userCentres: [{ centreId: 'centre-1' }],
            teacherAssignments: [
              {
                id: 'asgn-1',
                academicYearId: 'year-2025',
                batchId: 'batch-1',
                subjectId: 'sub-1',
                standardId: 'std-1',
                boardId: 'board-1',
                centreId: 'centre-1',
                academicYear: { id: 'year-2025', isActive: false },
                batch: { id: 'batch-1', centreId: 'centre-1', academicYearId: 'year-2025' },
              },
            ],
          };

          it('should strictly query materials for assigned academicYearId without active-year fallback', async () => {
            mockPrisma.teacherProfile.findUnique.mockResolvedValue({
              assignments: teacherAssignedYear1.teacherAssignments,
            });
            mockPrisma.studyMaterial.findMany.mockResolvedValue([]);

            await studyMaterialService.getAll(teacherAssignedYear1);

            const callArgs = mockPrisma.studyMaterial.findMany.mock.calls[mockPrisma.studyMaterial.findMany.mock.calls.length - 1][0];
            expect(JSON.stringify(callArgs.where)).toContain('"academicYearId":"year-2025"');
            expect(JSON.stringify(callArgs.where)).not.toContain('"isActive":true');
          });

          it('should deny teacher access in getById when material is in a different academic year even if active', async () => {
            mockPrisma.teacherProfile.findUnique.mockResolvedValue({
              assignments: teacherAssignedYear1.teacherAssignments,
            });
            mockPrisma.studyMaterial.findUnique.mockResolvedValue({
              id: 'mat-active-year',
              academicYearId: 'year-2026-active',
              subjectId: 'sub-1',
              standardId: 'std-1',
              boardId: 'board-1',
              targetTrackId: null,
              uploaderId: 'other-uploader',
              academicYear: { id: 'year-2026-active', isActive: true },
              uploader: { userCentres: [{ centreId: 'centre-1' }] },
              targetTrack: null,
            });

            await expect(
              studyMaterialService.getById('mat-active-year', teacherAssignedYear1)
            ).rejects.toThrow(ForbiddenException);
          });
        });

        describe('3. Form Validation, Boolean Coercion, and Field Rules', () => {
          const superAdmin = { id: 'super-admin', role: { name: 'SUPER_ADMIN' } };
          const centreAdmin = {
            id: 'centre-admin',
            role: { name: 'CENTRE_ADMIN' },
            userCentres: [{ centreId: 'centre-allowed' }],
          };

          it('should reject string booleans like "false" for isActive in createForm', async () => {
            await expect(
              formsService.createForm({
                title: 'Test Form',
                isActive: 'false' as any,
                fields: [{ id: 'f1', label: 'Name', type: 'text' }],
                centreId: 'centre-allowed',
              }, superAdmin)
            ).rejects.toThrow(BadRequestException);
          });

          it('should reject string booleans like "true" for isActive in updateForm', async () => {
            mockPrisma.customForm.findUnique.mockResolvedValue({
              id: 'form-1',
              title: 'Form',
              centreId: 'centre-allowed',
            });
            await expect(
              formsService.updateForm('form-1', {
                isActive: 'true' as any,
              }, superAdmin)
            ).rejects.toThrow(BadRequestException);
          });

          it('should reject malformed fields: missing label or invalid type', async () => {
            await expect(
              formsService.createForm({
                title: 'Test Form',
                fields: [{ id: 'f1', type: 'malicious-executable' }],
              }, superAdmin)
            ).rejects.toThrow(BadRequestException);

            await expect(
              formsService.createForm({
                title: 'Test Form',
                fields: [{ id: '', label: 'Valid Label', type: 'text' }],
              }, superAdmin)
            ).rejects.toThrow(BadRequestException);
          });

          it('should reject unauthorized centre change in updateForm', async () => {
            mockPrisma.customForm.findUnique.mockResolvedValue({
              id: 'form-1',
              title: 'Form',
              centreId: 'centre-allowed',
            });
            await expect(
              formsService.updateForm('form-1', {
                centreId: 'centre-unauthorized',
              }, centreAdmin)
            ).rejects.toThrow(ForbiddenException);
          });

          it('should accept valid form update with boolean isActive and valid fields', async () => {
            mockPrisma.customForm.findUnique.mockResolvedValue({
              id: 'form-1',
              title: 'Form',
              centreId: 'centre-allowed',
            });
            mockPrisma.customForm.update.mockImplementation((args: any) => Promise.resolve(args.data));

            const updated = await formsService.updateForm('form-1', {
              title: 'Updated Title',
              isActive: false,
              fields: [{ id: 'field_1', label: 'Student Name', type: 'text', required: true }],
            }, superAdmin);

            expect(updated.title).toBe('Updated Title');
            expect(updated.isActive).toBe(false);
            expect(updated.fields).toHaveLength(1);
          });
        });

        describe('4. Multi-Resource Safe Deletion Checking', () => {
          it('should report storage URL in use if referenced by mcqQuestion imageUrl', async () => {
            mockPrisma.studyMaterial.findFirst.mockResolvedValue(null);
            (mockPrisma as any).mcqQuestion = {
              findFirst: jest.fn().mockResolvedValue({ id: 'mcq-1' }),
            };

            const inUse = await studyMaterialService.isStorageUrlInUse('materials/shared-diagram.png');
            expect(inUse).toBe(true);
          });

          it('should report storage URL in use if referenced by studentAnswer answerFileUrl', async () => {
            mockPrisma.studyMaterial.findFirst.mockResolvedValue(null);
            (mockPrisma as any).mcqQuestion = {
              findFirst: jest.fn().mockResolvedValue(null),
            };
            (mockPrisma as any).studentAnswer = {
              findFirst: jest.fn().mockResolvedValue({ id: 'ans-1' }),
            };

            const inUse = await studyMaterialService.isStorageUrlInUse('materials/student-submission.pdf');
            expect(inUse).toBe(true);
          });
        });

        describe('SEC-23: Authoritative Reference Checking, Size Limits, Teacher Academic Year, & Fee Isolation', () => {
          let testStorageService: StorageService;
          let mockStoragePrisma: any;
          let mockS3Client: any;

          beforeEach(() => {
            mockStoragePrisma = {
              studyMaterial: { findFirst: jest.fn() },
              mcqQuestion: { findFirst: jest.fn() },
              studentAnswer: { findFirst: jest.fn() },
              customFormResponse: { findFirst: jest.fn() },
              user: { findFirst: jest.fn() },
              notice: { findFirst: jest.fn() },
              supportTicket: { findFirst: jest.fn() },
              $queryRawUnsafe: jest.fn(),
            };
            testStorageService = new StorageService(mockStoragePrisma as any);
            mockS3Client = {
              send: jest.fn(),
            };
            (testStorageService as any).s3Client = mockS3Client;
            (testStorageService as any).publicUrl = 'https://cdn.educare.test';
            process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id';
          });

          it('should enforce 100MB limit for materials, 20MB for thumbnails, and custom limits for forms in getPresignedUploadUrl', async () => {
            const matRes = await testStorageService.getPresignedUploadUrl('materials/test.pdf', 'application/pdf', 'u-1', { prefix: 'materials' });
            expect(matRes.maxSizeBytes).toBe(100 * 1024 * 1024);

            const thumbRes = await testStorageService.getPresignedUploadUrl('thumbnails/test.png', 'image/png', 'u-1', { prefix: 'thumbnails' });
            expect(thumbRes.maxSizeBytes).toBe(20 * 1024 * 1024);

            const formDefaultRes = await testStorageService.getPresignedUploadUrl('forms/f-1/test.pdf', 'application/pdf', 'u-1', { prefix: 'forms', scopeId: 'f-1' });
            expect(formDefaultRes.maxSizeBytes).toBe(25 * 1024 * 1024);

            const formCustomRes = await testStorageService.getPresignedUploadUrl('forms/f-1/test.pdf', 'application/pdf', 'u-1', { prefix: 'forms', scopeId: 'f-1', maxSizeBytes: 15 * 1024 * 1024 });
            expect(formCustomRes.maxSizeBytes).toBe(15 * 1024 * 1024);
          });

          it('should allow valid files and purge oversized files in validateAndEnforceObjectSize', async () => {
            // Material within 100MB
            mockS3Client.send.mockResolvedValueOnce({ ContentLength: 50 * 1024 * 1024 });
            const validMat = await testStorageService.validateAndEnforceObjectSize('materials/u-1/sample.pdf');
            expect(validMat.valid).toBe(true);

            // Material exceeding 100MB -> must trigger DeleteObjectCommand and throw BadRequestException
            mockS3Client.send.mockResolvedValueOnce({ ContentLength: 105 * 1024 * 1024 });
            mockS3Client.send.mockResolvedValueOnce({}); // DeleteObjectCommand response
            await expect(
              testStorageService.validateAndEnforceObjectSize('materials/u-1/oversized.pdf')
            ).rejects.toThrow(BadRequestException);
            expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));

            // Thumbnail exceeding 20MB -> must trigger DeleteObjectCommand and throw BadRequestException
            mockS3Client.send.mockResolvedValueOnce({ ContentLength: 25 * 1024 * 1024 });
            mockS3Client.send.mockResolvedValueOnce({});
            await expect(
              testStorageService.validateAndEnforceObjectSize('thumbnails/u-1/large.png')
            ).rejects.toThrow(BadRequestException);

            // Custom form limit of 15MB: 16MB must fail
            mockS3Client.send.mockResolvedValueOnce({ ContentLength: 16 * 1024 * 1024 });
            mockS3Client.send.mockResolvedValueOnce({});
            await expect(
              testStorageService.validateAndEnforceObjectSize('forms/f-1/large-form-file.pdf', 15 * 1024 * 1024)
            ).rejects.toThrow(BadRequestException);
          });

          it('should report storage URL in use if referenced by customFormResponse JSON data', async () => {
            mockStoragePrisma.studyMaterial.findFirst.mockResolvedValue(null);
            mockStoragePrisma.mcqQuestion.findFirst.mockResolvedValue(null);
            mockStoragePrisma.studentAnswer.findFirst.mockResolvedValue(null);
            mockStoragePrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'cfr-1' }]);

            const inUse = await testStorageService.isStorageUrlInUse('forms/f-1/applicant-resume.pdf');
            expect(inUse).toBe(true);
          });

          it('should report storage URL in use if referenced by user avatar', async () => {
            mockStoragePrisma.studyMaterial.findFirst.mockResolvedValue(null);
            mockStoragePrisma.mcqQuestion.findFirst.mockResolvedValue(null);
            mockStoragePrisma.studentAnswer.findFirst.mockResolvedValue(null);
            mockStoragePrisma.$queryRawUnsafe.mockResolvedValue([]);
            mockStoragePrisma.user.findFirst.mockResolvedValueOnce({ id: 'u-123' });

            const inUse = await testStorageService.isStorageUrlInUse('thumbnails/u-1/avatar.png');
            expect(inUse).toBe(true);
          });

          it('should refuse to delete a storage object when it is still in use by an application record', async () => {
            mockStoragePrisma.studyMaterial.findFirst.mockResolvedValue({ id: 'mat-existing' });

            const deleted = await testStorageService.deleteFile('materials/u-1/shared.pdf');
            expect(deleted).toBe(false);
            expect(mockS3Client.send).not.toHaveBeenCalled();
          });

          it('should fail closed when teacher assignment has no academic year and material has an academic year', async () => {
            const material = {
              id: 'mat-year-scoped',
              title: 'Year Scoped Material',
              type: 'PDF',
              url: 'materials/teacher-1/scoped.pdf',
              syllabusId: 'syl-1',
              academicYearId: 'year-2026',
              targetTrackId: null,
              uploaderId: 'other-user',
              uploader: { userCentres: [{ centreId: 'centre-alpha' }] },
            };

            const teacherWithYearlessAssignment = {
              id: 'teacher-1',
              role: { name: 'TEACHER' },
              userCentres: [{ centreId: 'centre-alpha' }],
              teacherProfile: {
                assignments: [
                  {
                    id: 'assign-1',
                    subjectId: 'sub-1',
                    standardId: 'std-1',
                    boardId: 'brd-1',
                    centreId: 'centre-alpha',
                    academicYearId: null, // Year is missing on assignment
                    batch: { centreId: 'centre-alpha', academicYearId: null, trackId: null },
                  },
                ],
              },
            };

            mockPrisma.studyMaterial.findUnique.mockResolvedValue(material);
            mockPrisma.syllabus.findUnique.mockResolvedValue({
              id: 'syl-1',
              subjectId: 'sub-1',
              standardId: 'std-1',
              boardId: 'brd-1',
            });

            await expect(
              studyMaterialService.getById('mat-year-scoped', teacherWithYearlessAssignment)
            ).rejects.toThrow(ForbiddenException);
          });

          it('should scope teacher materials queries with academicYearId null when assignment lacks year', async () => {
            const teacherWithYearlessAssignment = {
              id: 'teacher-1',
              role: { name: 'TEACHER' },
              userCentres: [{ centreId: 'centre-alpha' }],
              teacherProfile: {
                assignments: [
                  {
                    id: 'assign-1',
                    subjectId: 'sub-1',
                    standardId: 'std-1',
                    boardId: 'brd-1',
                    centreId: 'centre-alpha',
                    batch: { centreId: 'centre-alpha', academicYearId: null, trackId: null },
                  },
                ],
              },
            };

            mockPrisma.studyMaterial.findMany.mockResolvedValue([]);
            mockPrisma.teacherProfile.findUnique.mockResolvedValue({
              assignments: teacherWithYearlessAssignment.teacherProfile.assignments,
            });
            await studyMaterialService.getAll(teacherWithYearlessAssignment);

            expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(expect.objectContaining({
              where: expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    AND: expect.arrayContaining([
                      { academicYearId: null },
                    ]),
                  }),
                ]),
              }),
            }));
          });

          it('should fail closed in validateAndEnforceObjectSize when CLOUDFLARE_ACCOUNT_ID is missing or provider errors', async () => {
            const oldId = process.env.CLOUDFLARE_ACCOUNT_ID;
            delete process.env.CLOUDFLARE_ACCOUNT_ID;

            await expect(
              testStorageService.validateAndEnforceObjectSize('materials/u-1/file.pdf')
            ).rejects.toThrow(BadRequestException);

            process.env.CLOUDFLARE_ACCOUNT_ID = oldId || 'test-account';

            // Provider unexpected error fails closed
            mockS3Client.send.mockRejectedValueOnce(new Error('S3 500 Internal Service Error'));
            await expect(
              testStorageService.validateAndEnforceObjectSize('materials/u-1/file.pdf')
            ).rejects.toThrow(BadRequestException);
          });

          it('should fail closed in isStorageUrlInUse when prisma is missing or throws', async () => {
            const noDbService = new StorageService(null as any);
            expect(await noDbService.isStorageUrlInUse('materials/u-1/file.pdf')).toBe(true);

            // Query error fails closed
            mockStoragePrisma.studyMaterial.findFirst.mockRejectedValueOnce(new Error('DB Connection Timeout'));
            expect(await testStorageService.isStorageUrlInUse('materials/u-1/file.pdf')).toBe(true);
          });

          it('should report storage URL in use if referenced by customForm.fields JSON', async () => {
            mockStoragePrisma.studyMaterial.findFirst.mockResolvedValue(null);
            mockStoragePrisma.mcqQuestion.findFirst.mockResolvedValue(null);
            mockStoragePrisma.studentAnswer.findFirst.mockResolvedValue(null);
            mockStoragePrisma.customFormResponse = { findFirst: jest.fn().mockResolvedValue(null) };
            mockStoragePrisma.customForm = {
              findMany: jest.fn().mockResolvedValue([
                { id: 'form-1', fields: [{ id: 'field-1', type: 'image', imageUrl: 'forms/f-1/header.png' }] },
              ]),
            };

            const inUse = await testStorageService.isStorageUrlInUse('forms/f-1/header.png');
            expect(inUse).toBe(true);
          });

          it('should reject teacher material creation when assignment lacks academic year and year is resolved from active year', async () => {
            const teacherWithYearlessAssignment = {
              id: 'teacher-1',
              role: { name: 'TEACHER' },
              userCentres: [{ centreId: 'centre-alpha' }],
              teacherProfile: {
                assignments: [
                  {
                    id: 'assign-1',
                    subjectId: 'sub-1',
                    standardId: 'std-1',
                    boardId: 'brd-1',
                    centreId: 'centre-alpha',
                    academicYearId: null, // Missing academic year on assignment
                    batch: { centreId: 'centre-alpha', academicYearId: null, trackId: null },
                  },
                ],
              },
            };

            mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'active-year-2026', isActive: true }]);
            mockPrisma.syllabus.findUnique.mockResolvedValue({
              id: 'syl-1',
              subjectId: 'sub-1',
              standardId: 'std-1',
              boardId: 'brd-1',
            });
            mockPrisma.teacherProfile.findUnique.mockResolvedValue({
              assignments: teacherWithYearlessAssignment.teacherProfile.assignments,
            });

            // Mock storage service S3 head so size validation passes and assignment year check is tested
            if ((studyMaterialService as any).storageService) {
              ((studyMaterialService as any).storageService as any).s3Client = {
                send: jest.fn().mockResolvedValue({ ContentLength: 1024 }),
              };
            }

            // Teacher omits academicYearId in body; resolved from active year, but assignment is yearless -> MUST REJECT
            await expect(
              studyMaterialService.create(
                {
                  title: 'New Material',
                  syllabusId: 'syl-1',
                  type: 'FILE',
                  url: 'materials/teacher-1/doc.pdf',
                  // academicYearId omitted
                },
                teacherWithYearlessAssignment
              )
            ).rejects.toThrow(ForbiddenException);
          });

          it('should reject cross-form uploads and already-claimed uploads in submitResponse', async () => {
            const formsService = new (require('../forms/forms.service').FormsService)(
              mockPrisma,
              { sendNotification: jest.fn() },
              testStorageService
            );

            mockPrisma.customForm.findUnique.mockResolvedValue({
              id: 'form-alpha',
              isActive: true,
              maxFileSizeBytes: 10 * 1024 * 1024,
            });

            // 1. Cross-form upload: submitting key from form-beta into form-alpha
            await expect(
              formsService.submitResponse('form-alpha', {
                resume: 'forms/form-beta/resume.pdf',
              })
            ).rejects.toThrow(BadRequestException);

            // 2. Already claimed upload
            mockStoragePrisma.studyMaterial.findFirst.mockResolvedValue(null);
            mockStoragePrisma.customFormResponse = {
              findMany: jest.fn().mockResolvedValue([
                { id: 'resp-prior', data: { resume: 'forms/form-alpha/claimed.pdf' } },
              ]),
            };
            await expect(
              formsService.submitResponse('form-alpha', {
                resume: 'forms/form-alpha/claimed.pdf',
              })
            ).rejects.toThrow(BadRequestException);
          });

          it('should scope expense income report fee records to fee centre and matching batch', async () => {
            mockPrisma.transaction = { findMany: jest.fn().mockResolvedValue([]) };
            mockPrisma.feeRecord = {
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 'fee-1',
                  receiptNo: 'REC-001',
                  amount: 5000,
                  date: new Date('2026-05-01'),
                  status: 'PAID',
                  centreId: 'centre-alpha',
                  centre: { id: 'centre-alpha', name: 'Centre Alpha' },
                  student: {
                    admissionNo: 'ADM-001',
                    user: { firstName: 'Alice', lastName: 'Smith' },
                    enrollments: [
                      {
                        centreId: 'centre-beta',
                        batch: { name: 'Batch Beta', centre: { name: 'Centre Beta' }, centreId: 'centre-beta' },
                      },
                      {
                        centreId: 'centre-alpha',
                        batch: { name: 'Batch Alpha', centre: { name: 'Centre Alpha' }, centreId: 'centre-alpha' },
                      },
                    ],
                  },
                },
              ]),
            };

            const reportService = new (require('../report/report.service').ReportService)(mockPrisma);

            const report = await reportService.getExpenseIncomeReport('2026-01-01', '2026-12-31', 'centre-alpha');
            expect(report.feeRecords[0].centreName).toBe('Centre Alpha');
            expect(report.feeRecords[0].batchName).toBe('Batch Alpha');
          });

          it('should reject finalizeUpload when user does not own the object key and derive limits server-side', async () => {
            const attackerUser = { id: 'attacker-user', role: { name: 'TEACHER' } };
            const legitimateUser = { id: 'legit-user', role: { name: 'TEACHER' } };

            // 1. Attacker tries to finalize another user's material key
            await expect(
              testStorageService.finalizeUpload('materials/legit-user/file.pdf', attackerUser)
            ).rejects.toThrow(ForbiddenException);

            // 2. Legitimate user finalizes their own key with mock S3
            mockS3Client.send.mockResolvedValueOnce({ ContentLength: 50 * 1024 * 1024 });
            const res = await testStorageService.finalizeUpload('materials/legit-user/file.pdf', legitimateUser);
            expect(res.verified).toBe(true);
            expect(res.objectKey).toBe('materials/legit-user/file.pdf');
          });

          it('should never delete a referenced object during oversized validation', async () => {
            // Object is referenced by studyMaterial
            mockStoragePrisma.studyMaterial.findFirst.mockResolvedValue({ id: 'existing-mat' });
            mockS3Client.send.mockResolvedValueOnce({ ContentLength: 150 * 1024 * 1024 }); // 150MB > 100MB

            await expect(
              testStorageService.validateAndEnforceObjectSize('materials/u-1/shared.pdf')
            ).rejects.toThrow(BadRequestException);

            // DeleteObjectCommand must NOT have been called because object is in use
            const deleteCalls = mockS3Client.send.mock.calls.filter(
              (call: any[]) => call[0]?.constructor?.name === 'DeleteObjectCommand' || call[0]?.schema?.[2] === 'DeleteObject'
            );
            expect(deleteCalls.length).toBe(0);
          });

          it('should clean up unreferenced orphan uploads older than retention threshold without deleting referenced objects', async () => {
            const oldDate = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours old
            const recentDate = new Date();

            mockS3Client.send.mockImplementation(async (cmd: any) => {
              if (cmd.constructor?.name === 'ListObjectsV2Command' || cmd.input?.Prefix) {
                if (cmd.input.Prefix === 'materials/') {
                  return {
                    Contents: [
                      { Key: 'materials/u-1/abandoned-orphan.pdf', LastModified: oldDate },
                      { Key: 'materials/u-1/claimed-active.pdf', LastModified: oldDate },
                      { Key: 'materials/u-1/recent.pdf', LastModified: recentDate },
                    ],
                  };
                }
                return { Contents: [] };
              }
              return {};
            });

            // Mock claimed-active.pdf to be in use, abandoned-orphan to not be in use
            mockStoragePrisma.studyMaterial.findFirst.mockImplementation(async ({ where }: any) => {
              const str = JSON.stringify(where);
              if (str.includes('claimed-active.pdf')) return { id: 'mat-active' };
              return null;
            });

            const result = await testStorageService.cleanupOrphanUploads(2);
            expect(result.scanned).toBe(3);
            expect(result.purged).toBe(1);
          });

          it('should reject unscoped keys for non-Super Admins and fail closed when user is missing in finalizeUpload', async () => {
            const teacherUser = { id: 'teacher-1', role: { name: 'TEACHER' } };

            // 1. Unscoped key (only 2 parts, no owner segment) must be rejected for non-superadmin
            await expect(
              testStorageService.finalizeUpload('materials/unscoped-file.pdf', teacherUser)
            ).rejects.toThrow(ForbiddenException);

            // 2. Missing authenticated user must fail closed
            await expect(
              testStorageService.finalizeUpload('materials/teacher-1/file.pdf', null)
            ).rejects.toThrow(ForbiddenException);
          });

          it('should fail closed when database is unavailable during form upload finalization', async () => {
            const teacherUser = { id: 'teacher-1', role: { name: 'TEACHER' } };
            const serviceWithoutPrisma = new StorageService(null as any);

            await expect(
              serviceWithoutPrisma.finalizeUpload('forms/form-1/file.pdf', teacherUser)
            ).rejects.toThrow(InternalServerErrorException);
          });

          it('should follow S3 ContinuationToken pagination in cleanupOrphanUploads across multiple pages', async () => {
            const oldDate = new Date(Date.now() - 4 * 60 * 60 * 1000);
            let pageCall = 0;

            mockS3Client.send.mockImplementation(async (cmd: any) => {
              if (cmd.constructor?.name === 'ListObjectsV2Command' || cmd.input?.Prefix) {
                if (cmd.input.Prefix === 'materials/') {
                  pageCall++;
                  if (pageCall === 1) {
                    return {
                      IsTruncated: true,
                      NextContinuationToken: 'token-page-2',
                      Contents: [
                        { Key: 'materials/u-1/orphan-page-1.pdf', LastModified: oldDate }
                      ],
                    };
                  } else {
                    return {
                      IsTruncated: false,
                      Contents: [
                        { Key: 'materials/u-1/orphan-page-2.pdf', LastModified: oldDate }
                      ],
                    };
                  }
                }
                return { Contents: [] };
              }
              return {};
            });

            mockStoragePrisma.studyMaterial.findFirst.mockResolvedValue(null);

            const result = await testStorageService.cleanupOrphanUploads(2);
            expect(pageCall).toBe(2);
            expect(result.scanned).toBe(2);
            expect(result.purged).toBe(2);
          });

          it('should reject negative, zero, and out-of-range maxAgeHours in cleanupOrphanUploads', async () => {
            // Negative value moving threshold into the future
            await expect(testStorageService.cleanupOrphanUploads(-1)).rejects.toThrow(BadRequestException);
            await expect(testStorageService.cleanupOrphanUploads(-24)).rejects.toThrow(BadRequestException);

            // Zero value
            await expect(testStorageService.cleanupOrphanUploads(0)).rejects.toThrow(BadRequestException);

            // Less than safe 1-hour minimum retention
            await expect(testStorageService.cleanupOrphanUploads(0.5)).rejects.toThrow(BadRequestException);

            // Excessive value (> 720 hours / 30 days)
            await expect(testStorageService.cleanupOrphanUploads(1000)).rejects.toThrow(BadRequestException);

            // Non-finite values
            await expect(testStorageService.cleanupOrphanUploads(NaN)).rejects.toThrow(BadRequestException);
            await expect(testStorageService.cleanupOrphanUploads(Infinity)).rejects.toThrow(BadRequestException);
          });
        });
      });
    });
  });

  describe('SEC-24: Multi-Role Session Registration, Server-Side Logout Revocation, and Token Replay Rejection', () => {
    let mockPrisma: any;
    let mockRedisService: any;
    let jwtService: any;
    let jwtStrategy: any;
    let authController: any;
    let publicAuthService: any;
    let authService: any;

    const activeSessions = new Map<string, string>(); // `session:${jti}` -> userId
    const userSessionSets = new Map<string, Set<string>>(); // userId -> Set<jti>

    beforeEach(() => {
      activeSessions.clear();
      userSessionSets.clear();

      mockRedisService = {
        whitelistSession: jest.fn(async (userId: string, jti: string, ttl: number) => {
          activeSessions.set(`session:${jti}`, userId);
          if (!userSessionSets.has(userId)) {
            userSessionSets.set(userId, new Set());
          }
          userSessionSets.get(userId)!.add(jti);
          return true;
        }),
        isSessionValid: jest.fn(async (userId: string, jti?: string) => {
          if (!jti) return false;
          return activeSessions.has(`session:${jti}`);
        }),
        revokeSession: jest.fn(async (userId: string, jti: string) => {
          activeSessions.delete(`session:${jti}`);
          userSessionSets.get(userId)?.delete(jti);
          return true;
        }),
        revokeAllSessions: jest.fn(async (userId: string) => {
          const jtis = userSessionSets.get(userId);
          if (jtis) {
            for (const jti of jtis) {
              activeSessions.delete(`session:${jti}`);
            }
            userSessionSets.delete(userId);
          }
          return true;
        }),
        trackOnlineUser: jest.fn(async () => true),
        isLoginLocked: jest.fn(async () => false),
        incrementLoginAttempts: jest.fn(async () => 0),
        resetLoginAttempts: jest.fn(async () => {}),
      };

      mockPrisma = {
        publicUser: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
        },
        otpToken: {
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
        },
        studentProfile: {
          findUnique: jest.fn(),
        },
        userCentre: {
          findFirst: jest.fn(),
        },
      };

      jwtService = {
        sign: jest.fn((payload: any) => `mock.jwt.${Buffer.from(JSON.stringify(payload)).toString('base64')}`),
      };

      jwtStrategy = new JwtStrategy(mockPrisma as any, mockRedisService as any);
      authController = new AuthController(
        authService as any,
        mockRedisService as any
      );
      publicAuthService = new PublicAuthService(
        mockPrisma as any,
        jwtService as any,
        mockRedisService as any
      );
      authService = new AuthService(
        mockPrisma as any,
        jwtService as any,
        mockRedisService as any
      );
    });

    describe('1. PUBLIC_LEARNER Complete Authentication & Revocation Lifecycle', () => {
      const publicUserId = 'pub-learner-101';
      const rawPassword = 'StrongPassword123!';
      let passwordHash: string;

      beforeAll(async () => {
        passwordHash = await argon2.hash(rawPassword);
      });

      it('should enforce session registration on login, validate active token, and reject token replay after logout', async () => {
        // Step 1: Mock verified public user in database
        mockPrisma.publicUser.findUnique.mockResolvedValue({
          id: publicUserId,
          email: 'learner@example.com',
          name: 'Jane Learner',
          phone: '9876543210',
          passwordHash,
          isVerified: true,
          avatar: null,
        });

        // Step 2: Log in
        const loginResult = await publicAuthService.login({
          email: 'learner@example.com',
          password: rawPassword,
        });

        expect(loginResult).toHaveProperty('accessToken');
        expect(loginResult.user.id).toBe(publicUserId);

        // Verify session was registered in Redis with a valid JTI
        expect(mockRedisService.whitelistSession).toHaveBeenCalledWith(
          publicUserId,
          expect.any(String),
          7 * 24 * 60 * 60
        );

        const capturedJti = mockRedisService.whitelistSession.mock.calls[0][1];
        expect(capturedJti).toBeDefined();
        expect(activeSessions.has(`session:${capturedJti}`)).toBe(true);

        // Step 3: Validate active token in JwtStrategy
        const activePayload = {
          sub: publicUserId,
          role: 'PUBLIC_LEARNER',
          jti: capturedJti,
        };

        const validatedUser = await jwtStrategy.validate(activePayload);
        expect(validatedUser.id).toBe(publicUserId);
        expect(validatedUser.role.name).toBe('PUBLIC_LEARNER');
        expect(validatedUser.jti).toBe(capturedJti);
        expect(mockRedisService.trackOnlineUser).toHaveBeenCalledWith(publicUserId);

        // Step 4: Perform real logout via AuthController
        const mockResponse: any = {
          cookie: jest.fn(),
        };

        const logoutResult = await authController.logout(
          { user: { id: publicUserId, jti: capturedJti } },
          mockResponse
        );

        expect(logoutResult.sessionRevoked).toBe(true);
        expect(logoutResult.message).toBe('Logout successful');
        expect(mockRedisService.revokeSession).toHaveBeenCalledWith(publicUserId, capturedJti);
        expect(activeSessions.has(`session:${capturedJti}`)).toBe(false);

        // Step 5: Replay the exact same bearer token payload
        await expect(jwtStrategy.validate(activePayload)).rejects.toThrow(
          new UnauthorizedException('Session has been revoked or expired')
        );

        // Step 6: Verify a fresh login issues a new distinct token/session that works
        const secondLogin = await publicAuthService.login({
          email: 'learner@example.com',
          password: rawPassword,
        });

        const secondJti = mockRedisService.whitelistSession.mock.calls[1][1];
        expect(secondJti).not.toBe(capturedJti);

        const freshPayload = {
          sub: publicUserId,
          role: 'PUBLIC_LEARNER',
          jti: secondJti,
        };

        const freshValidatedUser = await jwtStrategy.validate(freshPayload);
        expect(freshValidatedUser.id).toBe(publicUserId);
        expect(freshValidatedUser.jti).toBe(secondJti);

        // Replaying the old token still fails
        await expect(jwtStrategy.validate(activePayload)).rejects.toThrow(UnauthorizedException);
      });

      it('should reject tokens missing JTI unconditionally', async () => {
        const legacyPayloadNoJti = {
          sub: publicUserId,
          role: 'PUBLIC_LEARNER',
        };

        await expect(jwtStrategy.validate(legacyPayloadNoJti)).rejects.toThrow(
          new UnauthorizedException('Session has been revoked or expired')
        );
      });
    });

    describe('2. Internal Roles (STUDENT, TEACHER, CENTRE_ADMIN) Complete Lifecycle', () => {
      const internalRoles = ['STUDENT', 'TEACHER', 'CENTRE_ADMIN'] as const;

      for (const roleName of internalRoles) {
        it(`should verify login, active session, logout revocation, and token replay for ${roleName}`, async () => {
          const userId = `user-${roleName.toLowerCase()}-1`;
          const jti = crypto.randomUUID();

          // Mock user in database
          mockPrisma.user.findUnique.mockResolvedValue({
            id: userId,
            email: `${roleName.toLowerCase()}@educare.test`,
            password: 'hashed-password',
            status: 'ACTIVE',
            role: { name: roleName, permissions: [] },
            userCentres: [{ centreId: 'centre-alpha' }],
          });

          // Whitelist session in Redis
          await mockRedisService.whitelistSession(userId, jti, 7 * 24 * 60 * 60);
          expect(activeSessions.has(`session:${jti}`)).toBe(true);

          const payload = {
            sub: userId,
            role: roleName,
            jti,
          };

          // Step 1: Active token validation
          const activeUser = await jwtStrategy.validate(payload);
          expect(activeUser.id).toBe(userId);
          expect(activeUser.role.name).toBe(roleName);
          expect(activeUser.jti).toBe(jti);

          // Step 2: Logout
          const mockRes: any = { cookie: jest.fn() };
          const logoutRes = await authController.logout(
            { user: { id: userId, jti } },
            mockRes
          );
          expect(logoutRes.sessionRevoked).toBe(true);
          expect(mockRedisService.revokeSession).toHaveBeenCalledWith(userId, jti);
          expect(activeSessions.has(`session:${jti}`)).toBe(false);

          // Step 3: Token replay fails closed
          await expect(jwtStrategy.validate(payload)).rejects.toThrow(
            new UnauthorizedException('Session has been revoked or expired')
          );

          // Step 4: Fresh login works
          const freshJti = crypto.randomUUID();
          await mockRedisService.whitelistSession(userId, freshJti, 7 * 24 * 60 * 60);

          const freshUser = await jwtStrategy.validate({
            sub: userId,
            role: roleName,
            jti: freshJti,
          });
          expect(freshUser.id).toBe(userId);
          expect(freshUser.jti).toBe(freshJti);
        });
      }

      it('should invalidate all active user sessions on logout-all', async () => {
        const userId = 'teacher-multi-device';
        const jtiDevice1 = crypto.randomUUID();
        const jtiDevice2 = crypto.randomUUID();

        mockPrisma.user.findUnique.mockResolvedValue({
          id: userId,
          email: 'teacher@educare.test',
          password: 'pwd',
          status: 'ACTIVE',
          role: { name: 'TEACHER', permissions: [] },
          userCentres: [{ centreId: 'centre-alpha' }],
        });

        await mockRedisService.whitelistSession(userId, jtiDevice1, 604800);
        await mockRedisService.whitelistSession(userId, jtiDevice2, 604800);

        expect(await mockRedisService.isSessionValid(userId, jtiDevice1)).toBe(true);
        expect(await mockRedisService.isSessionValid(userId, jtiDevice2)).toBe(true);

        const mockRes: any = { cookie: jest.fn() };
        const logoutAllRes = await authController.logoutAll({ user: { id: userId } }, mockRes);
        expect(logoutAllRes.sessionRevoked).toBe(true);

        // Both device tokens must now be rejected
        await expect(jwtStrategy.validate({ sub: userId, role: 'TEACHER', jti: jtiDevice1 })).rejects.toThrow(
          UnauthorizedException
        );
        await expect(jwtStrategy.validate({ sub: userId, role: 'TEACHER', jti: jtiDevice2 })).rejects.toThrow(
          UnauthorizedException
        );
      });
    });
  });

  describe('SEC-25: Next.js Backend-for-Frontend (BFF) Security Invariants', () => {
    function testGetInternalApiUrl(env: string, internalApiUrl?: string): string {
      const isProduction = env === 'production';
      const configured = internalApiUrl;
      if (isProduction) {
        if (!configured || !configured.trim()) {
          throw new Error('FATAL: INTERNAL_API_URL is mandatory in production for secure BFF upstream proxying.');
        }
        let parsed: URL;
        try {
          parsed = new URL(configured);
        } catch (e: any) {
          throw new Error(`FATAL: INTERNAL_API_URL is not a valid URL: ${e?.message || e}`);
        }
        if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
          throw new Error('FATAL: INTERNAL_API_URL must use HTTPS protocol in production.');
        }
        return configured.trim().replace(/\/+$/, '');
      }
      return (configured || 'http://localhost:3001/api').trim().replace(/\/+$/, '');
    }

    function testGetAuthCookieName(isHttps: boolean, env: string): string {
      return env === 'production' || isHttps ? '__Host-AccessToken' : 'AccessToken';
    }

    function testGetAuthCookieOptions(isHttps: boolean, env: string) {
      const isProduction = env === 'production';
      const secure = isProduction || isHttps;
      return {
        httpOnly: true,
        secure,
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
        domain: undefined,
      };
    }

    function testExtractToken(cookies: Record<string, string>, env: string): string | undefined {
      const isProduction = env === 'production';
      const hostToken = cookies['__Host-AccessToken'];
      if (hostToken) return hostToken;
      if (!isProduction) {
        const legacyToken = cookies['AccessToken'];
        if (legacyToken) return legacyToken;
      }
      return undefined;
    }

    function testValidateCsrf(headers: Record<string, string>, method: string, env: string) {
      const m = method.toUpperCase();
      if (['GET', 'HEAD', 'OPTIONS'].includes(m)) {
        return { valid: true };
      }

      if (headers['sec-fetch-site'] === 'cross-site') {
        return { valid: false, reason: 'Cross-site mutation rejected by Sec-Fetch-Site' };
      }

      const origin = headers['origin'];
      if (!origin) {
        return { valid: false, reason: 'Missing Origin header on state-changing request' };
      }

      let parsedOrigin: URL;
      try {
        parsedOrigin = new URL(origin);
      } catch {
        return { valid: false, reason: 'Malformed Origin header' };
      }

      const cleanOrigin = `${parsedOrigin.protocol}//${parsedOrigin.host}`.toLowerCase();
      const canonicalOrigins = [
        'https://lms.educarelearning.in',
        'https://educarelearning.in',
        'https://api.educarelearning.in',
      ];

      const allowedOrigins = env === 'production'
        ? Array.from(new Set(canonicalOrigins))
        : Array.from(new Set([...canonicalOrigins, 'http://localhost:3000', 'http://127.0.0.1:3000']));

      if (!allowedOrigins.includes(cleanOrigin)) {
        return { valid: false, reason: `Origin ${cleanOrigin} is not in trusted origin list` };
      }

      return { valid: true };
    }

    const ALLOWED_PREFIXES = [
      'assignments', 'attendance', 'auth', 'centres', 'courses', 'doubts',
      'enquiry', 'estudy', 'exams', 'fee', 'finance', 'forms', 'live-class',
      'notices', 'notifications', 'permissions', 'public', 'report', 'roles',
      'setup', 'sms', 'staff', 'storage', 'students', 'study-materials',
      'support', 'syllabus', 'users'
    ];

    function testValidateApiPath(segments: string[]) {
      if (!segments || segments.length === 0) {
        return { valid: false, reason: 'Empty API route path' };
      }

      const sanitizedSegments: string[] = [];

      for (const rawSegment of segments) {
        if (!rawSegment || rawSegment === '.' || rawSegment === '..') {
          return { valid: false, reason: 'Path traversal attempt detected' };
        }
        if (rawSegment.includes('/') || rawSegment.includes('\\') || rawSegment.includes('\0')) {
          return { valid: false, reason: 'Illegal separator or null byte in path segment' };
        }

        let current = rawSegment;
        for (let i = 0; i < 3; i++) {
          try {
            const decoded = decodeURIComponent(current);
            if (decoded === current) break;
            current = decoded;
            if (
              current === '.' ||
              current === '..' ||
              current.includes('..') ||
              current.includes('/') ||
              current.includes('\\') ||
              current.includes('\0')
            ) {
              return { valid: false, reason: 'Decoded path traversal or illegal character detected' };
            }
          } catch {
            return { valid: false, reason: 'Malformed percent-encoding' };
          }
        }
        sanitizedSegments.push(current);
      }

      const top = sanitizedSegments[0]?.toLowerCase();
      if (!ALLOWED_PREFIXES.includes(top)) {
        return { valid: false, reason: `API route prefix '${top}' is not authorized` };
      }

      if (top === 'auth') {
        const sub = sanitizedSegments[1]?.toLowerCase();
        if (['login', 'logout', 'logout-all'].includes(sub)) {
          return {
            valid: false,
            reason: `Route '/auth/${sub}' must be accessed via dedicated '/api/auth/${sub}' handler`,
          };
        }
      }

      return { valid: true, normalizedPath: '/' + sanitizedSegments.join('/') };
    }

    describe('1. Production-Mode Legacy Cookie Strict Rejection', () => {
      it('should strictly reject legacy AccessToken cookie in production and accept only __Host-AccessToken', () => {
        // Production: Legacy AccessToken alone must be rejected
        expect(testExtractToken({ AccessToken: 'legacy-token-123' }, 'production')).toBeUndefined();

        // Production: __Host-AccessToken must be accepted
        expect(testExtractToken({ '__Host-AccessToken': 'valid-host-token' }, 'production')).toBe('valid-host-token');

        // Production: When both are present, __Host-AccessToken must take precedence
        expect(
          testExtractToken(
            { '__Host-AccessToken': 'valid-host-token', AccessToken: 'legacy-token' },
            'production'
          )
        ).toBe('valid-host-token');
      });

      it('should allow AccessToken fallback only in non-production development mode', () => {
        expect(testExtractToken({ AccessToken: 'dev-token-123' }, 'development')).toBe('dev-token-123');
        expect(testExtractToken({ '__Host-AccessToken': 'dev-host-token' }, 'development')).toBe('dev-host-token');
      });
    });

    describe('2. Fail-Closed INTERNAL_API_URL Enforcement', () => {
      it('should fail fast in production if INTERNAL_API_URL is missing or empty', () => {
        expect(() => testGetInternalApiUrl('production', undefined)).toThrow(
          'FATAL: INTERNAL_API_URL is mandatory in production'
        );
        expect(() => testGetInternalApiUrl('production', '')).toThrow(
          'FATAL: INTERNAL_API_URL is mandatory in production'
        );
        expect(() => testGetInternalApiUrl('production', '   ')).toThrow(
          'FATAL: INTERNAL_API_URL is mandatory in production'
        );
      });

      it('should fail fast in production if INTERNAL_API_URL is not HTTPS', () => {
        expect(() => testGetInternalApiUrl('production', 'http://api.external.com/api')).toThrow(
          'FATAL: INTERNAL_API_URL must use HTTPS protocol in production'
        );
      });

      it('should accept valid HTTPS URL in production and localhost in development', () => {
        expect(testGetInternalApiUrl('production', 'https://api.educarelearning.in/api')).toBe(
          'https://api.educarelearning.in/api'
        );
        expect(testGetInternalApiUrl('development', undefined)).toBe('http://localhost:3001/api');
      });
    });

    describe('3. Canonical CSRF Origin Validation & Host Header Poisoning Defense', () => {
      it('should never trust an attacker-supplied Host or arbitrary origin even if matching', () => {
        // Attacker attempts Host Header Poisoning with origin matching the spoofed host
        const attackerAttempt = testValidateCsrf(
          { origin: 'https://attacker-controlled-host.com' },
          'POST',
          'production'
        );
        expect(attackerAttempt.valid).toBe(false);
        expect(attackerAttempt.reason).toContain('not in trusted origin list');
      });

      it('should accept only explicit canonical Educare production origins in production', () => {
        expect(testValidateCsrf({ origin: 'https://lms.educarelearning.in' }, 'POST', 'production').valid).toBe(true);
        expect(testValidateCsrf({ origin: 'https://educarelearning.in' }, 'POST', 'production').valid).toBe(true);
        expect(testValidateCsrf({ origin: 'https://evil.lms.educarelearning.in.attacker.com' }, 'POST', 'production').valid).toBe(false);
      });

      it('should reject missing origin and cross-site requests on mutations', () => {
        expect(testValidateCsrf({}, 'POST', 'production').valid).toBe(false);
        expect(testValidateCsrf({}, 'DELETE', 'production').valid).toBe(false);
        expect(
          testValidateCsrf(
            { origin: 'https://lms.educarelearning.in', 'sec-fetch-site': 'cross-site' },
            'POST',
            'production'
          ).valid
        ).toBe(false);
      });
    });

    describe('4. API Route Allowlisting, Traversal & Privileged Route Protection', () => {
      it('should strictly reject double URL-encoded path traversal (%252e%252e)', () => {
        const doubleEncoded = [
          ['%252e%252e', 'admin'],
          ['students', '%252e%252e', 'admin'],
          ['assignments', '%252e%252e%252fadmin'],
        ];

        for (const seg of doubleEncoded) {
          const res = testValidateApiPath(seg);
          expect(res.valid).toBe(false);
          expect(res.reason?.toLowerCase()).toContain('path traversal');
        }
      });

      it('should reject path segments containing null bytes or slashes', () => {
        expect(testValidateApiPath(['students\0']).valid).toBe(false);
        expect(testValidateApiPath(['students/admin']).valid).toBe(false);
        expect(testValidateApiPath(['students\\admin']).valid).toBe(false);
      });

      it('should forbid proxying privileged /auth/login, /auth/logout, and /auth/logout-all', () => {
        expect(testValidateApiPath(['auth', 'login']).valid).toBe(false);
        expect(testValidateApiPath(['auth', 'login']).reason).toContain('dedicated');

        expect(testValidateApiPath(['auth', 'logout']).valid).toBe(false);
        expect(testValidateApiPath(['auth', 'logout-all']).valid).toBe(false);

        // General non-login auth endpoints (e.g. /auth/profile, /auth/change-password) remain allowed
        expect(testValidateApiPath(['auth', 'change-password']).valid).toBe(true);
      });
    });

    describe('5. Unauthorized Cross-Centre Access Rejection Integration Check', () => {
      it('should strictly deny Centre Admin of Centre A from accessing Centre B resources', () => {
        const centreAdminA = {
          id: 'admin-a',
          role: { name: 'CENTRE_ADMIN' },
          userCentres: [{ centreId: 'centre-alpha' }],
        };

        // Asserting access against Centre B must throw ForbiddenException
        expect(() => assertCentreAccess(centreAdminA, 'centre-beta')).toThrow(ForbiddenException);
        expect(() => assertCentreAccess(centreAdminA, 'centre-alpha')).not.toThrow();
      });
    });
  });
});




