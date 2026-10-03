import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionType, EnquiryStatus, AttendanceStatus } from '@educare/database';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async getFeeCollectionReport(startDate: string, endDate: string) {
    const from = new Date(startDate);
    const to = new Date(endDate);
    
    return this.prisma.feeRecord.findMany({
      where: {
        date: { gte: from, lte: to }
      },
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true } } }
        }
      },
      orderBy: { date: 'desc' }
    });
  }

  async getExpenseIncomeReport(startDate: string, endDate: string) {
    const from = new Date(startDate);
    const to = new Date(endDate);
    
    const transactions = await this.prisma.transaction.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'desc' },
      include: { recordedBy: { select: { firstName: true, lastName: true } } }
    });

    const feeRecords = await this.prisma.feeRecord.findMany({
      where: { status: 'PAID', date: { gte: from, lte: to } }
    });

    return {
      transactions,
      feeTotal: feeRecords.reduce((sum, f) => sum + f.amount, 0)
    };
  }

  async getEnquiryConversionReport(startDate: string, endDate: string) {
    const from = new Date(startDate);
    const to = new Date(endDate);
    
    const all = await this.prisma.enquiry.findMany({
      where: { createdAt: { gte: from, lte: to } }
    });

    const statusCounts = {
      NEW: 0, CONTACTED: 0, VISITED: 0, QUALIFIED: 0, CONVERTED: 0, LOST: 0
    };

    all.forEach(e => {
      statusCounts[e.status]++;
    });

    return {
      total: all.length,
      counts: statusCounts,
      conversionRate: all.length > 0 ? (statusCounts.CONVERTED / all.length) * 100 : 0
    };
  }

  async getStudentPerformanceReport(batchId?: string) {
    let students;
    if (batchId) {
      const enrollments = await this.prisma.enrollment.findMany({
        where: { batchId },
        include: {
          studentProfile: {
            include: { user: { select: { firstName: true, lastName: true } } }
          }
        }
      });
      students = enrollments.map((e: any) => e.studentProfile);
    } else {
      students = await this.prisma.studentProfile.findMany({
        include: { user: { select: { firstName: true, lastName: true } } }
      });
    }

    const studentIds = students.map((s: any) => s.id);

    // 2. Get attendance aggregates
    const attRecords = await this.prisma.attendanceRecord.findMany({
      where: { studentId: { in: studentIds } },
      include: { attendance: { select: { batchId: true } } }
    });

    // 3. Map aggregates back to students
    return students.map((student: any) => {
      const studentAtts = batchId ? attRecords.filter((r: any) => r.studentId === student.id && r.attendance.batchId === batchId) : attRecords.filter((r: any) => r.studentId === student.id);
      const totalDays = studentAtts.length;
      const presentDays = studentAtts.filter((a: any) => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE).length;
      const attPercentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

      return {
        studentId: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        admissionNo: student.admissionNo,
        attendanceDetails: {
          totalDays,
          presentDays,
          percentage: attPercentage.toFixed(1)
        }
      };
    });
  }

  async getSingleStudentPerformance(studentId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { user: { select: { firstName: true, lastName: true } } }
    });

    if (!student) throw new Error("Student not found");

    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId }
    });

    const totalDays = records.length;
    const presentDays = records.filter(r => r.status === 'PRESENT').length;
    const percentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : '0.0';

    const examResults = await this.prisma.examResult.findMany({
      where: { studentId },
      include: { exam: { select: { title: true, type: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return {
      studentId: student.id,
      name: `${student.user.firstName} ${student.user.lastName}`,
      admissionNo: student.admissionNo,
      attendanceDetails: {
        totalDays,
        presentDays,
        percentage
      },
      examResults
    };
  }

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalStudents = await this.prisma.studentProfile.count();
    const totalInquiry = await this.prisma.enquiry.count();
    
    // For simplicity, absent is total absent records today
    const todayAbsent = await this.prisma.attendanceRecord.count({
      where: {
        attendance: { date: { gte: today } },
        status: AttendanceStatus.ABSENT
      }
    });

    const incomeTx = await this.prisma.transaction.findMany({
      where: { type: TransactionType.INCOME }
    });
    const transactionIncome = incomeTx.reduce((sum, tx) => sum + tx.amount, 0);

    const expenseTx = await this.prisma.transaction.findMany({
      where: { type: TransactionType.EXPENSE }
    });
    const totalExpense = expenseTx.reduce((sum, tx) => sum + tx.amount, 0);

    // Calculate Fees
    const feeRecords = await this.prisma.feeRecord.findMany();
    const paidFees = feeRecords.filter(f => f.status === 'PAID').reduce((sum, f) => sum + f.amount, 0);
    const totalFeeDue = feeRecords.filter(f => f.status === 'PENDING').reduce((sum, f) => sum + f.amount, 0);
    const feeOverdue = feeRecords.filter(f => f.status === 'OVERDUE').reduce((sum, f) => sum + f.amount, 0);
    
    const totalIncome = transactionIncome + paidFees;

    const totalRefund = 0;
    const upcomingFeeDue = 0;
    const pendingFees = 0;

    const eStudyMaterials = await this.prisma.studyMaterial.count();
    const smsBalance = 1000; // Mock balance

    return {
      totalStudents,
      totalInquiry,
      todayAbsent,
      totalIncome,
      totalExpense,
      totalRefund,
      totalFeeDue,
      feeOverdue,
      upcomingFeeDue,
      pendingFees,
      eStudyMaterials,
      smsBalance
    };
  }

  async getTeacherDashboard(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get teacher profile with assignments
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: {
        assignments: {
          include: {
            batch: {
              include: {
                standard: true,
                board: true,
                centre: true,
                enrollments: true,
              }
            },
            subject: true,
          }
        }
      }
    });

    if (!teacherProfile) return { batches: [], totalStudents: 0, todayPresent: 0, todayAbsent: 0, subjects: [] };

    const batchIds = [...new Set(teacherProfile.assignments.map(a => a.batchId))];
    const subjectIds = [...new Set(teacherProfile.assignments.map(a => a.subjectId))];

    // Total students across teacher's batches
    const totalStudents = await this.prisma.enrollment.count({
      where: { batchId: { in: batchIds } }
    });

    // Today's attendance records
    const todayAttendance = await this.prisma.attendanceRecord.findMany({
      where: {
        attendance: {
          batchId: { in: batchIds },
          date: { gte: today, lt: tomorrow }
        }
      }
    });

    const todayPresent = todayAttendance.filter(a => a.status === AttendanceStatus.PRESENT).length;
    const todayAbsent = todayAttendance.filter(a => a.status === AttendanceStatus.ABSENT).length;

    // Unique batches with student count
    const batches = batchIds.map(bId => {
      const assignment = teacherProfile.assignments.find(a => a.batchId === bId);
      const batch = assignment?.batch;
      return {
        id: bId,
        name: batch?.name,
        standard: batch?.standard?.name,
        board: batch?.board?.name,
        centre: batch?.centre?.name,
        studentCount: batch?.enrollments?.length || 0,
      };
    });

    const subjects = teacherProfile.assignments.map(a => ({
      id: a.subjectId,
      name: a.subject.name,
      batchName: a.batch.name,
    }));

    return { batches, totalStudents, todayPresent, todayAbsent, subjects };
  }
}
