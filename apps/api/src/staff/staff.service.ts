import { Injectable, NotFoundException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { assertCentreAccess, isSuperAdmin, getUserCentreIds, getAuthorizedCentreIds, SAFE_USER_SELECT } from '../common/utils/tenant.util';

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async createStaff(data: any, currentUser?: any) {
    try {
      const roleName = data.role;
      const role = await this.prisma.role.findUnique({ where: { name: roleName } });
      if (!role) throw new NotFoundException(`Role "${roleName}" not found.`);

      const centre = await this.prisma.centre.findFirst({ where: { name: data.centre } });
      if (!centre) throw new NotFoundException(`Centre "${data.centre}" not found.`);

      if (currentUser && !isSuperAdmin(currentUser)) {
        assertCentreAccess(currentUser, centre.id);
      }

      // 3. Generate credentials (SEC-07: Cryptographically secure temporary password)
      const email = data.email || `staff.${Date.now()}@educare.com`;
      const tempPassword = data.password || crypto.randomBytes(8).toString('hex');
      const password = await argon2.hash(tempPassword);

      // 4. Create User, TeacherProfile, and UserCentre in a transaction
      const newStaff = await this.prisma.$transaction(async (prisma) => {
        const user = await prisma.user.create({
          data: {
            email,
            password,
            firstName: data.name ? data.name.split(' ')[0] : 'New',
            lastName: data.name ? data.name.split(' ').slice(1).join(' ') : 'Staff',
            roleId: role.id,
          }
        });

        let profile = null;
        if (roleName === 'TEACHER' || (Array.isArray(data.assignments) && data.assignments.length > 0)) {
          profile = await prisma.teacherProfile.create({
            data: {
              userId: user.id,
              qualification: data.qualification || '',
              experience: data.experience || 0,
            }
          });

          if (Array.isArray(data.assignments) && data.assignments.length > 0) {
            for (const a of data.assignments) {
              const combinedClassesStr = a.combinedClasses || (Array.isArray(a.classes) ? a.classes.join(', ') : (a.classLevel || ''));
              const isCombined = Boolean(a.isCombined || (Array.isArray(a.classes) && a.classes.length > 1) || (a.classLevel && a.classLevel.includes(',')));

              let academicYearId: string | undefined;
              if (a.academicYear) {
                const ay = await prisma.academicYear.findFirst({ where: { name: a.academicYear } });
                if (ay) academicYearId = ay.id;
              }

              let boardId: string | undefined;
              if (a.board) {
                const b = await prisma.board.findFirst({ where: { name: a.board } });
                if (b) boardId = b.id;
              }

              let subjectId: string | undefined;
              if (a.subject) {
                const sub = await prisma.subject.findFirst({ where: { name: a.subject } });
                if (sub) subjectId = sub.id;
              }

              let standardId: string | undefined;
              if (a.classLevel && !isCombined) {
                const std = await prisma.standard.findFirst({ where: { name: a.classLevel } });
                if (std) standardId = std.id;
              }

              await prisma.teacherAssignment.create({
                data: {
                  teacherProfileId: profile.id,
                  academicYearId,
                  boardId,
                  subjectId,
                  standardId,
                  academicYearName: a.academicYear || '',
                  boardName: a.board || '',
                  subjectName: a.subject || '',
                  division: a.division || 'Division A',
                  isCombined,
                  combinedClasses: combinedClassesStr,
                }
              });
            }
          }
        }

        // Link User to Centre
        await prisma.userCentre.create({
          data: {
            userId: user.id,
            centreId: centre.id,
          }
        });

        const { password: _pwd, ...safeUser } = user;
        return { user: safeUser, profile };
      });

      return newStaff;
    } catch (error: any) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error creating staff:', error);
      throw new InternalServerErrorException(error.message || 'Failed to create staff');
    }
  }

  async getStaff(currentUser?: any) {
    const where: any = {
      role: {
        name: {
          notIn: ['STUDENT', 'PUBLIC_LEARNER', 'SUPER_ADMIN']
        }
      }
    };

    if (currentUser && !isSuperAdmin(currentUser)) {
      const userCentres = getAuthorizedCentreIds(currentUser);
      where.userCentres = {
        some: {
          centreId: { in: userCentres }
        }
      };
    }

    return this.prisma.user.findMany({
      where,
      select: {
        ...SAFE_USER_SELECT,
        teacherProfile: {
          include: {
            assignments: {
              include: {
                board: true,
                standard: true,
                subject: true,
                academicYear: true,
              }
            }
          }
        },
        userCentres: {
          include: {
            centre: true
          }
        },
        role: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateStaff(userId: string, data: any, currentUser?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userCentres: true }
    });
    if (!user) throw new NotFoundException('Staff not found');

    if (currentUser && !isSuperAdmin(currentUser)) {
      const userCentres = getAuthorizedCentreIds(currentUser);
      const staffCentres = user.userCentres.map(uc => uc.centreId);
      if (!staffCentres.some(cId => userCentres.includes(cId))) {
        throw new ForbiddenException('Cannot edit staff from another centre');
      }
    }

    const centre = data.centre ? await this.prisma.centre.findFirst({ where: { name: data.centre } }) : null;
    if (centre && currentUser && !isSuperAdmin(currentUser)) {
      assertCentreAccess(currentUser, centre.id);
    }

    return this.prisma.$transaction(async (prisma) => {
      let roleId = user.roleId;
      if (data.role) {
        const role = await prisma.role.findUnique({ where: { name: data.role } });
        if (role) roleId = role.id;
        else throw new NotFoundException(`Role "${data.role}" not found`);
      }

      const updateData: any = {
        email: data.email || undefined,
        firstName: data.name ? data.name.split(' ')[0] : undefined,
        lastName: data.name ? data.name.split(' ').slice(1).join(' ') : undefined,
        roleId,
        status: data.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE',
      };

      if (data.password) {
        updateData.password = await argon2.hash(data.password);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData
      });

      if (centre) {
        await prisma.userCentre.deleteMany({ where: { userId } });
        await prisma.userCentre.create({ data: { userId, centreId: centre.id } });
      }

      if (Array.isArray(data.assignments)) {
        let profile = await prisma.teacherProfile.findUnique({ where: { userId } });
        if (!profile) {
          profile = await prisma.teacherProfile.create({
            data: {
              userId,
              qualification: data.qualification || '',
              experience: data.experience || 0,
            }
          });
        }

        await prisma.teacherAssignment.deleteMany({
          where: { teacherProfileId: profile.id }
        });

        for (const a of data.assignments) {
          const combinedClassesStr = a.combinedClasses || (Array.isArray(a.classes) ? a.classes.join(', ') : (a.classLevel || ''));
          const isCombined = Boolean(a.isCombined || (Array.isArray(a.classes) && a.classes.length > 1) || (a.classLevel && a.classLevel.includes(',')));

          let academicYearId: string | undefined;
          if (a.academicYear) {
            const ay = await prisma.academicYear.findFirst({ where: { name: a.academicYear } });
            if (ay) academicYearId = ay.id;
          }

          let boardId: string | undefined;
          if (a.board) {
            const b = await prisma.board.findFirst({ where: { name: a.board } });
            if (b) boardId = b.id;
          }

          let subjectId: string | undefined;
          if (a.subject) {
            const sub = await prisma.subject.findFirst({ where: { name: a.subject } });
            if (sub) subjectId = sub.id;
          }

          let standardId: string | undefined;
          if (a.classLevel && !isCombined) {
            const std = await prisma.standard.findFirst({ where: { name: a.classLevel } });
            if (std) standardId = std.id;
          }

          await prisma.teacherAssignment.create({
            data: {
              teacherProfileId: profile.id,
              academicYearId,
              boardId,
              subjectId,
              standardId,
              academicYearName: a.academicYear || '',
              boardName: a.board || '',
              subjectName: a.subject || '',
              division: a.division || 'Division A',
              isCombined,
              combinedClasses: combinedClassesStr,
            }
          });
        }
      }

      const { password: _pwd, ...safeUpdatedUser } = updatedUser;
      if (data.status === 'Inactive') {
        await this.redisService.revokeAllSessions(userId);
      }
      return safeUpdatedUser;
    });
  }

  async deleteStaff(userId: string, currentUser?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userCentres: true }
    });
    if (!user) throw new NotFoundException('Staff not found');

    if (currentUser && !isSuperAdmin(currentUser)) {
      const userCentres = getAuthorizedCentreIds(currentUser);
      const staffCentres = user.userCentres.map(uc => uc.centreId);
      if (!staffCentres.some(cId => userCentres.includes(cId))) {
        throw new ForbiddenException('Cannot delete staff from another centre');
      }
    }
    
    const result = await this.prisma.$transaction(async (prisma) => {
      await prisma.userCentre.deleteMany({ where: { userId } });
      await prisma.teacherProfile.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
      return { success: true };
    });

    await this.redisService.revokeAllSessions(userId);
    return result;
  }
}
