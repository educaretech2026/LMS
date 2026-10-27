import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { StaffService } from '../staff/staff.service';
import { StaffController } from '../staff/staff.controller';
import { SupportService } from '../support/support.service';
import { SupportController } from '../support/support.controller';
import { EnquiryService } from '../enquiry/enquiry.service';
import { EnquiryController } from '../enquiry/enquiry.controller';
import { StudyMaterialService } from '../study-materials/study-materials.service';
import { StudyMaterialController } from '../study-materials/study-materials.controller';
import { EstudyService } from '../estudy/estudy.service';
import { AuditService } from '../audit/audit.service';
import { SyllabusService } from '../syllabus/syllabus.service';
import { ConfigController } from '../syllabus/config.controller';
import { SetupController } from '../setup/setup.controller';
import { SetupService } from '../setup/setup.service';
import { ProgressService } from '../syllabus/progress.service';
import { PrismaService } from '../database/prisma.service';
import { EnquiryStatus, SupportTicketStatus } from '@educare/database';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { StrictThrottlerGuard } from './guards/strict-throttler.guard';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { PERMISSIONS_KEY } from './decorators/permissions.decorator';
import { ROLES_KEY } from './decorators/roles.decorator';
import { reconcileLegacyEnquiries } from '../../../../packages/database/prisma/scripts/backfill-enquiry-centres';
import { reconcileLegacyStudyMaterials } from '../../../../packages/database/prisma/scripts/backfill-study-material-centres';

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
        setMustChangePassword: jest.fn().mockResolvedValue(undefined),
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
        mockPrisma.customForm = {
          findUnique: jest.fn().mockResolvedValue({
            id: 'form-a',
            isActive: true,
            centreId: 'centre-a',
            centre: { id: 'centre-a', status: 'ACTIVE' },
          }),
        };
        mockPrisma.centre.findUnique.mockResolvedValue({ id: 'centre-a', status: 'ACTIVE' });
        mockPrisma.enquiry.create.mockImplementation((args: any) => Promise.resolve(args.data));

        const publicPayload = {
          studentName: 'Alice Johnson',
          contactNumber: '9876543210',
          email: 'alice@example.com',
          formId: 'form-a',
          // Maliciously injected privileged fields:
          status: 'QUALIFIED',
          assignedToId: 'privileged-staff-id',
          notes: 'Pre-approved scholarship 100%',
          followUpDate: '2026-11-01',
        };

        const created = await enquiryService.createPublicEnquiry(publicPayload);

        // Expect hardcoded status: NEW and privileged fields stripped
        expect(created.status).toBe(EnquiryStatus.NEW);
        expect(created.assignedToId).toBeNull();
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
              OR: expect.arrayContaining([
                { isPublic: true },
                expect.objectContaining({
                  AND: expect.arrayContaining([
                    { syllabus: { standardId: 'std-10', boardId: 'board-cbse' } },
                  ]),
                }),
              ]),
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

  describe('Priority 1: Fail-closed handling of legacy study materials', () => {
    let mockPrisma: any;
    let studyMaterialService: StudyMaterialService;

    const studentAlpha = {
      id: 'stud-user-alpha',
      role: { name: 'STUDENT' },
    };

    const centreAdminAlpha = {
      id: 'admin-user-alpha',
      role: { name: 'CENTRE_ADMIN' },
      userCentres: [{ centreId: 'centre-alpha' }],
    };

    const teacherAlpha = {
      id: 'teacher-user-alpha',
      role: { name: 'TEACHER' },
      userCentres: [{ centreId: 'centre-alpha' }],
    };

    beforeEach(() => {
      mockPrisma = {
        studyMaterial: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
        },
        studentProfile: {
          findUnique: jest.fn(),
        },
        teacherProfile: {
          findUnique: jest.fn(),
        },
        academicYear: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
        },
        syllabus: {
          findUnique: jest.fn(),
        },
        targetTrack: {
          findUnique: jest.fn(),
        },
      };
      studyMaterialService = new StudyMaterialService(mockPrisma as any);
    });

    it('Null-centre legacy material (centreId = null, isShared = false) is denied to ordinary student -> HTTP 403 Forbidden', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'legacy-mat-1',
        title: 'Unresolved Legacy Physics',
        centreId: null,
        isShared: false,
        targetTrackId: null,
        uploaderId: 'other-user',
        uploader: {
          role: { name: 'SUPER_ADMIN' },
          userCentres: [],
        },
      });

      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-alpha',
        userId: studentAlpha.id,
        enrollments: [
          {
            batch: { id: 'batch-1', centreId: 'centre-alpha' },
          },
        ],
      });

      await expect(
        studyMaterialService.getById('legacy-mat-1', studentAlpha),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Null-centre legacy material (centreId = null, isShared = false) is denied to Centre Admin who did not upload it -> HTTP 403 Forbidden', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'legacy-mat-2',
        title: 'Unresolved Legacy Chemistry',
        centreId: null,
        isShared: false,
        targetTrackId: null,
        uploaderId: 'other-staff',
        uploader: {
          role: { name: 'SUPER_ADMIN' },
          userCentres: [],
        },
      });

      await expect(
        studyMaterialService.getById('legacy-mat-2', centreAdminAlpha),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Null-centre legacy material (centreId = null, isShared = false) is denied to Teacher who did not upload it -> HTTP 403 Forbidden', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'legacy-mat-3',
        title: 'Unresolved Legacy Biology',
        centreId: null,
        isShared: false,
        targetTrackId: null,
        uploaderId: 'other-teacher',
        uploader: {
          role: { name: 'TEACHER' },
          userCentres: [],
        },
      });

      await expect(
        studyMaterialService.getById('legacy-mat-3', teacherAlpha),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Null-centre material is accessible to its uploader (verified ownership rule)', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-self-uploaded',
        title: 'My Self Uploaded Notes',
        centreId: null,
        isShared: false,
        targetTrackId: null,
        uploaderId: teacherAlpha.id,
        uploader: {
          role: { name: 'TEACHER' },
          userCentres: [{ centreId: 'centre-alpha' }],
        },
      });

      const res = await studyMaterialService.getById('mat-self-uploaded', teacherAlpha);
      expect(res).toBeDefined();
      expect(res.id).toBe('mat-self-uploaded');
    });

    it('Super Admin can access unreconciled legacy material via getById and getUnreconciled', async () => {
      const unresolvedRecord = {
        id: 'legacy-mat-super',
        title: 'Unresolved Global Draft',
        centreId: null,
        isShared: false,
        targetTrackId: null,
      };

      mockPrisma.studyMaterial.findUnique.mockResolvedValue(unresolvedRecord);
      mockPrisma.studyMaterial.findMany.mockResolvedValue([unresolvedRecord]);

      const byId = await studyMaterialService.getById('legacy-mat-super', superAdmin);
      expect(byId).toBeDefined();
      expect(byId.id).toBe('legacy-mat-super');

      const unreconciled = await studyMaterialService.getUnreconciled(superAdmin);
      expect(unreconciled).toHaveLength(1);
      expect(unreconciled[0].id).toBe('legacy-mat-super');
    });

    it('Non-Super Admin cannot access getUnreconciled -> HTTP 403 Forbidden', async () => {
      await expect(
        studyMaterialService.getUnreconciled(centreAdminAlpha),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        studyMaterialService.getUnreconciled(teacherAlpha),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        studyMaterialService.getUnreconciled(studentAlpha),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Explicitly shared material (isShared = true) is available to enrolled student across any centre', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'shared-mat-1',
        title: 'National Foundation Concept Video',
        centreId: null,
        isShared: true,
        targetTrackId: null,
        syllabus: { boardId: 'board-cbse', standardId: 'std-10' },
      });

      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-alpha',
        userId: studentAlpha.id,
        enrollments: [
          {
            batch: {
              id: 'batch-centre-a',
              centreId: 'centre-alpha',
              boardId: 'board-cbse',
              standardId: 'std-10',
            },
          },
        ],
      });

      const res = await studyMaterialService.getById('shared-mat-1', studentAlpha);
      expect(res).toBeDefined();
      expect(res.id).toBe('shared-mat-1');
    });

    it('Explicitly shared material (isShared = true) is available to Centre Admin globally', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'shared-mat-2',
        title: 'HQ Global Faculty Handbook',
        centreId: null,
        isShared: true,
        targetTrackId: null,
        uploaderId: 'super-admin-id',
      });

      const res = await studyMaterialService.getById('shared-mat-2', centreAdminAlpha);
      expect(res).toBeDefined();
      expect(res.id).toBe('shared-mat-2');
    });

    it('Centre-specific material cannot be accessed from another centre by Centre Admin -> HTTP 403 Forbidden', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-centre-beta',
        title: 'Centre Beta Internal Worksheet',
        centreId: 'centre-beta',
        isShared: false,
        targetTrackId: null,
        uploaderId: 'staff-beta',
      });

      await expect(
        studyMaterialService.getById('mat-centre-beta', centreAdminAlpha),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Student cannot access unenrolled material even if centre matches -> HTTP 403 Forbidden', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-std-12',
        title: 'Class 12 Advanced Calculus',
        centreId: 'centre-alpha',
        isShared: false,
        targetTrackId: null,
        syllabus: { boardId: 'board-cbse', standardId: 'std-12' },
      });

      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 'sp-alpha',
        userId: studentAlpha.id,
        enrollments: [
          {
            batch: {
              id: 'batch-std-10',
              centreId: 'centre-alpha',
              boardId: 'board-cbse',
              standardId: 'std-10', // Enrolled in Standard 10, not 12
            },
          },
        ],
      });

      await expect(
        studyMaterialService.getById('mat-std-12', studentAlpha),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Non-super admin cannot set isShared = true when creating material -> rejected with HTTP 403 Forbidden', async () => {
      mockPrisma.academicYear.findMany.mockResolvedValue([{ id: 'ay-1', isActive: true }]);
      mockPrisma.syllabus.findUnique.mockResolvedValue({ id: 'syl-1' });
      mockPrisma.studyMaterial.create = jest.fn();

      await expect(
        studyMaterialService.create(
          {
            title: 'Attempted Global Share by Centre Admin',
            syllabusId: 'syl-1',
            isShared: true, // Non-super admin attempting to declare global content
          },
          centreAdminAlpha,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.studyMaterial.create).not.toHaveBeenCalled();
    });

    it('Non-super admin cannot delete explicitly shared material -> HTTP 403 Forbidden', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'shared-mat-delete',
        title: 'Protected Global Reference',
        centreId: null,
        isShared: true,
        uploaderId: 'super-admin-user',
      });

      await expect(
        studyMaterialService.delete('shared-mat-delete', centreAdminAlpha),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.studyMaterial.delete).not.toHaveBeenCalled();
    });
  });

  describe('Priority 2: Public enquiry abuse protection & strict rate limiting', () => {
    let mockPrisma: any;
    let enquiryService: EnquiryService;

    beforeEach(() => {
      mockPrisma = {
        enquiry: {
          create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'enq-new', ...args.data })),
        },
        centre: {
          findUnique: jest.fn().mockImplementation((args: any) => {
            if (args.where.id === 'centre-active') {
              return Promise.resolve({ id: 'centre-active', status: 'ACTIVE' });
            }
            if (args.where.id === 'centre-inactive') {
              return Promise.resolve({ id: 'centre-inactive', status: 'INACTIVE' });
            }
            return Promise.resolve(null);
          }),
        },
      };
      enquiryService = new EnquiryService(mockPrisma as any);
    });

    it('Public enquiry allows valid payload within limit and creates record with status = NEW and verified centreId', async () => {
      mockPrisma.customForm = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'form-active',
          isActive: true,
          centreId: 'centre-active',
          centre: { id: 'centre-active', status: 'ACTIVE' },
        }),
      };
      mockPrisma.centre.findUnique.mockResolvedValue({ id: 'centre-active', status: 'ACTIVE' });
      mockPrisma.enquiry.create.mockResolvedValue({ id: 'enq-1' });

      const result = await enquiryService.createPublicEnquiry({
        studentName: 'Aarav Sharma',
        parentName: 'Ramesh Sharma',
        contactNumber: '+91 98765 43210',
        email: 'aarav@example.com',
        formId: 'form-active',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.enquiry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentName: 'Aarav Sharma',
            contactNumber: '+91 98765 43210',
            status: EnquiryStatus.NEW,
            centreId: 'centre-active',
            assignedToId: null,
          }),
        }),
      );
    });

    it('Public enquiry rejects invalid payload (missing name or invalid phone number) with HTTP 400 Bad Request, without database write', async () => {
      await expect(
        enquiryService.createPublicEnquiry({
          studentName: '',
          contactNumber: '1234567890',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'Test Student',
          contactNumber: 'invalid-phone',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });

    it('Public enquiry discards client-supplied status, assignedToId, internal notes, and unverified centreId', async () => {
      await enquiryService.createPublicEnquiry({
        studentName: 'Sneha Patel',
        contactNumber: '9876543210',
        status: 'QUALIFIED', // Privileged status injection
        assignedToId: 'user-sales-lead', // Privileged routing injection
        notes: 'Secret discount offered', // Internal note injection
        followUpDate: '2026-12-01',
        centreId: 'centre-inactive', // Inactive centre injection
      });

      expect(mockPrisma.enquiry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            studentName: 'Sneha Patel',
            parentName: null,
            contactNumber: '9876543210',
            email: null,
            address: null,
            source: 'Website Form',
            targetBoard: null,
            targetStandard: null,
            targetCourse: null,
            status: EnquiryStatus.NEW, // Forced to NEW
            centreId: null, // Inactive centre rejected -> null
            assignedToId: null,
          },
        }),
      );
    });

    it('StrictThrottlerGuard extracts tracker strictly from socket.remoteAddress / req.ip without trusting forged X-Forwarded-For headers', async () => {
      const guard = new StrictThrottlerGuard(
        { throttlers: [{ limit: 5, ttl: 60000 }] } as any,
        {} as any,
        { getAllAndOverride: jest.fn() } as any,
      );

      const mockRequest = {
        headers: {
          'x-forwarded-for': '203.0.113.195, 198.51.100.17', // Attacker-forged proxy chain
        },
        socket: {
          remoteAddress: '148.135.138.196', // Genuine TCP connection socket
        },
        ip: '148.135.138.196',
      };

      const tracker = await (guard as any).getTracker(mockRequest);
      expect(tracker).toBe('148.135.138.196');
      expect(tracker).not.toContain('203.0.113.195');
    });

    it('StrictThrottlerGuard throws HTTP 429 Too Many Requests when rate limit exceeded, leaving database unchanged', async () => {
      const guard = new StrictThrottlerGuard(
        { throttlers: [{ limit: 5, ttl: 60000 }] } as any,
        {} as any,
        { getAllAndOverride: jest.fn() } as any,
      );

      await expect(
        (guard as any).throwThrottlingException({} as any),
      ).rejects.toThrow(
        expect.objectContaining({
          status: 429,
        }),
      );

      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });

    it('When Turnstile is configured in production, missing or invalid token rejects with HTTP 400 Bad Request without writing to database', async () => {
      const prevKey = process.env.TURNSTILE_SECRET_KEY;
      process.env.TURNSTILE_SECRET_KEY = 'secret-test-turnstile-key';

      try {
        await expect(
          enquiryService.createPublicEnquiry({
            studentName: 'Bot Submitter',
            contactNumber: '9999999999',
            // turnstileToken omitted
          }),
        ).rejects.toThrow(BadRequestException);

        expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
      } finally {
        if (prevKey) {
          process.env.TURNSTILE_SECRET_KEY = prevKey;
        } else {
          delete process.env.TURNSTILE_SECRET_KEY;
        }
      }
    });
  });

  describe('Priority 3: Complete configuration authorization tests', () => {
    let mockPrisma: any;
    let setupService: SetupService;
    let setupController: SetupController;
    let configController: ConfigController;
    let progressService: ProgressService;

    beforeEach(() => {
      mockPrisma = {
        centre: {
          findFirst: jest.fn().mockResolvedValue({ id: 'c-1', name: 'Original Name', email: 'c@test.com', contactNo: '111' }),
          update: jest.fn().mockImplementation((args: any) => Promise.resolve(args.data)),
        },
        academicYear: {
          findFirst: jest.fn().mockResolvedValue({ id: 'ay-1', name: '2026-2027', isActive: true }),
          findUnique: jest.fn().mockResolvedValue({ id: 'ay-1', name: '2026-2027' }),
          update: jest.fn().mockResolvedValue({ id: 'ay-1', isActive: true }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        syllabusConfiguration: {
          update: jest.fn().mockImplementation((args: any) => Promise.resolve(args.data)),
        },
        $transaction: jest.fn().mockImplementation((cb: any) => cb(mockPrisma)),
      };

      setupService = new SetupService(mockPrisma as any);
      setupController = new SetupController(setupService);

      progressService = {
        getConfiguration: jest.fn().mockResolvedValue({
          id: 'cfg-1',
          lectureWeight: 0.25,
          materialWeight: 0.25,
          practiceWeight: 0.25,
          testWeight: 0.25,
        }),
      } as any;

      configController = new ConfigController(progressService, mockPrisma as any);
    });

    it('Centre Admin cannot update /setup/settings (RolesGuard blocks with HTTP 403/false)', () => {
      const reflector = {
        getAllAndOverride: jest.fn((key) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === ROLES_KEY) return ['SUPER_ADMIN'];
          return null;
        }),
      };
      const guard = new RolesGuard(reflector as any);
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: centreAdminA }),
        }),
      };

      expect(guard.canActivate(mockContext as any)).toBe(false);
      expect(mockPrisma.centre.update).not.toHaveBeenCalled();
    });

    it('Super Admin can perform an authorized /setup/settings update', async () => {
      const reflector = {
        getAllAndOverride: jest.fn((key) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === ROLES_KEY) return ['SUPER_ADMIN'];
          return null;
        }),
      };
      const guard = new RolesGuard(reflector as any);
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: superAdmin }),
        }),
      };

      expect(guard.canActivate(mockContext as any)).toBe(true);

      const res = await setupController.updateSettings({
        centreName: 'Updated Centre Name',
        contactEmail: 'updated@educare.com',
      });

      expect(res).toEqual({ success: true });
      expect(mockPrisma.centre.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Updated Centre Name',
            email: 'updated@educare.com',
          }),
        }),
      );
    });

    it('Non-Super Admin cannot mutate syllabus configuration (RolesGuard blocks with HTTP 403/false)', () => {
      const reflector = {
        getAllAndOverride: jest.fn((key) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === ROLES_KEY) return ['SUPER_ADMIN'];
          return null;
        }),
      };
      const guard = new RolesGuard(reflector as any);
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: centreAdminA }),
        }),
      };

      expect(guard.canActivate(mockContext as any)).toBe(false);
      expect(mockPrisma.syllabusConfiguration.update).not.toHaveBeenCalled();
    });

    it('Super Admin can perform a valid syllabus configuration update', async () => {
      const reflector = {
        getAllAndOverride: jest.fn((key) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === ROLES_KEY) return ['SUPER_ADMIN'];
          return null;
        }),
      };
      const guard = new RolesGuard(reflector as any);
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: superAdmin }),
        }),
      };

      expect(guard.canActivate(mockContext as any)).toBe(true);

      await configController.updateConfig({
        lectureWeight: 0.4,
        materialWeight: 0.2,
        practiceWeight: 0.2,
        testWeight: 0.2,
      });

      expect(mockPrisma.syllabusConfiguration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cfg-1' },
          data: {
            lectureWeight: 0.4,
            materialWeight: 0.2,
            practiceWeight: 0.2,
            testWeight: 0.2,
          },
        }),
      );
    });

    it('Unauthenticated callers are rejected from mutating configuration endpoints (JwtAuthGuard rejects)', () => {
      const reflector = {
        getAllAndOverride: jest.fn((key) => {
          if (key === IS_PUBLIC_KEY) return false;
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

      expect(guard.canActivate(mockContext as any)).toBe(false);
      expect(mockPrisma.centre.update).not.toHaveBeenCalled();
      expect(mockPrisma.syllabusConfiguration.update).not.toHaveBeenCalled();
    });

    it('Extra, unauthorized fields submitted to /setup/settings are ignored and not persisted', async () => {
      await setupController.updateSettings({
        centreName: 'Safe Name',
        unauthorizedField: 'malicious-data',
        isAdmin: true,
        secretToken: 'stolen-secret',
      });

      expect(mockPrisma.centre.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            name: 'Safe Name',
            email: 'c@test.com', // preserved original
            contactNo: '111', // preserved original
          },
        }),
      );
    });

    it('Extra, unauthorized fields submitted to /syllabus-config are stripped, and invalid payloads are rejected', async () => {
      // 1. Valid field + unauthorized extra field: extra field is stripped
      await configController.updateConfig({
        lectureWeight: 0.5,
        injectedRole: 'SUPER_ADMIN',
        dropDatabase: true,
      });

      expect(mockPrisma.syllabusConfiguration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            lectureWeight: 0.5, // Only allowed field persisted
          },
        }),
      );

      // 2. Only unauthorized fields: rejected with BadRequestException
      mockPrisma.syllabusConfiguration.update.mockClear();
      await expect(
        configController.updateConfig({
          injectedRole: 'SUPER_ADMIN',
          dropDatabase: true,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.syllabusConfiguration.update).not.toHaveBeenCalled();
    });

    it('Rejected configuration operations leave database state unchanged', async () => {
      mockPrisma.centre.update.mockClear();
      mockPrisma.syllabusConfiguration.update.mockClear();

      const reflector = {
        getAllAndOverride: jest.fn((key) => {
          if (key === IS_PUBLIC_KEY) return false;
          if (key === ROLES_KEY) return ['SUPER_ADMIN'];
          return null;
        }),
      };
      const guard = new RolesGuard(reflector as any);

      // Unauthorized caller
      const unauthorizedCtx = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: centreAdminA }),
        }),
      };

      const isAllowed = guard.canActivate(unauthorizedCtx as any);
      expect(isAllowed).toBe(false);

      expect(mockPrisma.centre.update).not.toHaveBeenCalled();
      expect(mockPrisma.syllabusConfiguration.update).not.toHaveBeenCalled();
    });
  });

  describe('Priority 4: Ownership reconciliation scripts validation', () => {
    it('EnquiryService.getUnreconciledEnquiries resolves unambiguous single-centre staff enquiries and leaves multi-centre/unassigned enquiries fail-closed', async () => {
      const mockPrisma = {
        enquiry: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'enq-unambiguous',
              studentName: 'Student One',
              contactNumber: '1111111111',
              assignedToId: 'staff-single-centre',
              assignedTo: {
                firstName: 'Single',
                lastName: 'Staff',
                userCentres: [{ centreId: 'centre-alpha', centre: { name: 'Alpha Centre' } }],
              },
            },
            {
              id: 'enq-multi-centre',
              studentName: 'Student Two',
              contactNumber: '2222222222',
              assignedToId: 'staff-multi-centre',
              assignedTo: {
                firstName: 'Multi',
                lastName: 'Staff',
                userCentres: [
                  { centreId: 'centre-alpha', centre: { name: 'Alpha Centre' } },
                  { centreId: 'centre-beta', centre: { name: 'Beta Centre' } },
                ],
              },
            },
            {
              id: 'enq-unassigned',
              studentName: 'Student Three',
              contactNumber: '3333333333',
              assignedToId: null,
              assignedTo: null,
            },
          ]),
        },
      };

      const enquiryService = new EnquiryService(mockPrisma as any);
      const report = await enquiryService.getUnreconciledEnquiries();

      expect(report).toHaveLength(3);
      // Unambiguous: staff has exactly 1 centre
      expect(report[0].id).toBe('enq-unambiguous');
      expect(report[0].isAmbiguous).toBe(false);
      expect(report[0].suggestedCentreId).toBe('centre-alpha');

      // Ambiguous: staff has multiple centres
      expect(report[1].id).toBe('enq-multi-centre');
      expect(report[1].isAmbiguous).toBe(true);
      expect(report[1].suggestedCentreId).toBeNull();

      // Ambiguous: unassigned enquiry
      expect(report[2].id).toBe('enq-unassigned');
      expect(report[2].isAmbiguous).toBe(true);
      expect(report[2].suggestedCentreId).toBeNull();
    });

    it('StudyMaterialService.getUnreconciled queries records with centreId = null and isShared = false for Super Admin, and denies others', async () => {
      const mockPrisma = {
        studyMaterial: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'mat-legacy-1',
              title: 'Draft Material 1',
              centreId: null,
              isShared: false,
            },
            {
              id: 'mat-legacy-2',
              title: 'Draft Material 2',
              centreId: null,
              isShared: false,
            },
          ]),
        },
      };

      const studyMaterialService = new StudyMaterialService(mockPrisma as any);

      // Super Admin can retrieve unresolved records
      const unreconciled = await studyMaterialService.getUnreconciled(superAdmin);
      expect(unreconciled).toHaveLength(2);
      expect(mockPrisma.studyMaterial.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            centreId: null,
            isShared: false,
          },
        }),
      );

      // Non-super admins are rejected
      await expect(
        studyMaterialService.getUnreconciled(centreAdminA),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Scope F — Global Sharing Permissions and Lifecycle Hardening', () => {
    let mockPrisma: any;
    let mockAuditService: any;
    let studyMaterialService: StudyMaterialService;
    let mockStorageService: any;
    let studyMaterialController: StudyMaterialController;

    beforeEach(() => {
      mockPrisma = {
        academicYear: {
          findMany: jest.fn().mockResolvedValue([{ id: 'ay-active-1', isActive: true }]),
          findUnique: jest.fn().mockResolvedValue({ id: 'ay-active-1', isActive: true }),
          findFirst: jest.fn().mockResolvedValue({ id: 'ay-active-1', isActive: true }),
        },
        syllabus: {
          findUnique: jest.fn().mockResolvedValue({ id: 'syl-math-1', subjectId: 'sub-1', standardId: 'std-10', boardId: 'brd-1' }),
          findFirst: jest.fn().mockResolvedValue({ id: 'syl-math-1', subjectId: 'sub-1', standardId: 'std-10', boardId: 'brd-1' }),
        },
        studyMaterial: {
          create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'mat-created-id', ...args.data })),
          findUnique: jest.fn(),
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
          delete: jest.fn().mockResolvedValue({ id: 'mat-deleted-id' }),
        },
        studentProfile: {
          findUnique: jest.fn(),
        },
      };

      mockAuditService = {
        record: jest.fn(),
      };

      mockStorageService = {
        extractAndValidateObjectKey: jest.fn((k: string) => k),
        validateAndEnforceObjectSize: jest.fn().mockResolvedValue(undefined),
        getPresignedDownloadUrl: jest.fn().mockResolvedValue({ downloadUrl: 'https://r2.educare.local/signed-stream-url' }),
      };

      studyMaterialService = new StudyMaterialService(mockPrisma as any, mockStorageService as any, mockAuditService as any);
      studyMaterialController = new StudyMaterialController(studyMaterialService, mockStorageService as any, {} as any);
    });

    it('Non-super admin cannot set isShared = true via StudyMaterialService.create -> rejected with HTTP 403 and leaves DB untouched', async () => {
      await expect(
        studyMaterialService.create(
          {
            title: 'Unauthorized Global Material',
            syllabusId: 'syl-math-1',
            isShared: true,
          },
          centreAdminA,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.studyMaterial.create).not.toHaveBeenCalled();
    });

    it('Non-super admin cannot bypass sharing restriction via EstudyService.createMaterial -> rejected with HTTP 403', async () => {
      const estudyService = new EstudyService(mockPrisma as any, studyMaterialService);

      await expect(
        estudyService.createMaterial(
          {
            title: 'Attempted Global Estudy Material',
            syllabusId: 'syl-math-1',
            isShared: true,
          },
          centreAdminA,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.studyMaterial.create).not.toHaveBeenCalled();
    });

    it('Super Admin can set isShared = true on creation and records audit log', async () => {
      const created = await studyMaterialService.create(
        {
          title: 'Authorized Global Syllabus Guide',
          syllabusId: 'syl-math-1',
          isShared: true,
        },
        superAdmin,
      );

      expect(created).toBeDefined();
      expect(created.isShared).toBe(true);
      expect(mockPrisma.studyMaterial.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isShared: true,
          }),
        }),
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_SHARED_STUDY_MATERIAL',
          userRole: 'SUPER_ADMIN',
          details: expect.objectContaining({ isShared: true }),
        }),
      );
    });

    it('Non-super admin cannot update isShared status on existing material -> rejected with HTTP 403 and leaves DB untouched', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-local-1',
        title: 'Local Worksheet',
        centreId: 'centre-alpha',
        isShared: false,
        uploaderId: centreAdminA.id,
      });

      await expect(
        studyMaterialService.update(
          'mat-local-1',
          { isShared: true },
          centreAdminA,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.studyMaterial.update).not.toHaveBeenCalled();
    });

    it('Non-super admin cannot mutate an existing globally shared material -> rejected with HTTP 403', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-shared-global',
        title: 'Global Curriculum Standard',
        centreId: null,
        isShared: true,
        uploaderId: superAdmin.id,
      });

      await expect(
        studyMaterialService.update(
          'mat-shared-global',
          { title: 'Attempted Malicious Update' },
          centreAdminA,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.studyMaterial.update).not.toHaveBeenCalled();
    });

    it('Super Admin can update isShared and centreId on material and records audit log', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-reconciled-1',
        title: 'Reconciled Material',
        centreId: null,
        isShared: false,
        uploaderId: superAdmin.id,
      });

      const updated = await studyMaterialService.update(
        'mat-reconciled-1',
        { isShared: true, centreId: 'centre-alpha' },
        superAdmin,
      );

      expect(mockPrisma.studyMaterial.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mat-reconciled-1' },
          data: expect.objectContaining({
            isShared: true,
            centreId: 'centre-alpha',
          }),
        }),
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_STUDY_MATERIAL_SHARING',
          userRole: 'SUPER_ADMIN',
        }),
      );
    });

    it('Unresolved legacy material (centreId = null, isShared = false) is denied to ordinary uploader without verified centre', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-unresolved-uploaded',
        title: 'Unresolved Orphan Notes',
        centreId: null,
        isShared: false,
        targetTrackId: null,
        uploaderId: centreAdminA.id,
        uploader: {
          role: { name: 'CENTRE_ADMIN' },
          userCentres: [], // No verified centre link
        },
      });

      await expect(
        studyMaterialService.getById('mat-unresolved-uploaded', centreAdminA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Uploader ownership does not bypass cross-centre boundary (Centre Admin uploading to Centre B cannot read from Centre A)', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-centre-beta-owned',
        title: 'Centre B Specific Paper',
        centreId: 'centre-beta',
        isShared: false,
        uploaderId: centreAdminA.id,
        uploader: {
          role: { name: 'CENTRE_ADMIN' },
          userCentres: [{ centreId: 'centre-alpha' }],
        },
      });

      // centreAdminA only belongs to centre-alpha, so cannot access centre-beta material even if uploaderId matches
      await expect(
        studyMaterialService.getById('mat-centre-beta-owned', centreAdminA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Private video playback (getPlayUrl) applies the exact same tenant access rules', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-restricted-video',
        title: 'Restricted Centre B Lecture',
        url: 'materials/lecture-b.mp4',
        centreId: 'centre-beta',
        isShared: false,
        uploaderId: 'user-b-admin',
      });

      // Calling getPlayUrl for unauthorized user throws ForbiddenException and does not generate presigned download URL
      await expect(
        studyMaterialController.getPlayUrl('mat-restricted-video', { user: centreAdminA }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockStorageService.getPresignedDownloadUrl).not.toHaveBeenCalled();
    });

    it('Shared material (isShared = true, isPublic = false) is denied to public learners', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-internal-shared',
        title: 'Internal Cross-Centre Chemistry Notes',
        centreId: 'centre-alpha',
        isShared: true,
        isPublic: false,
        targetTrackId: null,
      });

      const publicLearner = {
        id: 'user-public-learner',
        role: { name: 'PUBLIC_LEARNER' },
      };

      await expect(
        studyMaterialService.getById('mat-internal-shared', publicLearner),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('Public learners can only access published public materials'),
        }),
      );

      // Video playback for public learner on non-public material must also be forbidden
      await expect(
        studyMaterialController.getPlayUrl('mat-internal-shared', { user: publicLearner }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Published public material (isPublic = true) is accessible to public learners and students', async () => {
      const publicMaterial = {
        id: 'mat-public-preview',
        title: 'Public Chemistry Sample Lecture',
        url: 'materials/sample-chem.mp4',
        centreId: null,
        isShared: false,
        isPublic: true,
        targetTrackId: null,
      };

      mockPrisma.studyMaterial.findUnique.mockResolvedValue(publicMaterial);

      const publicLearner = {
        id: 'user-public-learner',
        role: { name: 'PUBLIC_LEARNER' },
      };

      const result = await studyMaterialService.getById('mat-public-preview', publicLearner);
      expect(result).toBeDefined();
      expect(result.id).toBe('mat-public-preview');

      // Video playback also succeeds for public preview
      const playRes = await studyMaterialController.getPlayUrl('mat-public-preview', { user: publicLearner });
      expect(playRes.playUrl).toBe('https://r2.educare.local/signed-stream-url');
    });

    it('Non-super admin cannot set isPublic = true when creating material', async () => {
      await expect(
        studyMaterialService.create(
          {
            title: 'Unauthorized Public Material',
            type: 'FILE',
            isPublic: true,
            boardId: 'board-cbse',
            standardId: 'std-10',
            subjectId: 'sub-math',
          },
          centreAdminA,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Only Super Admins can publish study materials for public preview.',
        }),
      );
      expect(mockPrisma.studyMaterial.create).not.toHaveBeenCalled();
    });

    it('Non-super admin cannot set isPublic = true when updating material', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-centre-a',
        title: 'Centre A Notes',
        centreId: 'centre-a',
        isShared: false,
        isPublic: false,
        uploaderId: centreAdminA.id,
      });

      await expect(
        studyMaterialService.update('mat-centre-a', { isPublic: true }, centreAdminA),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Only Super Admins can modify public-publication status.',
        }),
      );
      expect(mockPrisma.studyMaterial.update).not.toHaveBeenCalled();
    });

    it('Non-super admin cannot modify existing isPublic = true study material', async () => {
      mockPrisma.studyMaterial.findUnique.mockResolvedValue({
        id: 'mat-public-locked',
        title: 'Public Locked Notes',
        centreId: 'centre-a',
        isShared: false,
        isPublic: true,
        uploaderId: centreAdminA.id,
      });

      await expect(
        studyMaterialService.update('mat-public-locked', { title: 'Hacked Title' }, centreAdminA),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'Only Super Admins can modify public study materials.',
        }),
      );
      expect(mockPrisma.studyMaterial.update).not.toHaveBeenCalled();
    });

    it('Student can access isShared = true material across centres only if enrolled in matching course', async () => {
      const sharedMaterial = {
        id: 'mat-shared-syllabus',
        title: 'Shared 10th CBSE Math Formula Sheet',
        centreId: 'centre-beta', // In Centre Beta
        isShared: true,
        isPublic: false,
        targetTrackId: null,
        syllabus: {
          boardId: 'board-cbse',
          standardId: 'std-10',
          subjectId: 'sub-math',
        },
      };

      mockPrisma.studyMaterial.findUnique.mockResolvedValue(sharedMaterial);

      // Student A is enrolled in Centre Alpha, CBSE Std 10 (matching syllabus)
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        userId: studentA.id,
        enrollments: [
          {
            batch: {
              centreId: 'centre-alpha', // Different centre!
              boardId: 'board-cbse',
              standardId: 'std-10',
            },
          },
        ],
      });

      const allowedResult = await studyMaterialService.getById('mat-shared-syllabus', studentA);
      expect(allowedResult).toBeDefined();

      // Student B is enrolled in ICSE Std 12 (different syllabus)
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        userId: studentB.id,
        enrollments: [
          {
            batch: {
              centreId: 'centre-alpha',
              boardId: 'board-icse',
              standardId: 'std-12',
            },
          },
        ],
      });

      await expect(
        studyMaterialService.getById('mat-shared-syllabus', studentB),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('You are not enrolled in the course corresponding to this material'),
        }),
      );
    });
  });

  describe('Scope G — Reverse-Proxy-Safe Rate Limiting and StrictThrottlerGuard', () => {
    let guard: StrictThrottlerGuard;

    beforeEach(() => {
      guard = new StrictThrottlerGuard();
    });

    it('Direct connection from untrusted IP with forged X-Forwarded-For derives tracker strictly from socket.remoteAddress', async () => {
      const untrustedDirectReq = {
        socket: { remoteAddress: '198.51.100.42' },
        headers: { 'x-forwarded-for': '8.8.8.8, 1.1.1.1' },
      };

      const tracker = await (guard as any).getTracker(untrustedDirectReq);
      expect(tracker).toBe('198.51.100.42');
      expect(tracker).not.toBe('8.8.8.8');
    });

    it('Connection from trusted reverse proxy derives tracker from forwarded client IP', async () => {
      const trustedProxyReq = {
        socket: { remoteAddress: '127.0.0.1' }, // Local loopback trusted proxy
        headers: { 'x-forwarded-for': '203.0.113.10' },
      };

      const tracker = await (guard as any).getTracker(trustedProxyReq);
      expect(tracker).toBe('203.0.113.10');
    });

    it('Different client IPs behind trusted proxy produce distinct tracker IDs', async () => {
      const client1Req = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'x-forwarded-for': '203.0.113.11' },
      };
      const client2Req = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'x-forwarded-for': '203.0.113.12' },
      };

      const tracker1 = await (guard as any).getTracker(client1Req);
      const tracker2 = await (guard as any).getTracker(client2Req);

      expect(tracker1).toBe('203.0.113.11');
      expect(tracker2).toBe('203.0.113.12');
      expect(tracker1).not.toBe(tracker2);
    });

    it('Cloudflare proxy header (cf-connecting-ip) is honored when socket connection is trusted', async () => {
      const cfReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {
          'cf-connecting-ip': '198.51.100.99',
          'x-forwarded-for': '198.51.100.99, 10.0.0.1',
        },
      };

      const tracker = await (guard as any).getTracker(cfReq);
      expect(tracker).toBe('198.51.100.99');
    });

    it('Sanitizes malicious or malformed client IP header values and safely falls back', async () => {
      const maliciousReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {
          'x-forwarded-for': '<script>alert(1)</script>, 10.0.0.1',
        },
      };

      const tracker = await (guard as any).getTracker(maliciousReq);
      // Malformed IP is rejected by regex and safe socket IP is used
      expect(tracker).toBe('127.0.0.1');
    });

    it('Recognizes trusted reverse proxy configured as CIDR block in TRUSTED_PROXIES', async () => {
      const originalEnv = process.env.TRUSTED_PROXIES;
      process.env.TRUSTED_PROXIES = '10.0.0.0/8,172.16.0.0/12';

      const cidrReq = {
        socket: { remoteAddress: '10.1.2.3' },
        headers: { 'x-forwarded-for': '203.0.113.88' },
      };

      const isTrusted = (guard as any).isSocketFromTrustedProxy('10.1.2.3', cidrReq);
      expect(isTrusted).toBe(true);

      const tracker = await (guard as any).getTracker(cidrReq);
      expect(tracker).toBe('203.0.113.88');

      process.env.TRUSTED_PROXIES = originalEnv;
    });

    it('Exceeding rate limit throws HTTP 429 Too Many Requests and leaves database write uncalled', async () => {
      const mockStorage = {
        increment: jest.fn().mockResolvedValue({ totalHits: 6, timeToExpire: 55 }),
      };
      const strictGuard = new StrictThrottlerGuard(
        { throttlers: [{ limit: 5, ttl: 60000 }] },
        mockStorage as any,
      );

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            socket: { remoteAddress: '198.51.100.55' },
            headers: {},
          }),
          getResponse: () => ({
            header: jest.fn(),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      };

      await expect(
        strictGuard.canActivate(mockContext as any),
      ).rejects.toThrow();
    });

    it('When Redis rate limiter storage fails, fails closed with HTTP 503 Service Unavailable', async () => {
      const brokenStorage = {
        increment: jest.fn().mockRejectedValue(new Error('ECONNREFUSED: Redis connection lost')),
      };
      const resilientGuard = new StrictThrottlerGuard(
        { throttlers: [{ limit: 5, ttl: 60000 }] },
        brokenStorage as any,
      );

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            socket: { remoteAddress: '198.51.100.77' },
            headers: {},
          }),
          getResponse: () => ({
            header: jest.fn(),
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      };

      await expect(
        resilientGuard.canActivate(mockContext as any),
      ).rejects.toThrow(
        expect.objectContaining({
          status: 503,
        }),
      );
    });
  });

  describe('Scope H — Production Turnstile Bot Protection Policy', () => {
    let mockPrisma: any;
    let enquiryService: EnquiryService;
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
      mockPrisma = {
        enquiry: {
          create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'enq-ok', ...args.data })),
        },
        centre: {
          findUnique: jest.fn().mockResolvedValue({ id: 'centre-alpha', status: 'ACTIVE' }),
        },
      };
      enquiryService = new EnquiryService(mockPrisma as any);
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('In production, missing TURNSTILE_SECRET_KEY throws HTTP 500 Server Configuration Error (fails closed)', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.TURNSTILE_SECRET_KEY;

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'Alice Smith',
          contactNumber: '9876543210',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          status: 500,
        }),
      );
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });

    it('When TURNSTILE_SECRET_KEY is configured, missing token throws HTTP 400 Bad Request', async () => {
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'Bob Builder',
          contactNumber: '9876543210',
          // Missing turnstileToken
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });

    it('When Turnstile verification rejects token (success: false), throws HTTP 400 Bad Request', async () => {
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
      } as any);

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'Charlie Brown',
          contactNumber: '9876543210',
          turnstileToken: 'invalid-bot-token',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });

    it('When Turnstile verification times out or network fails, fails closed with HTTP 400 without leaking token/secret', async () => {
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
      global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout after 5000ms'));

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'Dave Smith',
          contactNumber: '9876543210',
          turnstileToken: 'timeout-token',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });

    it('When Turnstile token is valid, creates enquiry and sends verification strictly to Cloudflare siteverify', async () => {
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hostname: 'lms.educarelearning.in',
          action: 'admission_enquiry',
        }),
      } as any);
      global.fetch = mockFetch;

      const res = await enquiryService.createPublicEnquiry({
        studentName: 'Emma Watson',
        contactNumber: '9876543210',
        turnstileToken: 'valid-turnstile-token',
      });

      expect(res).toBeDefined();
      expect(mockPrisma.enquiry.create).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('Rejects Turnstile token when verification returns unauthorized origin hostname', async () => {
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hostname: 'evil-attacker-site.com',
          action: 'admission_enquiry',
        }),
      } as any);

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'Frankie Hacker',
          contactNumber: '9876543210',
          turnstileToken: 'stolen-turnstile-token',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'CAPTCHA verification failed: origin hostname not authorized.',
        }),
      );
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });

    it('Rejects Turnstile token when widget action does not match expected action', async () => {
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hostname: 'lms.educarelearning.in',
          action: 'newsletter_signup', // Mismatched action
        }),
      } as any);

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'Gina Replayer',
          contactNumber: '9876543210',
          turnstileToken: 'replayed-action-token',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'CAPTCHA verification failed: widget action missing or mismatched.',
        }),
      );
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });

    it('Rejects Turnstile token when widget action is omitted in siteverify response', async () => {
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hostname: 'lms.educarelearning.in',
          // action missing
        }),
      } as any);

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'NoAction User',
          contactNumber: '9876543210',
          turnstileToken: 'no-action-token',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'CAPTCHA verification failed: widget action missing or mismatched.',
        }),
      );
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });

    it('Rejects Turnstile token when rendered on api.educarelearning.in (non-frontend domain)', async () => {
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hostname: 'api.educarelearning.in', // API domain must not be in default allowlist
          action: 'admission_enquiry',
        }),
      } as any);

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'ApiDomain User',
          contactNumber: '9876543210',
          turnstileToken: 'api-domain-token',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'CAPTCHA verification failed: origin hostname not authorized.',
        }),
      );
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });

    it('Accepts Turnstile token issued for staging.educarelearning.in when APP_ENV=staging', async () => {
      const prevAppEnv = process.env.APP_ENV;
      process.env.APP_ENV = 'staging';
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hostname: 'staging.educarelearning.in',
          action: 'admission_enquiry',
        }),
      } as any);

      const result = await enquiryService.createPublicEnquiry({
        studentName: 'Staging Student',
        contactNumber: '9876543210',
        turnstileToken: 'staging-token-valid',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.enquiry.create).toHaveBeenCalled();
      if (prevAppEnv) {
        process.env.APP_ENV = prevAppEnv;
      } else {
        delete process.env.APP_ENV;
      }
    });

    it('Accepts Turnstile token for dynamically configured hostnames via TURNSTILE_ALLOWED_HOSTNAMES', async () => {
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
      process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'custom-staging.educarelearning.in,test-domain.org';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hostname: 'custom-staging.educarelearning.in',
          action: 'admission_enquiry',
        }),
      } as any);

      const result = await enquiryService.createPublicEnquiry({
        studentName: 'Custom Staging Student',
        contactNumber: '9876543210',
        turnstileToken: 'custom-staging-token',
      });

      expect(result).toBeDefined();
      expect(mockPrisma.enquiry.create).toHaveBeenCalled();
      delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
    });

    it('Rejects expired or replayed Turnstile token with explicit timeout-or-duplicate error message', async () => {
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          'error-codes': ['timeout-or-duplicate'],
        }),
      } as any);

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'Henry Expired',
          contactNumber: '9876543210',
          turnstileToken: 'expired-token',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'CAPTCHA verification failed: token expired or already used.',
        }),
      );
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });

    it('Rejects safely when verification service returns HTTP 502 or invalid JSON without leaking secrets', async () => {
      process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => { throw new Error('Bad gateway HTML'); },
      } as any);

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'Isabel BadGateway',
          contactNumber: '9876543210',
          turnstileToken: 'token-502',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          message: 'CAPTCHA verification service returned an error. Please try again.',
        }),
      );
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    });
  });

  describe('Scope I — Realistic Ownership-Reconciliation Simulation (Synthetic Scenarios)', () => {
    it('Enquiry Reconciliation: resolves single-centre staff, fails closed for multi-centre and unassigned staff', async () => {
      const syntheticEnquiries = [
        {
          id: 'enq-syn-1',
          studentName: 'Single Centre Student',
          contactNumber: '9876543211',
          assignedToId: 'staff-single',
          assignedTo: {
            userCentres: [{ centreId: 'centre-alpha' }],
          },
        },
        {
          id: 'enq-syn-2',
          studentName: 'Multi Centre Student',
          contactNumber: '9876543212',
          assignedToId: 'staff-multi',
          assignedTo: {
            userCentres: [{ centreId: 'centre-alpha' }, { centreId: 'centre-beta' }],
          },
        },
        {
          id: 'enq-syn-3',
          studentName: 'Unassigned Student',
          contactNumber: '9876543213',
          assignedToId: null,
          assignedTo: null,
        },
      ];

      const mockClient = {
        enquiry: {
          findMany: jest.fn().mockResolvedValue(syntheticEnquiries),
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const enquiryService = new EnquiryService(mockClient as any);
      const report = await enquiryService.getUnreconciledEnquiries();

      // Check classification
      expect(report).toHaveLength(3);
      expect(report[0].isAmbiguous).toBe(false);
      expect(report[0].suggestedCentreId).toBe('centre-alpha');

      expect(report[1].isAmbiguous).toBe(true);
      expect(report[1].suggestedCentreId).toBeNull();

      expect(report[2].isAmbiguous).toBe(true);
      expect(report[2].suggestedCentreId).toBeNull();

      // In dry run inspection, DB update is never called
      expect(mockClient.enquiry.update).not.toHaveBeenCalled();
    });

    it('Study Material Reconciliation: resolves single-centre tracks and uploaders, fails closed for ambiguous records', async () => {
      const syntheticMaterials = [
        {
          id: 'mat-syn-1',
          title: 'Single Centre Track Material',
          centreId: null,
          isShared: false,
          targetTrack: {
            batches: [{ centreId: 'centre-alpha' }, { centreId: 'centre-alpha' }],
          },
          uploader: { role: { name: 'TEACHER' }, userCentres: [] },
        },
        {
          id: 'mat-syn-2',
          title: 'Multi Centre Track Material',
          centreId: null,
          isShared: false,
          targetTrack: {
            batches: [{ centreId: 'centre-alpha' }, { centreId: 'centre-beta' }],
          },
          uploader: { role: { name: 'TEACHER' }, userCentres: [] },
        },
        {
          id: 'mat-syn-3',
          title: 'Super Admin Unassigned Material',
          centreId: null,
          isShared: false,
          targetTrack: null,
          uploader: { role: { name: 'SUPER_ADMIN' }, userCentres: [] },
        },
        {
          id: 'mat-syn-4',
          title: 'Single Centre Teacher Material',
          centreId: null,
          isShared: false,
          targetTrack: null,
          uploader: { role: { name: 'TEACHER' }, userCentres: [{ centreId: 'centre-gamma' }] },
        },
        {
          id: 'mat-syn-5',
          title: 'Multi Centre Teacher Material',
          centreId: null,
          isShared: false,
          targetTrack: null,
          uploader: { role: { name: 'TEACHER' }, userCentres: [{ centreId: 'centre-alpha' }, { centreId: 'centre-beta' }] },
        },
        {
          id: 'mat-syn-6',
          title: 'Broken Orphan Material',
          centreId: null,
          isShared: false,
          targetTrack: null,
          uploader: null,
        },
      ];

      const mockClient = {
        studyMaterial: {
          findMany: jest.fn().mockResolvedValue(syntheticMaterials),
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const studyMaterialService = new StudyMaterialService(mockClient as any);
      const unreconciled = await studyMaterialService.getUnreconciled(superAdmin);

      expect(unreconciled).toHaveLength(6);
      expect(mockClient.studyMaterial.update).not.toHaveBeenCalled();
    });

    it('Reconciliation Script - Enquiry: Dry run executes 0 mutations', async () => {
      const syntheticEnquiries = [
        {
          id: 'enq-dry-1',
          studentName: 'Dry Run Student',
          contactNumber: '9876543211',
          source: 'Centre: centre-alpha',
          assignedToId: 'staff-single',
          assignedTo: {
            userCentres: [{ centreId: 'centre-alpha' }],
          },
        },
      ];

      const mockClient = {
        enquiry: {
          findMany: jest.fn().mockResolvedValue(syntheticEnquiries),
          update: jest.fn().mockResolvedValue({}),
        },
        centre: {
          findUnique: jest.fn().mockResolvedValue({ id: 'centre-alpha', status: 'ACTIVE' }),
        },
      };

      const result = await reconcileLegacyEnquiries(true, mockClient as any);
      expect(result.resolvedCount).toBe(0);
      expect(result.ambiguousCount).toBe(1);
      expect(mockClient.enquiry.update).not.toHaveBeenCalled();
    });

    it('Reconciliation Script - Enquiry: Single-centre staff assignment alone does NOT authorize automatic backfill in apply mode', async () => {
      const syntheticEnquiries = [
        {
          id: 'enq-staff-only-1',
          studentName: 'Staff Assigned Student',
          contactNumber: '9876543211',
          source: 'Website Form', // No verified centre tag
          assignedToId: 'staff-single',
          assignedTo: {
            userCentres: [{ centreId: 'centre-alpha' }],
          },
        },
      ];

      const mockClient = {
        enquiry: {
          findMany: jest.fn().mockResolvedValue(syntheticEnquiries),
          update: jest.fn().mockResolvedValue({}),
        },
        centre: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      // In apply mode, staff assignment alone does NOT mutate the record (fails closed for Super Admin review)
      const result = await reconcileLegacyEnquiries(false, mockClient as any);
      expect(result.resolvedCount).toBe(0);
      expect(result.ambiguousCount).toBe(1);
      expect(result.ambiguousRecords[0].suggestedCentreId).toBe('centre-alpha');
      expect(result.ambiguousRecords[0].reason).toContain('staff assignment is post-intake CRM routing and does not prove originating centre');
      expect(mockClient.enquiry.update).not.toHaveBeenCalled();
    });

    it('Reconciliation Script - Enquiry: Client-supplied free-text source tag does NOT authorize automatic backfill in apply mode', async () => {
      const syntheticEnquiries = [
        {
          id: 'enq-forged-source-1',
          studentName: 'Forged Source Student',
          contactNumber: '9876543211',
          source: 'Centre: centre-alpha', // Untrusted free-text source tag
          assignedToId: null,
          assignedTo: null,
        },
      ];

      const mockClient = {
        enquiry: {
          findMany: jest.fn().mockResolvedValue(syntheticEnquiries),
          update: jest.fn().mockResolvedValue({}),
        },
        centre: {
          findUnique: jest.fn().mockResolvedValue({ id: 'centre-alpha', status: 'ACTIVE' }),
        },
      };

      const result = await reconcileLegacyEnquiries(false, mockClient as any);
      expect(result.resolvedCount).toBe(0);
      expect(result.ambiguousCount).toBe(1);
      expect(result.ambiguousRecords[0].reason).toContain('source originates from client input and cannot establish tenant ownership');
      expect(mockClient.enquiry.update).not.toHaveBeenCalled();
    });

    it('Reconciliation Script - Study Material: Dry run executes 0 mutations', async () => {
      const syntheticMaterials = [
        {
          id: 'mat-dry-1',
          title: 'Track Material',
          centreId: null,
          isShared: false,
          targetTrack: {
            batches: [{ centreId: 'centre-alpha' }],
          },
          uploader: { role: { name: 'TEACHER' }, userCentres: [] },
        },
      ];

      const mockClient = {
        studyMaterial: {
          findMany: jest.fn().mockResolvedValue(syntheticMaterials),
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const result = await reconcileLegacyStudyMaterials(true, mockClient as any);
      expect(result.resolvedCount).toBe(1);
      expect(mockClient.studyMaterial.update).not.toHaveBeenCalled();
    });

    it('Reconciliation Script - Study Material: Apply mode reconciles single-centre track records', async () => {
      const syntheticMaterials = [
        {
          id: 'mat-apply-1',
          title: 'Track Material',
          centreId: null,
          isShared: false,
          targetTrack: {
            batches: [{ centreId: 'centre-beta' }],
          },
          uploader: { role: { name: 'TEACHER' }, userCentres: [] },
        },
      ];

      const mockClient = {
        studyMaterial: {
          findMany: jest.fn().mockResolvedValue(syntheticMaterials),
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const result = await reconcileLegacyStudyMaterials(false, mockClient as any);
      expect(result.resolvedCount).toBe(1);
      expect(mockClient.studyMaterial.update).toHaveBeenCalledWith({
        where: { id: 'mat-apply-1' },
        data: { centreId: 'centre-beta' },
      });
    });
  });

  describe('Scope J: Trusted Enquiry Origin & Hardened Reconciliation', () => {
    let mockPrisma: any;
    let mockAuditService: any;
    let enquiryService: EnquiryService;
    let enquiryController: EnquiryController;

    const superAdminUser = { id: 'super-admin-uuid', role: 'SUPER_ADMIN' };
    const centreAdminUser = { id: 'admin-alpha-uuid', role: 'CENTRE_ADMIN', userCentres: [{ centreId: 'centre-alpha' }] };
    const teacherUser = { id: 'teacher-uuid', role: 'TEACHER', userCentres: [{ centreId: 'centre-alpha' }] };

    beforeEach(() => {
      mockPrisma = {
        enquiry: {
          create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'enq-new-uuid', ...args.data })),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
        },
        customForm: {
          findUnique: jest.fn(),
        },
        centre: {
          findUnique: jest.fn(),
        },
      };

      mockAuditService = {
        record: jest.fn(),
      };

      enquiryService = new EnquiryService(mockPrisma as any, mockAuditService as any);
      enquiryController = new EnquiryController(enquiryService);
    });

    it('Case 1: A public enquiry submits source: "Centre: centre-B" while containing no verified origin metadata; record is NOT assigned to centre B', async () => {
      const payload = {
        studentName: 'Prospect Student',
        contactNumber: '9876543210',
        email: 'prospect@example.com',
        source: 'Centre: centre-B', // Untrusted free-text source tag
      };

      const result = await enquiryService.createPublicEnquiry(payload);
      expect(mockPrisma.enquiry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentName: 'Prospect Student',
          contactNumber: '9876543210',
          source: 'Centre: centre-B', // Preserved as attribution string only
          centreId: null, // Tenant ownership is strictly unassigned
          assignedToId: null,
          status: 'NEW',
        }),
      });
      expect(result.centreId).toBeNull();
    });

    it('Case 2: A public enquiry submits a forged centreId; requested centre is NOT accepted as authoritative', async () => {
      // Mock that centre-B exists in database
      mockPrisma.centre.findUnique.mockResolvedValue({ id: 'centre-B', status: 'ACTIVE' });

      const payload = {
        studentName: 'Prospect Student',
        contactNumber: '9876543210',
        centreId: 'centre-B', // Forged client-submitted centreId
      };

      const result = await enquiryService.createPublicEnquiry(payload);
      expect(mockPrisma.enquiry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentName: 'Prospect Student',
          centreId: null, // Untrusted client centreId is discarded
          assignedToId: null,
        }),
      });
      expect(result.centreId).toBeNull();
    });

    it('Case 3: A public enquiry submits a forged assignedToId; user is NOT assigned through that field', async () => {
      const payload = {
        studentName: 'Prospect Student',
        contactNumber: '9876543210',
        assignedToId: 'attacker-counselor-uuid', // Forged assigned staff
      };

      const result = await enquiryService.createPublicEnquiry(payload);
      expect(mockPrisma.enquiry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentName: 'Prospect Student',
          assignedToId: null, // Forged staff assignment is strictly discarded
          centreId: null,
        }),
      });
      expect(result.assignedToId).toBeNull();
    });

    it('Case 4: A valid active form configured for centre A derives centre ownership from verified form configuration', async () => {
      mockPrisma.customForm.findUnique.mockResolvedValue({
        id: 'form-centre-alpha',
        isActive: true,
        centreId: 'centre-alpha',
        centre: { id: 'centre-alpha', status: 'ACTIVE' },
      });

      const payload = {
        studentName: 'Verified Lead',
        contactNumber: '9876543210',
        formId: 'form-centre-alpha',
      };

      const result = await enquiryService.createPublicEnquiry(payload);
      expect(mockPrisma.enquiry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentName: 'Verified Lead',
          centreId: 'centre-alpha', // Derived from server-verified form configuration
          assignedToId: null,
        }),
      });
      expect(result.centreId).toBe('centre-alpha');
    });

    it('Case 5: A form without a configured centre creates an unassigned enquiry', async () => {
      mockPrisma.customForm.findUnique.mockResolvedValue({
        id: 'form-global-lead',
        isActive: true,
        centreId: null,
      });

      const payload = {
        studentName: 'Global Lead',
        contactNumber: '9876543210',
        formId: 'form-global-lead',
      };

      const result = await enquiryService.createPublicEnquiry(payload);
      expect(mockPrisma.enquiry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentName: 'Global Lead',
          centreId: null, // Form has no centre, record remains unassigned
        }),
      });
      expect(result.centreId).toBeNull();
    });

    it('Case 6: An inactive or invalid form cannot establish centre ownership, and conflicting client centreId is rejected', async () => {
      // Inactive form
      mockPrisma.customForm.findUnique.mockResolvedValueOnce({
        id: 'form-inactive-lead',
        isActive: false,
        centreId: 'centre-alpha',
      });

      const resInactive = await enquiryService.createPublicEnquiry({
        studentName: 'Inactive Lead',
        contactNumber: '9876543210',
        formId: 'form-inactive-lead',
      });
      expect(resInactive.centreId).toBeNull();

      // Nonexistent form
      mockPrisma.customForm.findUnique.mockResolvedValueOnce(null);
      const resNonexistent = await enquiryService.createPublicEnquiry({
        studentName: 'Nonexistent Form Lead',
        contactNumber: '9876543210',
        formId: 'form-nonexistent',
      });
      expect(resNonexistent.centreId).toBeNull();

      // Conflicting client-supplied centreId with verified active form
      mockPrisma.customForm.findUnique.mockResolvedValueOnce({
        id: 'form-alpha-active',
        isActive: true,
        centreId: 'centre-alpha',
        centre: { id: 'centre-alpha', status: 'ACTIVE' },
      });

      await expect(
        enquiryService.createPublicEnquiry({
          studentName: 'Conflicting Lead',
          contactNumber: '9876543210',
          formId: 'form-alpha-active',
          centreId: 'centre-beta', // Conflicts with form's centre-alpha
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Case 7: A staff member assigned after intake cannot cause an existing enquiry to be automatically assigned to staff centre', async () => {
      const syntheticEnquiry = {
        id: 'enq-post-intake-staff',
        studentName: 'Routed Prospect',
        contactNumber: '9876543210',
        source: 'Website Form',
        centreId: null,
        assignedToId: 'counselor-1',
        assignedTo: {
          userCentres: [{ centreId: 'centre-alpha' }],
        },
      };

      const mockReconcileClient = {
        enquiry: {
          findMany: jest.fn().mockResolvedValue([syntheticEnquiry]),
          update: jest.fn(),
        },
      };

      const result = await reconcileLegacyEnquiries(false, mockReconcileClient as any);
      expect(result.resolvedCount).toBe(0);
      expect(result.ambiguousCount).toBe(1);
      expect(result.ambiguousRecords[0].suggestedCentreId).toBe('centre-alpha');
      expect(result.ambiguousRecords[0].reason).toContain('staff assignment is post-intake CRM routing');
      expect(mockReconcileClient.enquiry.update).not.toHaveBeenCalled();
    });

    it('Case 8: Dry-run reconciliation performs no database mutations', async () => {
      const syntheticEnquiries = [
        {
          id: 'enq-dry-1',
          studentName: 'Dry Run Prospect',
          contactNumber: '9876543210',
          source: 'Centre: centre-alpha',
          assignedToId: 'staff-1',
          assignedTo: {
            userCentres: [{ centreId: 'centre-alpha' }],
          },
        },
      ];

      const mockReconcileClient = {
        enquiry: {
          findMany: jest.fn().mockResolvedValue(syntheticEnquiries),
          update: jest.fn(),
        },
      };

      const result = await reconcileLegacyEnquiries(true, mockReconcileClient as any);
      expect(mockReconcileClient.enquiry.update).not.toHaveBeenCalled();
      expect(result.total).toBe(1);
    });

    it('Case 9: Apply-mode reconciliation leaves records with forged or ambiguous origin metadata unchanged', async () => {
      const syntheticEnquiries = [
        {
          id: 'enq-forged-1',
          studentName: 'Forged Prospect',
          contactNumber: '9876543210',
          source: 'Centre: centre-B', // Forged free-text source
          assignedToId: null,
          assignedTo: null,
        },
        {
          id: 'enq-ambiguous-2',
          studentName: 'Multi Centre Staff Prospect',
          contactNumber: '9876543211',
          source: 'Walk-in',
          assignedToId: 'staff-multi',
          assignedTo: {
            userCentres: [{ centreId: 'centre-alpha' }, { centreId: 'centre-beta' }],
          },
        },
      ];

      const mockReconcileClient = {
        enquiry: {
          findMany: jest.fn().mockResolvedValue(syntheticEnquiries),
          update: jest.fn(),
        },
      };

      const result = await reconcileLegacyEnquiries(false, mockReconcileClient as any);
      expect(result.resolvedCount).toBe(0);
      expect(result.ambiguousCount).toBe(2);
      expect(mockReconcileClient.enquiry.update).not.toHaveBeenCalled();
    });

    it('Case 10: Unauthorized users cannot access unreconciled-enquiry endpoint or perform manual reconciliation, whereas Super Admin succeeds and audits', async () => {
      // 1. Non-super admin cannot access unreconciled endpoint
      await expect(enquiryService.getUnreconciledEnquiries(centreAdminUser)).rejects.toThrow(ForbiddenException);
      await expect(enquiryService.getUnreconciledEnquiries(teacherUser)).rejects.toThrow(ForbiddenException);

      // 2. Non-super admin cannot perform manual reconciliation
      await expect(
        enquiryService.reconcileEnquiry('enq-unreconciled-1', 'centre-alpha', centreAdminUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        enquiryService.reconcileEnquiry('enq-unreconciled-1', 'centre-alpha', teacherUser),
      ).rejects.toThrow(ForbiddenException);

      // 3. Super Admin reconciliation requires active valid centre
      mockPrisma.centre.findUnique.mockResolvedValueOnce(null);
      await expect(
        enquiryService.reconcileEnquiry('enq-unreconciled-1', 'centre-invalid', superAdminUser),
      ).rejects.toThrow(BadRequestException);

      mockPrisma.centre.findUnique.mockResolvedValueOnce({ id: 'centre-inactive', status: 'INACTIVE' });
      await expect(
        enquiryService.reconcileEnquiry('enq-unreconciled-1', 'centre-inactive', superAdminUser),
      ).rejects.toThrow(BadRequestException);

      // 4. Super Admin succeeds with active centre, updates record, and audits the ownership change
      mockPrisma.centre.findUnique.mockResolvedValue({ id: 'centre-alpha', status: 'ACTIVE', name: 'Alpha Centre' });
      mockPrisma.enquiry.findUnique.mockResolvedValue({
        id: 'enq-unreconciled-1',
        studentName: 'Unreconciled Student',
        centreId: null,
      });

      const reconciled = await enquiryService.reconcileEnquiry(
        'enq-unreconciled-1',
        'centre-alpha',
        superAdminUser,
        'Approved after verified parent consultation',
      );

      expect(mockPrisma.enquiry.update).toHaveBeenCalledWith({
        where: { id: 'enq-unreconciled-1' },
        data: { centreId: 'centre-alpha' },
        include: expect.any(Object),
      });

      expect(reconciled.centreId).toBe('centre-alpha');
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'super-admin-uuid',
          userRole: 'SUPER_ADMIN',
          action: 'RECONCILE_ENQUIRY_OWNERSHIP',
          category: 'ENQUIRY',
          entityType: 'Enquiry',
          entityId: 'enq-unreconciled-1',
          centreId: 'centre-alpha',
          details: expect.objectContaining({
            previousCentreId: null,
            newCentreId: 'centre-alpha',
            reason: 'Approved after verified parent consultation',
          }),
        }),
      );
    });
  });
});

