import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SAFE_USER_SELECT, isSuperAdmin, getUserCentreIds } from '../common/utils/tenant.util';

@Injectable()
export class SyllabusService {
  constructor(private prisma: PrismaService) {}

  async assertBatchAccess(batchId: string, user: any, allowStudent = false) {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    if (isSuperAdmin(user)) {
      return batch;
    }

    const roleStr = typeof user?.role === 'object' && user?.role !== null ? user?.role.name : user?.role;
    const normalizedRole = String(roleStr || '').toUpperCase().replace(/[\s_]+/g, '_');

    if (allowStudent && (normalizedRole === 'STUDENT' || normalizedRole === 'PUBLIC_LEARNER')) {
      const student = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { enrollments: true },
      });
      if (!student || !student.enrollments.some(e => e.batchId === batchId)) {
        throw new ForbiddenException('Access denied: You are not enrolled in this batch.');
      }
      return batch;
    }

    // For staff (CENTRE_ADMIN, TEACHER):
    const centreIds = getUserCentreIds(user);
    if (!centreIds || centreIds.length === 0 || !centreIds.includes(batch.centreId)) {
      throw new ForbiddenException('Access denied: You are not authorized for this batch centre.');
    }

    if (normalizedRole === 'TEACHER') {
      const teacherProfile = await this.prisma.teacherProfile.findUnique({
        where: { userId: user.id },
        include: { assignments: true },
      });
      const assignments = teacherProfile?.assignments || [];
      const hasAssignment = assignments.some(a => {
        if (a.batchId && a.batchId === batchId) return true;
        const assignedCentreId = a.centreId;
        if (assignedCentreId && assignedCentreId !== batch.centreId) return false;
        if (a.standardId && a.standardId !== batch.standardId) return false;
        if (a.boardId && a.boardId !== batch.boardId) return false;
        return true;
      });
      if (!hasAssignment) {
        throw new ForbiddenException('Access denied: Teacher is not assigned to this batch.');
      }
    }

    return batch;
  }

  async getBatchSyllabusProgress(batchId: string, user?: any) {
    const batch = await this.assertBatchAccess(batchId, user, true);

    const syllabi = await this.prisma.syllabus.findMany({
      where: {
        boardId: batch.boardId,
        standardId: batch.standardId,
      },
      include: {
        subject: true,
        chapters: {
          include: {
            topics: {
              include: {
                batchProgress: {
                  where: { batchId: batchId }
                }
              }
            },
            batchProgress: {
              where: { batchId: batchId }
            }
          }
        }
      }
    });

    // Transform into a tree structure
    return syllabi.map(syllabus => {
      const chapters = syllabus.chapters.map(chapter => {
        const topics = chapter.topics.map(topic => {
          return {
            id: topic.id,
            name: topic.name,
            status: topic.batchProgress[0]?.status || 'NOT_STARTED',
          };
        });

        // Auto-calculate chapter status based on topics
        let chapterStatus = chapter.batchProgress[0]?.status || 'NOT_STARTED';
        if (topics.length > 0) {
          const completedTopics = topics.filter(t => t.status === 'COMPLETED').length;
          const startedTopics = topics.filter(t => t.status !== 'NOT_STARTED').length;
          
          if (completedTopics === topics.length) {
            chapterStatus = 'COMPLETED';
          } else if (startedTopics > 0) {
            chapterStatus = 'IN_PROGRESS';
          } else {
            chapterStatus = 'NOT_STARTED';
          }
        }

        return {
          id: chapter.id,
          name: chapter.name,
          status: chapterStatus,
          topics: topics,
        };
      });

      return {
        subjectId: syllabus.subject.id,
        subjectName: syllabus.subject.name,
        chapters: chapters,
      };
    });
  }

  async updateChapterProgress(batchId: string, chapterId: string, status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED', userId: string, user?: any) {
    const batch = await this.assertBatchAccess(batchId, user, false);

    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { syllabus: true },
    });
    if (!chapter) {
      throw new NotFoundException('Chapter not found');
    }
    if (chapter.syllabus.boardId !== batch.boardId || chapter.syllabus.standardId !== batch.standardId) {
      throw new BadRequestException('Chapter does not belong to the batch syllabus');
    }

    const progress = await this.prisma.batchChapterProgress.upsert({
      where: {
        batchId_chapterId: {
          batchId,
          chapterId
        }
      },
      create: {
        batchId,
        chapterId,
        status,
        updatedBy: userId,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
      update: {
        status,
        updatedBy: userId,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      }
    });

    if (status === 'COMPLETED' || status === 'NOT_STARTED') {
      const topics = await this.prisma.topic.findMany({ where: { chapterId } });
      for (const topic of topics) {
        await this.prisma.batchTopicProgress.upsert({
          where: { batchId_topicId: { batchId, topicId: topic.id } },
          create: {
            batchId, topicId: topic.id, status, updatedBy: userId,
            completedAt: status === 'COMPLETED' ? new Date() : null,
          },
          update: {
            status, updatedBy: userId,
            completedAt: status === 'COMPLETED' ? new Date() : null,
          }
        });
      }
    }

    return progress;
  }

  async updateTopicProgress(batchId: string, topicId: string, status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED', userId: string, user?: any) {
    const batch = await this.assertBatchAccess(batchId, user, false);

    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { chapter: { include: { syllabus: true } } },
    });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    if (topic.chapter.syllabus.boardId !== batch.boardId || topic.chapter.syllabus.standardId !== batch.standardId) {
      throw new BadRequestException('Topic does not belong to the batch syllabus');
    }

    const progress = await this.prisma.batchTopicProgress.upsert({
      where: {
        batchId_topicId: {
          batchId,
          topicId
        }
      },
      create: {
        batchId,
        topicId,
        status,
        updatedBy: userId,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
      update: {
        status,
        updatedBy: userId,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      }
    });

    const allTopics = await this.prisma.topic.findMany({ where: { chapterId: topic.chapterId } });
    const topicProgresses = await this.prisma.batchTopicProgress.findMany({
      where: { batchId, topicId: { in: allTopics.map(t => t.id) } }
    });
    
    const completedCount = topicProgresses.filter(tp => tp.status === 'COMPLETED').length;
    const startedCount = topicProgresses.filter(tp => tp.status !== 'NOT_STARTED').length;
    
    let newChapterStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' = 'NOT_STARTED';
    if (completedCount === allTopics.length && allTopics.length > 0) {
      newChapterStatus = 'COMPLETED';
    } else if (startedCount > 0) {
      newChapterStatus = 'IN_PROGRESS';
    }
    
    await this.prisma.batchChapterProgress.upsert({
      where: { batchId_chapterId: { batchId, chapterId: topic.chapterId } },
      create: {
          batchId, chapterId: topic.chapterId, status: newChapterStatus, updatedBy: userId,
          completedAt: newChapterStatus === 'COMPLETED' ? new Date() : null,
      },
      update: {
          status: newChapterStatus, updatedBy: userId,
          completedAt: newChapterStatus === 'COMPLETED' ? new Date() : null,
      }
    });

    return progress;
  }

  async getStudentSyllabusProgress(batchId: string, studentId: string, user?: any) {
    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
    });
    if (!studentProfile) {
      throw new NotFoundException('Student profile not found');
    }

    const roleStr = typeof user?.role === 'object' && user?.role !== null ? user?.role.name : user?.role;
    const normalizedRole = String(roleStr || '').toUpperCase().replace(/[\s_]+/g, '_');

    if (normalizedRole === 'STUDENT' || normalizedRole === 'PUBLIC_LEARNER') {
      if (studentProfile.userId !== user?.id) {
        throw new ForbiddenException('Access denied: You can only view your own student progress.');
      }
    }

    const batch = await this.assertBatchAccess(batchId, user, true);

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentProfileId_batchId: { studentProfileId: studentId, batchId } },
      include: { subjects: true }
    });
    if (!enrollment) {
      throw new ForbiddenException('Student is not enrolled in this batch');
    }

    const subjectIds = enrollment.subjects.map(s => s.id);

    const syllabi = await this.prisma.syllabus.findMany({
      where: { boardId: batch.boardId, standardId: batch.standardId, subjectId: { in: subjectIds } },
      include: {
        subject: true,
        chapters: {
          include: {
            topics: {
              include: {
                studentProgress: { where: { studentId, batchId } },
                revisionTasks: { where: { studentId, status: { in: ['UPCOMING', 'DUE'] } } }
              }
            }
          }
        }
      }
    });

    return syllabi;
  }

  async recordStudentEvent(userId: string, data: any, user?: any) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException('Student profile not found');

    const { batchId, topicId } = data;
    if (!batchId || !topicId) {
      throw new BadRequestException('Missing required fields: batchId and topicId');
    }

    // Verify caller is enrolled in the supplied batch
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { studentProfileId_batchId: { studentProfileId: student.id, batchId } },
    });
    if (!enrollment) {
      throw new ForbiddenException('Access denied: Student is not enrolled in this batch.');
    }

    // Verify topic belongs to batch syllabus
    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Batch not found');

    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { chapter: { include: { syllabus: true } } },
    });
    if (!topic) throw new NotFoundException('Topic not found');

    if (topic.chapter.syllabus.boardId !== batch.boardId || topic.chapter.syllabus.standardId !== batch.standardId) {
      throw new BadRequestException('Topic does not belong to the batch syllabus');
    }

    // 1. Calculate Lecture & Material Progress
    const materials = await this.prisma.studyMaterial.findMany({ where: { topicId } });
    const videos = materials.filter(m => m.type === 'VIDEO');
    const docs = materials.filter(m => m.type !== 'VIDEO');

    const materialProgressRecords = await this.prisma.studyMaterialProgress.findMany({
      where: { studentProfileId: student.id, studyMaterialId: { in: materials.map(m => m.id) } }
    });

    let lectureProgress = 0;
    if (videos.length > 0) {
      const completedVideos = videos.filter(v => materialProgressRecords.find(p => p.studyMaterialId === v.id && p.isCompleted));
      lectureProgress = (completedVideos.length / videos.length) * 100;
    } else {
      lectureProgress = 100;
    }

    let matProgress = 0;
    if (docs.length > 0) {
      const openedDocs = docs.filter(d => materialProgressRecords.find(p => p.studyMaterialId === d.id && p.isOpened));
      matProgress = (openedDocs.length / docs.length) * 100;
    } else {
      matProgress = 100;
    }

    // 2. Practice Progress (Assignments)
    const assignments = await this.prisma.assignment.findMany({ where: { topicId, batchId } });
    let practiceProgress = 0;
    if (assignments.length > 0) {
      const submissions = await this.prisma.assignmentSubmission.findMany({
        where: { studentId: student.id, assignmentId: { in: assignments.map(a => a.id) } }
      });
      practiceProgress = (submissions.length / assignments.length) * 100;
    } else {
      practiceProgress = 100;
    }

    // 3. Test Progress (Exams)
    const exams = await this.prisma.exam.findMany({ where: { topicId, batchId } });
    let testProgress = 0;
    if (exams.length > 0) {
      const results = await this.prisma.examResult.findMany({
        where: { studentId: student.id, examId: { in: exams.map(e => e.id) } }
      });
      testProgress = (results.length / exams.length) * 100;
    } else {
      testProgress = 100;
    }

    // 4. Aggregate
    const completionPercentage = (lectureProgress * 0.20) + (matProgress * 0.20) + (practiceProgress * 0.30) + (testProgress * 0.30);
    const status = completionPercentage >= 100 ? 'COMPLETED' : (completionPercentage > 0 ? 'IN_PROGRESS' : 'NOT_STARTED');

    await this.prisma.studentTopicProgress.upsert({
      where: {
        studentId_topicId_batchId: { studentId: student.id, topicId, batchId }
      },
      create: {
        studentId: student.id,
        topicId,
        batchId,
        status,
        completionPercentage,
        lectureProgress,
        materialProgress: matProgress,
        practiceProgress,
        testProgress,
        lastActivityAt: new Date(),
        completedAt: status === 'COMPLETED' ? new Date() : null
      },
      update: {
        status,
        completionPercentage,
        lectureProgress,
        materialProgress: matProgress,
        practiceProgress,
        testProgress,
        lastActivityAt: new Date(),
        completedAt: status === 'COMPLETED' ? new Date() : null
      }
    });

    return { success: true, message: "Event recorded", completionPercentage };
  }

  async getBatchAnalytics(batchId: string, user?: any) {
    await this.assertBatchAccess(batchId, user, false);

    const studentProgress = await this.prisma.studentTopicProgress.findMany({
      where: { batchId },
      include: {
        student: { include: { user: { select: SAFE_USER_SELECT } } },
        topic: true
      }
    });

    const students = new Set(studentProgress.map(p => p.studentId));
    let totalLearningProgress = 0;
    let totalMasteryScore = 0; // Using practice accuracy as a proxy for mastery score here
    let weakTopics: Record<string, number> = {};

    studentProgress.forEach(p => {
      totalLearningProgress += p.completionPercentage;
      totalMasteryScore += p.practiceAccuracy;
      
      if (p.status === 'REVISION_REQUIRED' || p.practiceAccuracy < 60) {
        weakTopics[p.topic.name] = (weakTopics[p.topic.name] || 0) + 1;
      }
    });

    const avgLearningProgress = studentProgress.length ? (totalLearningProgress / studentProgress.length) : 0;
    const avgMastery = studentProgress.length ? (totalMasteryScore / studentProgress.length) : 0;

    // Sort weak topics by frequency
    const topWeakTopics = Object.entries(weakTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      totalStudents: students.size,
      avgLearningProgress: Math.round(avgLearningProgress),
      avgMastery: Math.round(avgMastery),
      topWeakTopics
    };
  }
}
