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
    const totalIncome = incomeTx.reduce((sum, tx) => sum + tx.amount, 0);

    const expenseTx = await this.prisma.transaction.findMany({
      where: { type: TransactionType.EXPENSE }
    });
    const totalExpense = expenseTx.reduce((sum, tx) => sum + tx.amount, 0);

    // Dummy values for now for fees and refund
    const totalRefund = 0;
    const totalFeeDue = 0;
    const feeOverdue = 0;
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
}
