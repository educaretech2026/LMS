import { Injectable, NotFoundException, InternalServerErrorException, ForbiddenException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { assertCentreAccess, isSuperAdmin, getUserCentreIds, getAuthorizedCentreIds, SAFE_USER_SELECT } from '../common/utils/tenant.util';
import {
  buildAdmissionPrefix,
  formatAdmissionNumber,
  extractSequenceFromAdmissionNumber,
} from './utils/admission-number.util';

@Injectable()
export class StudentsService implements OnModuleInit {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async onModuleInit() {
    try {
      // Self-healing migration: sanitize any legacy student admissionNo containing an email address or autofill string
      const erroneousStudents = await this.prisma.studentProfile.findMany({
        where: {
          OR: [
            { admissionNo: { contains: '@' } },
            { admissionNo: { contains: 'admin' } },
            { admissionNo: { contains: 'educare' } },
          ],
        },
        select: { id: true, admissionNo: true },
        take: 100,
      });

      if (erroneousStudents.length > 0) {
        this.logger.warn(`Found ${erroneousStudents.length} student profiles with invalid email/autofill admission numbers. Self-healing...`);
        for (const s of erroneousStudents) {
          const fixedAdmNo = `ADM-${s.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()}`;
          await this.prisma.studentProfile.update({
            where: { id: s.id },
            data: { admissionNo: fixedAdmNo },
          }).catch((err) => {
            this.logger.error(`Failed to heal student admission number for ${s.id}: ${err.message}`);
          });
        }
        this.logger.log(`Successfully healed ${erroneousStudents.length} student admission numbers.`);
      }
    } catch (err: any) {
      this.logger.warn(`Could not run admissionNo self-healing migration: ${err?.message}`);
    }
  }

  /**
   * Atomically computes the next sequential admission number for a cohort prefix:
   * Formula: [CENTRE]-[YEAR]-[COURSE]-[CLASS][BATCH]-[NUMBER] (e.g. KL-26-NEET-11A-001)
   */
  async generateNextAdmissionNo(
    params: {
      centreId?: string;
      centreName?: string;
      academicYearId?: string;
      academicYearName?: string;
      trackId?: string;
      trackName?: string;
      standardId?: string;
      standardName?: string;
      batchId?: string;
      batchName?: string;
    },
    txPrisma?: any,
  ): Promise<{ admissionNo: string; prefix: string; sequence: number }> {
    const prisma = txPrisma || this.prisma;

    // 1. Resolve Centre
    let centreCode = '';
    let resolvedCentreName = params.centreName || '';
    if (params.centreId) {
      const c = await prisma.centre.findUnique({
        where: { id: params.centreId },
        select: { code: true, name: true },
      });
      if (c) {
        centreCode = c.code;
        resolvedCentreName = c.name;
      }
    } else if (params.centreName) {
      const c = await prisma.centre.findFirst({
        where: { OR: [{ name: params.centreName }, { code: params.centreName }] },
        select: { code: true, name: true },
      });
      if (c) {
        centreCode = c.code;
        resolvedCentreName = c.name;
      }
    }

    // 2. Resolve Academic Year
    let resolvedYearName = params.academicYearName || '';
    if (params.academicYearId) {
      const y = await prisma.academicYear.findUnique({
        where: { id: params.academicYearId },
        select: { name: true },
      });
      if (y) resolvedYearName = y.name;
    } else if (!resolvedYearName) {
      const activeYear = await prisma.academicYear.findFirst({
        where: { isActive: true },
        select: { name: true },
      });
      if (activeYear) resolvedYearName = activeYear.name;
    }

    // 3. Resolve Track / Course
    let resolvedTrackName = params.trackName || '';
    if (params.trackId) {
      const t = await prisma.targetTrack.findUnique({
        where: { id: params.trackId },
        select: { name: true },
      });
      if (t) resolvedTrackName = t.name;
    }

    // 4. Resolve Standard / Class
    let resolvedStandardName = params.standardName || '';
    let standardLevel: number | undefined;
    if (params.standardId) {
      const s = await prisma.standard.findUnique({
        where: { id: params.standardId },
        select: { name: true, level: true },
      });
      if (s) {
        resolvedStandardName = s.name;
        standardLevel = s.level;
      }
    }

    // 5. Resolve Batch / Division
    let resolvedBatchName = params.batchName || '';
    if (params.batchId) {
      const b = await prisma.batch.findUnique({
        where: { id: params.batchId },
        select: { name: true },
      });
      if (b) resolvedBatchName = b.name;
    }

    // 6. Build standardized prefix [CENTRE]-[YEAR]-[COURSE]-[CLASS][BATCH]
    const prefix = buildAdmissionPrefix({
      centreCode,
      centreName: resolvedCentreName,
      academicYearName: resolvedYearName,
      trackName: resolvedTrackName,
      standardName: resolvedStandardName,
      standardLevel,
      batchName: resolvedBatchName,
    });

    // 7. Query existing profiles matching prefix to calculate highest counter
    const existingProfiles = await prisma.studentProfile.findMany({
      where: {
        admissionNo: {
          startsWith: `${prefix}-`,
        },
      },
      select: { admissionNo: true },
    });

    let maxSeq = 0;
    for (const p of existingProfiles) {
      const seq = extractSequenceFromAdmissionNumber(p.admissionNo, prefix);
      if (seq !== null && seq > maxSeq) {
        maxSeq = seq;
      }
    }

    const nextSeq = maxSeq + 1;
    const admissionNo = formatAdmissionNumber(prefix, nextSeq);

    return { admissionNo, prefix, sequence: nextSeq };
  }

  /**
   * Previews the next admission number without persisting to database.
   * Used for real-time frontend pre-fill.
   */
  async previewAdmissionNumber(query: any, currentUser?: any) {
    if (currentUser && !isSuperAdmin(currentUser) && query.centreId) {
      assertCentreAccess(currentUser, query.centreId);
    }
    return this.generateNextAdmissionNo({
      centreId: query.centreId,
      centreName: query.centre || query.centreName,
      academicYearId: query.academicYearId,
      academicYearName: query.academicYear || query.yearName,
      trackId: query.trackId,
      trackName: query.trackName,
      standardId: query.standardId,
      standardName: query.classLevel || query.standardName,
      batchId: query.batchId,
      batchName: query.division || query.batchName,
    });
  }

  async createStudent(data: any, currentUser?: any) {
    try {
      // 1. Fetch related entities based on provided string names
      const role = await this.prisma.role.findUnique({ where: { name: 'STUDENT' } });
      if (!role) throw new NotFoundException('STUDENT role not found. Please run seed script.');

      const centre = await this.prisma.centre.findFirst({ where: { name: data.centre } });
      if (!centre) throw new NotFoundException(`Centre "${data.centre}" not found.`);

      if (currentUser && !isSuperAdmin(currentUser)) {
        assertCentreAccess(currentUser, centre.id);
      }

      const year = await this.prisma.academicYear.findUnique({ where: { name: data.academicYear } });
      if (!year) throw new NotFoundException(`Academic Year "${data.academicYear}" not found.`);

      const board = await this.prisma.board.findUnique({ where: { name: data.board } });
      if (!board) throw new NotFoundException(`Board "${data.board}" not found.`);

      const standard = await this.prisma.standard.findFirst({
        where: {
          name: data.classLevel,
          OR: [
            { boardId: board.id },
            { boards: { some: { boardId: board.id } } },
          ],
        },
      });
      if (!standard) throw new NotFoundException(`Class "${data.classLevel}" not found.`);

      // 2. Find or create the Batch
      const batchName = data.division || 'Default Batch';
      let batch = await this.prisma.batch.findFirst({
        where: {
          name: batchName,
          academicYearId: year.id,
          boardId: board.id,
          standardId: standard.id,
          centreId: centre.id,
        }
      });

      if (!batch) {
        batch = await this.prisma.batch.create({
          data: {
            name: batchName,
            academicYearId: year.id,
            boardId: board.id,
            standardId: standard.id,
            centreId: centre.id,
          }
        });
      }

      // 3. Generate credentials (Default to standard known password 'password123' if not provided)
      const email = data.email || `student.${Date.now()}@educare.com`;
      const tempPassword = (typeof data.password === 'string' && data.password.trim().length > 0)
        ? data.password.trim()
        : (process.env.DEFAULT_STUDENT_PASSWORD || 'password123');
      const password = await argon2.hash(tempPassword);

      // 4. Create User, StudentProfile, and Enrollment in a transaction
      const newStudent = await this.prisma.$transaction(async (prisma) => {
        const user = await prisma.user.create({
          data: {
            email,
            password,
            firstName: data.name ? data.name.split(' ')[0] : 'New',
            lastName: data.name ? data.name.split(' ').slice(1).join(' ') : 'Student',
            roleId: role.id,
          }
        });

        // Ensure admissionNo is clean, institutional, and never populated with an email address or autofill string
        const rawAdmNo = typeof data.admissionNo === 'string' ? data.admissionNo.trim() : '';
        const isEmailOrAutofill = rawAdmNo.includes('@') || /admin/i.test(rawAdmNo) || /educare/i.test(rawAdmNo);
        const isValidAdmissionNo = rawAdmNo !== '' && rawAdmNo !== 'ADM-999' && !isEmailOrAutofill;

        let admissionNo = rawAdmNo;
        if (!isValidAdmissionNo) {
          let trackName = '';
          if (data.trackId) {
            const t = await prisma.targetTrack.findUnique({
              where: { id: data.trackId },
              select: { name: true },
            });
            if (t) trackName = t.name;
          }

          const generated = await this.generateNextAdmissionNo(
            {
              centreId: centre.id,
              centreName: centre.name,
              academicYearId: year.id,
              academicYearName: year.name,
              trackId: data.trackId,
              trackName,
              standardId: standard.id,
              standardName: standard.name,
              batchId: batch.id,
              batchName: batch.name,
            },
            prisma,
          );
          admissionNo = generated.admissionNo;
        }

        const profile = await prisma.studentProfile.create({
          data: {
            userId: user.id,
            admissionNo,
            parentName: data.parentName,
            parentEmail: data.parentEmail,
            parentPhone: data.parentPhone,
            bloodGroup: data.bloodGroup,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            address: data.address,
            parentOccupation: data.parentOccupation || null,
          }
        });

        const enrollment = await prisma.enrollment.create({
          data: {
            studentProfileId: profile.id,
            batchId: batch.id,
            trackId: data.trackId || null,
            ...(data.subjectIds && data.subjectIds.length > 0 && {
               subjects: { connect: data.subjectIds.map((id: string) => ({ id })) }
            })
          }
        });

        // Link User to Centre
        await prisma.userCentre.create({
          data: {
            userId: user.id,
            centreId: centre.id,
          }
        });

        const { password: _pwd, ...safeUser } = user;
        return { user: safeUser, profile, enrollment, batch };
      });

      if (newStudent?.user?.id && typeof this.redisService?.setMustChangePassword === 'function') {
        await this.redisService.setMustChangePassword(newStudent.user.id);
      }

      return newStudent;
    } catch (error: any) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error creating student:', error);
      throw new InternalServerErrorException(error.message || 'Failed to create student');
    }
  }

  async searchStudents(query: string, user?: any) {
    if (!query || query.length < 2) return [];
    
    const where: any = {
      user: { status: 'ACTIVE' },
      OR: [
        { admissionNo: { contains: query, mode: 'insensitive' } },
        { user: { firstName: { contains: query, mode: 'insensitive' } } },
        { user: { lastName: { contains: query, mode: 'insensitive' } } },
      ]
    };

    if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
      where.enrollments = {
        some: {
          batch: {
            centreId: { in: userCentres }
          }
        }
      };
    }

    return this.prisma.studentProfile.findMany({
      where,
      include: {
        user: { select: SAFE_USER_SELECT },
        enrollments: { 
          include: { 
            batch: true,
            subjects: true,
            track: true 
          } 
        }
      },
      take: 10
    });
  }

  async getStudentById(id: string, user?: any) {
    let student = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: { select: SAFE_USER_SELECT },
        enrollments: {
          include: {
            batch: {
              include: {
                academicYear: true,
                board: true,
                standard: true,
                centre: true,
              }
            },
            subjects: true,
            track: true
          }
        }
      }
    });

    if (!student) {
      student = await this.prisma.studentProfile.findUnique({
        where: { userId: id },
        include: {
          user: { select: SAFE_USER_SELECT },
          enrollments: {
            include: {
              batch: {
                include: {
                  academicYear: true,
                  board: true,
                  standard: true,
                  centre: true,
                }
              },
              subjects: true,
              track: true
            }
          }
        }
      });
    }

    if (!student) throw new NotFoundException('Student not found');

    const isStudent = user?.role?.name === 'STUDENT' || user?.role === 'STUDENT';
    if (isStudent && user?.id) {
      if (student.userId !== user.id) {
        throw new ForbiddenException('Access denied');
      }
    } else if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
      const studentCentres = student.enrollments.map(e => e.batch?.centreId).filter(Boolean);
      const hasCentreOverlap = studentCentres.some(cId => userCentres.includes(cId));
      if (!hasCentreOverlap) {
        throw new ForbiddenException('Student does not belong to your centre');
      }
    }

    return student;
  }

  async getStudentByUserId(userId: string, user?: any) {
    return this.getStudentById(userId, user);
  }

  async getStudents(user?: any) {
    const where: any = {
      user: { status: 'ACTIVE' }
    };

    if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
      where.enrollments = {
        some: {
          batch: {
            centreId: { in: userCentres }
          }
        }
      };
    }

    return this.prisma.studentProfile.findMany({
      where,
      include: {
        user: { select: SAFE_USER_SELECT },
        enrollments: {
          include: {
            batch: {
              include: {
                academicYear: true,
                board: true,
                standard: true,
                centre: true,
              }
            },
            subjects: true,
            track: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateStudent(id: string, data: any, user?: any) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: { select: SAFE_USER_SELECT },
        enrollments: { include: { batch: true } }
      }
    });
    if (!profile) throw new NotFoundException('Student not found');

    if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
      const studentCentres = profile.enrollments.map(e => e.batch?.centreId).filter(Boolean);
      if (!studentCentres.some(cId => userCentres.includes(cId))) {
        throw new ForbiddenException('Cannot edit student from another centre');
      }
    }

    const centre = data.centre
      ? await this.prisma.centre.findFirst({
          where: {
            OR: [
              { id: data.centre },
              { name: { equals: data.centre, mode: 'insensitive' } },
            ],
          },
        })
      : null;
    if (centre && user && !isSuperAdmin(user)) {
      assertCentreAccess(user, centre.id);
    }

    const year = data.academicYear
      ? await this.prisma.academicYear.findFirst({
          where: {
            OR: [
              { id: data.academicYear },
              { name: { equals: data.academicYear, mode: 'insensitive' } },
            ],
          },
        })
      : null;

    const board = data.board
      ? await this.prisma.board.findFirst({
          where: {
            OR: [
              { id: data.board },
              { name: { equals: data.board, mode: 'insensitive' } },
            ],
          },
        })
      : null;

    const standard = data.classLevel
      ? await this.prisma.standard.findFirst({
          where: {
            name: { equals: data.classLevel, mode: 'insensitive' },
            ...(board
              ? {
                  OR: [
                    { boardId: board.id },
                    { boards: { some: { boardId: board.id } } },
                  ],
                }
              : {}),
          },
        }) || await this.prisma.standard.findFirst({
          where: {
            OR: [
              { id: data.classLevel },
              { name: { equals: data.classLevel, mode: 'insensitive' } },
            ],
          },
        })
      : null;

    const existingEnrollment = profile.enrollments?.[0];
    const existingBatch = existingEnrollment?.batch;

    const effectiveYearId = year?.id || existingBatch?.academicYearId;
    const effectiveBoardId = board?.id || existingBatch?.boardId;
    const effectiveStandardId = standard?.id || existingBatch?.standardId;
    const effectiveCentreId = centre?.id || existingBatch?.centreId;

    let batch = null;
    if (effectiveCentreId && effectiveYearId && effectiveBoardId && effectiveStandardId) {
      const batchName = data.division || existingBatch?.name || 'Default Batch';
      batch = await this.prisma.batch.findFirst({
        where: {
          name: batchName,
          academicYearId: effectiveYearId,
          boardId: effectiveBoardId,
          standardId: effectiveStandardId,
          centreId: effectiveCentreId,
        },
      });
      if (!batch) {
        batch = await this.prisma.batch.create({
          data: {
            name: batchName,
            academicYearId: effectiveYearId,
            boardId: effectiveBoardId,
            standardId: effectiveStandardId,
            centreId: effectiveCentreId,
          },
        });
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      let passwordHash: string | undefined = undefined;
      if (typeof data.password === 'string' && data.password.trim().length > 0) {
        passwordHash = await argon2.hash(data.password.trim());
      }

      if (data.name || data.email || passwordHash) {
        await prisma.user.update({
          where: { id: profile.userId },
          data: {
            email: data.email || undefined,
            firstName: data.name ? data.name.split(' ')[0] : undefined,
            lastName: data.name ? data.name.split(' ').slice(1).join(' ') : undefined,
            ...(passwordHash && { password: passwordHash }),
          }
        });

        if (passwordHash && typeof this.redisService?.setMustChangePassword === 'function') {
          await this.redisService.setMustChangePassword(profile.userId);
        }
      }

      const rawUpdateAdmNo = typeof data.admissionNo === 'string' ? data.admissionNo.trim() : '';
      const isUpdateEmailOrAutofill = rawUpdateAdmNo.includes('@') || /admin/i.test(rawUpdateAdmNo) || /educare/i.test(rawUpdateAdmNo);
      const isValidUpdateAdmNo = rawUpdateAdmNo !== '' && !isUpdateEmailOrAutofill;

      const effectiveParentPhone = data.parentPhone || data.phone || undefined;

      const updatedProfile = await prisma.studentProfile.update({
        where: { id },
        data: {
          admissionNo: isValidUpdateAdmNo ? rawUpdateAdmNo : undefined,
          parentName: data.parentName || undefined,
          parentEmail: data.parentEmail || undefined,
          parentPhone: effectiveParentPhone,
          bloodGroup: data.bloodGroup || undefined,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          address: data.address || undefined,
          parentOccupation: data.parentOccupation || undefined,
        }
      });

      if (batch || data.trackId !== undefined || data.subjectIds !== undefined) {
        const enrollment = await prisma.enrollment.findFirst({ where: { studentProfileId: id } });
        if (enrollment) {
          const updateData: any = {};
          if (batch) updateData.batchId = batch.id;
          if (data.trackId !== undefined) updateData.trackId = data.trackId || null;
          if (data.subjectIds !== undefined) {
            updateData.subjects = {
              set: data.subjectIds.map((id: string) => ({ id }))
            };
          }
          
          await prisma.enrollment.update({
            where: { id: enrollment.id },
            data: updateData
          });
        } else if (batch) {
          await prisma.enrollment.create({
            data: {
              studentProfileId: id,
              batchId: batch.id,
              trackId: data.trackId || null,
              ...(data.subjectIds && data.subjectIds.length > 0 ? {
                subjects: {
                  connect: data.subjectIds.map((id: string) => ({ id }))
                }
              } : {}),
            }
          });
        }
      }

      if (centre) {
        await prisma.userCentre.deleteMany({ where: { userId: profile.userId } });
        await prisma.userCentre.create({ data: { userId: profile.userId, centreId: centre.id } });
      }

      return await prisma.studentProfile.findUnique({
        where: { id },
        include: {
          user: { select: SAFE_USER_SELECT },
          enrollments: {
            include: {
              batch: {
                include: { academicYear: true, board: true, standard: true, centre: true }
              },
              track: true,
              subjects: true,
            }
          }
        }
      });
    });
  }

  async deleteStudent(id: string, user?: any) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: { enrollments: { include: { batch: true } } }
    });
    if (!profile) throw new NotFoundException('Student not found');
    
    if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
      const studentCentres = profile.enrollments.map(e => e.batch?.centreId).filter(Boolean);
      if (!studentCentres.some(cId => userCentres.includes(cId))) {
        throw new ForbiddenException('Cannot delete student from another centre');
      }
    }

    // Soft delete by marking user as inactive
    await this.prisma.user.update({
      where: { id: profile.userId },
      data: { status: 'INACTIVE' }
    });
    await this.redisService.revokeAllSessions(profile.userId);
    return { success: true };
  }

  async toggleStatus(id: string, status: 'ACTIVE' | 'INACTIVE', user?: any) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: { enrollments: { include: { batch: true } } }
    });
    if (!profile) throw new NotFoundException('Student not found');
    
    if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
      const studentCentres = profile.enrollments.map(e => e.batch?.centreId).filter(Boolean);
      if (!studentCentres.some(cId => userCentres.includes(cId))) {
        throw new ForbiddenException('Cannot alter student status for another centre');
      }
    }

    await this.prisma.user.update({
      where: { id: profile.userId },
      data: { status }
    });
    if (status === 'INACTIVE') {
      await this.redisService.revokeAllSessions(profile.userId);
    }
    return { success: true, status };
  }

  async resetStudentPassword(id: string, newPassword?: string, user?: any) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: { select: SAFE_USER_SELECT },
        enrollments: { include: { batch: true } }
      }
    });
    if (!profile) throw new NotFoundException('Student not found');

    if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
      const studentCentres = profile.enrollments.map(e => e.batch?.centreId).filter(Boolean);
      if (!studentCentres.some(cId => userCentres.includes(cId))) {
        throw new ForbiddenException('Cannot reset password for student from another centre');
      }
    }

    const rawPassword = (typeof newPassword === 'string' && newPassword.trim().length > 0)
      ? newPassword.trim()
      : (process.env.DEFAULT_STUDENT_PASSWORD || 'password123');

    const hashedPassword = await argon2.hash(rawPassword);

    await this.prisma.user.update({
      where: { id: profile.userId },
      data: { password: hashedPassword }
    });

    if (typeof this.redisService?.setMustChangePassword === 'function') {
      await this.redisService.setMustChangePassword(profile.userId);
    }
    if (typeof this.redisService?.revokeAllSessions === 'function') {
      await this.redisService.revokeAllSessions(profile.userId);
    }

    return {
      success: true,
      message: `Password reset successfully. Default password is now set for this student.`,
      email: profile.user?.email,
      mustChangePassword: true,
    };
  }

  async getTodayBirthdays(user?: any) {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    
    if (user && !isSuperAdmin(user)) {
      let userCentres: string[] = [];
      const roleName = typeof user.role === 'string' ? user.role : user.role?.name;
      const normalizedRole = String(roleName || '').toUpperCase().replace(/[\s_]+/g, '_');

      if (normalizedRole === 'STUDENT') {
        const student = await this.prisma.studentProfile.findUnique({
          where: { userId: user.id },
          include: { enrollments: { include: { batch: true } } }
        });
        userCentres = (student?.enrollments || []).map(e => e.batch?.centreId).filter(Boolean) as string[];
      } else {
        userCentres = getUserCentreIds(user);
      }

      if (userCentres.length === 0) {
        return [];
      }

      return this.prisma.$queryRaw`
        SELECT u."firstName", u."lastName", p."admissionNo", s."name" as "classLevel"
        FROM "student_profiles" p
        JOIN "users" u ON u.id = p."userId"
        JOIN "enrollments" e ON e."studentProfileId" = p.id
        JOIN "batches" b ON b.id = e."batchId"
        JOIN "standards" s ON s.id = b."standardId"
        WHERE EXTRACT(MONTH FROM p."dateOfBirth") = ${month}
        AND EXTRACT(DAY FROM p."dateOfBirth") = ${day}
        AND b."centreId" = ANY(${userCentres})
      `;
    }

    return this.prisma.$queryRaw`
      SELECT u."firstName", u."lastName", p."admissionNo", s."name" as "classLevel"
      FROM "student_profiles" p
      JOIN "users" u ON u.id = p."userId"
      JOIN "enrollments" e ON e."studentProfileId" = p.id
      JOIN "batches" b ON b.id = e."batchId"
      JOIN "standards" s ON s.id = b."standardId"
      WHERE EXTRACT(MONTH FROM p."dateOfBirth") = ${month}
      AND EXTRACT(DAY FROM p."dateOfBirth") = ${day}
    `;
  }
}

