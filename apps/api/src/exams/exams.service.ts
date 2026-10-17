import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { assertCentreAccess, isSuperAdmin, getUserCentreIds, getAuthorizedCentreIds, SAFE_USER_SELECT } from '../common/utils/tenant.util';

function calculateGrade(marksObtained: number, maxMarks: number): string {
  if (!maxMarks || maxMarks <= 0) return 'F';
  const percentage = (marksObtained / maxMarks) * 100;
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  return 'F';
}

function sanitizeQuestions(questions: any[]): any[] {
  if (!Array.isArray(questions)) return [];
  return questions.map(q => {
    const { correctOption, explanation, ...safeQ } = q;
    return safeQ;
  });
}

@Injectable()
export class ExamsService {
  private releasedExams = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService
  ) {}

  async isAnswersReleased(examId: string): Promise<boolean> {
    if (process.env.REDIS_URL) {
      try {
        const val = await this.redisService.getRaw(`exam:released:${examId}`);
        return val === 'true';
      } catch {
        // Fail closed if Redis is configured but fails
        return false;
      }
    }
    return this.releasedExams.has(examId);
  }

  async releaseExamAnswers(examId: string, released = true, user?: any): Promise<{ success: boolean; examId: string; released: boolean }> {
    if (!user) {
      throw new UnauthorizedException('Authentication required to release exam answers.');
    }
    const isStudent = user?.role === 'STUDENT' || user?.role?.name === 'STUDENT';
    if (isStudent) {
      throw new ForbiddenException('Students are not authorized to release exam answers.');
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { batch: { select: { centreId: true, standardId: true, boardId: true } } }
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (!isSuperAdmin(user)) {
      const examCentreId = exam.centreId || exam.batch?.centreId;
      if (!examCentreId) {
        throw new ForbiddenException('Exams without an assigned centre can only be managed by Super Administrators.');
      }
      assertCentreAccess(user, examCentreId);

      const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
      if (isTeacher) {
        await this.assertTeacherExamAccess(user.id, exam);
      }
    }

    if (process.env.REDIS_URL) {
      try {
        if (released) {
          await this.redisService.setRaw(`exam:released:${examId}`, 'true');
        } else {
          await this.redisService.delRaw(`exam:released:${examId}`);
        }
      } catch (err) {
        throw new ServiceUnavailableException('Failed to persist exam answer release state in Redis.');
      }
    }

    if (released) {
      this.releasedExams.add(examId);
    } else {
      this.releasedExams.delete(examId);
    }

    return { success: true, examId, released };
  }

  async assertTeacherExamAccess(userId: string, exam: any): Promise<void> {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: {
        assignments: true,
        user: {
          include: {
            userCentres: true,
          }
        }
      },
    });
    if (!teacherProfile) {
      throw new ForbiddenException('Teacher profile not found.');
    }

    if (!teacherProfile.assignments || teacherProfile.assignments.length === 0) {
      throw new ForbiddenException('Teacher has no active assignments.');
    }

    // 1. Centre check: The exam's effective centre must be among the teacher's authorized centres
    const effectiveExamCentreId = exam.centreId || exam.batch?.centreId;
    if (effectiveExamCentreId) {
      const teacherCentreIds = teacherProfile.user?.userCentres?.map(uc => uc.centreId) || [];
      if (!teacherCentreIds.includes(effectiveExamCentreId)) {
        throw new ForbiddenException('You are not authorized to access exams in this centre.');
      }
    }

    // 2. Academic tuple check: subject, standard, board, and batch must match simultaneously
    const effectiveStandardId = exam.standardId || exam.batch?.standardId;
    const effectiveBoardId = exam.boardId || exam.batch?.boardId;
    const effectiveSubjectId = exam.subjectId;

    const matches = teacherProfile.assignments.some(a => {
      // Subject is mandatory and must match
      if (!a.subjectId || a.subjectId !== effectiveSubjectId) {
        return false;
      }

      // If standard/class is specified on either side, it must match
      if (effectiveStandardId && a.standardId) {
        const directMatch = a.standardId === effectiveStandardId;
        let combinedMatch = false;
        if (a.isCombined && a.combinedClasses) {
          const parsed = a.combinedClasses.split(',').map(s => s.trim()).filter(Boolean);
          combinedMatch = parsed.includes(effectiveStandardId);
        }
        if (!directMatch && !combinedMatch) {
          return false;
        }
      }

      // If board is specified on both sides, it must match
      if (effectiveBoardId && a.boardId && a.boardId !== effectiveBoardId) {
        return false;
      }

      // If batch is specified on the assignment or exam, it must be compatible
      if (exam.batchId && a.batchId && a.batchId !== exam.batchId) {
        return false;
      }

      return true;
    });

    if (!matches) {
      throw new ForbiddenException('You are not authorized to access or manage this exam. The exam subject, class, or batch does not match your active teaching assignments.');
    }
  }

  async getExams(user?: any): Promise<any> {
    const isStudent = user?.role?.name === 'STUDENT' || user?.role === 'STUDENT';
    
    if (isStudent && user?.id) {
      const studentProfile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: {
          enrollments: {
            include: {
              batch: true,
            }
          }
        }
      });

      if (!studentProfile) {
        return [];
      }

      const batchIds = studentProfile.enrollments.map(e => e.batchId).filter(Boolean);
      const boardIds = studentProfile.enrollments.map(e => e.batch?.boardId).filter(Boolean);
      const standardIds = studentProfile.enrollments.map(e => e.batch?.standardId).filter(Boolean);
      const centreIds = studentProfile.enrollments.map(e => e.batch?.centreId).filter(Boolean);
      const trackIds = studentProfile.enrollments.map(e => e.trackId || e.batch?.trackId).filter(Boolean);

      const orConditions: any[] = [];
      if (batchIds.length > 0) {
        orConditions.push({ batchId: { in: batchIds } });
      }

      const hierarchyAnd: any[] = [{ batchId: null }];
      if (boardIds.length > 0) {
        hierarchyAnd.push({ OR: [{ boardId: null }, { boardId: { in: boardIds } }] });
      }
      if (standardIds.length > 0) {
        hierarchyAnd.push({ OR: [{ standardId: null }, { standardId: { in: standardIds } }] });
      }
      if (centreIds.length > 0) {
        hierarchyAnd.push({ OR: [{ centreId: null }, { centreId: { in: centreIds } }] });
      }
      if (trackIds.length > 0) {
        hierarchyAnd.push({ OR: [{ targetTrackId: null }, { targetTrackId: { in: trackIds } }] });
      }
      orConditions.push({ AND: hierarchyAnd });

      const exams = await this.prisma.exam.findMany({
        where: {
          OR: orConditions
        },
        include: {
          academicYear: true,
          batch: true,
          subject: true,
          chapter: true,
          topic: true,
          mcqQuestions: true,
          targetTrack: true,
          results: {
            where: { studentId: studentProfile.id }
          },
          _count: {
            select: { results: true, mcqQuestions: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // SEC: Students must NEVER receive un-sanitized answer keys on exam lists
      return exams.map(exam => {
        return {
          ...exam,
          mcqQuestions: exam.mcqQuestions ? sanitizeQuestions(exam.mcqQuestions) : [],
        };
      });
    }

    const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
    if (isTeacher && user?.id) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: user.id },
        include: { assignments: true, user: { include: { userCentres: true } } }
      });
      if (!teacherProfile || !teacherProfile.assignments || teacherProfile.assignments.length === 0) {
        return [];
      }

      const userCentres = getAuthorizedCentreIds(user);
      const assignmentOrConditions = teacherProfile.assignments
        .filter(a => Boolean(a.subjectId))
        .map(a => {
          const cond: any = { subjectId: a.subjectId };
          if (a.standardId) {
            const stdList = [a.standardId];
            if (a.isCombined && a.combinedClasses) {
              stdList.push(...a.combinedClasses.split(',').map(s => s.trim()).filter(Boolean));
            }
            cond.OR = [{ standardId: null }, { standardId: { in: stdList } }];
          }
          if (a.boardId) {
            cond.AND = [{ OR: [{ boardId: null }, { boardId: a.boardId }] }];
          }
          if (a.batchId) {
            cond.batchId = a.batchId;
          }
          return cond;
        });

      if (assignmentOrConditions.length === 0) {
        return [];
      }

      return this.prisma.exam.findMany({
        where: {
          AND: [
            {
              OR: [
                { centreId: { in: userCentres } },
                { batch: { centreId: { in: userCentres } } },
              ]
            },
            {
              OR: assignmentOrConditions
            }
          ]
        },
        include: {
          academicYear: true,
          batch: true,
          subject: true,
          chapter: true,
          topic: true,
          mcqQuestions: true,
          targetTrack: true,
          _count: {
            select: { results: true, mcqQuestions: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    const where: any = {};
    if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
      where.OR = [
        { centreId: { in: userCentres } },
        { batch: { centreId: { in: userCentres } } },
      ];
    }

    return this.prisma.exam.findMany({
      where,
      include: {
        academicYear: true,
        batch: true,
        subject: true,
        chapter: true,
        topic: true,
        mcqQuestions: true,
        targetTrack: true,
        _count: {
          select: { results: true, mcqQuestions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAllResults(user?: any): Promise<any> {
    const where: any = {};
    const isStudent = user?.role?.name === 'STUDENT' || user?.role === 'STUDENT';
    const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';

    if (isStudent && user?.id) {
      const studentProfile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id }
      });
      if (studentProfile) {
        where.studentId = studentProfile.id;
      } else {
        return [];
      }
    } else if (isTeacher && user?.id) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: user.id },
        include: { assignments: true, user: { include: { userCentres: true } } }
      });
      if (!teacherProfile || !teacherProfile.assignments || teacherProfile.assignments.length === 0) {
        return [];
      }

      const userCentres = getAuthorizedCentreIds(user);
      const assignmentOrConditions = teacherProfile.assignments
        .filter(a => Boolean(a.subjectId))
        .map(a => {
          const cond: any = { subjectId: a.subjectId };
          if (a.standardId) {
            const stdList = [a.standardId];
            if (a.isCombined && a.combinedClasses) {
              stdList.push(...a.combinedClasses.split(',').map(s => s.trim()).filter(Boolean));
            }
            cond.OR = [{ standardId: null }, { standardId: { in: stdList } }];
          }
          if (a.boardId) {
            cond.AND = [{ OR: [{ boardId: null }, { boardId: a.boardId }] }];
          }
          if (a.batchId) {
            cond.batchId = a.batchId;
          }
          return cond;
        });

      if (assignmentOrConditions.length === 0) {
        return [];
      }

      where.exam = {
        AND: [
          {
            OR: [
              { centreId: { in: userCentres } },
              { batch: { centreId: { in: userCentres } } },
            ]
          },
          {
            OR: assignmentOrConditions
          }
        ]
      };
    } else if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
      where.exam = {
        OR: [
          { centreId: { in: userCentres } },
          { batch: { centreId: { in: userCentres } } },
        ]
      };
    }

    return this.prisma.examResult.findMany({
      where,
      include: {
        exam: {
          include: {
            subject: true,
            targetTrack: true
          }
        },
        student: {
          include: {
            user: {
              select: SAFE_USER_SELECT
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getExamById(id: string, user?: any): Promise<any> {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: {
        academicYear: true,
        batch: true,
        subject: true,
        chapter: true,
        topic: true,
        mcqQuestions: true,
        targetTrack: true,
        _count: {
          select: { results: true, mcqQuestions: true }
        }
      }
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const isStudent = user?.role?.name === 'STUDENT' || user?.role === 'STUDENT';
    if (isStudent && user?.id) {
      const studentProfile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { enrollments: { include: { batch: true } } }
      });
      if (!studentProfile) throw new ForbiddenException('Student profile not found');

      const studentCentres = studentProfile.enrollments.map(e => e.batch?.centreId).filter(Boolean);
      const studentStandards = studentProfile.enrollments.map(e => e.batch?.standardId).filter(Boolean);
      const studentBoards = studentProfile.enrollments.map(e => e.batch?.boardId).filter(Boolean);
      const studentBatches = studentProfile.enrollments.map(e => e.batchId).filter(Boolean);

      const matchesCentre = !exam.centreId || studentCentres.includes(exam.centreId);
      const matchesBatch = !exam.batchId || studentBatches.includes(exam.batchId);
      const matchesStandard = !exam.standardId || studentStandards.includes(exam.standardId);
      const matchesBoard = !exam.boardId || studentBoards.includes(exam.boardId);

      if (!matchesCentre || !matchesBatch || !matchesStandard || !matchesBoard) {
        throw new ForbiddenException('Access denied: You are not eligible for this exam.');
      }

      const ownResults = await this.prisma.examResult.findMany({
        where: { examId: id, studentId: studentProfile.id }
      });

      // SEC: Students viewing/taking an exam must ALWAYS receive sanitized questions without answer keys
      return {
        ...exam,
        mcqQuestions: exam.mcqQuestions ? sanitizeQuestions(exam.mcqQuestions) : [],
        results: ownResults,
      };
    } else if (user && !isSuperAdmin(user)) {
      const examCentreId = exam.centreId || exam.batch?.centreId;
      if (!examCentreId) {
        throw new ForbiddenException('Exams without an assigned centre can only be managed by Super Administrators.');
      }
      assertCentreAccess(user, examCentreId);
      const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
      if (isTeacher) {
        await this.assertTeacherExamAccess(user.id, exam);
      }
    }

    return exam;
  }

  async getExamResults(examId: string, user?: any): Promise<any> {
    const isStudent = user?.role?.name === 'STUDENT' || user?.role === 'STUDENT';
    const where: any = { examId };

    if (isStudent && user?.id) {
      const studentProfile = await this.prisma.studentProfile.findUnique({ where: { userId: user.id } });
      if (!studentProfile) return [];
      where.studentId = studentProfile.id;

      const results = await this.prisma.examResult.findMany({
        where,
        include: {
          student: {
            include: { user: { select: SAFE_USER_SELECT } }
          },
          studentAnswers: true
        }
      });

      const answersReleased = await this.isAnswersReleased(examId);

      // SEC: Before authorized release, do not reveal answers or isCorrect per question
      return results.map(r => ({
        id: r.id,
        examId: r.examId,
        studentId: r.studentId,
        marksObtained: r.marksObtained,
        maxMarks: r.maxMarks,
        grade: r.grade,
        remarks: r.remarks,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        student: r.student,
        studentAnswers: answersReleased ? r.studentAnswers : r.studentAnswers.map(sa => ({
          id: sa.id,
          questionId: sa.questionId,
          selectedOption: sa.selectedOption,
          answerFileUrl: sa.answerFileUrl,
        }))
      }));
    }

    if (user && !isSuperAdmin(user)) {
      const exam = await this.prisma.exam.findUnique({
        where: { id: examId },
        select: {
          centreId: true,
          batchId: true,
          subjectId: true,
          standardId: true,
          boardId: true,
          batch: { select: { centreId: true } }
        }
      });
      if (!exam) throw new NotFoundException('Exam not found');
      const examCentreId = exam.centreId || exam.batch?.centreId;
      if (!examCentreId) {
        throw new ForbiddenException('Exams without an assigned centre can only be managed by Super Administrators.');
      }
      assertCentreAccess(user, examCentreId);

      const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
      if (isTeacher) {
        await this.assertTeacherExamAccess(user.id, exam);
      }
    }

    return this.prisma.examResult.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: SAFE_USER_SELECT }
          }
        },
        studentAnswers: true
      }
    });
  }

  async getExamStudents(examId: string, user?: any): Promise<any> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { batch: { select: { centreId: true } } }
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (user && !isSuperAdmin(user)) {
      const examCentreId = exam.centreId || exam.batch?.centreId;
      if (!examCentreId) {
        throw new ForbiddenException('Exams without an assigned centre can only be managed by Super Administrators.');
      }
      assertCentreAccess(user, examCentreId);

      const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
      if (isTeacher) {
        await this.assertTeacherExamAccess(user.id, exam);
      }
    }

    const whereClause: any = {};
    if (exam.batchId) {
      whereClause.batchId = exam.batchId;
    } else {
      const batchWhere: any = {};
      if (exam.academicYearId) batchWhere.academicYearId = exam.academicYearId;
      if (exam.boardId) batchWhere.boardId = exam.boardId;
      if (exam.standardId) batchWhere.standardId = exam.standardId;
      if (exam.centreId) batchWhere.centreId = exam.centreId;
      if (Object.keys(batchWhere).length > 0) {
        whereClause.batch = batchWhere;
      }
      if (exam.targetTrackId) whereClause.trackId = exam.targetTrackId;
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: whereClause,
      include: { studentProfile: { include: { user: { select: SAFE_USER_SELECT } } } }
    });

    const studentMap = new Map<string, any>();
    for (const e of enrollments) {
      if (e.studentProfile) {
        studentMap.set(e.studentProfileId, {
          studentId: e.studentProfileId,
          name: `${e.studentProfile.user?.firstName || ''} ${e.studentProfile.user?.lastName || ''}`.trim() || 'Student',
          admissionNo: e.studentProfile.admissionNo
        });
      }
    }

    const results = await this.prisma.examResult.findMany({
      where: { examId },
      include: { student: { include: { user: { select: SAFE_USER_SELECT } } } }
    });
    for (const r of results) {
      if (r.student && !studentMap.has(r.studentId)) {
        studentMap.set(r.studentId, {
          studentId: r.studentId,
          name: `${r.student.user?.firstName || ''} ${r.student.user?.lastName || ''}`.trim() || 'Student',
          admissionNo: r.student.admissionNo
        });
      }
    }

    return Array.from(studentMap.values());
  }

  async saveExamResults(examId: string, results: any[], user?: any) {
    if (!Array.isArray(results)) {
      throw new BadRequestException('Results must be an array.');
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        batch: { select: { centreId: true } },
        mcqQuestions: true,
      }
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const effectiveCentreId = exam.centreId || exam.batch?.centreId;
    if (user && !isSuperAdmin(user)) {
      if (!effectiveCentreId) {
        throw new ForbiddenException('Exams without an assigned centre can only be managed by Super Administrators.');
      }
      assertCentreAccess(user, effectiveCentreId);

      const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
      if (isTeacher) {
        await this.assertTeacherExamAccess(user.id, exam);
      }
    }

    const questionsTotalMarks = exam.mcqQuestions?.reduce((sum, q) => sum + Number(q.marks || 4), 0) || 0;
    const defaultMaxMarks = questionsTotalMarks > 0 ? questionsTotalMarks : 100;

    const seenStudentIds = new Set<string>();
    const validatedRecords: {
      studentId: string;
      marksObtained: number;
      maxMarks: number;
      grade: string;
      remarks: string | null;
    }[] = [];

    for (const [idx, r] of results.entries()) {
      if (!r || typeof r !== 'object') {
        throw new BadRequestException(`Invalid result entry at index ${idx}.`);
      }
      if (!r.studentId || typeof r.studentId !== 'string') {
        throw new BadRequestException(`Missing or invalid studentId at index ${idx}.`);
      }
      if (seenStudentIds.has(r.studentId)) {
        throw new BadRequestException(`Duplicate studentId '${r.studentId}' in results payload.`);
      }
      seenStudentIds.add(r.studentId);

      const student = await this.prisma.studentProfile.findUnique({
        where: { id: r.studentId },
        include: { enrollments: { include: { batch: true } } }
      });
      if (!student) {
        throw new BadRequestException(`Student profile not found for id '${r.studentId}'.`);
      }

      // Check effective centre membership (direct or via batch)
      const studentCentres = student.enrollments.map(e => e.batch?.centreId).filter(Boolean);
      if (effectiveCentreId) {
        if (studentCentres.length === 0 || !studentCentres.includes(effectiveCentreId)) {
          throw new ForbiddenException(`Student '${r.studentId}' does not belong to exam centre '${effectiveCentreId}'.`);
        }
      }

      // Check batch membership if exam is batch-specific
      if (exam.batchId) {
        const studentBatches = student.enrollments.map(e => e.batchId).filter(Boolean);
        if (!studentBatches.includes(exam.batchId)) {
          throw new ForbiddenException(`Student '${r.studentId}' is not enrolled in required exam batch '${exam.batchId}'.`);
        }
      }

      const marksObtained = Number(r.marksObtained);
      if (isNaN(marksObtained) || !isFinite(marksObtained) || marksObtained < 0) {
        throw new BadRequestException(`Invalid marksObtained for student '${r.studentId}'. Must be a non-negative finite number.`);
      }

      let maxMarks = defaultMaxMarks;
      if (questionsTotalMarks > 0) {
        if (r.maxMarks !== undefined && Number(r.maxMarks) !== questionsTotalMarks) {
          throw new BadRequestException(`Supplied maxMarks (${r.maxMarks}) does not match configured exam total marks (${questionsTotalMarks}) for student '${r.studentId}'.`);
        }
        maxMarks = questionsTotalMarks;
      } else if (r.maxMarks !== undefined) {
        maxMarks = Number(r.maxMarks);
      }
      if (isNaN(maxMarks) || !isFinite(maxMarks) || maxMarks <= 0) {
        throw new BadRequestException(`Invalid maxMarks for student '${r.studentId}'. Must be a positive finite number.`);
      }

      if (marksObtained > maxMarks) {
        throw new BadRequestException(`marksObtained (${marksObtained}) cannot exceed maxMarks (${maxMarks}) for student '${r.studentId}'.`);
      }

      const expectedGrade = calculateGrade(marksObtained, maxMarks);
      if (r.grade !== undefined && r.grade !== null && String(r.grade).trim() !== '') {
        const suppliedGrade = String(r.grade).trim().toUpperCase();
        if (suppliedGrade !== expectedGrade) {
          throw new BadRequestException(`Inconsistent grade '${r.grade}' for student '${r.studentId}'. Based on marks ${marksObtained}/${maxMarks}, expected grade is '${expectedGrade}'.`);
        }
      }
      const grade = expectedGrade;

      validatedRecords.push({
        studentId: r.studentId,
        marksObtained,
        maxMarks,
        grade,
        remarks: r.remarks ? String(r.remarks).slice(0, 500) : null,
      });
    }

    return this.prisma.$transaction(async (prisma) => {
      await prisma.examResult.deleteMany({ where: { examId } });

      if (validatedRecords.length > 0) {
        await prisma.examResult.createMany({
          data: validatedRecords.map(vr => ({
            examId,
            ...vr,
          }))
        });
      }

      return { success: true, count: validatedRecords.length };
    });
  }

  async submitExamAttempt(examId: string, studentId: string, answers: Record<string, string>, score?: any) {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw new BadRequestException('Answers payload must be an object mapping question IDs to selected answers.');
    }

    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentId },
      include: { enrollments: { include: { batch: true } } }
    });
    if (!profile) {
      throw new ForbiddenException('Student profile not found.');
    }
    const studentProfileId = profile.id;

    // Verify student is eligible for the exam
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { batch: true }
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const studentCentres = profile.enrollments.map(e => e.batch?.centreId).filter(Boolean);
    const studentStandards = profile.enrollments.map(e => e.batch?.standardId).filter(Boolean);
    const studentBoards = profile.enrollments.map(e => e.batch?.boardId).filter(Boolean);
    const studentBatches = profile.enrollments.map(e => e.batchId).filter(Boolean);

    const matchesCentre = !exam.centreId || studentCentres.includes(exam.centreId);
    const matchesBatch = !exam.batchId || studentBatches.includes(exam.batchId);
    const matchesStandard = !exam.standardId || studentStandards.includes(exam.standardId);
    const matchesBoard = !exam.boardId || studentBoards.includes(exam.boardId);

    if (!matchesCentre || !matchesBatch || !matchesStandard || !matchesBoard) {
      throw new ForbiddenException('Access denied: You are not eligible to submit this exam.');
    }

    const existing = await this.prisma.examResult.findFirst({
      where: { examId, studentId: studentProfileId }
    });

    if (existing && exam.type !== 'QUESTION_BANK') {
      throw new BadRequestException('Exam attempt has already been submitted.');
    }

    // 1. Fetch questions to perform server-side authoritative grading (SEC-03)
    const questions = await this.prisma.mcqQuestion.findMany({
      where: { examId }
    });

    if (!questions || questions.length === 0) {
      throw new BadRequestException('Cannot submit attempt: exam has no questions configured.');
    }

    const validQuestionIds = new Set(questions.map(q => q.id));
    for (const submittedQId of Object.keys(answers)) {
      if (!validQuestionIds.has(submittedQId)) {
        throw new BadRequestException(`Question '${submittedQId}' does not belong to this exam.`);
      }
    }

    let calculatedEarned = 0;
    let totalPossible = 0;
    const answerRecords: { qId: string; studentAns: string | null; isCorrect: boolean; marksAwarded: number; isDescriptive: boolean }[] = [];

    for (const q of questions) {
      const qMarks = Number(q.marks ?? 4.0);
      const qNegMarks = Number(q.negativeMarks ?? 1.0);
      totalPossible += qMarks;

      const isDescriptive = q.type === 'DESCRIPTIVE';
      if (!isDescriptive) {
        const studentAns = answers ? answers[q.id] : undefined;
        let isCorrect = false;
        let marksAwarded = 0;
        if (studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== '') {
          if (String(studentAns).trim() === String(q.correctOption).trim()) {
            calculatedEarned += qMarks;
            isCorrect = true;
            marksAwarded = qMarks;
          } else {
            calculatedEarned -= qNegMarks;
            marksAwarded = -qNegMarks;
          }
        }
        answerRecords.push({ qId: q.id, studentAns: studentAns ? String(studentAns) : null, isCorrect, marksAwarded, isDescriptive: false });
      } else {
        const studentAns = answers ? answers[q.id] : null;
        answerRecords.push({ qId: q.id, studentAns: studentAns ? String(studentAns) : null, isCorrect: false, marksAwarded: 0, isDescriptive: true });
      }
    }

    if (totalPossible <= 0) {
      throw new BadRequestException('Cannot submit attempt: exam questions have zero total marks.');
    }

    // SEC-03: Earned marks & maxMarks are strictly calculated by the server from trusted questions.
    // Client-provided score total or earned values are completely ignored.
    const marksObtained = Math.max(0, calculatedEarned);
    const maxMarks = totalPossible;
    const grade = calculateGrade(marksObtained, maxMarks);

    // 2. Transactional result write & answer upsert
    return this.prisma.$transaction(async (prisma) => {
      const inTxExisting = await prisma.examResult.findFirst({
        where: { examId, studentId: studentProfileId }
      });

      if (inTxExisting && exam.type !== 'QUESTION_BANK') {
        throw new BadRequestException('Exam attempt has already been submitted.');
      }

      let examResultId = inTxExisting?.id;
      if (!inTxExisting) {
        const res = await prisma.examResult.create({
          data: {
            examId,
            studentId: studentProfileId,
            marksObtained,
            maxMarks,
            grade,
          }
        });
        examResultId = res.id;
      } else {
        await prisma.examResult.update({
          where: { id: examResultId },
          data: {
            marksObtained,
            maxMarks,
            grade,
          }
        });
      }

      // 3. Upsert student answers
      for (const rec of answerRecords) {
        if (!rec.studentAns) continue;
        const updateData = {
          selectedOption: rec.isDescriptive ? null : rec.studentAns,
          answerFileUrl: rec.isDescriptive ? rec.studentAns : null,
          marksAwarded: rec.marksAwarded,
          isCorrect: rec.isCorrect,
        };

        await prisma.studentAnswer.upsert({
          where: {
            examResultId_questionId: {
              examResultId: examResultId as string,
              questionId: rec.qId,
            }
          },
          create: {
            examResultId: examResultId as string,
            questionId: rec.qId,
            ...updateData
          },
          update: updateData,
        });
      }

      return {
        success: true,
        examResultId,
        marksObtained,
        maxMarks,
        grade,
      };
    });
  }

  async getExamReview(examId: string, user: any): Promise<any> {
    const isStudent = user?.role === 'STUDENT' || user?.role?.name === 'STUDENT';
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        mcqQuestions: true,
        batch: true,
        subject: true,
      }
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (isStudent) {
      const studentProfile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { enrollments: { include: { batch: true } } }
      });
      if (!studentProfile) throw new ForbiddenException('Student profile not found');

      const studentCentres = studentProfile.enrollments.map(e => e.batch?.centreId).filter(Boolean);
      const studentStandards = studentProfile.enrollments.map(e => e.batch?.standardId).filter(Boolean);
      const studentBoards = studentProfile.enrollments.map(e => e.batch?.boardId).filter(Boolean);
      const studentBatches = studentProfile.enrollments.map(e => e.batchId).filter(Boolean);

      const matchesCentre = !exam.centreId || studentCentres.includes(exam.centreId);
      const matchesBatch = !exam.batchId || studentBatches.includes(exam.batchId);
      const matchesStandard = !exam.standardId || studentStandards.includes(exam.standardId);
      const matchesBoard = !exam.boardId || studentBoards.includes(exam.boardId);

      if (!matchesCentre || !matchesBatch || !matchesStandard || !matchesBoard) {
        throw new ForbiddenException('Access denied: You are not eligible for this exam.');
      }

      const result = await this.prisma.examResult.findFirst({
        where: { examId, studentId: studentProfile.id },
        include: { studentAnswers: true }
      });
      if (!result) {
        throw new ForbiddenException('You have not attempted this exam yet.');
      }

      const released = await this.isAnswersReleased(examId);
      if (!released) {
        throw new ForbiddenException('Answer keys and explanations have not been released for this exam.');
      }

      const answerMap = new Map<string, any>();
      for (const sa of result.studentAnswers) {
        answerMap.set(sa.questionId, sa);
      }

      return {
        examId: exam.id,
        title: exam.title,
        marksObtained: result.marksObtained,
        maxMarks: result.maxMarks,
        grade: result.grade,
        questions: exam.mcqQuestions.map(q => {
          const sa = answerMap.get(q.id);
          return {
            id: q.id,
            questionText: q.questionText,
            imageUrl: q.imageUrl,
            options: q.options,
            type: q.type,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
            selectedOption: sa?.selectedOption ?? null,
            isCorrect: sa?.isCorrect ?? false,
            marksAwarded: sa?.marksAwarded ?? 0,
            correctOption: q.correctOption,
            explanation: q.explanation,
          };
        })
      };
    }

    if (user && !isSuperAdmin(user)) {
      const examCentreId = exam.centreId || exam.batch?.centreId;
      if (examCentreId) {
        assertCentreAccess(user, examCentreId);
      }
      const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
      if (isTeacher) {
        await this.assertTeacherExamAccess(user.id, exam);
      }
    }

    return exam;
  }

  async getExamsByTopic(topicId: string, user?: any): Promise<any> {
    const isStudent = user?.role?.name === 'STUDENT' || user?.role === 'STUDENT';
    
    if (isStudent && user?.id) {
      const studentProfile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { enrollments: { include: { batch: true } } }
      });
      if (!studentProfile) return [];

      const studentCentres = studentProfile.enrollments.map(e => e.batch?.centreId).filter(Boolean);
      const studentStandards = studentProfile.enrollments.map(e => e.batch?.standardId).filter(Boolean);
      const studentBoards = studentProfile.enrollments.map(e => e.batch?.boardId).filter(Boolean);
      const studentBatches = studentProfile.enrollments.map(e => e.batchId).filter(Boolean);

      const exams = await this.prisma.exam.findMany({
        where: {
          topicId,
          type: { in: ['MCQ_EXAM', 'MOCK_TEST', 'QUESTION_BANK'] },
          OR: [
            { batchId: { in: studentBatches } },
            {
              AND: [
                { batchId: null },
                { OR: [{ centreId: null }, { centreId: { in: studentCentres } }] },
                { OR: [{ standardId: null }, { standardId: { in: studentStandards } }] },
                { OR: [{ boardId: null }, { boardId: { in: studentBoards } }] },
              ]
            }
          ]
        },
        include: {
          subject: true,
          chapter: true,
          topic: true,
          mcqQuestions: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return exams.map(e => ({
        ...e,
        mcqQuestions: sanitizeQuestions(e.mcqQuestions),
      }));
    }

    const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
    if (isTeacher && user?.id) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: user.id },
        include: { assignments: true, user: { include: { userCentres: true } } }
      });
      if (!teacherProfile || !teacherProfile.assignments || teacherProfile.assignments.length === 0) {
        return [];
      }

      const userCentres = getAuthorizedCentreIds(user);
      const assignmentOrConditions = teacherProfile.assignments
        .filter(a => Boolean(a.subjectId))
        .map(a => {
          const cond: any = { subjectId: a.subjectId };
          if (a.standardId) {
            const stdList = [a.standardId];
            if (a.isCombined && a.combinedClasses) {
              stdList.push(...a.combinedClasses.split(',').map(s => s.trim()).filter(Boolean));
            }
            cond.OR = [{ standardId: null }, { standardId: { in: stdList } }];
          }
          if (a.boardId) {
            cond.AND = [{ OR: [{ boardId: null }, { boardId: a.boardId }] }];
          }
          if (a.batchId) {
            cond.batchId = a.batchId;
          }
          return cond;
        });

      if (assignmentOrConditions.length === 0) {
        return [];
      }

      return this.prisma.exam.findMany({
        where: {
          topicId,
          type: { in: ['MCQ_EXAM', 'MOCK_TEST', 'QUESTION_BANK'] },
          AND: [
            {
              OR: [
                { centreId: { in: userCentres } },
                { batch: { centreId: { in: userCentres } } },
              ]
            },
            {
              OR: assignmentOrConditions
            }
          ]
        },
        include: {
          subject: true,
          chapter: true,
          topic: true,
          mcqQuestions: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    const where: any = {
      topicId,
      type: { in: ['MCQ_EXAM', 'MOCK_TEST', 'QUESTION_BANK'] },
    };

    if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
      where.OR = [
        { centreId: { in: userCentres } },
        { batch: { centreId: { in: userCentres } } },
      ];
    }

    return this.prisma.exam.findMany({
      where,
      include: {
        subject: true,
        chapter: true,
        topic: true,
        mcqQuestions: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createExam(data: any, user?: any) {
    let { title, type, academicYearId, batchId, subjectId, chapterId, topicId, boardId, standardId, centreId, targetTrackId } = data;
    
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new BadRequestException('Exam title is required.');
    }

    const userCentres = user && !isSuperAdmin(user) ? getAuthorizedCentreIds(user) : [];

    if (user && !isSuperAdmin(user)) {
      if (centreId && !userCentres.includes(centreId)) {
        throw new ForbiddenException('Cannot create exam for an unauthorized centre.');
      }
      if (!centreId) {
        centreId = userCentres[0];
      }
    }

    if (!academicYearId || academicYearId === 'dummy') {
      throw new BadRequestException("A valid academicYearId is required. Placeholder 'dummy' is not accepted.");
    }
    const year = await this.prisma.academicYear.findUnique({ where: { id: academicYearId } });
    if (!year) {
      throw new BadRequestException(`Specified academic year '${academicYearId}' does not exist.`);
    }

    if (!subjectId || subjectId === 'dummy') {
      throw new BadRequestException("A valid subjectId is required. Placeholder 'dummy' is not accepted.");
    }
    const sub = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!sub) {
      throw new BadRequestException(`Specified subject '${subjectId}' does not exist.`);
    }

    if (batchId === 'dummy') {
      throw new BadRequestException("Invalid batchId: 'dummy' is not a valid batch identifier.");
    }

    // Validate destination batch if specified
    let batch: any = null;
    if (batchId) {
      batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
      if (!batch) {
        throw new BadRequestException(`Specified batch '${batchId}' does not exist.`);
      }
      if (user && !isSuperAdmin(user) && batch.centreId && !userCentres.includes(batch.centreId)) {
        throw new ForbiddenException('Specified batch belongs to an unauthorized centre.');
      }
      if (centreId && batch.centreId && batch.centreId !== centreId) {
        throw new BadRequestException('Exam centreId does not match the centre of the specified batch.');
      }
    }

    // Validate destination standard
    if (standardId) {
      const std = await this.prisma.standard.findUnique({ where: { id: standardId } });
      if (!std) {
        throw new BadRequestException(`Specified standard '${standardId}' does not exist.`);
      }
    }

    // Validate destination board
    if (boardId) {
      const brd = await this.prisma.board.findUnique({ where: { id: boardId } });
      if (!brd) {
        throw new BadRequestException(`Specified board '${boardId}' does not exist.`);
      }
    }

    // If teacher, enforce teacher assignment tuple check on creation
    const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
    if (isTeacher && user?.id) {
      await this.assertTeacherExamAccess(user.id, {
        centreId,
        subjectId,
        batchId: batchId || null,
        standardId,
        boardId,
        batch,
      });
    }

    return this.prisma.exam.create({
      data: {
        title: title.trim(),
        type: type || 'QUESTION_BANK',
        academicYearId,
        batchId: batchId || null,
        subjectId,
        chapterId: chapterId || null,
        topicId: topicId || null,
        boardId: boardId || null,
        standardId: standardId || null,
        centreId: centreId || null,
        targetTrackId: targetTrackId || null,
      }
    });
  }

  async getMcqQuestions(user?: any): Promise<any> {
    const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
    if (isTeacher && user?.id) {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: user.id },
        include: { assignments: true, user: { include: { userCentres: true } } }
      });
      if (!teacherProfile || !teacherProfile.assignments || teacherProfile.assignments.length === 0) {
        return [];
      }

      const userCentres = getAuthorizedCentreIds(user);
      const assignmentOrConditions = teacherProfile.assignments
        .filter(a => Boolean(a.subjectId))
        .map(a => {
          const cond: any = { subjectId: a.subjectId };
          if (a.standardId) {
            const stdList = [a.standardId];
            if (a.isCombined && a.combinedClasses) {
              stdList.push(...a.combinedClasses.split(',').map(s => s.trim()).filter(Boolean));
            }
            cond.OR = [{ standardId: null }, { standardId: { in: stdList } }];
          }
          if (a.boardId) {
            cond.AND = [{ OR: [{ boardId: null }, { boardId: a.boardId }] }];
          }
          if (a.batchId) {
            cond.batchId = a.batchId;
          }
          return cond;
        });

      if (assignmentOrConditions.length === 0) {
        return [];
      }

      return this.prisma.mcqQuestion.findMany({
        where: {
          exam: {
            AND: [
              {
                OR: [
                  { centreId: { in: userCentres } },
                  { batch: { centreId: { in: userCentres } } },
                ]
              },
              {
                OR: assignmentOrConditions
              }
            ]
          }
        },
        include: { exam: true },
        orderBy: { createdAt: 'desc' }
      });
    }

    const where: any = {};
    if (user && !isSuperAdmin(user)) {
      const userCentres = getAuthorizedCentreIds(user);
      where.exam = {
        OR: [
          { centreId: { in: userCentres } },
          { batch: { centreId: { in: userCentres } } },
        ]
      };
    }
    return this.prisma.mcqQuestion.findMany({
      where,
      include: { exam: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createMcqQuestion(data: any, user?: any): Promise<any> {
    const { questionText, imageUrl, options, correctOption, explanation, marks, negativeMarks, examId, type } = data;
    if (examId && user && !isSuperAdmin(user)) {
      const exam = await this.prisma.exam.findUnique({
        where: { id: examId },
        include: { batch: { select: { centreId: true, standardId: true, boardId: true } } }
      });
      if (!exam) throw new NotFoundException('Exam not found');
      const examCentreId = exam.centreId || exam.batch?.centreId;
      if (!examCentreId) {
        throw new ForbiddenException('Exams without an assigned centre can only be managed by Super Administrators.');
      }
      assertCentreAccess(user, examCentreId);

      const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
      if (isTeacher) {
        await this.assertTeacherExamAccess(user.id, exam);
      }
    }

    return this.prisma.mcqQuestion.create({
      data: {
        questionText,
        imageUrl,
        options,
        correctOption,
        explanation,
        marks: marks !== undefined ? Number(marks) : 4.0,
        negativeMarks: negativeMarks !== undefined ? Number(negativeMarks) : 1.0,
        examId,
        type: type || 'MCQ',
      }
    });
  }

  async updateExam(id: string, data: any, user?: any): Promise<any> {
    const existingExam = await this.prisma.exam.findUnique({
      where: { id },
      include: { batch: { select: { centreId: true, standardId: true, boardId: true } } }
    });
    if (!existingExam) throw new NotFoundException('Exam not found');

    const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';

    if (user && !isSuperAdmin(user)) {
      const examCentreId = existingExam.centreId || existingExam.batch?.centreId;
      if (!examCentreId) {
        throw new ForbiddenException('Exams without an assigned centre can only be managed by Super Administrators.');
      }
      assertCentreAccess(user, examCentreId);
      if (isTeacher) {
        await this.assertTeacherExamAccess(user.id, existingExam);
      }
    }

    const {
      title,
      type,
      academicYearId,
      batchId,
      subjectId,
      chapterId,
      topicId,
      boardId,
      standardId,
      centreId,
      targetTrackId,
      questions,
    } = data;

    const userCentres = user && !isSuperAdmin(user) ? getAuthorizedCentreIds(user) : [];

    // Derive destination centreId
    const destCentreId = centreId !== undefined ? centreId : existingExam.centreId;

    // Validate destination centreId if explicitly provided
    if (centreId !== undefined && centreId !== null && user && !isSuperAdmin(user)) {
      if (!userCentres.includes(centreId)) {
        throw new ForbiddenException(`Cannot transfer exam to unauthorized centre '${centreId}'.`);
      }
    }

    // Derive destination batchId and batch record
    let destBatch: any = null;
    let destBatchId: string | null = null;
    if (batchId !== undefined) {
      if (batchId === 'dummy') {
        throw new BadRequestException("Invalid batchId: 'dummy' is not a valid batch identifier.");
      }
      if (batchId === null || batchId === '') {
        destBatchId = null;
        destBatch = null;
      } else {
        destBatchId = batchId;
        const b = await this.prisma.batch.findUnique({ where: { id: batchId } });
        if (!b) {
          throw new BadRequestException(`Specified destination batch '${batchId}' does not exist.`);
        }
        if (user && !isSuperAdmin(user) && b.centreId && !userCentres.includes(b.centreId)) {
          throw new ForbiddenException('Specified destination batch belongs to an unauthorized centre.');
        }
        destBatch = b;
      }
    } else {
      destBatchId = existingExam.batchId;
      destBatch = existingExam.batch;
    }

    // Destination effective centre
    const effectiveDestCentre = destCentreId || destBatch?.centreId;

    // Ensure non-superadmin cannot remove centre scope
    if (user && !isSuperAdmin(user)) {
      if (!effectiveDestCentre) {
        throw new ForbiddenException('Cannot remove centre scope from an exam. Non-superadmin exams must have an effective centre.');
      }
      assertCentreAccess(user, effectiveDestCentre);
    }

    // Inconsistency check between destCentreId and destBatch.centreId
    if (destBatch?.centreId && destCentreId && destBatch.centreId !== destCentreId) {
      throw new BadRequestException('Destination exam centreId does not match the centre of the destination batch.');
    }

    // Validate destination subjectId
    const destSubjectId = subjectId !== undefined ? subjectId : existingExam.subjectId;
    if (subjectId !== undefined) {
      if (!subjectId || subjectId === 'dummy') {
        throw new BadRequestException('A valid subjectId is required.');
      }
      const sub = await this.prisma.subject.findUnique({ where: { id: subjectId } });
      if (!sub) {
        throw new BadRequestException(`Specified destination subject '${subjectId}' does not exist.`);
      }
    }

    // Validate destination standardId
    const destStandardId = standardId !== undefined ? standardId : existingExam.standardId;
    if (standardId !== undefined && standardId !== null) {
      const std = await this.prisma.standard.findUnique({ where: { id: standardId } });
      if (!std) {
        throw new BadRequestException(`Specified destination standard '${standardId}' does not exist.`);
      }
    }

    // Validate destination boardId
    const destBoardId = boardId !== undefined ? boardId : existingExam.boardId;
    if (boardId !== undefined && boardId !== null) {
      const brd = await this.prisma.board.findUnique({ where: { id: boardId } });
      if (!brd) {
        throw new BadRequestException(`Specified destination board '${boardId}' does not exist.`);
      }
    }

    // Validate destination academicYearId
    if (academicYearId !== undefined) {
      if (!academicYearId || academicYearId === 'dummy') {
        throw new BadRequestException('A valid academicYearId is required.');
      }
      const yr = await this.prisma.academicYear.findUnique({ where: { id: academicYearId } });
      if (!yr) {
        throw new BadRequestException(`Specified academic year '${academicYearId}' does not exist.`);
      }
    }

    // If teacher, check that new target tuple is also within teacher's assignments
    if (isTeacher) {
      await this.assertTeacherExamAccess(user.id, {
        centreId: effectiveDestCentre,
        subjectId: destSubjectId,
        batchId: destBatchId,
        standardId: destStandardId,
        boardId: destBoardId,
        batch: destBatch,
      });
    }

    const updatePayload: any = {};
    if (title !== undefined) updatePayload.title = title;
    if (type !== undefined) updatePayload.type = type;
    if (academicYearId !== undefined) updatePayload.academicYearId = academicYearId;
    if (batchId !== undefined) updatePayload.batchId = destBatchId;
    if (subjectId !== undefined) updatePayload.subjectId = destSubjectId;
    if (chapterId !== undefined) updatePayload.chapterId = chapterId || null;
    if (topicId !== undefined) updatePayload.topicId = topicId || null;
    if (boardId !== undefined) updatePayload.boardId = boardId || null;
    if (standardId !== undefined) updatePayload.standardId = standardId || null;
    if (centreId !== undefined) updatePayload.centreId = centreId || null;
    if (targetTrackId !== undefined) updatePayload.targetTrackId = targetTrackId || null;

    await this.prisma.$transaction(async (prisma) => {
      await prisma.exam.update({
        where: { id },
        data: updatePayload,
      });

      if (Array.isArray(questions)) {
        const existing = await prisma.mcqQuestion.findMany({
          where: { examId: id },
          select: { id: true }
        });
        const existingIds = new Set(existing.map(q => q.id));
        const incomingIds = new Set(questions.filter(q => q.id).map(q => q.id));

        const toDelete = [...existingIds].filter(qid => !incomingIds.has(qid));
        if (toDelete.length > 0) {
          await prisma.mcqQuestion.deleteMany({
            where: { id: { in: toDelete } }
          });
        }

        for (const q of questions) {
          if (!q.text && !q.questionText) continue;
          const qText = q.text || q.questionText;
          const qType = q.type || 'MCQ';
          const qOptions = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : undefined;
          let correctOption = q.correctOption;
          if (correctOption === undefined && q.correct !== undefined && Array.isArray(qOptions)) {
            correctOption = qOptions[q.correct]?.text ?? qOptions[q.correct];
          }

          const qData: any = {
            questionText: qText,
            type: qType,
            imageUrl: q.imageUrl || null,
            explanation: q.explanation || null,
            options: qOptions,
            correctOption: correctOption !== undefined ? String(correctOption) : null,
            marks: q.marks !== undefined ? Number(q.marks) : 4.0,
            negativeMarks: q.negativeMarks !== undefined ? Number(q.negativeMarks) : 1.0,
          };

          if (q.id && existingIds.has(q.id)) {
            await prisma.mcqQuestion.update({
              where: { id: q.id },
              data: qData
            });
          } else {
            await prisma.mcqQuestion.create({
              data: {
                ...qData,
                examId: id
              }
            });
          }
        }
      }
    });

    return this.getExamById(id, user);
  }

  async deleteExam(id: string, user?: any): Promise<any> {
    const existingExam = await this.prisma.exam.findUnique({
      where: { id },
      include: { batch: { select: { centreId: true } } }
    });
    if (!existingExam) throw new NotFoundException('Exam not found');

    if (user && !isSuperAdmin(user)) {
      const examCentreId = existingExam.centreId || existingExam.batch?.centreId;
      if (!examCentreId) {
        throw new ForbiddenException('Exams without an assigned centre can only be managed by Super Administrators.');
      }
      assertCentreAccess(user, examCentreId);
      const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
      if (isTeacher) {
        await this.assertTeacherExamAccess(user.id, existingExam);
      }
    }

    return this.prisma.exam.delete({
      where: { id }
    });
  }

  async updateMcqQuestion(id: string, data: any, user?: any): Promise<any> {
    const existing = await this.prisma.mcqQuestion.findUnique({
      where: { id },
      include: { exam: { include: { batch: { select: { centreId: true, standardId: true, boardId: true } } } } }
    });
    if (!existing) throw new NotFoundException('Question not found');

    if (user && !isSuperAdmin(user)) {
      const examCentreId = existing.exam?.centreId || existing.exam?.batch?.centreId;
      if (!examCentreId) {
        throw new ForbiddenException('Exams without an assigned centre can only be managed by Super Administrators.');
      }
      assertCentreAccess(user, examCentreId);

      const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
      if (isTeacher && existing.exam) {
        await this.assertTeacherExamAccess(user.id, existing.exam);
      }
    }

    const { questionText, text, imageUrl, options, correctOption, explanation, marks, negativeMarks, type } = data;
    return this.prisma.mcqQuestion.update({
      where: { id },
      data: {
        ...(questionText || text ? { questionText: questionText || text } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(options !== undefined ? { options: typeof options === 'string' ? JSON.parse(options) : options } : {}),
        ...(correctOption !== undefined ? { correctOption: String(correctOption) } : {}),
        ...(explanation !== undefined ? { explanation } : {}),
        ...(marks !== undefined ? { marks: Number(marks) } : {}),
        ...(negativeMarks !== undefined ? { negativeMarks: Number(negativeMarks) } : {})
      }
    });
  }

  async deleteMcqQuestion(id: string, user?: any): Promise<any> {
    const existing = await this.prisma.mcqQuestion.findUnique({
      where: { id },
      include: { exam: { include: { batch: { select: { centreId: true, standardId: true, boardId: true } } } } }
    });
    if (!existing) throw new NotFoundException('Question not found');

    if (user && !isSuperAdmin(user)) {
      const examCentreId = existing.exam?.centreId || existing.exam?.batch?.centreId;
      if (!examCentreId) {
        throw new ForbiddenException('Exams without an assigned centre can only be managed by Super Administrators.');
      }
      assertCentreAccess(user, examCentreId);

      const isTeacher = user?.role?.name === 'TEACHER' || user?.role === 'TEACHER';
      if (isTeacher && existing.exam) {
        await this.assertTeacherExamAccess(user.id, existing.exam);
      }
    }

    return this.prisma.mcqQuestion.delete({
      where: { id }
    });
  }
}