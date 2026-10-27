import { Injectable, NotFoundException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { assertCentreAccess, isSuperAdmin, getUserCentreIds, getAuthorizedCentreIds, SAFE_USER_SELECT } from '../common/utils/tenant.util';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

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

      // 3. Generate credentials (SEC-07: Cryptographically secure temporary password if not provided)
      const email = data.email || `student.${Date.now()}@educare.com`;
      const tempPassword = data.password || crypto.randomBytes(8).toString('hex');
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

        const profile = await prisma.studentProfile.create({
          data: {
            userId: user.id,
            admissionNo: data.admissionNo && data.admissionNo !== "ADM-999" ? data.admissionNo : `${centre.code || 'ADM'}-${Date.now().toString().slice(-5)}`,
            parentName: data.parentName,
            parentEmail: data.parentEmail,
            parentPhone: data.parentPhone,
            bloodGroup: data.bloodGroup,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            address: data.address,
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

    const centre = data.centre ? await this.prisma.centre.findFirst({ where: { name: data.centre } }) : null;
    if (centre && user && !isSuperAdmin(user)) {
      assertCentreAccess(user, centre.id);
    }

    const year = data.academicYear ? await this.prisma.academicYear.findUnique({ where: { name: data.academicYear } }) : null;
    const board = data.board ? await this.prisma.board.findUnique({ where: { name: data.board } }) : null;
    const standard = (data.classLevel && board)
      ? await this.prisma.standard.findFirst({
          where: {
            name: data.classLevel,
            OR: [
              { boardId: board.id },
              { boards: { some: { boardId: board.id } } },
            ],
          },
        })
      : null;

    let batch = null;
    if (centre && year && board && standard) {
      const batchName = data.division || 'Default Batch';
      batch = await this.prisma.batch.findFirst({
        where: { name: batchName, academicYearId: year.id, boardId: board.id, standardId: standard.id, centreId: centre.id }
      });
      if (!batch) {
        batch = await this.prisma.batch.create({
          data: { name: batchName, academicYearId: year.id, boardId: board.id, standardId: standard.id, centreId: centre.id }
        });
      }
    }

    return this.prisma.$transaction(async (prisma) => {
      if (data.name || data.email) {
        await prisma.user.update({
          where: { id: profile.userId },
          data: {
            email: data.email || undefined,
            firstName: data.name ? data.name.split(' ')[0] : undefined,
            lastName: data.name ? data.name.split(' ').slice(1).join(' ') : undefined,
          }
        });
      }

      const updatedProfile = await prisma.studentProfile.update({
        where: { id },
        data: {
          admissionNo: data.admissionNo || undefined,
          parentName: data.parentName || undefined,
          parentEmail: data.parentEmail || undefined,
          parentPhone: data.parentPhone || undefined,
          bloodGroup: data.bloodGroup || undefined,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          address: data.address || undefined,
        }
      });

      if (batch || data.trackId) {
        const enrollment = await prisma.enrollment.findFirst({ where: { studentProfileId: id } });
        if (enrollment) {
          const updateData: any = {};
          if (batch) updateData.batchId = batch.id;
          if (data.trackId) updateData.trackId = data.trackId;
          if (data.subjectIds !== undefined) {
            updateData.subjects = {
              set: data.subjectIds.map((id: string) => ({ id }))
            };
          }
          
          await prisma.enrollment.update({
            where: { id: enrollment.id },
            data: updateData
          });
        }
      }

      if (centre) {
        await prisma.userCentre.deleteMany({ where: { userId: profile.userId } });
        await prisma.userCentre.create({ data: { userId: profile.userId, centreId: centre.id } });
      }

      return updatedProfile;
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

  async getTodayBirthdays(user?: any) {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    
    if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
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

