import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { assertCentreAccess, isSuperAdmin, getUserCentreIds } from '../common/utils/tenant.util';

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
  constructor(private prisma: PrismaService) {}

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

      // SEC-03: Strip answers for students if they haven't submitted
      return exams.map(exam => {
        const hasSubmitted = exam.results && exam.results.length > 0;
        if (!hasSubmitted && exam.mcqQuestions) {
          return {
            ...exam,
            mcqQuestions: sanitizeQuestions(exam.mcqQuestions),
          };
        }
        return exam;
      });
    }

    const where: any = {};
    if (user && !isSuperAdmin(user)) {
      const userCentres = getUserCentreIds(user);
      if (userCentres.length > 0) {
        where.OR = [
          { centreId: { in: userCentres } },
          { batch: { centreId: { in: userCentres } } },
          { centreId: null, batchId: null },
        ];
      }
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
    if (isStudent && user?.id) {
      const studentProfile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id }
      });
      if (studentProfile) {
        where.studentId = studentProfile.id;
      } else {
        return [];
      }
    } else if (user && !isSuperAdmin(user)) {
      const userCentres = getUserCentreIds(user);
      if (userCentres.length > 0) {
        where.exam = {
          OR: [
            { centreId: { in: userCentres } },
            { batch: { centreId: { in: userCentres } } },
          ]
        };
      }
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
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
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
      const studentProfile = await this.prisma.studentProfile.findUnique({ where: { userId: user.id } });
      const hasResult = studentProfile
        ? await this.prisma.examResult.findFirst({ where: { examId: id, studentId: studentProfile.id } })
        : null;

      if (!hasResult && exam.mcqQuestions) {
        return {
          ...exam,
          mcqQuestions: sanitizeQuestions(exam.mcqQuestions),
        };
      }
    } else if (user && !isSuperAdmin(user)) {
      const examCentreId = exam.centreId || exam.batch?.centreId;
      if (examCentreId) {
        assertCentreAccess(user, examCentreId);
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
    } else if (user && !isSuperAdmin(user)) {
      const exam = await this.prisma.exam.findUnique({
        where: { id: examId },
        select: { centreId: true, batch: { select: { centreId: true } } }
      });
      const examCentreId = exam?.centreId || exam?.batch?.centreId;
      if (examCentreId) {
        assertCentreAccess(user, examCentreId);
      }
    }

    return this.prisma.examResult.findMany({
      where,
      include: { student: { include: { user: true } }, studentAnswers: true }
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
      if (examCentreId) {
        assertCentreAccess(user, examCentreId);
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
      include: { studentProfile: { include: { user: true } } }
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

    // Also include any students who already submitted results for this exam
    const results = await this.prisma.examResult.findMany({
      where: { examId },
      include: { student: { include: { user: true } } }
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
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { batch: { select: { centreId: true } } }
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (user && !isSuperAdmin(user)) {
      const examCentreId = exam.centreId || exam.batch?.centreId;
      if (examCentreId) {
        assertCentreAccess(user, examCentreId);
      }
    }

    // Delete existing to support simple upsert list
    await this.prisma.examResult.deleteMany({ where: { examId } });
    
    if (results.length > 0) {
      await this.prisma.examResult.createMany({
        data: results.map((r: any) => {
          const marksObtained = Number(r.marksObtained || 0);
          const maxMarks = Number(r.maxMarks || 100);
          const grade = r.grade || calculateGrade(marksObtained, maxMarks);
          return {
            examId,
            studentId: r.studentId,
            marksObtained,
            maxMarks,
            grade,
            remarks: r.remarks || null,
          };
        })
      });
    }
    return { success: true };
  }

  async submitExamAttempt(examId: string, studentId: string, answers: Record<string, string>, score?: any) {
    const profile = await this.prisma.studentProfile.findUnique({ where: { userId: studentId } });
    const studentProfileId = profile ? profile.id : studentId;

    // 1. Fetch questions to perform server-side authoritative grading (SEC-03)
    const questions = await this.prisma.mcqQuestion.findMany({
      where: { examId }
    });

    let calculatedEarned = 0;
    let totalPossible = 0;

    for (const q of questions) {
      const qMarks = Number(q.marks ?? 4.0);
      const qNegMarks = Number(q.negativeMarks ?? 1.0);
      totalPossible += qMarks;

      if (q.type !== 'DESCRIPTIVE') {
        const studentAns = answers ? answers[q.id] : undefined;
        if (studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== '') {
          if (String(studentAns).trim() === String(q.correctOption).trim()) {
            calculatedEarned += qMarks;
          } else {
            calculatedEarned -= qNegMarks;
          }
        }
      }
    }

    const marksObtained = Math.max(0, calculatedEarned);
    const maxMarks = totalPossible > 0 ? totalPossible : Number(score?.total || 100);
    const grade = calculateGrade(marksObtained, maxMarks);

    // 2. Check if an existing ExamResult is there for this student
    const existing = await this.prisma.examResult.findFirst({
      where: { examId, studentId: studentProfileId }
    });

    let examResultId = existing?.id;
    if (!existing) {
      const res = await this.prisma.examResult.create({
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
      await this.prisma.examResult.update({
        where: { id: examResultId },
        data: {
          marksObtained,
          maxMarks,
          grade,
        }
      });
    }

    const qMap = new Map(questions.map(q => [q.id, q]));

    // 3. Upsert answers
    for (const [qId, ans] of Object.entries(answers || {})) {
      if (!ans) continue;
      const q = qMap.get(qId);
      if (!q) continue;

      const isDescriptive = q.type === 'DESCRIPTIVE';
      
      const updateData = {
        selectedOption: isDescriptive ? null : ans,
        answerFileUrl: isDescriptive ? ans : null,
      };

      await this.prisma.studentAnswer.upsert({
        where: {
          examResultId_questionId: {
            examResultId: examResultId as string,
            questionId: qId,
          }
        },
        create: {
          examResultId: examResultId as string,
          questionId: qId,
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
  }

  async getExamsByTopic(topicId: string, user?: any): Promise<any> {
    const exams = await this.prisma.exam.findMany({
      where: {
        topicId,
        type: { in: ['MCQ_EXAM', 'MOCK_TEST'] },
      },
      include: {
        subject: true,
        chapter: true,
        topic: true,
        mcqQuestions: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const isStudent = user?.role?.name === 'STUDENT' || user?.role === 'STUDENT';
    if (isStudent) {
      return exams.map(e => ({
        ...e,
        mcqQuestions: sanitizeQuestions(e.mcqQuestions),
      }));
    }

    return exams;
  }

  async createExam(data: any, user?: any) {
    let { title, type, academicYearId, batchId, subjectId, chapterId, topicId, boardId, standardId, centreId, targetTrackId } = data;
    
    if (user && !isSuperAdmin(user)) {
      const userCentres = getUserCentreIds(user);
      if (userCentres.length > 0) {
        if (centreId && !userCentres.includes(centreId)) {
          throw new ForbiddenException('Cannot create exam for another centre');
        }
        if (!centreId) {
          centreId = userCentres[0];
        }
      }
    }

    // Ensure we have a valid academicYear
    if (academicYearId === "dummy") {
      let year = await this.prisma.academicYear.findFirst();
      if (!year) {
        year = await this.prisma.academicYear.create({ data: { name: "2026-27 (Dummy)" } });
      }
      academicYearId = year.id;
    }
    
    // Ensure we have a valid batch if requested
    if (batchId === "dummy") {
      let batch = await this.prisma.batch.findFirst();
      if (batch) batchId = batch.id;
      else batchId = null;
    }
    
    // Ensure we have a valid subject
    if (subjectId === "dummy") {
      let subject = await this.prisma.subject.findFirst();
      if (!subject) {
        subject = await this.prisma.subject.create({ data: { name: "Dummy Subject" } });
      }
      subjectId = subject.id;
    }

    return this.prisma.exam.create({
      data: {
        title,
        type: type || 'QUESTION_BANK',
        academicYearId,
        batchId: batchId || undefined,
        subjectId,
        chapterId: chapterId || undefined,
        topicId: topicId || undefined,
        boardId: boardId || undefined,
        standardId: standardId || undefined,
        centreId: centreId || undefined,
        targetTrackId: targetTrackId || null,
      }
    });
  }

  async getMcqQuestions(): Promise<any> {
    return this.prisma.mcqQuestion.findMany({
      include: { exam: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createMcqQuestion(data: any): Promise<any> {
    const { questionText, imageUrl, options, correctOption, explanation, marks, negativeMarks, examId } = data;
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
      }
    });
  }

  async updateExam(id: string, data: any, user?: any): Promise<any> {
    const existingExam = await this.prisma.exam.findUnique({
      where: { id },
      include: { batch: { select: { centreId: true } } }
    });
    if (!existingExam) throw new NotFoundException('Exam not found');

    if (user && !isSuperAdmin(user)) {
      const examCentreId = existingExam.centreId || existingExam.batch?.centreId;
      if (examCentreId) {
        assertCentreAccess(user, examCentreId);
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

    const updatePayload: any = {};
    if (title !== undefined) updatePayload.title = title;
    if (type !== undefined) updatePayload.type = type;
    if (academicYearId !== undefined) updatePayload.academicYearId = academicYearId;
    if (batchId !== undefined) updatePayload.batchId = batchId || null;
    if (subjectId !== undefined) updatePayload.subjectId = subjectId;
    if (chapterId !== undefined) updatePayload.chapterId = chapterId || null;
    if (topicId !== undefined) updatePayload.topicId = topicId || null;
    if (boardId !== undefined) updatePayload.boardId = boardId || null;
    if (standardId !== undefined) updatePayload.standardId = standardId || null;
    if (centreId !== undefined) updatePayload.centreId = centreId || null;
    if (targetTrackId !== undefined) updatePayload.targetTrackId = targetTrackId || null;

    await this.prisma.exam.update({
      where: { id },
      data: updatePayload,
    });

    if (Array.isArray(questions)) {
      const existing = await this.prisma.mcqQuestion.findMany({
        where: { examId: id },
        select: { id: true }
      });
      const existingIds = new Set(existing.map(q => q.id));
      const incomingIds = new Set(questions.filter(q => q.id).map(q => q.id));

      const toDelete = [...existingIds].filter(qid => !incomingIds.has(qid));
      if (toDelete.length > 0) {
        await this.prisma.mcqQuestion.deleteMany({
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
          await this.prisma.mcqQuestion.update({
            where: { id: q.id },
            data: qData
          });
        } else {
          await this.prisma.mcqQuestion.create({
            data: {
              ...qData,
              examId: id
            }
          });
        }
      }
    }

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
      if (examCentreId) {
        assertCentreAccess(user, examCentreId);
      }
    }

    return this.prisma.exam.delete({
      where: { id }
    });
  }

  async updateMcqQuestion(id: string, data: any): Promise<any> {
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

  async deleteMcqQuestion(id: string): Promise<any> {
    return this.prisma.mcqQuestion.delete({
      where: { id }
    });
  }
}