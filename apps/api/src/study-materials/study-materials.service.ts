import { Injectable, HttpException, HttpStatus, NotFoundException, ForbiddenException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { isSuperAdmin, getAuthorizedCentreIds, SAFE_USER_SELECT } from '../common/utils/tenant.util';

@Injectable()
export class StudyMaterialService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storageService?: StorageService,
    @Optional() private readonly auditService?: AuditService,
  ) {
    if (this.storageService && !(this.storageService as any).prisma && this.prisma) {
      (this.storageService as any).prisma = this.prisma;
    }
  }

  async getAll(user?: any) {
    try {
      const roleStr = typeof user?.role === 'object' && user?.role !== null ? user?.role.name : user?.role;
      const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');
      const isStudent = normalizedRole === 'STUDENT';
      const isPublicLearner = normalizedRole === 'PUBLIC_LEARNER';
      const isTeacher = normalizedRole === 'TEACHER';
      const isCentreAdmin = normalizedRole === 'CENTRE_ADMIN';

      let where: any = {};

      if (isPublicLearner) {
        where = { isPublic: true };
      } else if (isStudent && user?.id) {
        const student = await this.prisma.studentProfile.findUnique({
          where: { userId: user.id },
          include: { enrollments: { include: { batch: true } } }
        });

        if (!student || !student.enrollments || student.enrollments.length === 0) {
          // Unenrolled students can only view public previews
          where = { isPublic: true };
        } else {
          const validEnrollments = student.enrollments.filter(e => e.batch);
          if (validEnrollments.length === 0) {
            where = { isPublic: true };
          } else {
            const enrolmentConditions = validEnrollments.map(e => ({
              AND: [
                {
                  syllabus: {
                    ...(e.batch.standardId ? { standardId: e.batch.standardId } : {}),
                    ...(e.batch.boardId ? { boardId: e.batch.boardId } : {}),
                  }
                },
                ...(e.trackId ? [{
                  OR: [
                    { targetTrackId: null },
                    { targetTrackId: e.trackId }
                  ]
                }] : [{ targetTrackId: null }]),
                ...(e.batch.academicYearId ? [{
                  OR: [
                    { academicYearId: e.batch.academicYearId },
                    { academicYear: { isActive: true } }
                  ]
                }] : []),
                {
                  OR: [
                    { isShared: true },
                    ...(e.batch.centreId ? [
                      { centreId: e.batch.centreId },
                      {
                        targetTrackId: { not: null },
                        targetTrack: { batches: { some: { centreId: e.batch.centreId } } }
                      },
                    ] : [])
                  ]
                }
              ]
            }));

            where = {
              OR: [
                { isPublic: true },
                ...enrolmentConditions,
              ]
            };
          }
        }
      } else if (isTeacher && user?.id) {
        let authorizedCentres: string[] = [];
        try {
          authorizedCentres = getAuthorizedCentreIds(user);
        } catch {
          authorizedCentres = [];
        }

        if (authorizedCentres.length === 0) {
          where = { isPublic: true };
        } else {
          const teacherProfile = await this.prisma.teacherProfile.findUnique({
            where: { userId: user.id },
            include: { assignments: { include: { batch: true } } },
          });
          const assignments = teacherProfile?.assignments || [];
          const validAssignments = assignments.filter(a => a.subjectId && (a.standardId || a.batch?.standardId));
          const assignmentConditions = validAssignments.map(a => {
            const stdId = a.standardId || a.batch?.standardId;
            const brdId = a.boardId || a.batch?.boardId;
            const assignedCentreId = a.batch?.centreId || (a as any).centreId;

            if (!assignedCentreId || !authorizedCentres.includes(assignedCentreId)) {
              return null;
            }

            const assignedYearId = a.batch?.academicYearId || (a as any).academicYearId;

            return {
              AND: [
                {
                  syllabus: {
                    subjectId: a.subjectId,
                    standardId: stdId,
                    ...(brdId ? { boardId: brdId } : {}),
                  }
                },
                ...(a.batch?.trackId ? [{
                  OR: [
                    { targetTrackId: null },
                    { targetTrackId: a.batch.trackId }
                  ]
                }] : [{ targetTrackId: null }]),
                ...(assignedYearId ? [{ academicYearId: assignedYearId }] : [{ academicYearId: null }]),
                {
                  OR: [
                    { isShared: true },
                    { centreId: assignedCentreId },
                    {
                      targetTrackId: { not: null },
                      targetTrack: { batches: { some: { centreId: assignedCentreId } } }
                    },
                  ]
                }
              ]
            };
          }).filter(Boolean);
          
          where = {
            OR: [
              { isPublic: true },
              { uploaderId: user.id, centreId: { in: authorizedCentres } },
              ...(assignmentConditions.length > 0 ? assignmentConditions : []),
            ]
          };
        }
      } else if (isCentreAdmin && user?.id) {
        let authorizedCentres: string[] = [];
        try {
          authorizedCentres = getAuthorizedCentreIds(user);
        } catch {
          authorizedCentres = [];
        }

        if (authorizedCentres.length === 0) {
          where = { isPublic: true };
        } else {
          where = {
            OR: [
              { isPublic: true },
              { isShared: true },
              { centreId: { in: authorizedCentres } },
              {
                targetTrackId: { not: null },
                targetTrack: { batches: { some: { centreId: { in: authorizedCentres } } } }
              },
            ]
          };
        }
      }

      try {
        return await this.prisma.studyMaterial.findMany({
          where,
          include: {
            academicYear: true,
            syllabus: {
              include: { board: true, standard: true, subject: true }
            },
            chapter: true,
            topic: true,
            subtopic: true,
            uploader: {
              select: SAFE_USER_SELECT
            }
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (dbError: any) {
        console.warn('Prisma studyMaterial.findMany failed, attempting resilient fallback query:', dbError?.message);
        return await this.prisma.studyMaterial.findMany({
          where: isSuperAdmin(user) ? {} : { isPublic: true },
          include: {
            academicYear: true,
            syllabus: {
              include: { board: true, standard: true, subject: true }
            },
            chapter: true,
            topic: true,
            uploader: {
              select: SAFE_USER_SELECT
            }
          },
          orderBy: { createdAt: 'desc' },
        }).catch(() => []);
      }
    } catch (error: any) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      console.error(error);
      throw new HttpException('Failed to fetch study materials', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getById(id: string, user?: any) {
    const material = await this.prisma.studyMaterial.findUnique({
      where: { id },
      include: {
        syllabus: {
          include: { board: true, standard: true, subject: true },
        },
        academicYear: true,
        uploader: {
          include: { userCentres: true, role: true },
        },
        targetTrack: {
          include: { batches: true },
        },
      }
    });

    if (!material) {
      throw new NotFoundException('Study material not found');
    }

    if (!user || isSuperAdmin(user)) {
      return material;
    }

    const roleStr = typeof user?.role === 'object' && user?.role !== null ? user?.role.name : user?.role;
    const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');
    const isStudent = normalizedRole === 'STUDENT';
    const isPublicLearner = normalizedRole === 'PUBLIC_LEARNER';
    const isTeacher = normalizedRole === 'TEACHER';
    const isCentreAdmin = normalizedRole === 'CENTRE_ADMIN';

    const isExplicitlyShared = Boolean((material as any).isShared);
    const isPublic = Boolean((material as any).isPublic);
    const materialCentreId = (material as any).centreId || null;

    if (isPublicLearner) {
      if (!isPublic) {
        throw new ForbiddenException('Access denied: Public learners can only access published public materials.');
      }
      return material;
    } else if (isStudent && user?.id) {
      if (isPublic) {
        return material;
      }
      const student = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { enrollments: { include: { batch: true } } }
      });

      if (!student || !student.enrollments || student.enrollments.length === 0) {
        throw new ForbiddenException('Access denied: Student profile not found or not enrolled.');
      }

      const trackCentres = (material.targetTrack?.batches || []).map((b: any) => b.centreId).filter(Boolean) as string[];
      const hasTrackCentres = material.targetTrackId !== null && trackCentres.length > 0;
      const uploaderCentres = material.uploader?.userCentres?.map((uc: any) => uc.centreId) || [];

      // A missing centreId must never imply global sharing. Fails closed to Super Admin review.
      if (!isExplicitlyShared && !materialCentreId && !hasTrackCentres && uploaderCentres.length === 0) {
        throw new ForbiddenException('Access denied: This study material has unresolved centre ownership and is restricted to administrator review.');
      }

      const matchesEnrolment = student.enrollments.some(e => {
        if (!e.batch) return false;

        // Centre check:
        if (isExplicitlyShared) {
          // Explicitly shared material is globally accessible across all centres
        } else if (hasTrackCentres) {
          if (!trackCentres.includes(e.batch.centreId)) return false;
        } else if (material.targetTrackId !== null && trackCentres.length === 0) {
          return false;
        } else if (materialCentreId) {
          if (materialCentreId !== e.batch.centreId) return false;
        } else if (uploaderCentres.length > 0) {
          if (!uploaderCentres.includes(e.batch.centreId)) return false;
        } else {
          return false;
        }

        // Track ID check on this specific enrolment:
        // A student MUST have a matching trackId if material has targetTrackId!
        if (material.targetTrackId !== null) {
          if (!e.trackId || e.trackId !== material.targetTrackId) {
            return false;
          }
        }

        // Academic Year check
        if (material.academicYearId && e.batch.academicYearId && e.batch.academicYearId !== material.academicYearId) {
          if (!material.academicYear?.isActive) {
            return false;
          }
        }

        // Syllabus (board + standard) check together on this specific enrolment!
        if (material.syllabus) {
          if (material.syllabus.boardId && e.batch.boardId && material.syllabus.boardId !== e.batch.boardId) {
            return false;
          }
          if (material.syllabus.standardId && e.batch.standardId && material.syllabus.standardId !== e.batch.standardId) {
            return false;
          }
        }

        return true;
      });

      if (!matchesEnrolment) {
        throw new ForbiddenException('Access denied: You are not enrolled in the course corresponding to this material.');
      }
    } else if (isCentreAdmin && user?.id) {
      if (isPublic) {
        return material;
      }
      const authorizedCentres = getAuthorizedCentreIds(user);
      const trackCentres = (material.targetTrack?.batches || []).map((b: any) => b.centreId).filter(Boolean) as string[];
      const uploaderCentres = material.uploader?.userCentres?.map((uc: any) => uc.centreId) || [];

      // Unresolved records cannot be accessed by ordinary centre admins even if they uploaded it
      if (!isExplicitlyShared && !materialCentreId && trackCentres.length === 0 && uploaderCentres.length === 0) {
        throw new ForbiddenException('Access denied: This study material has unresolved centre ownership and is restricted to Super Admin review.');
      }

      if (isExplicitlyShared) {
        // Explicitly shared material is globally visible to centre admins
      } else if (materialCentreId) {
        if (!authorizedCentres.includes(materialCentreId)) {
          throw new ForbiddenException('Access denied: You do not have access to study materials from another centre.');
        }
      } else if (material.targetTrackId) {
        const isTrackInCentre = trackCentres.some(cId => authorizedCentres.includes(cId));
        if (!isTrackInCentre) {
          throw new ForbiddenException('Access denied: You do not have access to study materials from another centre.');
        }
      } else if (uploaderCentres.length > 0) {
        const isUploaderInCentre = uploaderCentres.some(cId => authorizedCentres.includes(cId));
        if (!isUploaderInCentre) {
          throw new ForbiddenException('Access denied: You do not have access to study materials from another centre.');
        }
      }
    } else if (isTeacher && user?.id) {
      if (isPublic) {
        return material;
      }
      const authorizedCentres = getAuthorizedCentreIds(user);
      const trackCentres = (material.targetTrack?.batches || []).map((b: any) => b.centreId).filter(Boolean) as string[];
      const uploaderCentres = material.uploader?.userCentres?.map((uc: any) => uc.centreId) || [];

      // Unresolved records cannot be accessed by ordinary teachers even if they uploaded it
      if (!isExplicitlyShared && !materialCentreId && trackCentres.length === 0 && uploaderCentres.length === 0) {
        throw new ForbiddenException('Access denied: This study material has unresolved centre ownership and is restricted to Super Admin review.');
      }

      if (!isExplicitlyShared) {
        if (materialCentreId && !authorizedCentres.includes(materialCentreId)) {
          throw new ForbiddenException('Access denied: You do not have access to study materials from another centre.');
        }
      }

      const isUploader = material.uploaderId === user.id;
      if (isUploader) {
        // Uploader must still belong to an authorized centre for this material
        if (!isExplicitlyShared && materialCentreId && !authorizedCentres.includes(materialCentreId)) {
          throw new ForbiddenException('Access denied: You do not have access to study materials from another centre.');
        }
      } else {
        const teacherProfile = await this.prisma.teacherProfile.findUnique({
          where: { userId: user.id },
          include: { assignments: { include: { batch: true } } },
        });

        const assignments = teacherProfile?.assignments || [];
        const isAssigned = assignments.some(a => {
          const stdId = a.standardId || a.batch?.standardId;
          if (!a.subjectId || !stdId) return false;
          if (material.syllabus?.subjectId && a.subjectId !== material.syllabus.subjectId) return false;
          if (material.syllabus?.standardId && stdId !== material.syllabus.standardId) return false;
          if (material.syllabus?.boardId && (a.boardId || a.batch?.boardId)) {
            const brdId = a.boardId || a.batch?.boardId;
            if (brdId !== material.syllabus.boardId) return false;
          }
          if (material.targetTrackId) {
            if (!a.batch?.trackId || a.batch.trackId !== material.targetTrackId) return false;
          }

          // Authoritative centre check per assignment
          const assignedCentreId = a.batch?.centreId || (a as any).centreId;
          if (!assignedCentreId || !authorizedCentres.includes(assignedCentreId)) {
            return false;
          }

          const assignedYearId = a.batch?.academicYearId || (a as any).academicYearId;
          if (material.academicYearId) {
            if (!assignedYearId || assignedYearId !== material.academicYearId) {
              return false;
            }
          }

          if (isExplicitlyShared) {
            return true;
          }

          if (material.targetTrackId !== null) {
            if (!trackCentres.includes(assignedCentreId)) return false;
          } else if (materialCentreId) {
            if (materialCentreId !== assignedCentreId) return false;
          } else if (uploaderCentres.length > 0) {
            if (!uploaderCentres.includes(assignedCentreId)) return false;
          } else {
            return false;
          }

          return true;
        });

        if (!isAssigned) {
          throw new ForbiddenException('Access denied: You are not assigned to teach the course for this study material.');
        }
      }
    }

    return material;
  }

  async create(data: any, user?: any) {
    try {
      let { academicYearId, syllabusId } = data;

      // Resolve academic year deterministically without arbitrary selection
      if (academicYearId === "dummy-academic-year" || !academicYearId) {
        const activeYears = await this.prisma.academicYear.findMany({ where: { isActive: true } });
        if (activeYears.length === 0) {
          throw new BadRequestException('An active academic year must be configured before creating study materials');
        }
        if (activeYears.length > 1) {
          throw new BadRequestException('Multiple active academic years found. Please explicitly specify academicYearId.');
        }
        academicYearId = activeYears[0].id;
      } else {
        const year = await this.prisma.academicYear.findUnique({ where: { id: academicYearId } });
        if (!year) {
          throw new BadRequestException('The specified academic year does not exist');
        }
      }
      
      // Resolve syllabus deterministically without arbitrary findFirst() fallback
      if (syllabusId === "dummy-syllabus-id" || !syllabusId) {
        if (data.chapterId && typeof this.prisma.chapter?.findUnique === 'function') {
          const ch = await this.prisma.chapter.findUnique({
            where: { id: data.chapterId },
            select: { syllabusId: true }
          });
          if (ch?.syllabusId) {
            syllabusId = ch.syllabusId;
          }
        }

        if (!syllabusId && data.boardId && data.standardId && data.subjectId) {
          let syllabus = null;
          if (typeof this.prisma.syllabus?.findFirst === 'function') {
            syllabus = await this.prisma.syllabus.findFirst({
              where: {
                boardId: data.boardId,
                standardId: data.standardId,
                subjectId: data.subjectId,
              }
            });
          }

          if (!syllabus) {
            if (typeof this.prisma.syllabus?.upsert === 'function') {
              syllabus = await this.prisma.syllabus.upsert({
                where: {
                  boardId_standardId_subjectId: {
                    boardId: data.boardId,
                    standardId: data.standardId,
                    subjectId: data.subjectId,
                  }
                },
                update: {},
                create: {
                  boardId: data.boardId,
                  standardId: data.standardId,
                  subjectId: data.subjectId,
                }
              });
            } else if (typeof this.prisma.syllabus?.create === 'function') {
              syllabus = await this.prisma.syllabus.create({
                data: {
                  boardId: data.boardId,
                  standardId: data.standardId,
                  subjectId: data.subjectId,
                }
              });
            }
          }

          if (syllabus) {
            syllabusId = syllabus.id;
          } else {
            throw new BadRequestException('No syllabus found matching the specified board, standard, and subject');
          }
        } else if (!syllabusId) {
          throw new BadRequestException('A valid syllabusId or (boardId, standardId, subjectId) combination must be provided');
        }
      } else {
        const syllabus = await this.prisma.syllabus.findUnique({ where: { id: syllabusId } });
        if (!syllabus) {
          throw new BadRequestException('The specified syllabus does not exist');
        }
      }

      // Resolve targetTrackId if client provided targetTrack string (e.g. "TUITION", "ENTRANCE", "BOTH")
      if (!data.targetTrackId && data.targetTrack) {
        if (data.targetTrack !== 'BOTH' && typeof this.prisma.targetTrack?.findFirst === 'function') {
          const track = await this.prisma.targetTrack.findFirst({
            where: {
              OR: [
                { id: data.targetTrack },
                { name: { equals: data.targetTrack, mode: 'insensitive' } }
              ]
            }
          });
          if (track) {
            data.targetTrackId = track.id;
          }
        }
      }

      // Validate target track authorization and scope
      if (data.targetTrackId && typeof this.prisma.targetTrack?.findUnique === 'function') {
        const track = await this.prisma.targetTrack.findUnique({
          where: { id: data.targetTrackId },
          include: { batches: true }
        });
        if (!track) {
          throw new BadRequestException('The specified target track does not exist');
        }

        if (user && !isSuperAdmin(user)) {
          const authorizedCentres = getAuthorizedCentreIds(user);
          const trackCentres = (track.batches || []).map((b: any) => b.centreId).filter(Boolean) as string[];
          if (trackCentres.length > 0 && !trackCentres.some(cId => authorizedCentres.includes(cId))) {
            throw new ForbiddenException('You cannot target a track from another centre.');
          }

          const roleStr = typeof user.role === 'object' && user.role !== null ? user.role.name : user.role;
          const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');
          if (normalizedRole === 'TEACHER') {
            const teacherProfile = await this.prisma.teacherProfile.findUnique({
              where: { userId: user.id },
              include: { assignments: { include: { batch: true } } },
            });
            const hasAssignedBatchInTrack = teacherProfile?.assignments?.some(a => 
              a.batch?.trackId === data.targetTrackId
            );
            if (!hasAssignedBatchInTrack && (track.batches || []).length > 0) {
              throw new ForbiddenException('Teachers can only target tracks associated with their assigned batches.');
            }
          }
        }
      }

      const effectiveUploaderId = user?.id || data.uploaderId;

      let resolvedCentreId: string | null = null;
      if (isSuperAdmin(user)) {
        resolvedCentreId = data.centreId || null;
      } else if (user) {
        const authorizedCentres = getAuthorizedCentreIds(user);
        if (data.centreId) {
          if (!authorizedCentres.includes(data.centreId)) {
            throw new ForbiddenException('You cannot create study material for another centre.');
          }
          resolvedCentreId = data.centreId;
        } else if (authorizedCentres.length > 0) {
          resolvedCentreId = authorizedCentres[0];
        }
      }

      if (data.url) {
        await this.checkStorageOwnership(data.url, 'url', effectiveUploaderId, user ? isSuperAdmin(user) : false);
        if (this.storageService?.validateAndEnforceObjectSize) {
          await this.storageService.validateAndEnforceObjectSize(data.url, 100 * 1024 * 1024);
        }
      }
      if (data.thumbnailUrl) {
        await this.checkStorageOwnership(data.thumbnailUrl, 'thumbnailUrl', effectiveUploaderId, user ? isSuperAdmin(user) : false);
        if (this.storageService?.validateAndEnforceObjectSize) {
          await this.storageService.validateAndEnforceObjectSize(data.thumbnailUrl, 20 * 1024 * 1024);
        }
      }

      // Check teacher assignment authorization
      if (user && !isSuperAdmin(user)) {
        const roleStr = typeof user.role === 'object' && user.role !== null ? user.role.name : user.role;
        const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');

        if (normalizedRole === 'TEACHER') {
          const authorizedCentres = getAuthorizedCentreIds(user);
          const teacherProfile = await this.prisma.teacherProfile.findUnique({
            where: { userId: user.id },
            include: { assignments: { include: { batch: true } } },
          });
          const syllabus = await this.prisma.syllabus.findUnique({ where: { id: syllabusId } });
          const assignments = teacherProfile?.assignments || [];
          const isAssigned = assignments.some(a => {
            const stdId = a.standardId || a.batch?.standardId;
            if (!a.subjectId || !stdId) return false;
            if (syllabus?.subjectId && a.subjectId !== syllabus.subjectId) return false;
            if (syllabus?.standardId && stdId !== syllabus.standardId) return false;
            if (syllabus?.boardId && (a.boardId || a.batch?.boardId)) {
              const brdId = a.boardId || a.batch?.boardId;
              if (brdId !== syllabus.boardId) return false;
            }

            // Must be bound to authorized centre
            const assignedCentreId = a.batch?.centreId || (a as any).centreId;
            if (!assignedCentreId || !authorizedCentres.includes(assignedCentreId)) {
              return false;
            }

            // Must be bound to academic year for year-specific material
            const assignedYearId = a.batch?.academicYearId || (a as any).academicYearId;
            if (academicYearId) {
              if (!assignedYearId || assignedYearId !== academicYearId) {
                return false;
              }
            }

            // Must match targetTrackId
            if (data.targetTrackId) {
              if (!a.batch?.trackId || a.batch.trackId !== data.targetTrackId) return false;
            }

            return true;
          });
          if (!isAssigned) {
            throw new ForbiddenException('Teachers can only upload study materials for subjects, standards, centres, and tracks they are assigned to teach.');
          }
        }
      }

      if (!data.targetTrackId && user && !isSuperAdmin(user)) {
        const authorizedCentres = getAuthorizedCentreIds(user);
        if (authorizedCentres.length === 0) {
          throw new ForbiddenException('Staff must belong to an authorized centre to create study materials.');
        }
      }

      let resolvedIsShared = false;
      let resolvedIsPublic = false;
      if (isSuperAdmin(user)) {
        resolvedIsShared = Boolean(data.isShared);
        resolvedIsPublic = Boolean(data.isPublic);
      } else {
        if (data.isShared) {
          throw new ForbiddenException('Only Super Admins can designate study materials as globally shared.');
        }
        if (data.isPublic) {
          throw new ForbiddenException('Only Super Admins can publish study materials for public preview.');
        }
        resolvedIsShared = false;
        resolvedIsPublic = false;
      }

      const created = await this.prisma.studyMaterial.create({
        data: {
          title: data.title,
          type: data.type,
          url: data.url,
          thumbnailUrl: data.thumbnailUrl,
          academicYearId,
          syllabusId,
          chapterId: data.chapterId || null,
          topicId: data.topicId || null,
          subtopicId: data.subtopicId || null,
          uploaderId: effectiveUploaderId,
          centreId: resolvedCentreId,
          isShared: resolvedIsShared,
          isPublic: resolvedIsPublic,
          targetTrackId: data.targetTrackId || null,
        },
      });

      if ((resolvedIsShared || resolvedIsPublic) && this.auditService) {
        this.auditService.record({
          userId: user?.id,
          userRole: 'SUPER_ADMIN',
          action: resolvedIsPublic ? 'CREATE_PUBLIC_STUDY_MATERIAL' : 'CREATE_SHARED_STUDY_MATERIAL',
          category: 'STUDY_MATERIAL',
          entityType: 'StudyMaterial',
          entityId: created.id,
          details: { title: created.title, isShared: resolvedIsShared, isPublic: resolvedIsPublic },
        });
      }

      return created;
    } catch (error: any) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error(error);
      throw new HttpException('Failed to create study material', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  extractAndValidateStorageKey(urlOrKey: string): string | null {
    if (this.storageService) {
      return this.storageService.extractAndValidateObjectKey(urlOrKey);
    }
    if (!urlOrKey || typeof urlOrKey !== 'string') return null;
    let rawKey = urlOrKey.trim();
    if (!rawKey) return null;
    if (rawKey.startsWith('http://') || rawKey.startsWith('https://')) {
      try {
        const parsedUrl = new URL(rawKey);
        rawKey = parsedUrl.pathname.replace(/^\/+/, '');
      } catch {
        return null;
      }
    } else {
      rawKey = rawKey.replace(/^\/+/, '');
    }
    if (rawKey.includes('..') || rawKey.includes('\\')) return null;
    if (!rawKey.startsWith('materials/') && !rawKey.startsWith('forms/') && !rawKey.startsWith('thumbnails/')) {
      return null;
    }
    if (!/^[a-zA-Z0-9_\-\./]+$/.test(rawKey)) return null;
    return rawKey;
  }

  async checkStorageOwnership(rawUrl: string, fieldName: string, effectiveUploaderId: string, isSuperAdminUser: boolean = false) {
    if (!rawUrl || typeof rawUrl !== 'string') return;

    if (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be')) {
      if (fieldName === 'thumbnailUrl') {
        throw new BadRequestException('Thumbnails cannot be YouTube URLs.');
      }
      return;
    }

    // 1. Authoritative validation: must be a managed storage key/URL
    const validatedKey = this.extractAndValidateStorageKey(rawUrl);
    if (!validatedKey) {
      throw new BadRequestException(`Invalid or unmanaged storage object (${fieldName}). Expected an approved managed storage key or URL.`);
    }

    // 2. If object key encodes an owner (e.g. materials/<userId>/...)
    const keyParts = validatedKey.split('/');
    if (keyParts.length >= 3 && (keyParts[0] === 'materials' || keyParts[0] === 'thumbnails')) {
      const ownerInKey = keyParts[1];
      if (ownerInKey && ownerInKey !== effectiveUploaderId && !isSuperAdminUser) {
        throw new ForbiddenException(`Cannot associate a storage object (${fieldName}) owned by another user.`);
      }
    }

    // 3. Database existing material check
    const existingWithUrl = await this.prisma.studyMaterial.findFirst({
      where: {
        OR: [
          { url: rawUrl },
          { thumbnailUrl: rawUrl },
          ...(validatedKey ? [
            { url: validatedKey },
            { thumbnailUrl: validatedKey },
            { url: { endsWith: `/${validatedKey}` } },
            { thumbnailUrl: { endsWith: `/${validatedKey}` } },
          ] : [])
        ]
      }
    });
    if (existingWithUrl && existingWithUrl.uploaderId && existingWithUrl.uploaderId !== effectiveUploaderId && !isSuperAdminUser) {
      throw new ForbiddenException(`Cannot associate a storage object (${fieldName}) owned by another user or material.`);
    }
  }

  async getByTopic(topicId: string, user?: any) {
    const roleStr = typeof user?.role === 'object' && user?.role !== null ? user?.role.name : user?.role;
    const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');
    const isStudent = normalizedRole === 'STUDENT';
    const isPublicLearner = normalizedRole === 'PUBLIC_LEARNER';
    const isTeacher = normalizedRole === 'TEACHER';
    const isCentreAdmin = normalizedRole === 'CENTRE_ADMIN';

    const where: any = { topicId };

    if (isPublicLearner) {
      where.isPublic = true;
    } else if (isStudent && user?.id) {
      const student = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { enrollments: { include: { batch: true } } }
      });

      if (!student || !student.enrollments || student.enrollments.length === 0) {
        where.isPublic = true;
      } else {
        const validEnrollments = student.enrollments.filter(e => e.batch);
        if (validEnrollments.length === 0) {
          where.isPublic = true;
        } else {
          const enrolmentConditions = validEnrollments.map(e => ({
            AND: [
              {
                syllabus: {
                  ...(e.batch.standardId ? { standardId: e.batch.standardId } : {}),
                  ...(e.batch.boardId ? { boardId: e.batch.boardId } : {}),
                }
              },
              ...(e.trackId ? [{
                OR: [
                  { targetTrackId: null },
                  { targetTrackId: e.trackId }
                ]
              }] : [{ targetTrackId: null }]),
              ...(e.batch.academicYearId ? [{
                OR: [
                  { academicYearId: e.batch.academicYearId },
                  { academicYear: { isActive: true } }
                ]
              }] : []),
              {
                OR: [
                  { isShared: true },
                  ...(e.batch.centreId ? [
                    { centreId: e.batch.centreId },
                    {
                      targetTrackId: { not: null },
                      targetTrack: { batches: { some: { centreId: e.batch.centreId } } }
                    },
                    {
                      targetTrackId: null,
                      uploader: { userCentres: { some: { centreId: e.batch.centreId } } }
                    }
                  ] : [])
                ]
              }
            ]
          }));

          where.AND = [
            { topicId },
            {
              OR: [
                { isPublic: true },
                ...enrolmentConditions
              ]
            }
          ];
        }
      }
    } else if (isCentreAdmin && user?.id) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      where.AND = [
        { topicId },
        {
          OR: [
            { isPublic: true },
            { isShared: true },
            { centreId: { in: authorizedCentres } },
            {
              targetTrackId: { not: null },
              targetTrack: { batches: { some: { centreId: { in: authorizedCentres } } } }
            },
            {
              targetTrackId: null,
              uploader: { userCentres: { some: { centreId: { in: authorizedCentres } } } }
            },
            { uploaderId: user.id },
          ]
        }
      ];
    } else if (isTeacher && user?.id) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: user.id },
        include: { assignments: { include: { batch: true } } },
      });
      const assignments = teacherProfile?.assignments || [];
      const validAssignments = assignments.filter(a => a.subjectId && (a.standardId || a.batch?.standardId));
      const assignmentConditions = validAssignments.map(a => {
        const stdId = a.standardId || a.batch?.standardId;
        const brdId = a.boardId || a.batch?.boardId;
        const assignedCentreId = a.batch?.centreId || (a as any).centreId;

        if (!assignedCentreId || !authorizedCentres.includes(assignedCentreId)) {
          return null;
        }

        const assignedYearId = a.batch?.academicYearId || (a as any).academicYearId;

        return {
          AND: [
            {
              syllabus: {
                subjectId: a.subjectId,
                standardId: stdId,
                ...(brdId ? { boardId: brdId } : {}),
              }
            },
            ...(a.batch?.trackId ? [{
              OR: [
                { targetTrackId: null },
                { targetTrackId: a.batch.trackId }
              ]
            }] : [{ targetTrackId: null }]),
            ...(assignedYearId ? [{ academicYearId: assignedYearId }] : [{ academicYearId: null }]),
            {
              OR: [
                { isShared: true },
                { centreId: assignedCentreId },
                {
                  targetTrackId: { not: null },
                  targetTrack: { batches: { some: { centreId: assignedCentreId } } }
                },
                {
                  targetTrackId: null,
                  uploader: { userCentres: { some: { centreId: assignedCentreId } } }
                },
              ]
            }
          ]
        };
      }).filter(Boolean);

      where.AND = [
        { topicId },
        {
          OR: [
            { isPublic: true },
            { uploaderId: user.id },
            ...(assignmentConditions.length > 0 ? assignmentConditions : [{ id: 'none' }]),
          ]
        }
      ];
    }

    return this.prisma.studyMaterial.findMany({
      where,
      include: {
        academicYear: true,
        syllabus: {
          include: { board: true, standard: true, subject: true }
        },
        chapter: true,
        topic: true,
        uploader: { select: SAFE_USER_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async isStorageUrlInUse(url: string, excludeId?: string): Promise<boolean> {
    if (!url) return false;
    if (this.storageService?.isStorageUrlInUse) {
      const inUse = await this.storageService.isStorageUrlInUse(url, { model: 'StudyMaterial', id: excludeId });
      if (inUse) return true;
    }
    const validatedKey = this.storageService?.extractAndValidateObjectKey(url);
    const searchConditions: any[] = [
      { url },
      { thumbnailUrl: url },
    ];
    if (validatedKey) {
      searchConditions.push(
        { url: validatedKey },
        { thumbnailUrl: validatedKey },
        { url: { endsWith: `/${validatedKey}` } },
        { thumbnailUrl: { endsWith: `/${validatedKey}` } },
      );
    }
    const existing = await this.prisma.studyMaterial.findFirst({
      where: {
        OR: searchConditions,
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });
    if (existing) return true;

    // Check MCQ Questions if model is present
    const prismaAny = this.prisma as any;
    if (prismaAny.mcqQuestion?.findFirst) {
      try {
        const mcqConditions: any[] = [{ imageUrl: url }];
        if (validatedKey) {
          mcqConditions.push(
            { imageUrl: validatedKey },
            { imageUrl: { endsWith: `/${validatedKey}` } },
          );
        }
        const mcqExisting = await prismaAny.mcqQuestion.findFirst({
          where: { OR: mcqConditions },
        });
        if (mcqExisting) return true;
      } catch {
        // Fail-safe: prevent deletion if check fails
        return true;
      }
    }

    // Check Student Answers if model is present
    if (prismaAny.studentAnswer?.findFirst) {
      try {
        const answerConditions: any[] = [{ answerFileUrl: url }];
        if (validatedKey) {
          answerConditions.push(
            { answerFileUrl: validatedKey },
            { answerFileUrl: { endsWith: `/${validatedKey}` } },
          );
        }
        const answerExisting = await prismaAny.studentAnswer.findFirst({
          where: { OR: answerConditions },
        });
        if (answerExisting) return true;
      } catch {
        // Fail-safe: prevent deletion if check fails
        return true;
      }
    }

    return false;
  }

  async update(id: string, updateData: any, user?: any) {
    try {
      const material = await this.getById(id, user);
      if (!material) throw new NotFoundException('Study material not found');

      if (user && !isSuperAdmin(user)) {
        if (updateData.isShared !== undefined && Boolean(updateData.isShared) !== Boolean((material as any).isShared)) {
          throw new ForbiddenException('Only Super Admins can modify global-sharing status.');
        }
        if ((material as any).isShared) {
          throw new ForbiddenException('Only Super Admins can modify globally shared materials.');
        }
        if (updateData.isPublic !== undefined && Boolean(updateData.isPublic) !== Boolean((material as any).isPublic)) {
          throw new ForbiddenException('Only Super Admins can modify public-publication status.');
        }
        if ((material as any).isPublic) {
          throw new ForbiddenException('Only Super Admins can modify public study materials.');
        }

        const roleStr = typeof user.role === 'object' && user.role !== null ? user.role.name : user.role;
        const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');

        if (normalizedRole === 'TEACHER') {
          if (material.uploaderId !== user.id) {
            throw new ForbiddenException('Teachers can only update study materials they uploaded.');
          }
        } else if (normalizedRole === 'CENTRE_ADMIN') {
          const authorizedCentres = getAuthorizedCentreIds(user);
          const belongsToCentre = (material as any).centreId && authorizedCentres.includes((material as any).centreId);
          if (!belongsToCentre && material.uploaderId !== user.id) {
            throw new ForbiddenException('Centre Admins cannot update materials from other centres.');
          }
        } else {
          throw new ForbiddenException('You are not authorized to update study materials.');
        }

        if (updateData.centreId && updateData.centreId !== (material as any).centreId) {
          const authorizedCentres = getAuthorizedCentreIds(user);
          if (!authorizedCentres.includes(updateData.centreId)) {
            throw new ForbiddenException('Cannot reassign material to an unauthorized centre.');
          }
        }
      }

      const effectiveUploaderId = material.uploaderId || user?.id;

      if (updateData.url && updateData.url !== material.url) {
        await this.checkStorageOwnership(updateData.url, 'url', effectiveUploaderId, user ? isSuperAdmin(user) : false);
        if (this.storageService?.validateAndEnforceObjectSize) {
          await this.storageService.validateAndEnforceObjectSize(updateData.url, 100 * 1024 * 1024);
        }
      }
      if (updateData.thumbnailUrl && updateData.thumbnailUrl !== material.thumbnailUrl) {
        await this.checkStorageOwnership(updateData.thumbnailUrl, 'thumbnailUrl', effectiveUploaderId, user ? isSuperAdmin(user) : false);
        if (this.storageService?.validateAndEnforceObjectSize) {
          await this.storageService.validateAndEnforceObjectSize(updateData.thumbnailUrl, 20 * 1024 * 1024);
        }
      }

      const resolvedIsShared = isSuperAdmin(user)
        ? (updateData.isShared !== undefined ? Boolean(updateData.isShared) : (material as any).isShared)
        : (material as any).isShared;

      const resolvedIsPublic = isSuperAdmin(user)
        ? (updateData.isPublic !== undefined ? Boolean(updateData.isPublic) : (material as any).isPublic)
        : (material as any).isPublic;

      const updated = await this.prisma.studyMaterial.update({
        where: { id },
        data: {
          ...(updateData.title ? { title: updateData.title } : {}),
          ...(updateData.type ? { type: updateData.type } : {}),
          ...(updateData.url ? { url: updateData.url } : {}),
          ...(updateData.thumbnailUrl ? { thumbnailUrl: updateData.thumbnailUrl } : {}),
          ...(updateData.chapterId !== undefined ? { chapterId: updateData.chapterId } : {}),
          ...(updateData.topicId !== undefined ? { topicId: updateData.topicId } : {}),
          ...(updateData.subtopicId !== undefined ? { subtopicId: updateData.subtopicId } : {}),
          ...(updateData.centreId !== undefined && isSuperAdmin(user) ? { centreId: updateData.centreId } : {}),
          isShared: resolvedIsShared,
          isPublic: resolvedIsPublic,
        },
      });

      if (this.auditService && (updateData.isShared !== undefined || updateData.isPublic !== undefined || updateData.centreId !== undefined)) {
        this.auditService.record({
          userId: user?.id,
          userRole: isSuperAdmin(user) ? 'SUPER_ADMIN' : 'STAFF',
          action: updateData.isPublic !== undefined ? 'UPDATE_STUDY_MATERIAL_VISIBILITY' : 'UPDATE_STUDY_MATERIAL_SHARING',
          category: 'STUDY_MATERIAL',
          entityType: 'StudyMaterial',
          entityId: id,
          details: { isShared: resolvedIsShared, isPublic: resolvedIsPublic, centreId: updated.centreId },
        });
      }

      return updated;
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      console.error(error);
      throw new HttpException('Failed to update study material', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async delete(id: string, user?: any) {
    try {
      const material = await this.getById(id, user);
      if (!material) throw new NotFoundException('Study material not found');

      if (user && !isSuperAdmin(user)) {
        if ((material as any).isShared) {
          throw new ForbiddenException('Only Super Admins can delete explicitly shared materials.');
        }
        if ((material as any).isPublic) {
          throw new ForbiddenException('Only Super Admins can delete public study materials.');
        }

        const roleStr = typeof user.role === 'object' && user.role !== null ? user.role.name : user.role;
        const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');

        if (normalizedRole === 'TEACHER') {
          if (material.uploaderId !== user.id) {
            throw new ForbiddenException('Teachers can only delete study materials they uploaded.');
          }
        } else if (normalizedRole === 'CENTRE_ADMIN') {
          const authorizedCentres = getAuthorizedCentreIds(user);
          const uploaderCentres = material.uploader?.userCentres?.map(uc => uc.centreId) || [];
          const trackCentres = material.targetTrack?.batches?.map(b => b.centreId) || [];
          const belongsToCentre = material.uploaderId === user.id ||
            uploaderCentres.some(c => authorizedCentres.includes(c)) ||
            trackCentres.some(c => authorizedCentres.includes(c));
          if (!belongsToCentre) {
            throw new ForbiddenException('Centre Admins cannot delete materials from other centres.');
          }
        } else {
          throw new ForbiddenException('You are not authorized to delete study materials.');
        }
      }

      return await this.prisma.studyMaterial.delete({
        where: { id },
      });
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      console.error(error);
      throw new HttpException('Failed to delete study material', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateProgress(studyMaterialId: string, userId: string, progressData: any, user?: any) {
    const roleStr = typeof user?.role === 'object' && user?.role !== null ? user?.role.name : user?.role;
    const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');
    if (normalizedRole !== 'STUDENT') {
      throw new ForbiddenException('Only students can record learning progress.');
    }

    const { isOpened, timeWatchedSecs, isCompleted } = progressData || {};
    
    if (timeWatchedSecs !== undefined && (typeof timeWatchedSecs !== 'number' || timeWatchedSecs < 0 || !Number.isFinite(timeWatchedSecs))) {
      throw new BadRequestException('timeWatchedSecs must be a valid non-negative number.');
    }

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId }
    });
    if (!student) {
      throw new HttpException('Student profile not found', HttpStatus.NOT_FOUND);
    }
    
    // Authorize student access to this study material before recording progress
    const callingUser = user || { id: userId, role: 'STUDENT' };
    await this.getById(studyMaterialId, callingUser);

    // Get existing progress to keep the max time watched
    const existing = await this.prisma.studyMaterialProgress.findUnique({
      where: {
        studentProfileId_studyMaterialId: {
          studentProfileId: student.id,
          studyMaterialId: studyMaterialId
        }
      }
    });

    const newTimeWatched = timeWatchedSecs !== undefined 
      ? Math.max(timeWatchedSecs, existing?.timeWatchedSecs || 0)
      : existing?.timeWatchedSecs || 0;

    return this.prisma.studyMaterialProgress.upsert({
      where: {
        studentProfileId_studyMaterialId: {
          studentProfileId: student.id,
          studyMaterialId: studyMaterialId
        }
      },
      update: {
        isOpened: isOpened !== undefined ? !!isOpened : undefined,
        timeWatchedSecs: newTimeWatched,
        isCompleted: isCompleted !== undefined ? !!isCompleted : undefined,
      },
      create: {
        studentProfileId: student.id,
        studyMaterialId: studyMaterialId,
        isOpened: isOpened || false,
        timeWatchedSecs: newTimeWatched,
        isCompleted: isCompleted || false
      }
    });
  }

  async getUnreconciled(user?: any) {
    if (!isSuperAdmin(user)) {
      throw new ForbiddenException('Only Super Admins can inspect unreconciled study materials.');
    }
    return (this.prisma as any).studyMaterial.findMany({
      where: {
        centreId: null,
        isShared: false,
      },
      include: {
        uploader: { select: SAFE_USER_SELECT },
        targetTrack: { include: { batches: true } },
        syllabus: { include: { board: true, standard: true, subject: true } },
        academicYear: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

