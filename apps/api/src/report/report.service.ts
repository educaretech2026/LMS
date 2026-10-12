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

  async getExpenseIncomeReport(startDate: string, endDate: string, centreId?: string) {
    const from = new Date(startDate);
    const to = new Date(endDate);
    to.setHours(23, 59, 59, 999);
    
    const txWhere: any = { date: { gte: from, lte: to } };
    if (centreId) txWhere.centreId = centreId;

    const transactions = await this.prisma.transaction.findMany({
      where: txWhere,
      orderBy: { date: 'desc' },
      include: {
        recordedBy: { select: { firstName: true, lastName: true, email: true } },
        centre: { select: { id: true, name: true } },
      }
    });

    const feeWhere: any = { date: { gte: from, lte: to } };
    const feeRecords = await this.prisma.feeRecord.findMany({
      where: feeWhere,
      orderBy: { date: 'desc' },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            enrollments: {
              include: {
                batch: {
                  include: {
                    centre: true,
                    standard: true,
                  }
                }
              }
            }
          }
        }
      }
    });

    // If centreId specified, optionally filter fee records by student enrollment centre
    const filteredFees = centreId
      ? feeRecords.filter(f => f.student.enrollments.some(e => e.batch.centreId === centreId))
      : feeRecords;

    const paidFees = filteredFees.filter(f => f.status === 'PAID');
    const feeTotal = paidFees.reduce((sum, f) => sum + f.amount, 0);

    return {
      transactions,
      feeRecords: filteredFees.map(f => ({
        id: f.id,
        receiptNo: f.receiptNo,
        amount: f.amount,
        date: f.date,
        status: f.status,
        paymentMode: f.paymentMode || 'CASH',
        feeHead: f.feeHead || 'Tuition Fee',
        studentName: `${f.student.user.firstName} ${f.student.user.lastName}`,
        admissionNo: f.student.admissionNo,
        batchName: f.student.enrollments[0]?.batch?.name || '-',
        centreName: f.student.enrollments[0]?.batch?.centre?.name || '-',
      })),
      feeTotal,
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

  async getOverviewAnalytics(
    startDate?: string,
    endDate?: string,
    batchId?: string,
    centreId?: string,
    academicYearId?: string,
    boardId?: string,
    standardId?: string,
    subjectId?: string,
  ) {
    const from = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = endDate ? new Date(endDate) : new Date();
    to.setHours(23, 59, 59, 999);

    // 1. Financial aggregates
    const txWhere: any = { date: { gte: from, lte: to } };
    if (centreId) txWhere.centreId = centreId;
    const transactions = await this.prisma.transaction.findMany({ where: txWhere });

    const income = transactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);

    const feeWhere: any = { date: { gte: from, lte: to } };
    const feeRecords = await this.prisma.feeRecord.findMany({
      where: feeWhere,
      include: {
        student: {
          include: {
            enrollments: {
              include: { batch: true }
            }
          }
        }
      }
    });

    const matchingFees = feeRecords.filter(f => {
      if (!centreId && !batchId) return true;
      return f.student.enrollments.some(e => {
        if (centreId && e.batch.centreId !== centreId) return false;
        if (batchId && e.batch.id !== batchId) return false;
        return true;
      });
    });

    const paidFees = matchingFees.filter(f => f.status === 'PAID').reduce((sum, f) => sum + f.amount, 0);
    const pendingFees = matchingFees.filter(f => f.status === 'PENDING').reduce((sum, f) => sum + f.amount, 0);
    const overdueFees = matchingFees.filter(f => f.status === 'OVERDUE').reduce((sum, f) => sum + f.amount, 0);

    const totalRevenue = income + paidFees;
    const netProfit = totalRevenue - expenses;

    // 2. Attendance Summary
    const attWhere: any = {
      attendance: {
        date: { gte: from, lte: to },
        ...(batchId ? { batchId } : {}),
        ...(centreId ? { batch: { centreId } } : {}),
        ...(subjectId ? { subjectId } : {}),
      }
    };
    const attRecords = await this.prisma.attendanceRecord.findMany({
      where: attWhere,
      select: { status: true }
    });
    const totalAtt = attRecords.length;
    const presentAtt = attRecords.filter(a => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE).length;
    const attendanceRate = totalAtt > 0 ? (presentAtt / totalAtt) * 100 : 0;

    // 3. Exam summary
    const examWhere: any = {
      createdAt: { gte: from, lte: to },
      exam: {
        ...(batchId ? { batchId } : {}),
        ...(centreId ? { centreId } : {}),
        ...(academicYearId ? { academicYearId } : {}),
        ...(boardId ? { boardId } : {}),
        ...(standardId ? { standardId } : {}),
        ...(subjectId ? { subjectId } : {}),
      }
    };
    const examResults = await this.prisma.examResult.findMany({
      where: examWhere,
      select: { marksObtained: true, maxMarks: true, grade: true }
    });
    const totalExamsAttempted = examResults.length;
    const avgScorePercent = totalExamsAttempted > 0
      ? (examResults.reduce((s, r) => s + (r.maxMarks > 0 ? (r.marksObtained / r.maxMarks) * 100 : 0), 0) / totalExamsAttempted)
      : 0;

    const passedAttempts = examResults.filter(r => r.maxMarks > 0 && (r.marksObtained / r.maxMarks) >= 0.4).length;
    const passRate = totalExamsAttempted > 0 ? (passedAttempts / totalExamsAttempted) * 100 : 0;

    // 4. CRM / Enquiries summary
    const enquiries = await this.prisma.enquiry.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(centreId ? { centreId } : {}),
      },
      select: { status: true }
    });
    const totalEnquiries = enquiries.length;
    const convertedEnquiries = enquiries.filter(e => e.status === EnquiryStatus.CONVERTED).length;
    const conversionRate = totalEnquiries > 0 ? (convertedEnquiries / totalEnquiries) * 100 : 0;

    // 5. Active Students count
    const totalStudents = await this.prisma.studentProfile.count();

    return {
      financials: {
        totalRevenue,
        feeTotal: paidFees,
        adhocIncome: income,
        expenses,
        netProfit,
        pendingFees,
        overdueFees,
      },
      attendance: {
        totalRecords: totalAtt,
        presentRecords: presentAtt,
        rate: Number(attendanceRate.toFixed(1)),
      },
      academics: {
        totalAttempts: totalExamsAttempted,
        avgScore: Number(avgScorePercent.toFixed(1)),
        passRate: Number(passRate.toFixed(1)),
      },
      crm: {
        totalEnquiries,
        converted: convertedEnquiries,
        conversionRate: Number(conversionRate.toFixed(1)),
      },
      totalStudents,
    };
  }

  async getExamsAnalytics(
    batchId?: string,
    startDate?: string,
    endDate?: string,
    academicYearId?: string,
    centreId?: string,
    boardId?: string,
    standardId?: string,
    subjectId?: string,
    chapterId?: string,
    topicId?: string,
  ) {
    const from = startDate ? new Date(startDate) : undefined;
    const to = endDate ? new Date(endDate) : undefined;
    if (to) to.setHours(23, 59, 59, 999);

    const where: any = {};
    if (batchId) where.batchId = batchId;
    if (centreId) where.centreId = centreId;
    if (academicYearId) where.academicYearId = academicYearId;
    if (boardId) where.boardId = boardId;
    if (standardId) where.standardId = standardId;
    if (subjectId) where.subjectId = subjectId;
    if (chapterId) where.chapterId = chapterId;
    if (topicId) where.topicId = topicId;
    if (from && to) where.createdAt = { gte: from, lte: to };

    const exams = await this.prisma.exam.findMany({
      where,
      include: {
        academicYear: { select: { id: true, name: true } },
        centre: { select: { id: true, name: true, code: true } },
        board: { select: { id: true, name: true } },
        standard: { select: { id: true, name: true, level: true } },
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        chapter: { select: { id: true, name: true } },
        topic: { select: { id: true, name: true } },
        results: {
          include: {
            student: {
              include: { user: { select: { firstName: true, lastName: true } } }
            }
          }
        }
      },
      orderBy: [
        { academicYear: { name: 'desc' } },
        { centre: { name: 'asc' } },
        { standard: { level: 'asc' } },
        { subject: { name: 'asc' } },
        { title: 'asc' }
      ],
      take: 100,
    });

    const gradeDistribution: Record<string, number> = {
      'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'F': 0
    };

    let totalAttempts = 0;
    let totalScoreSum = 0;

    const examsReport = exams.map(exam => {
      const attempts = exam.results.length;
      let examAvg = 0;
      let topScore = 0;

      if (attempts > 0) {
        const scores = exam.results.map(r => {
          const pct = r.maxMarks > 0 ? (r.marksObtained / r.maxMarks) * 100 : 0;
          const grade = r.grade || (pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'F');
          if (gradeDistribution[grade] !== undefined) gradeDistribution[grade]++;
          return { marks: r.marksObtained, pct };
        });

        topScore = Math.max(...exam.results.map(r => r.marksObtained));
        examAvg = scores.reduce((sum, s) => sum + s.pct, 0) / attempts;
        totalAttempts += attempts;
        totalScoreSum += scores.reduce((sum, s) => sum + s.pct, 0);
      }

      return {
        id: exam.id,
        title: exam.title,
        type: exam.type,
        academicYearName: exam.academicYear?.name || 'Current Year',
        centreName: exam.centre?.name || 'All Centres',
        boardName: exam.board?.name || '-',
        standardName: exam.standard?.name || '-',
        batchName: exam.batch?.name || 'All Batches',
        subjectName: exam.subject?.name || 'General',
        chapterName: exam.chapter?.name || '-',
        topicName: exam.topic?.name || '-',
        createdAt: exam.createdAt,
        attemptsCount: attempts,
        averagePercentage: Number(examAvg.toFixed(1)),
        topScore,
        results: exam.results.map(r => ({
          studentId: r.studentId,
          studentName: `${r.student?.user?.firstName || ''} ${r.student?.user?.lastName || ''}`.trim(),
          admissionNo: r.student?.admissionNo,
          marksObtained: r.marksObtained,
          maxMarks: r.maxMarks,
          grade: r.grade,
          percentage: r.maxMarks > 0 ? Number(((r.marksObtained / r.maxMarks) * 100).toFixed(1)) : 0,
        }))
      };
    });

    const overallAverage = totalAttempts > 0 ? Number((totalScoreSum / totalAttempts).toFixed(1)) : 0;

    return {
      exams: examsReport,
      summary: {
        totalExams: exams.length,
        totalAttempts,
        overallAverage,
        gradeDistribution,
      }
    };
  }

  async getAttendanceAnalytics(
    batchId?: string,
    startDate?: string,
    endDate?: string,
    centreId?: string,
    boardId?: string,
    standardId?: string,
    subjectId?: string,
  ) {
    const from = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = endDate ? new Date(endDate) : new Date();
    to.setHours(23, 59, 59, 999);

    const attWhere: any = {
      date: { gte: from, lte: to },
    };
    if (batchId) attWhere.batchId = batchId;
    if (subjectId) attWhere.subjectId = subjectId;
    if (centreId || boardId || standardId) {
      attWhere.batch = {
        ...(centreId ? { centreId } : {}),
        ...(boardId ? { boardId } : {}),
        ...(standardId ? { standardId } : {}),
      };
    }

    const attendances = await this.prisma.attendance.findMany({
      where: attWhere,
      include: {
        batch: {
          select: {
            id: true,
            name: true,
            centre: { select: { id: true, name: true } },
            board: { select: { id: true, name: true } },
            standard: { select: { id: true, name: true } },
          }
        },
        subject: { select: { id: true, name: true } },
        records: {
          include: {
            student: {
              include: { user: { select: { firstName: true, lastName: true } } }
            }
          }
        }
      },
      orderBy: [
        { date: 'asc' },
      ]
    });

    // Daily attendance trend
    const dailyMap: Record<string, { date: string; total: number; present: number; absent: number; late: number }> = {};
    const studentAggregates: Record<string, {
      id: string;
      name: string;
      admissionNo: string;
      batchName: string;
      centreName: string;
      standardName: string;
      boardName: string;
      total: number;
      present: number;
    }> = {};

    attendances.forEach(att => {
      const dateStr = att.date.toISOString().split('T')[0];
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { date: dateStr, total: 0, present: 0, absent: 0, late: 0 };
      }

      att.records.forEach(rec => {
        dailyMap[dateStr].total++;
        if (rec.status === AttendanceStatus.PRESENT) dailyMap[dateStr].present++;
        else if (rec.status === AttendanceStatus.ABSENT) dailyMap[dateStr].absent++;
        else if (rec.status === AttendanceStatus.LATE) dailyMap[dateStr].late++;

        if (!studentAggregates[rec.studentId]) {
          studentAggregates[rec.studentId] = {
            id: rec.studentId,
            name: `${rec.student?.user?.firstName || ''} ${rec.student?.user?.lastName || ''}`.trim(),
            admissionNo: rec.student?.admissionNo || '-',
            batchName: att.batch?.name || '-',
            centreName: att.batch?.centre?.name || '-',
            standardName: att.batch?.standard?.name || '-',
            boardName: att.batch?.board?.name || '-',
            total: 0,
            present: 0,
          };
        }
        studentAggregates[rec.studentId].total++;
        if (rec.status === AttendanceStatus.PRESENT || rec.status === AttendanceStatus.LATE) {
          studentAggregates[rec.studentId].present++;
        }
      });
    });

    const dailyTrends = Object.values(dailyMap).map(d => ({
      ...d,
      rate: d.total > 0 ? Number((( (d.present + d.late) / d.total) * 100).toFixed(1)) : 0,
    }));

    // Hierarchical sort: Centre -> Standard -> Batch -> Name
    const studentList = Object.values(studentAggregates).map(s => {
      const percentage = s.total > 0 ? Number(((s.present / s.total) * 100).toFixed(1)) : 0;
      return {
        ...s,
        percentage,
        isAtRisk: percentage < 75,
      };
    }).sort((a, b) => {
      if (a.centreName !== b.centreName) return a.centreName.localeCompare(b.centreName);
      if (a.standardName !== b.standardName) return a.standardName.localeCompare(b.standardName);
      if (a.batchName !== b.batchName) return a.batchName.localeCompare(b.batchName);
      return a.name.localeCompare(b.name);
    });

    const atRiskCount = studentList.filter(s => s.isAtRisk).length;
    const overallTotal = dailyTrends.reduce((s, d) => s + d.total, 0);
    const overallPresent = dailyTrends.reduce((s, d) => s + d.present + d.late, 0);
    const overallRate = overallTotal > 0 ? Number(((overallPresent / overallTotal) * 100).toFixed(1)) : 0;

    return {
      dailyTrends,
      studentList,
      summary: {
        totalSessions: attendances.length,
        totalRecords: overallTotal,
        overallRate,
        atRiskCount,
      }
    };
  }
}
