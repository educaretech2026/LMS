import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AttendanceStatus } from '@educare/database';
import { isSuperAdmin, getAuthorizedCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async getBatchStudents(batchId?: string, subjectId?: string, user?: any) {
    let students: any[];
    const roleStr = typeof user?.role === 'object' && user?.role !== null ? user?.role.name : user?.role;
    const isTeacher = String(roleStr || '').toUpperCase().replace(/\s+/g, '_') === 'TEACHER';

    if (batchId && batchId !== 'ALL') {
      const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
      if (!batch || !batch.centreId) {
        throw new ForbiddenException('Cannot access students for a batch without an identifiable centre.');
      }
      if (user && !isSuperAdmin(user)) {
        assertCentreAccess(user, batch.centreId);
      }

      if (isTeacher && user?.id) {
        const teacherProfile = await this.prisma.teacherProfile.findUnique({
          where: { userId: user.id },
          include: { assignments: { include: { batch: true } } },
        });
        const teacherCentres = getAuthorizedCentreIds(user);
        const isAssigned = teacherProfile?.assignments?.some(a => {
          if (subjectId && (!a.subjectId || a.subjectId !== subjectId)) return false;
          if (a.batchId && a.batchId === batchId) return true;
          if (a.batch && a.batch.id === batchId) return true;
          if (!a.batchId && !a.batch && a.standardId && batch.standardId === a.standardId) {
            if (a.boardId && batch.boardId && a.boardId !== batch.boardId) return false;
            if (!teacherCentres.includes(batch.centreId)) return false;
            return true;
          }
          return false;
        });
        if (!isAssigned) {
          throw new ForbiddenException('Teachers can only access students in their assigned batches.');
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
      if (isTeacher) {
        throw new ForbiddenException('Teachers must specify a specific assigned batch to retrieve students.');
      }
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
    const roleStr = typeof user?.role === 'object' && user?.role !== null ? user?.role.name : user?.role;
    const isTeacher = String(roleStr || '').toUpperCase().replace(/\s+/g, '_') === 'TEACHER';

    if (batchId && batchId !== 'ALL') {
      const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
      if (!batch || !batch.centreId) {
        throw new ForbiddenException('Cannot access attendance for a batch without an identifiable centre.');
      }
      if (user && !isSuperAdmin(user)) {
        assertCentreAccess(user, batch.centreId);
      }

      if (isTeacher && user?.id) {
        const teacherProfile = await this.prisma.teacherProfile.findUnique({
          where: { userId: user.id },
          include: { assignments: { include: { batch: true } } },
        });
        const teacherCentres = getAuthorizedCentreIds(user);
        const isAssigned = teacherProfile?.assignments?.some(a => {
          if (subjectId && (!a.subjectId || a.subjectId !== subjectId)) return false;
          if (a.batchId && a.batchId === batchId) return true;
          if (a.batch && a.batch.id === batchId) return true;
          if (!a.batchId && !a.batch && a.standardId && batch.standardId === a.standardId) {
            if (a.boardId && batch.boardId && a.boardId !== batch.boardId) return false;
            if (!teacherCentres.includes(batch.centreId)) return false;
            return true;
          }
          return false;
        });
        if (!isAssigned) {
          throw new ForbiddenException('Teachers can only access attendance for their assigned batches.');
        }
      }
    } else if (isTeacher) {
      throw new ForbiddenException('Teachers must specify an assigned batch.');
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
      // Find single active academic year deterministically
      const activeYears = await this.prisma.academicYear.findMany({ where: { isActive: true } });
      if (activeYears.length === 0) {
        throw new BadRequestException("No active academic year configured. Please configure an active academic year.");
      }
      if (activeYears.length > 1) {
        throw new BadRequestException("Multiple active academic years found. Cannot deterministically resolve default batch without explicit academic year.");
      }
      const ay = activeYears[0];
      
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
    const roleStr = typeof user?.role === 'object' && user?.role !== null ? user?.role.name : user?.role;
    const isTeacher = String(roleStr || '').toUpperCase().replace(/\s+/g, '_') === 'TEACHER';
    let assignedBatchIds: string[] | null = null;
    let assignedStandardIds: string[] | null = null;
    if (isTeacher && user?.id) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: user.id },
        include: { assignments: { include: { batch: true } } },
      });
      const validAssignments = (teacherProfile?.assignments || []).filter(a => {
        if (a.batch) {
          return a.batch.centreId === centreId && (!boardId || a.batch.boardId === boardId) && (!trackId || a.batch.trackId === trackId);
        }
        return (!boardId || !a.boardId || a.boardId === boardId);
      });
      assignedBatchIds = validAssignments.map(a => a.batchId || a.batch?.id).filter(Boolean) as string[];
      const classWideAssignments = validAssignments.filter(a => !a.batchId && !a.batch && a.standardId);
      assignedStandardIds = classWideAssignments.map(a => a.standardId).filter(Boolean) as string[];

      if (assignedBatchIds.length === 0 && assignedStandardIds.length === 0) {
        return [];
      }
    }

    return this.prisma.batch.findMany({
      where: {
        centreId,
        boardId,
        standardId,
        trackId,
        ...(isTeacher && assignedBatchIds !== null && assignedStandardIds !== null ? {
          OR: [
            ...(assignedBatchIds.length > 0 ? [{ id: { in: assignedBatchIds } }] : []),
            ...(assignedStandardIds.length > 0 ? [{ standardId: { in: assignedStandardIds } }] : []),
          ]
        } : {})
      }
    });
  }

  async getStudentsByFilter(centreId: string, boardId: string, standardId: string, trackId: string, user?: any) {
    if (user && !isSuperAdmin(user)) {
      assertCentreAccess(user, centreId);
    }
    const roleStr = typeof user?.role === 'object' && user?.role !== null ? user?.role.name : user?.role;
    const isTeacher = String(roleStr || '').toUpperCase().replace(/\s+/g, '_') === 'TEACHER';

    if (isTeacher && user?.id) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: user.id },
        include: { assignments: { include: { batch: true } } },
      });
      const isAssigned = teacherProfile?.assignments?.some(a => {
        if (a.batch) {
          if (a.batch.centreId === centreId && a.batch.standardId === standardId && (!boardId || a.batch.boardId === boardId) && (!trackId || a.batch.trackId === trackId)) {
            return true;
          }
          return false;
        }
        if (a.standardId && a.standardId === standardId) {
          if (boardId && a.boardId && a.boardId !== boardId) return false;
          return true;
        }
        return false;
      });
      if (!isAssigned) {
        throw new ForbiddenException('Teachers can only access student lists for their assigned classes and tracks.');
      }
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
    const roleStr = typeof user?.role === 'object' && user?.role !== null ? user?.role.name : user?.role;
    const isTeacher = String(roleStr || '').toUpperCase().replace(/\s+/g, '_') === 'TEACHER';

    if (isTeacher && user?.id) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: user.id },
        include: { assignments: { include: { batch: true } } },
      });
      const isAssigned = teacherProfile?.assignments?.some(a => {
        if (a.batch) {
          if (a.batch.centreId === centreId && a.batch.standardId === standardId && (!boardId || a.batch.boardId === boardId) && (!trackId || a.batch.trackId === trackId)) {
            return true;
          }
          return false;
        }
        if (a.standardId && a.standardId === standardId) {
          if (boardId && a.boardId && a.boardId !== boardId) return false;
          return true;
        }
        return false;
      });
      if (!isAssigned) {
        throw new ForbiddenException('Teachers can only access attendance for their assigned classes and tracks.');
      }
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
    
    if (!date || isNaN(new Date(date).getTime())) {
      throw new BadRequestException('A valid attendance date is required');
    }
    const targetDate = new Date(date);

    let resolvedBatchId = batchId;
    if (batchId === 'ALL') {
      resolvedBatchId = null;
    } else if (!batchId && centreId && boardId && standardId && trackId) {
      resolvedBatchId = await this.resolveBatchId(centreId, boardId, standardId, trackId);
    }

    let effectiveCentreId = centreId;
    let targetBatch: any = null;
    if (resolvedBatchId) {
      targetBatch = await this.prisma.batch.findUnique({
        where: { id: resolvedBatchId },
        select: { id: true, centreId: true, standardId: true, boardId: true }
      });
      if (!targetBatch || !targetBatch.centreId) {
        throw new BadRequestException('The specified batch does not exist or has no identifiable centre');
      }
      effectiveCentreId = targetBatch.centreId;
    }

    if (!effectiveCentreId) {
      throw new BadRequestException('Cannot mark attendance without an identifiable centre');
    }

    if (user && typeof user !== 'string' && !isSuperAdmin(user)) {
      assertCentreAccess(user, effectiveCentreId);

      const roleStr = typeof user.role === 'object' && user.role !== null ? user.role.name : user.role;
      const normalizedRole = String(roleStr || '').toUpperCase().replace(/\s+/g, '_');
      if (normalizedRole === 'TEACHER') {
        if (batchId === 'ALL' || !resolvedBatchId) {
          throw new ForbiddenException('Teachers cannot mark centre-wide attendance. Please select a specific assigned batch.');
        }

        const teacherProfile = await this.prisma.teacherProfile.findUnique({
          where: { userId: user.id },
          include: { assignments: { include: { batch: true } } },
        });
        if (!teacherProfile || !teacherProfile.assignments || teacherProfile.assignments.length === 0) {
          throw new ForbiddenException('Teacher has no active assignments to mark attendance');
        }
        const teacherCentres = getAuthorizedCentreIds(user);
        const isAssigned = teacherProfile.assignments.some(a => {
          if (subjectId && (!a.subjectId || a.subjectId !== subjectId)) return false;
          if (a.batchId && a.batchId === resolvedBatchId) return true;
          if (a.batch && a.batch.id === resolvedBatchId) return true;
          if (!a.batchId && !a.batch && a.standardId && targetBatch?.standardId === a.standardId) {
            if (a.boardId && targetBatch?.boardId && a.boardId !== targetBatch.boardId) return false;
            if (!teacherCentres.includes(effectiveCentreId)) return false;
            return true;
          }
          return false;
        });
        if (!isAssigned) {
          throw new ForbiddenException('You are not authorized to mark attendance for this batch or subject');
        }
      }
    }

    if (!Array.isArray(records) || records.length === 0) {
      throw new BadRequestException('Attendance records list cannot be empty');
    }

    const validStatuses = Object.values(AttendanceStatus);
    const seenStudentIds = new Set<string>();

    for (const r of records) {
      if (!r.studentId) {
        throw new BadRequestException('Every attendance record must have a studentId');
      }
      if (seenStudentIds.has(r.studentId)) {
        throw new BadRequestException(`Duplicate attendance entry for student ID: ${r.studentId}`);
      }
      seenStudentIds.add(r.studentId);

      if (!validStatuses.includes(r.status)) {
        throw new BadRequestException(`Invalid attendance status: ${r.status}. Allowed values: ${validStatuses.join(', ')}`);
      }
    }

    // Verify ALL students exist and belong to the batch/centre
    const studentProfiles = await this.prisma.studentProfile.findMany({
      where: {
        id: { in: Array.from(seenStudentIds) },
      },
      include: {
        enrollments: {
          where: {
            ...(resolvedBatchId ? { batchId: resolvedBatchId } : {}),
            batch: { centreId: effectiveCentreId }
          }
        }
      }
    });

    if (studentProfiles.length !== seenStudentIds.size) {
      throw new BadRequestException('One or more student profiles do not exist');
    }

    for (const sp of studentProfiles) {
      if (!sp.enrollments || sp.enrollments.length === 0) {
        if (resolvedBatchId) {
          throw new BadRequestException(`Student ${sp.id} is not enrolled in the specified batch and centre`);
        } else {
          throw new BadRequestException(`Student ${sp.id} is not enrolled in centre ${effectiveCentreId}`);
        }
      }
    }

    // Perform atomic update inside database transaction
    await this.prisma.$transaction(async (tx) => {
      let attendance = await tx.attendance.findFirst({
        where: { 
          batchId: resolvedBatchId, 
          date: targetDate,
          subjectId: subjectId || null
        }
      });

      if (attendance) {
        attendance = await tx.attendance.update({
          where: { id: attendance.id },
          data: { recordedById: userId }
        });
      } else {
        attendance = await tx.attendance.create({
          data: {
            batchId: resolvedBatchId,
            date: targetDate,
            recordedById: userId,
            subjectId: subjectId || null
          }
        });
      }

      await tx.attendanceRecord.deleteMany({
        where: { attendanceId: attendance.id }
      });

      const createRecords = records.map((r: any) => ({
        attendanceId: attendance.id,
        studentId: r.studentId,
        status: r.status as AttendanceStatus,
        remarks: r.remarks || null
      }));

      await tx.attendanceRecord.createMany({
        data: createRecords
      });
    });

    return { message: "Attendance marked successfully" };
  }
}
