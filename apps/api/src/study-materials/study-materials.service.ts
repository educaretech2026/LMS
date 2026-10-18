import { Injectable, HttpException, HttpStatus, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { isSuperAdmin, getAuthorizedCentreIds, SAFE_USER_SELECT } from '../common/utils/tenant.util';

@Injectable()
export class StudyMaterialService {
  constructor(private readonly prisma: PrismaService) {}

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
        where = {
          targetTrackId: null,
          OR: [
            { uploader: { role: { name: 'SUPER_ADMIN' } } },
            { uploader: { userCentres: { none: {} } } },
            { uploaderId: null },
          ]
        };
      } else if (isStudent && user?.id) {
        const student = await this.prisma.studentProfile.findUnique({
          where: { userId: user.id },
          include: { enrollments: { include: { batch: true } } }
        });

        if (!student || !student.enrollments || student.enrollments.length === 0) {
          return [];
        }

        const standardIds = student.enrollments.map(e => e.batch?.standardId).filter(Boolean) as string[];
        const boardIds = student.enrollments.map(e => e.batch?.boardId).filter(Boolean) as string[];
        const academicYearIds = student.enrollments.map(e => e.batch?.academicYearId).filter(Boolean) as string[];
        const trackIds = student.enrollments.map(e => e.trackId).filter(Boolean) as string[];
        const studentCentres = student.enrollments.map(e => e.batch?.centreId).filter(Boolean) as string[];

        where = {
          AND: [
            {
              OR: [
                {
                  syllabus: {
                    standardId: { in: standardIds },
                    boardId: { in: boardIds }
                  }
                },
                { syllabusId: null }
              ]
            },
            {
              OR: [
                { targetTrackId: null },
                ...(trackIds.length > 0 ? [{ targetTrackId: { in: trackIds } }] : [])
              ]
            },
            {
              OR: [
                { academicYearId: { in: academicYearIds } },
                { academicYear: { isActive: true } }
              ]
            },
            {
              OR: [
                { uploader: { userCentres: { some: { centreId: { in: studentCentres } } } } },
                { targetTrack: { batches: { some: { centreId: { in: studentCentres } } } } },
                { uploader: { role: { name: 'SUPER_ADMIN' } }, targetTrackId: null },
                { uploaderId: null, targetTrackId: null },
              ]
            }
          ]
        };
      } else if (isTeacher && user?.id) {
        const authorizedCentres = getAuthorizedCentreIds(user);
        const teacherProfile = await this.prisma.teacherProfile.findUnique({
          where: { userId: user.id },
          include: { assignments: true },
        });
        const assignments = teacherProfile?.assignments || [];
        const assignmentConditions = assignments
          .filter(a => a.subjectId || a.standardId)
          .map(a => ({
            syllabus: {
              ...(a.subjectId ? { subjectId: a.subjectId } : {}),
              ...(a.standardId ? { standardId: a.standardId } : {}),
            }
          }));
        
        where = {
          AND: [
            {
              OR: [
                { uploader: { userCentres: { some: { centreId: { in: authorizedCentres } } } } },
                { targetTrack: { batches: { some: { centreId: { in: authorizedCentres } } } } },
                { uploaderId: user.id },
                { uploader: { role: { name: 'SUPER_ADMIN' } } },
                { uploaderId: null },
              ]
            },
            {
              OR: [
                { uploaderId: user.id },
                ...(assignmentConditions.length > 0 ? assignmentConditions : [{ id: 'none' }]),
              ]
            }
          ]
        };
      } else if (isCentreAdmin && user?.id) {
        const authorizedCentres = getAuthorizedCentreIds(user);
        where = {
          OR: [
            { uploader: { userCentres: { some: { centreId: { in: authorizedCentres } } } } },
            { targetTrack: { batches: { some: { centreId: { in: authorizedCentres } } } } },
            { uploaderId: user.id },
            { uploader: { role: { name: 'SUPER_ADMIN' } }, targetTrackId: null },
            { uploaderId: null, targetTrackId: null },
          ]
        };
      }

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

    if (isPublicLearner) {
      const uploaderCentres = material.uploader?.userCentres || [];
      const uploaderObj = material.uploader as any;
      const roleStrUploader = typeof uploaderObj?.role === 'object' && uploaderObj?.role !== null ? uploaderObj?.role.name : uploaderObj?.role;
      const isSuperAdminUploader = String(roleStrUploader || '').toUpperCase().replace(/\s+/g, '_') === 'SUPER_ADMIN';
      if (material.targetTrackId || (!isSuperAdminUploader && uploaderCentres.length > 0)) {
        throw new ForbiddenException('Access denied: Public learners can only access publicly available materials.');
      }
    } else if (isStudent && user?.id) {
      const student = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { enrollments: { include: { batch: true } } }
      });

      if (!student || !student.enrollments || student.enrollments.length === 0) {
        throw new ForbiddenException('Access denied: Student profile not found or not enrolled.');
      }

      const standardIds = student.enrollments.map(e => e.batch?.standardId).filter(Boolean) as string[];
      const boardIds = student.enrollments.map(e => e.batch?.boardId).filter(Boolean) as string[];
      const academicYearIds = student.enrollments.map(e => e.batch?.academicYearId).filter(Boolean) as string[];
      const trackIds = student.enrollments.map(e => e.trackId).filter(Boolean) as string[];
      const studentCentres = student.enrollments.map(e => e.batch?.centreId).filter(Boolean) as string[];

      const matchesSyllabus = !material.syllabus || (
        (!material.syllabus.standardId || standardIds.includes(material.syllabus.standardId)) &&
        (!material.syllabus.boardId || boardIds.includes(material.syllabus.boardId))
      );
      const matchesAcademicYear = !material.academicYearId || academicYearIds.includes(material.academicYearId);

      if (!matchesSyllabus || !matchesAcademicYear) {
        throw new ForbiddenException('Access denied: You are not enrolled in the course corresponding to this material.');
      }

      if (material.targetTrackId && !trackIds.includes(material.targetTrackId)) {
        throw new ForbiddenException('Access denied: You are not enrolled in the track for this material.');
      }

      const materialCentres = [
        ...(material.uploader?.userCentres?.map(uc => uc.centreId) || []),
        ...(material.targetTrack?.batches?.map(b => b.centreId) || []),
      ];
      if (materialCentres.length > 0) {
        const hasMatchingCentre = studentCentres.some(sc => materialCentres.includes(sc));
        if (!hasMatchingCentre) {
          throw new ForbiddenException('Access denied: Material belongs to another centre.');
        }
      }
    } else if (isCentreAdmin && user?.id) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      const uploaderCentres = material.uploader?.userCentres?.map(uc => uc.centreId) || [];
      const trackCentres = material.targetTrack?.batches?.map(b => b.centreId) || [];
      const isUploaderInCentre = uploaderCentres.some(cId => authorizedCentres.includes(cId));
      const isTrackInCentre = trackCentres.some(cId => authorizedCentres.includes(cId));
      const isUploaderSelf = material.uploaderId === user.id;

      if (!isUploaderSelf && !isUploaderInCentre && !isTrackInCentre) {
        const isGlobal = !material.targetTrackId && uploaderCentres.length === 0;
        if (!isGlobal) {
          throw new ForbiddenException('Access denied: You do not have access to study materials from another centre.');
        }
      }
    } else if (isTeacher && user?.id) {
      const isUploader = material.uploaderId === user.id;
      if (!isUploader) {
        const authorizedCentres = getAuthorizedCentreIds(user);
        const uploaderCentres = material.uploader?.userCentres?.map(uc => uc.centreId) || [];
        const trackCentres = material.targetTrack?.batches?.map(b => b.centreId) || [];
        const isCrossCentre = (uploaderCentres.length > 0 || trackCentres.length > 0) &&
          !uploaderCentres.some(c => authorizedCentres.includes(c)) &&
          !trackCentres.some(c => authorizedCentres.includes(c));

        if (isCrossCentre) {
          throw new ForbiddenException('Access denied: Study material belongs to another centre.');
        }

        const teacherProfile = await this.prisma.teacherProfile.findUnique({
          where: { userId: user.id },
          include: { assignments: { include: { batch: true } } },
        });

        const assignments = teacherProfile?.assignments || [];
        const isAssigned = assignments.some(a => {
          if (material.syllabus?.subjectId && (!a.subjectId || a.subjectId !== material.syllabus.subjectId)) return false;
          if (material.syllabus?.standardId) {
            const matchesStandard = a.standardId === material.syllabus.standardId || a.batch?.standardId === material.syllabus.standardId;
            if (!matchesStandard) return false;
          }
          if (material.targetTrackId && a.batch?.trackId && a.batch.trackId !== material.targetTrackId) return false;
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
        if (data.boardId && data.standardId && data.subjectId) {
          const syllabus = await this.prisma.syllabus.findFirst({
            where: {
              boardId: data.boardId,
              standardId: data.standardId,
              subjectId: data.subjectId,
            }
          });
          if (!syllabus) {
            throw new BadRequestException('No syllabus found matching the specified board, standard, and subject');
          }
          syllabusId = syllabus.id;
        } else {
          throw new BadRequestException('A valid syllabusId or (boardId, standardId, subjectId) combination must be provided');
        }
      } else {
        const syllabus = await this.prisma.syllabus.findUnique({ where: { id: syllabusId } });
        if (!syllabus) {
          throw new BadRequestException('The specified syllabus does not exist');
        }
      }

      // Validate target track authorization and scope
      if (data.targetTrackId) {
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

      // Check teacher assignment authorization
      if (user && !isSuperAdmin(user)) {
        const roleStr = typeof user.role === 'object' && user.role !== null ? user.role.name : user.role;
        const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');

        if (normalizedRole === 'TEACHER') {
          const teacherProfile = await this.prisma.teacherProfile.findUnique({
            where: { userId: user.id },
            include: { assignments: { include: { batch: true } } },
          });
          const syllabus = await this.prisma.syllabus.findUnique({ where: { id: syllabusId } });
          const assignments = teacherProfile?.assignments || [];
          const isAssigned = assignments.some(a => {
            if (syllabus?.subjectId && (!a.subjectId || a.subjectId !== syllabus.subjectId)) return false;
            if (syllabus?.standardId) {
              const matchesStd = a.standardId === syllabus.standardId || a.batch?.standardId === syllabus.standardId;
              if (!matchesStd) return false;
            }
            return true;
          });
          if (!isAssigned) {
            throw new ForbiddenException('Teachers can only upload study materials for subjects and standards they are assigned to teach.');
          }
        }
      }

      const effectiveUploaderId = (user && !isSuperAdmin(user)) ? user.id : (user?.id || data.uploaderId);

      // Verify storage URL ownership
      if (data.url && !data.url.includes('youtube.com') && !data.url.includes('youtu.be')) {
        const existingMaterialWithUrl = await this.prisma.studyMaterial.findFirst({
          where: { url: data.url }
        });
        if (existingMaterialWithUrl && existingMaterialWithUrl.uploaderId !== effectiveUploaderId) {
          throw new ForbiddenException('Cannot associate a storage object owned by another user or material.');
        }
      }

      return await this.prisma.studyMaterial.create({
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
          targetTrackId: data.targetTrackId || null,
        },
      });
    } catch (error: any) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error(error);
      throw new HttpException('Failed to create study material', HttpStatus.INTERNAL_SERVER_ERROR);
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
      where.targetTrackId = null;
      where.OR = [
        { uploader: { role: { name: 'SUPER_ADMIN' } } },
        { uploader: { userCentres: { none: {} } } },
        { uploaderId: null },
      ];
    } else if (isStudent && user?.id) {
      const student = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { enrollments: { include: { batch: true } } }
      });

      if (!student || !student.enrollments || student.enrollments.length === 0) {
        return [];
      }

      const standardIds = student.enrollments.map(e => e.batch?.standardId).filter(Boolean) as string[];
      const boardIds = student.enrollments.map(e => e.batch?.boardId).filter(Boolean) as string[];
      const trackIds = student.enrollments.map(e => e.trackId).filter(Boolean) as string[];
      const studentCentres = student.enrollments.map(e => e.batch?.centreId).filter(Boolean) as string[];

      where.AND = [
        {
          OR: [
            {
              syllabus: {
                standardId: { in: standardIds },
                boardId: { in: boardIds }
              }
            },
            { syllabusId: null }
          ]
        },
        {
          OR: [
            { targetTrackId: null },
            ...(trackIds.length > 0 ? [{ targetTrackId: { in: trackIds } }] : [])
          ]
        },
        {
          OR: [
            { uploader: { userCentres: { some: { centreId: { in: studentCentres } } } } },
            { targetTrack: { batches: { some: { centreId: { in: studentCentres } } } } },
            { uploader: { role: { name: 'SUPER_ADMIN' } }, targetTrackId: null },
            { uploaderId: null, targetTrackId: null },
          ]
        }
      ];
    } else if (isCentreAdmin && user?.id) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      where.OR = [
        { uploader: { userCentres: { some: { centreId: { in: authorizedCentres } } } } },
        { targetTrack: { batches: { some: { centreId: { in: authorizedCentres } } } } },
        { uploaderId: user.id },
        { uploader: { role: { name: 'SUPER_ADMIN' } }, targetTrackId: null },
        { uploaderId: null, targetTrackId: null },
      ];
    } else if (isTeacher && user?.id) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: user.id },
        include: { assignments: true },
      });
      const assignments = teacherProfile?.assignments || [];
      const assignmentConditions = assignments
        .filter(a => a.subjectId || a.standardId)
        .map(a => ({
          syllabus: {
            ...(a.subjectId ? { subjectId: a.subjectId } : {}),
            ...(a.standardId ? { standardId: a.standardId } : {}),
          }
        }));

      where.AND = [
        {
          OR: [
            { uploader: { userCentres: { some: { centreId: { in: authorizedCentres } } } } },
            { targetTrack: { batches: { some: { centreId: { in: authorizedCentres } } } } },
            { uploaderId: user.id },
            { uploader: { role: { name: 'SUPER_ADMIN' } } },
            { uploaderId: null },
          ]
        },
        {
          OR: [
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
    const existing = await this.prisma.studyMaterial.findFirst({
      where: {
        OR: [
          { url },
          { thumbnailUrl: url },
        ],
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });
    return !!existing;
  }

  async delete(id: string, user?: any) {
    try {
      const material = await this.getById(id, user);
      if (!material) throw new NotFoundException('Study material not found');

      if (user && !isSuperAdmin(user)) {
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
}

