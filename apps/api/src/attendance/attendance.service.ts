import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AttendanceStatus } from '@educare/database';
import { isSuperAdmin, getAuthorizedCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async getBatchStudents(batchId?: string, subjectId?: string, user?: any) {
    let students: any[];
    if (batchId && batchId !== 'ALL') {
      if (user && !isSuperAdmin(user)) {
        const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
        if (batch?.centreId) {
          assertCentreAccess(user, batch.centreId);
        }
      }

      const enrollments = await this.prisma.enrollment.findMany({
        where: { 
          batchId,
          ...(subjectId && { subjects: { some: { id: subjectId } } })
        },
        include: {
          studentProfile: {
            include: {
              user: { select: { firstName: true, lastName: true, id: true } }
            }
          }
        }
      });
      students = enrollments.map(e => e.studentProfile);
    } else {
      if (user && !isSuperAdmin(user)) {
        const authorizedCentres = getAuthorizedCentreIds(user);
        const enrollments = await this.prisma.enrollment.findMany({
          where: {
            batch: {
              centreId: { in: authorizedCentres }
            },
            ...(subjectId && { subjects: { some: { id: subjectId } } })
          },
          include: {
            studentProfile: {
              include: {
                user: { select: { firstName: true, lastName: true, id: true } }
              }
            }
          }
        });
        students = enrollments.map(e => e.studentProfile);
      } else {
        students = await this.prisma.studentProfile.findMany({
          include: {
            user: { select: { firstName: true, lastName: true, id: true } }
          }
        });
      }
    }

    return students.map(s => ({
      studentId: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      admissionNo: s.admissionNo
    }));
  }

  async getStudentAttendance(userId: string) {
    const studentProfile = await this.prisma.studentProfile.findFirst({
      where: { userId }
    });
    if (!studentProfile) {
      return [];
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId: studentProfile.id },
      include: {
        attendance: {
          include: {
            batch: { select: { name: true } },
            subject: { select: { name: true } }
          }
        }
      },
      orderBy: {
        attendance: { date: 'desc' }
      }
    });

    return records.map(r => ({
      id: r.id,
      status: r.status,
      remarks: r.remarks,
      date: r.attendance?.date,
      batch: r.attendance?.batch,
      subject: r.attendance?.subject,
    }));
  }

  async getAttendanceForBatchAndDate(batchId: string | undefined, date: string, subjectId?: string, user?: any) {
    if (batchId && batchId !== 'ALL' && user && !isSuperAdmin(user)) {
      const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
      if (batch?.centreId) {
        assertCentreAccess(user, batch.centreId);
      }
    }

    const targetDate = new Date(date);
    
    return this.prisma.attendance.findFirst({
      where: {
        batchId: (batchId && batchId !== 'ALL') ? batchId : null,
        date: targetDate,
        subjectId: subjectId || null
      },
      include: {
        records: true,
        recordedBy: { select: { firstName: true, lastName: true } }
      }
    });
  }

  async resolveBatchId(centreId: string, boardId: string, standardId: string, trackId: string) {
    let batch = await this.prisma.batch.findFirst({
      where: { centreId, boardId, standardId, trackId }
    });
    if (!batch) {
      // Create a default batch for these dimensions so we can link attendance to it
      // Find any active academic year
      const ay = await this.prisma.academicYear.findFirst({ where: { isActive: true } }) || await this.prisma.academicYear.findFirst();
      if (!ay) throw new BadRequestException("No academic year found");
      
      batch = await this.prisma.batch.create({
        data: {
          name: `Default Batch - ${trackId}`,
          academicYearId: ay.id,
          boardId,
          standardId,
          centreId,
          trackId: trackId
        }
      });
    }
    return batch.id;
  }

  async getBatches(centreId: string, boardId: string, standardId: string, trackId: string, user?: any) {
    if (user && !isSuperAdmin(user)) {
      assertCentreAccess(user, centreId);
    }
    return this.prisma.batch.findMany({
      where: { centreId, boardId, standardId, trackId }
    });
  }

  async getStudentsByFilter(centreId: string, boardId: string, standardId: string, trackId: string, user?: any) {
    if (user && !isSuperAdmin(user)) {
      assertCentreAccess(user, centreId);
    }
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        batch: { centreId, boardId, standardId, trackId }
      },
      include: {
        studentProfile: {
          include: { user: { select: { firstName: true, lastName: true, id: true } } }
        }
      }
    });

    return enrollments.map(e => ({
      studentId: e.studentProfileId,
      name: `${e.studentProfile.user.firstName} ${e.studentProfile.user.lastName}`,
      admissionNo: e.studentProfile.admissionNo
    }));
  }

  async getAttendanceByFilter(centreId: string, boardId: string, standardId: string, trackId: string, date: string, user?: any) {
    if (user && !isSuperAdmin(user)) {
      assertCentreAccess(user, centreId);
    }
    const targetDate = new Date(date);
    const batch = await this.prisma.batch.findFirst({
      where: { centreId, boardId, standardId, trackId }
    });
    
    if (!batch) return null;

    return this.prisma.attendance.findFirst({
      where: { batchId: batch.id, date: targetDate },
      include: {
        records: true,
        recordedBy: { select: { firstName: true, lastName: true } }
      }
    });
  }

  async markAttendance(data: any, user: any) {
    const userId = typeof user === 'string' ? user : user?.id;
    const { batchId, date, records, centreId, boardId, standardId, trackId, subjectId } = data;
    const targetDate = new Date(date);

    if (user && typeof user !== 'string' && !isSuperAdmin(user)) {
      if (centreId) {
        assertCentreAccess(user, centreId);
      }
      if (batchId && batchId !== 'ALL') {
        const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
        if (batch?.centreId) {
          assertCentreAccess(user, batch.centreId);
        }
      }
    }
    
    let resolvedBatchId = batchId;
    if (batchId === 'ALL') {
      resolvedBatchId = null;
    } else if (!batchId && centreId && boardId && standardId && trackId) {
      resolvedBatchId = await this.resolveBatchId(centreId, boardId, standardId, trackId);
    }

    let attendance = await this.prisma.attendance.findFirst({
      where: { 
        batchId: resolvedBatchId, 
        date: targetDate,
        subjectId: subjectId || null
      }
    });

    if (attendance) {
      attendance = await this.prisma.attendance.update({
        where: { id: attendance.id },
        data: { recordedById: userId }
      });
    } else {
      attendance = await this.prisma.attendance.create({
        data: {
          batchId: resolvedBatchId,
          date: targetDate,
          recordedById: userId,
          subjectId: subjectId || null
        }
      });
    }

    // We can just delete the old records and insert new ones to handle upsert cleanly
    await this.prisma.attendanceRecord.deleteMany({
      where: { attendanceId: attendance.id }
    });

    const createRecords = records.map((r: any) => ({
      attendanceId: attendance.id,
      studentId: r.studentId,
      status: r.status as AttendanceStatus,
      remarks: r.remarks
    }));

    await this.prisma.attendanceRecord.createMany({
      data: createRecords
    });

    return { message: "Attendance marked successfully" };
  }
}
