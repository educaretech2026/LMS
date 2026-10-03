import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async createStudent(data: any) {
    try {
      // 1. Fetch related entities based on provided string names
      const role = await this.prisma.role.findUnique({ where: { name: 'STUDENT' } });
      if (!role) throw new NotFoundException('STUDENT role not found. Please run seed script.');

      const centre = await this.prisma.centre.findFirst({ where: { name: data.centre } });
      if (!centre) throw new NotFoundException(`Centre "${data.centre}" not found.`);

      const year = await this.prisma.academicYear.findUnique({ where: { name: data.academicYear } });
      if (!year) throw new NotFoundException(`Academic Year "${data.academicYear}" not found.`);

      const board = await this.prisma.board.findUnique({ where: { name: data.board } });
      if (!board) throw new NotFoundException(`Board "${data.board}" not found.`);

      const standard = await this.prisma.standard.findUnique({ where: { name_boardId: { name: data.classLevel, boardId: board.id } } });
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

      // 3. Generate credentials
      const email = data.email || `student.${Date.now()}@educare.com`;
      const password = await argon2.hash(data.password || 'password123');

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

        return { user, profile, enrollment, batch };
      });

      return newStudent;
    } catch (error: any) {
      console.error('Error creating student:', error);
      throw new InternalServerErrorException(error.message || 'Failed to create student');
    }
  }

  async searchStudents(query: string) {
    if (!query || query.length < 2) return [];
    
    return this.prisma.studentProfile.findMany({
      where: {
        user: { status: 'ACTIVE' },
        OR: [
          { admissionNo: { contains: query, mode: 'insensitive' } },
          { user: { firstName: { contains: query, mode: 'insensitive' } } },
          { user: { lastName: { contains: query, mode: 'insensitive' } } },
        ]
      },
      include: {
        user: true,
        enrollments: { 
          include: { 
            batch: true,
            subjects: true 
          } 
        }
      },
      take: 10
    });
  }

  async getStudentById(id: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: true,
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
            subjects: true
          }
        }
      }
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async getStudents() {
    return this.prisma.studentProfile.findMany({
      where: {
        user: { status: 'ACTIVE' }
      },
      include: {
        user: true,
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
            subjects: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateStudent(id: string, data: any) {
    const profile = await this.prisma.studentProfile.findUnique({ where: { id }, include: { user: true } });
    if (!profile) throw new NotFoundException('Student not found');

    const centre = data.centre ? await this.prisma.centre.findFirst({ where: { name: data.centre } }) : null;
    const year = data.academicYear ? await this.prisma.academicYear.findUnique({ where: { name: data.academicYear } }) : null;
    const board = data.board ? await this.prisma.board.findUnique({ where: { name: data.board } }) : null;
    const standard = (data.classLevel && board) ? await this.prisma.standard.findUnique({ where: { name_boardId: { name: data.classLevel, boardId: board.id } } }) : null;

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

  async deleteStudent(id: string) {
    const profile = await this.prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Student not found');
    
    // Soft delete by marking user as inactive
    await this.prisma.user.update({
      where: { id: profile.userId },
      data: { status: 'INACTIVE' }
    });
    return { success: true };
  }

  async toggleStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id },
      select: { userId: true }
    });
    if (!profile) throw new NotFoundException('Student not found');
    
    await this.prisma.user.update({
      where: { id: profile.userId },
      data: { status }
    });
    return { success: true, status };
  }
  async getTodayBirthdays() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    
    // Using raw query for PostgreSQL date extraction
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
