import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { StaffService } from '../staff/staff.service';
import { StaffController } from '../staff/staff.controller';
import { SupportService } from '../support/support.service';
import { SupportController } from '../support/support.controller';
import { EnquiryService } from '../enquiry/enquiry.service';
import { EnquiryController } from '../enquiry/enquiry.controller';
import { StudyMaterialService } from '../study-materials/study-materials.service';
import { EstudyService } from '../estudy/estudy.service';
import { SyllabusService } from '../syllabus/syllabus.service';
import { ConfigController } from '../syllabus/config.controller';
import { SetupController } from '../setup/setup.controller';
import { SetupService } from '../setup/setup.service';
import { ProgressService } from '../syllabus/progress.service';
import { PrismaService } from '../database/prisma.service';
import { EnquiryStatus, SupportTicketStatus } from '@educare/database';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { PERMISSIONS_KEY } from './decorators/permissions.decorator';
import { ROLES_KEY } from './decorators/roles.decorator';

describe('Authorization Remediation Regression Suite', () => {
  // Common Mock Actors
  const superAdmin = {
    id: 'user-super-admin',
    email: 'super@educare.local',
    role: { name: 'SUPER_ADMIN' },
    userCentres: [],
  };

  const centreAdminA = {
    id: 'user-admin-centre-a',
    email: 'admin-a@educare.local',
    role: { name: 'CENTRE_ADMIN' },
    userCentres: [{ centreId: 'centre-a' }],
  };

  const centreAdminB = {
    id: 'user-admin-centre-b',
    email: 'admin-b@educare.local',
    role: { name: 'CENTRE_ADMIN' },
    userCentres: [{ centreId: 'centre-b' }],
  };

  const teacherA = {
    id: 'user-teacher-a',
    email: 'teacher-a@educare.local',
    role: { name: 'TEACHER' },
    userCentres: [{ centreId: 'centre-a' }],
  };

  const studentA = {
    id: 'user-student-a',
    email: 'student-a@educare.local',
    role: { name: 'STUDENT' },
    userCentres: [],
  };

  const studentB = {
    id: 'user-student-b',
    email: 'student-b@educare.local',
    role: { name: 'STUDENT' },
    userCentres: [],
  };

  describe('Scope A — Staff Privilege Escalation Remediation', () => {
    let staffService: StaffService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        role: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        userCentre: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
          create: jest.fn(),
        },
        teacherProfile: {
          create: jest.fn(),
        },
        centre: {
          findFirst: jest.fn().mockResolvedValue({ id: 'centre-b', name: 'Centre B' }),
        },
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
      };
      const mockRedisService = {
        revokeAllSessions: jest.fn().mockResolvedValue(true),
      };
      staffService = new StaffService(mockPrisma as any, mockRedisService as any);
    });

    it('Centre admin creating SUPER_ADMIN -> HTTP 403 Forbidden', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-super-admin', name: 'SUPER_ADMIN' });

      await expect(
        staffService.createStaff(
          {
            email: 'new-super@educare.local',
            password: 'Password123!',
            role: 'SUPER_ADMIN',
            centre: { id: 'centre-a' },
          },
          centreAdminA,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('Centre admin creating CENTRE_ADMIN -> HTTP 403 Forbidden', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-centre-admin', name: 'CENTRE_ADMIN' });

      await expect(
        staffService.createStaff(
          {
            email: 'new-admin@educare.local',
            password: 'Password123!',
            role: 'CENTRE_ADMIN',
            centre: { id: 'centre-a' },
          },
          centreAdminA,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('Centre admin updating a teacher to SUPER_ADMIN -> HTTP 403 Forbidden', async () => {
      // Target user is currently a teacher in Centre A
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'target-teacher-1',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-a' }],
      });
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-super', name: 'SUPER_ADMIN' });

      await expect(
        staffService.updateStaff(
          'target-teacher-1',
          { role: 'SUPER_ADMIN' },
          centreAdminA,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('Centre admin updating or deleting a super-admin/centre-admin account -> HTTP 403 Forbidden', async () => {
      // Target user is a SUPER_ADMIN
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-super-admin',
        role: { name: 'SUPER_ADMIN' },
        userCentres: [],
      });

      // Update attempt
      await expect(
        staffService.updateStaff('existing-super-admin', { firstName: 'Hacked' }, centreAdminA),
      ).rejects.toThrow(ForbiddenException);

      // Delete attempt
      await expect(
        staffService.deleteStaff('existing-super-admin', centreAdminA),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('Centre admin operating on staff from another centre -> HTTP 403 Forbidden', async () => {
      // Target staff belongs exclusively to Centre B
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'teacher-in-centre-b',
        role: { name: 'TEACHER' },
        userCentres: [{ centreId: 'centre-b' }],
      });

      await expect(
        staffService.updateStaff('teacher-in-centre-b', { firstName: 'Moved' }, centreAdminA),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        staffService.deleteStaff('teacher-in-centre-b', centreAdminA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Super admin assigning an allowed role -> succeeds', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'role-centre-admin', name: 'CENTRE_ADMIN' });
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-admin-user',
        email: 'allowed-admin@educare.local',
        firstName: 'Authorized',
        lastName: 'Admin',
        userCentres: [{ centre: { id: 'centre-b', name: 'Centre B' } }],
        role: { name: 'CENTRE_ADMIN' },
      });

      const result = await staffService.createStaff(
        {
          email: 'allowed-admin@educare.local',
          password: 'Password123!',
          role: 'CENTRE_ADMIN',
          centre: 'Centre B',
        },
        superAdmin,
      );

      expect(result).toBeDefined();
      expect(result.user.id).toBe('new-admin-user');
    });
  });

  describe('Scope B — Tenant Isolation: Support Tickets, Enquiries, and Study Materials', () => {
    describe('1. Support Tickets Isolation', () => {
      let supportService: SupportService;
      let mockPrisma: any;

      beforeEach(() => {
        mockPrisma = {
          supportTicket: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
          },
        };
        supportService = new SupportService(mockPrisma as any);
      });

      it('Centre Admin A cannot see tickets owned by users with no verified centre link', async () => {
        mockPrisma.supportTicket.findMany.mockResolvedValue([]);

        await supportService.getAllTickets(centreAdminA);

        expect(mockPrisma.supportTicket.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              user: {
                OR: [
                  { userCentres: { some: { centreId: { in: ['centre-a'] } } } },
                  { studentProfile: { enrollments: { some: { batch: { centreId: { in: ['centre-a'] } } } } } },
                ],
              },
            },
          }),
        );
      });

      it('Centre Admin A updating status of ticket belonging to user in Centre B -> HTTP 403 Forbidden', async () => {
        mockPrisma.supportTicket.findUnique.mockResolvedValue({
          id: 'ticket-b-1',
          user: {
            id: 'user-in-centre-b',
            userCentres: [{ centreId: 'centre-b' }],
            studentProfile: null,
          },
        });

        await expect(
          supportService.updateTicketStatus('ticket-b-1', SupportTicketStatus.RESOLVED, centreAdminA),
        ).rejects.toThrow(ForbiddenException);

        expect(mockPrisma.supportTicket.update).not.toHaveBeenCalled();
      });

      it('Super Admin can view and update tickets globally', async () => {
        mockPrisma.supportTicket.findMany.mockResolvedValue([{ id: 'ticket-1' }, { id: 'ticket-2' }]);
        mockPrisma.supportTicket.findUnique.mockResolvedValue({
          id: 'ticket-1',
          user: { userCentres: [] },
        });
        mockPrisma.supportTicket.update.mockResolvedValue({ id: 'ticket-1', status: 'RESOLVED' });

        const tickets = await supportService.getAllTickets(superAdmin);
        expect(tickets.length).toBe(2);

        const updated = await supportService.updateTicketStatus('ticket-1', SupportTicketStatus.RESOLVED, superAdmin);
        expect(updated.status).toBe('RESOLVED');
      });
    });

    describe('2. Enquiry Isolation & Whitelisting', () => {
      let enquiryService: EnquiryService;
      let mockPrisma: any;

      beforeEach(() => {
        mockPrisma = {
          enquiry: {
            create: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
          },
          centre: {
            findUnique: jest.fn(),
          },
          user: {
            findFirst: jest.fn(),
          },
        };
        enquiryService = new EnquiryService(mockPrisma as any);
      });

      it('Public enquiry cannot set assignedToId, status, internal notes or privileged fields', async () => {
        mockPrisma.centre.findUnique.mockResolvedValue({ id: 'centre-a', status: 'ACTIVE' });
        mockPrisma.enquiry.create.mockImplementation((args: any) => Promise.resolve(args.data));

        const publicPayload = {
          studentName: 'Alice Johnson',
          contactNumber: '9876543210',
          email: 'alice@example.com',
          centreId: 'centre-a',
          // Maliciously injected privileged fields:
          status: 'QUALIFIED',
          assignedToId: 'privileged-staff-id',
          notes: 'Pre-approved scholarship 100%',
          followUpDate: '2026-11-01',
        };

        const created = await enquiryService.createPublicEnquiry(publicPayload);

        // Expect hardcoded status: NEW and privileged fields stripped
        expect(created.status).toBe(EnquiryStatus.NEW);
        expect(created.assignedToId).toBeUndefined();
        expect(created.notes).toBeUndefined();
        expect(created.studentName).toBe('Alice Johnson');
        expect(created.centreId).toBe('centre-a');
      });

      it('Centre Admin A cannot list or update Centre B enquiries', async () => {
        // List check
        mockPrisma.enquiry.findMany.mockResolvedValue([]);
        await enquiryService.getAllEnquiries(centreAdminA);
        expect(mockPrisma.enquiry.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { centreId: { in: ['centre-a'] } },
          }),
        );

        // Update check on Centre B enquiry
        mockPrisma.enquiry.findUnique.mockResolvedValue({
          id: 'enquiry-b-1',
          centreId: 'centre-b',
        });

        await expect(
          enquiryService.updateEnquiry('enquiry-b-1', { notes: 'Updated notes' }, centreAdminA),
        ).rejects.toThrow(ForbiddenException);

        expect(mockPrisma.enquiry.update).not.toHaveBeenCalled();
      });

      it('Centre Admin A cannot create enquiry assigned to Centre B', async () => {
        await expect(
          enquiryService.createEnquiry(
            {
              studentName: 'Bob',
              contactNumber: '1234567890',
              centreId: 'centre-b',
            },
            centreAdminA,
          ),
        ).rejects.toThrow(ForbiddenException);

        expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
      });
    });

    describe('3. Study Materials & E-Study Isolation', () => {
      let studyMaterialService: StudyMaterialService;
      let mockPrisma: any;

      beforeEach(() => {
        mockPrisma = {
          studyMaterial: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
          },
          studentProfile: {
            findUnique: jest.fn(),
          },
          syllabus: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
          },
          academicYear: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
          },
          teacherProfile: {
            findUnique: jest.fn(),
          },
          targetTrack: {
            findUnique: jest.fn(),
          },
        };
        studyMaterialService = new StudyMaterialService(mockPrisma as any);
      });

      it('Student A cannot retrieve materials for a course/batch they are not enrolled in', async () => {
        // Student has enrollment in Batch 1 only
        mockPrisma.studentProfile.findUnique.mockResolvedValue({
          id: 'student-profile-a',
          userId: studentA.id,
          enrollments: [
            {
              batch: {
                id: 'batch-1',
                centreId: 'centre-a',
                boardId: 'board-cbse',
                standardId: 'std-10',
                academicYearId: 'ay-2026',
              },
              trackId: null,
            },
          ],
        });
        mockPrisma.studyMaterial.findMany.mockResolvedValue([]);

        await studyMaterialService.getAll(studentA);

        expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              OR: [
                expect.objectContaining({
                  AND: expect.arrayContaining([
                    {
                      OR: [
                        { syllabus: { standardId: 'std-10', boardId: 'board-cbse' } },
                        { syllabusId: null },
                      ],
                    },
                  ]),
                }),
              ],
            },
          }),
        );
      });

      it('Centre Admin A cannot create material targeting Centre B', async () => {
        mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-1', isActive: true }]);
        mockPrisma.syllabus.findUnique.mockResolvedValue({ id: 'syl-1' });

        await expect(
          studyMaterialService.create(
            {
              title: 'Chemistry Lab',
              syllabusId: 'syl-1',
              centreId: 'centre-b', // Unauthorized target
            },
            centreAdminA,
          ),
        ).rejects.toThrow(ForbiddenException);

        expect(mockPrisma.studyMaterial.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('Scope C — Syllabus Progress and Configuration Permissions', () => {
    let syllabusService: SyllabusService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        batch: {
          findUnique: jest.fn(),
        },
        syllabus: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
        },
        chapter: {
          findUnique: jest.fn(),
        },
        topic: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
        },
        studentProfile: {
          findUnique: jest.fn(),
        },
        enrollment: {
          findUnique: jest.fn(),
        },
        teacherProfile: {
          findUnique: jest.fn(),
        },
        batchChapterProgress: {
          upsert: jest.fn(),
        },
        batchTopicProgress: {
          upsert: jest.fn(),
          findMany: jest.fn(),
        },
        studentTopicProgress: {
          upsert: jest.fn(),
          findMany: jest.fn(),
        },
      };
      syllabusService = new SyllabusService(mockPrisma as any);
    });

    it('Student calling chapter/topic batch-progress mutation -> HTTP 403 Forbidden', async () => {
      mockPrisma.batch.findUnique.mockResolvedValue({
        id: 'batch-centre-a',
        centreId: 'centre-a',
        boardId: 'board-1',
        standardId: 'std-1',
      });

      // Student attempts mutating batch chapter progress
      await expect(
        syllabusService.updateChapterProgress(
          'batch-centre-a',
          'chapter-1',
          'COMPLETED',
          studentA.id,
          studentA,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Student attempts mutating batch topic progress
      await expect(
        syllabusService.updateTopicProgress(
          'batch-centre-a',
          'topic-1',
          'COMPLETED',
          studentA.id,
          studentA,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.batchChapterProgress.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.batchTopicProgress.upsert).not.toHaveBeenCalled();
    });

    it('Student querying another student progress -> HTTP 403 Forbidden', async () => {
      mockPrisma.studentProfile.findUnique
        .mockResolvedValueOnce({ id: 'student-profile-b', userId: studentB.id }) // target student
        .mockResolvedValueOnce({ id: 'student-profile-a', userId: studentA.id }); // caller profile

      await expect(
        syllabusService.getStudentSyllabusProgress('batch-1', 'student-profile-b', studentA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Student querying progress for a batch they are not enrolled in -> HTTP 403 Forbidden', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'student-profile-a',
        userId: studentA.id,
        enrollments: [{ batchId: 'batch-enrolled' }],
      });
      mockPrisma.batch.findUnique.mockResolvedValue({
        id: 'batch-not-enrolled',
        centreId: 'centre-a',
      });

      await expect(
        syllabusService.getBatchSyllabusProgress('batch-not-enrolled', studentA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Centre Admin A cannot read or mutate a batch belonging to Centre B', async () => {
      mockPrisma.batch.findUnique.mockResolvedValue({
        id: 'batch-in-b',
        centreId: 'centre-b',
      });

      await expect(
        syllabusService.getBatchSyllabusProgress('batch-in-b', centreAdminA),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        syllabusService.updateChapterProgress('batch-in-b', 'chap-1', 'COMPLETED', centreAdminA.id, centreAdminA),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        syllabusService.getBatchAnalytics('batch-in-b', centreAdminA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Batch A combined with an unrelated chapter/topic ID is rejected with HTTP 400', async () => {
      mockPrisma.batch.findUnique.mockResolvedValue({
        id: 'batch-1',
        centreId: 'centre-a',
        boardId: 'board-cbse',
        standardId: 'std-10',
      });

      // Chapter belongs to ICSE Class 12
      mockPrisma.chapter.findUnique.mockResolvedValue({
        id: 'unrelated-chapter',
        syllabus: {
          boardId: 'board-icse',
          standardId: 'std-12',
        },
      });

      await expect(
        syllabusService.updateChapterProgress('batch-1', 'unrelated-chapter', 'COMPLETED', centreAdminA.id, centreAdminA),
      ).rejects.toThrow(BadRequestException);
    });

    it('Teacher without appropriate assignment cannot mutate that batch', async () => {
      mockPrisma.batch.findUnique.mockResolvedValue({
        id: 'batch-1',
        centreId: 'centre-a',
        boardId: 'board-cbse',
        standardId: 'std-10',
      });
      // Teacher profile has assignments only for std-12 in another batch
      mockPrisma.teacherProfile.findUnique.mockResolvedValue({
        userId: teacherA.id,
        assignments: [
          {
            batchId: 'batch-999',
            centreId: 'centre-a',
            standardId: 'std-12',
            boardId: 'board-cbse',
          },
        ],
      });

      await expect(
        syllabusService.updateChapterProgress('batch-1', 'chap-1', 'COMPLETED', teacherA.id, teacherA),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Public Route Bypass in Global PermissionsGuard and RolesGuard', () => {
    it('PermissionsGuard allows @Public() endpoints without requiring user or permissions', () => {
      const reflector = {
        getAllAndOverride: jest.fn((key) => {
          if (key === IS_PUBLIC_KEY) return true;
          if (key === PERMISSIONS_KEY) return ['LIVE_CLASSES'];
          return null;
        }),
      };
      const guard = new PermissionsGuard(reflector as any);
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: undefined }),
        }),
      };
      expect(guard.canActivate(mockContext as any)).toBe(true);
    });

    it('RolesGuard allows @Public() endpoints without requiring user or roles', () => {
      const reflector = {
        getAllAndOverride: jest.fn((key) => {
          if (key === IS_PUBLIC_KEY) return true;
          if (key === ROLES_KEY) return ['SUPER_ADMIN'];
          return null;
        }),
      };
      const guard = new RolesGuard(reflector as any);
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: undefined }),
        }),
      };
      expect(guard.canActivate(mockContext as any)).toBe(true);
    });
  });
});
