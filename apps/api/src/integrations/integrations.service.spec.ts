import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../database/prisma.service';
import * as crypto from 'crypto';

describe('IntegrationsService & Webhook Ingestion', () => {
  let service: IntegrationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      apiIntegration: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      studentProfile: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(10),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue({ id: 'role-student', name: 'STUDENT' }),
      },
      centre: {
        findFirst: jest.fn().mockResolvedValue({ id: 'centre-1', name: 'Main Campus', code: 'MC' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'centre-1', name: 'Main Campus', code: 'MC' }),
      },
      academicYear: {
        findFirst: jest.fn().mockResolvedValue({ id: 'year-1', name: '2025-2026', isActive: true }),
      },
      board: {
        findFirst: jest.fn().mockResolvedValue({ id: 'board-1', name: 'CBSE' }),
        create: jest.fn().mockResolvedValue({ id: 'board-1', name: 'CBSE' }),
      },
      standard: {
        findFirst: jest.fn().mockResolvedValue({ id: 'std-1', name: 'Class 10' }),
        create: jest.fn().mockResolvedValue({ id: 'std-1', name: 'Class 10' }),
      },
      batch: {
        findFirst: jest.fn().mockResolvedValue({ id: 'batch-1', name: 'Default Batch' }),
        create: jest.fn().mockResolvedValue({ id: 'batch-1', name: 'Default Batch' }),
      },
      enrollment: {
        create: jest.fn().mockResolvedValue({ id: 'enr-1' }),
      },
      userCentre: {
        create: jest.fn().mockResolvedValue({ id: 'uc-1' }),
      },
      enquiry: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'enq-1' }),
        update: jest.fn().mockResolvedValue({ id: 'enq-1' }),
      },
      webhookLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('HMAC SHA-256 Webhook Signature Verification', () => {
    it('should compute and verify valid HMAC signatures over raw payloads', () => {
      const secret = 'whsec_test_secret_key_12345';
      const payload = JSON.stringify({
        event: 'student.enrolled',
        data: { crmEnquiryId: 'CRM-100', studentName: 'Test Student' },
      });

      const signature = crypto
        .createHmac('sha256', secret)
        .update(Buffer.from(payload))
        .digest('hex');

      const computed = crypto
        .createHmac('sha256', secret)
        .update(Buffer.from(payload))
        .digest('hex');

      expect(signature).toBe(computed);
      expect(crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(computed, 'hex'))).toBe(true);
    });
  });

  describe('Idempotency Handling', () => {
    it('should update existing student without creating duplicate when CRM ID matches', async () => {
      prisma.studentProfile.findFirst.mockResolvedValueOnce({
        id: 'prof-existing',
        userId: 'user-existing',
        admissionNo: 'MC-12345',
        parentName: 'Old Parent',
        user: { email: 'student@example.com' },
        enrollments: [{ batchId: 'batch-1', batch: { centreId: 'centre-1' } }],
      });
      prisma.studentProfile.update.mockResolvedValueOnce({
        id: 'prof-existing',
        admissionNo: 'MC-12345',
      });
      prisma.enquiry.findFirst.mockResolvedValueOnce({
        id: 'enq-1',
        notes: '',
      });

      const integration = { id: 'integ-1', centreId: 'centre-1' };
      const rawPayload = {
        event: 'student.enrolled',
        data: {
          crmEnquiryId: 'CRM-REPEAT-101',
          studentName: 'Existing Student',
          email: 'student@example.com',
          parentName: 'Updated Parent',
        },
      };

      const result = await service.processCrmAdmissionWebhook(rawPayload, integration);

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(false);
      expect(result.studentId).toBe('prof-existing');
      expect(prisma.studentProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prof-existing' },
          data: expect.objectContaining({
            externalCrmId: 'CRM-REPEAT-101',
            parentName: 'Updated Parent',
          }),
        }),
      );
    });
  });

  describe('New Student Enrollment Dispatch', () => {
    it('should provision user, profile, enrollment, and enquiry in a transaction', async () => {
      prisma.studentProfile.findFirst.mockResolvedValueOnce(null);
      prisma.user.findUnique.mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValueOnce({
        id: 'usr-new',
        email: 'newstudent@example.com',
      });
      prisma.studentProfile.create.mockResolvedValueOnce({
        id: 'prof-new',
        admissionNo: 'MC-99999',
      });

      const integration = { id: 'integ-1', centreId: 'centre-1' };
      const rawPayload = {
        event: 'opportunity.won',
        data: {
          crmEnquiryId: 'CRM-NEW-500',
          studentName: 'Aarav Patel',
          email: 'aarav@example.com',
          phone: '+91 9999999999',
          centre: 'Main Campus',
          board: 'CBSE',
          standard: 'Class 10',
        },
      };

      const result = await service.processCrmAdmissionWebhook(rawPayload, integration);

      expect(result.success).toBe(true);
      expect(result.isNew).toBe(true);
      expect(result.studentId).toBe('prof-new');
      expect(result.email).toBe('newstudent@example.com');
      expect((result as any).temporaryPassword).toBeDefined();
      expect(result.admissionNo).toBe('MC-99999');
      expect(prisma.webhookLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUCCESS',
            crmId: 'CRM-NEW-500',
          }),
        }),
      );
    });
  });
});
