import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from './students.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('StudentsService - Structured Admission Number Generation', () => {
  let service: StudentsService;
  let prisma: any;
  let redis: any;

  const mockCentre = {
    id: 'centre-kl',
    code: 'KL',
    name: 'Educare Kalathipady',
  };

  const mockAcademicYear = {
    id: 'year-2026',
    name: '2025-26',
    isActive: true,
  };

  const mockStandard = {
    id: 'std-11',
    name: 'Class 11',
    level: 11,
  };

  const mockBoard = {
    id: 'board-cbse',
    name: 'CBSE',
  };

  const mockBatch = {
    id: 'batch-div-a',
    name: 'Division A',
  };

  const mockTrack = {
    id: 'track-neet',
    name: 'NEET Long Term',
  };

  const mockRole = {
    id: 'role-student',
    name: 'STUDENT',
  };

  beforeEach(async () => {
    prisma = {
      centre: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockCentre.id) return Promise.resolve(mockCentre);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockResolvedValue(mockCentre),
      },
      academicYear: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockAcademicYear.id || where.name === mockAcademicYear.name) {
            return Promise.resolve(mockAcademicYear);
          }
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockResolvedValue(mockAcademicYear),
      },
      standard: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockStandard.id) return Promise.resolve(mockStandard);
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockResolvedValue(mockStandard),
      },
      board: {
        findUnique: jest.fn().mockResolvedValue(mockBoard),
      },
      batch: {
        findUnique: jest.fn().mockResolvedValue(mockBatch),
        findFirst: jest.fn().mockResolvedValue(mockBatch),
        create: jest.fn().mockResolvedValue(mockBatch),
      },
      targetTrack: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === mockTrack.id) return Promise.resolve(mockTrack);
          return Promise.resolve(null);
        }),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue(mockRole),
      },
      studentProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sp-1', ...data })),
      },
      user: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'u-1', ...data })),
      },
      enrollment: {
        create: jest.fn().mockResolvedValue({ id: 'enr-1' }),
        count: jest.fn().mockResolvedValue(0),
      },
      userCentre: {
        create: jest.fn().mockResolvedValue({ id: 'uc-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
    };

    redis = {
      del: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
  });

  describe('generateNextAdmissionNo', () => {
    it('generates KL-26-NEET-11A-001 when cohort has no prior enrollments', async () => {
      prisma.studentProfile.findMany.mockResolvedValue([]);

      const result = await service.generateNextAdmissionNo({
        centreId: mockCentre.id,
        academicYearId: mockAcademicYear.id,
        trackId: mockTrack.id,
        standardId: mockStandard.id,
        batchId: mockBatch.id,
      });

      expect(result.prefix).toBe('KL-26-NEET-11A');
      expect(result.sequence).toBe(1);
      expect(result.admissionNo).toBe('KL-26-NEET-11A-001');
    });

    it('advances sequential counter to 004 when 001, 002, 003 already exist', async () => {
      prisma.studentProfile.findMany.mockResolvedValue([
        { admissionNo: 'KL-26-NEET-11A-001' },
        { admissionNo: 'KL-26-NEET-11A-002' },
        { admissionNo: 'KL-26-NEET-11A-003' },
      ]);

      const result = await service.generateNextAdmissionNo({
        centreId: mockCentre.id,
        academicYearId: mockAcademicYear.id,
        trackId: mockTrack.id,
        standardId: mockStandard.id,
        batchId: mockBatch.id,
      });

      expect(result.sequence).toBe(4);
      expect(result.admissionNo).toBe('KL-26-NEET-11A-004');
    });

    it('scopes sequence to batch enrollment count when batch has 5 enrolled students', async () => {
      prisma.enrollment.count.mockResolvedValue(5);
      prisma.studentProfile.findMany.mockResolvedValue([]);

      const result = await service.generateNextAdmissionNo({
        centreId: mockCentre.id,
        academicYearId: mockAcademicYear.id,
        trackId: mockTrack.id,
        standardId: mockStandard.id,
        batchId: mockBatch.id,
      });

      expect(result.sequence).toBe(6);
      expect(result.rollNo).toBe(6);
      expect(result.admissionNo).toBe('KL-26-NEET-11A-006');
    });
  });

  describe('createStudent', () => {
    it('auto-generates structured admission number when admissionNo is empty', async () => {
      prisma.studentProfile.findMany.mockResolvedValue([]);

      const adminUser = { role: 'SUPER_ADMIN' };
      const res = await service.createStudent(
        {
          name: 'Arjun Nair',
          email: 'arjun@example.com',
          centre: mockCentre.name,
          academicYear: mockAcademicYear.name,
          board: mockBoard.name,
          classLevel: mockStandard.name,
          division: mockBatch.name,
          trackId: mockTrack.id,
          admissionNo: '',
        },
        adminUser,
      );

      expect(res.profile.admissionNo).toBe('KL-26-NEET-11A-001');
      expect(prisma.studentProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            admissionNo: 'KL-26-NEET-11A-001',
          }),
        }),
      );
    });

    it('sanitizes and replaces autofilled email address string in admissionNo with generated format', async () => {
      prisma.studentProfile.findMany.mockResolvedValue([]);

      const adminUser = { role: 'SUPER_ADMIN' };
      const res = await service.createStudent(
        {
          name: 'Pooja Sharma',
          email: 'pooja@example.com',
          centre: mockCentre.name,
          academicYear: mockAcademicYear.name,
          board: mockBoard.name,
          classLevel: mockStandard.name,
          division: mockBatch.name,
          trackId: mockTrack.id,
          admissionNo: 'admin@educarelearning.in', // Simulated browser autofill mistake
        },
        adminUser,
      );

      expect(res.profile.admissionNo).toBe('KL-26-NEET-11A-001');
      expect(res.profile.admissionNo).not.toContain('@');
      expect(res.profile.admissionNo).not.toContain('admin');
    });
  });
});

