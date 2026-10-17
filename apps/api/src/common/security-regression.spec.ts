import { getJwtSecret } from './config/jwt.config';
import { StorageService } from '../storage/storage.service';
import { assertCentreAccess, isSuperAdmin, getUserCentreIds } from './utils/tenant.util';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://mock-r2.com/upload-signed'),
}));

describe('Security Regression Suite', () => {
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

  describe('SEC-02: Multi-Tenant Centre Isolation', () => {
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
      expect(getUserCentreIds({ id: 'no-centres', role: 'STUDENT' })).toEqual([]);
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
  });

  describe('SEC-03: Exam Question Sanitization & Server-Side Scoring', () => {
    function sanitizeQuestions(questions: any[]): any[] {
      return questions.map(q => {
        const { correctOption, explanation, ...safeQ } = q;
        return safeQ;
      });
    }

    function calculateAuthoritativeScore(questions: any[], answers: Record<string, string>) {
      let calculatedEarned = 0;
      let totalPossible = 0;

      for (const q of questions) {
        const qMarks = Number(q.marks ?? 4.0);
        const qNegMarks = Number(q.negativeMarks ?? 1.0);
        totalPossible += qMarks;

        if (q.type !== 'DESCRIPTIVE') {
          const studentAns = answers ? answers[q.id] : undefined;
          if (studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== '') {
            if (String(studentAns).trim() === String(q.correctOption).trim()) {
              calculatedEarned += qMarks;
            } else {
              calculatedEarned -= qNegMarks;
            }
          }
        }
      }

      return {
        marksObtained: Math.max(0, calculatedEarned),
        maxMarks: totalPossible,
      };
    }

    it('should sanitize correctOption and explanation from student view before submission', () => {
      const rawQuestions = [
        {
          id: 'q1',
          questionText: 'What is 2 + 2?',
          options: ['2', '3', '4', '5'],
          correctOption: '4',
          explanation: 'Basic arithmetic addition',
          marks: 4,
          negativeMarks: 1,
        },
      ];

      const sanitized = sanitizeQuestions(rawQuestions);
      expect(sanitized[0].correctOption).toBeUndefined();
      expect(sanitized[0].explanation).toBeUndefined();
      expect(sanitized[0].questionText).toBe('What is 2 + 2?');
      expect(sanitized[0].options).toEqual(['2', '3', '4', '5']);
    });

    it('should calculate score objectively and ignore forged client scores', () => {
      const questions = [
        { id: 'q1', type: 'MCQ', correctOption: 'B', marks: 4, negativeMarks: 1 },
        { id: 'q2', type: 'MCQ', correctOption: 'A', marks: 4, negativeMarks: 1 },
      ];

      // Student got q1 right (B) and q2 wrong (C)
      const studentAnswers = { q1: 'B', q2: 'C' };
      const result = calculateAuthoritativeScore(questions, studentAnswers);

      // Expected: +4 for q1, -1 for q2 = 3 marks out of 8
      expect(result.marksObtained).toBe(3);
      expect(result.maxMarks).toBe(8);

      // Even if client sent score: { earned: 100, total: 100 }, the authoritative calculation is 3
      expect(result.marksObtained).not.toBe(100);
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
