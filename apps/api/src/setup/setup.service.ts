import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SetupService {
  constructor(private prisma: PrismaService) {}

  // Centres
  async getCentres() {
    return this.prisma.centre.findMany();
  }
  async createCentre(data: { name: string; code: string; type: string; address?: string }) {
    return this.prisma.centre.create({ data });
  }
  async updateCentre(id: string, data: any) {
    return this.prisma.centre.update({ where: { id }, data });
  }
  async deleteCentre(id: string) {
    const centre = await this.prisma.centre.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userCentres: true, batches: true, liveClasses: true, exams: true, Transaction: true }
        }
      }
    });

    if (!centre) throw new NotFoundException('Centre not found');

    const { userCentres, batches, liveClasses, exams, Transaction } = centre._count;
    if (userCentres > 0 || batches > 0 || liveClasses > 0 || exams > 0 || Transaction > 0) {
      throw new ConflictException(`Cannot delete: Found ${batches} batches, ${liveClasses} live classes, ${exams} exams, ${Transaction} transactions, and ${userCentres} users attached to this centre.`);
    }

    return this.prisma.centre.delete({ where: { id } });
  }

  // Academic Years
  async getAcademicYears() {
    return this.prisma.academicYear.findMany({ orderBy: { startDate: 'desc' } });
  }
  async createAcademicYear(data: { name: string; startDate: Date; endDate: Date; isActive?: boolean }) {
    return this.prisma.academicYear.create({ data });
  }

  // Boards
  async getBoards() {
    return this.prisma.board.findMany();
  }
  async createBoard(data: { name: string; code: string; description?: string }) {
    return this.prisma.board.create({ data });
  }

  // Standards (Classes)
  async getStandards(boardId?: string) {
    return this.prisma.standard.findMany({
      where: boardId ? { boardId } : undefined,
    });
  }
  async createStandard(data: { name: string; code?: string; level: number; boardId: string }) {
    return this.prisma.standard.create({
      data: {
        name: data.name,
        level: data.level,
        boardId: data.boardId,
      }
    });
  }

  // Batches
  async getBatches(boardId?: string, standardId?: string) {
    return this.prisma.batch.findMany({
      where: {
        ...(boardId && { boardId }),
        ...(standardId && { standardId }),
      },
      include: {
        board: true,
        standard: true,
        centre: true,
        track: true
      }
    });
  }

  async createBatch(data: { name: string; academicYearId: string; boardId: string; standardId: string; centreId: string; trackId?: string }) {
    return this.prisma.batch.create({ data });
  }

  async deleteBatch(id: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id }, include: { _count: { select: { enrollments: true, assignments: true, exams: true } } } });
    if (!batch) return;
    
    const { enrollments, assignments, exams } = batch._count;
    if (enrollments > 0 || assignments > 0 || exams > 0) {
      throw new ConflictException(`Cannot delete: Found ${enrollments} enrollments, ${assignments} assignments, and ${exams} exams attached to this batch.`);
    }

    return this.prisma.batch.delete({ where: { id } });
  }

  // Target Tracks
  async getTracks() {
    return this.prisma.targetTrack.findMany({ orderBy: { name: 'asc' } });
  }

  async createTrack(data: { name: string }) {
    return this.prisma.targetTrack.create({ data });
  }

  async deleteTrack(id: string) {
    const track = await this.prisma.targetTrack.findUnique({ where: { id }, include: { _count: { select: { batches: true, enrollments: true, exams: true } } } });
    if (!track) return;

    const { batches, enrollments, exams } = track._count;
    if (batches > 0 || enrollments > 0 || exams > 0) {
      throw new ConflictException(`Cannot delete: Track is in use by ${batches} batches, ${enrollments} enrollments, and ${exams} exams.`);
    }
    
    return this.prisma.targetTrack.delete({ where: { id } });
  }

  // Subjects
  async getSubjects() {
    return this.prisma.subject.findMany();
  }
  
  async createSubject(data: { name: string; boardId?: string; standardId?: string }) {
    // Upsert the subject globally
    const subject = await this.prisma.subject.upsert({
      where: { name: data.name },
      update: {},
      create: { name: data.name },
    });
    
    // If board and standard provided, map it via Syllabus immediately
    if (data.boardId && data.standardId) {
      await this.prisma.syllabus.upsert({
        where: {
          boardId_standardId_subjectId: {
            boardId: data.boardId,
            standardId: data.standardId,
            subjectId: subject.id,
          },
        },
        update: {},
        create: {
          boardId: data.boardId,
          standardId: data.standardId,
          subjectId: subject.id,
        },
      });
    }
    
    return subject;
  }

  // Syllabi
  async getSyllabi(boardId?: string, standardId?: string) {
    return this.prisma.syllabus.findMany({
      where: {
        ...(boardId ? { boardId } : {}),
        ...(standardId ? { standardId } : {}),
      },
      include: { subject: true, standard: true, board: true }
    });
  }
  async createSyllabus(data: { boardId: string; standardId: string; subjectId: string }) {
    return this.prisma.syllabus.create({ data });
  }

  // Chapters
  async getChapters(syllabusId?: string) {
    if (syllabusId) {
      return this.prisma.chapter.findMany({ 
        where: { syllabusId },
        include: { topics: { include: { subtopics: true } } }
      });
    }
    return this.prisma.chapter.findMany({ 
      include: { 
        syllabus: { include: { subject: true } },
        topics: { include: { subtopics: true } }
      } 
    });
  }
  async createChapter(data: { name: string; syllabusId: string }) {
    return this.prisma.chapter.create({ data });
  }

  // Topics
  async getTopics(chapterId?: string) {
    if (chapterId) {
      return this.prisma.topic.findMany({ where: { chapterId }, include: { subtopics: true } });
    }
    return this.prisma.topic.findMany({ include: { chapter: true, subtopics: true } });
  }
  async createTopic(data: { name: string; chapterId: string }) {
    return this.prisma.topic.create({ data });
  }

  // Subtopics
  async getSubtopics(topicId?: string) {
    if (topicId) {
      return this.prisma.subtopic.findMany({ where: { topicId } });
    }
    return this.prisma.subtopic.findMany({ include: { topic: true } });
  }
  async createSubtopic(data: { name: string; topicId: string }) {
    return this.prisma.subtopic.create({ data });
  }

  // Deletions
  async deleteBoard(id: string) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      include: {
        _count: { select: { batches: true, syllabi: true, liveClasses: true, exams: true, standards: true } }
      }
    });
    if (!board) throw new NotFoundException('Board not found');
    
    const { batches, syllabi, liveClasses, exams, standards } = board._count;
    if (batches > 0 || syllabi > 0 || liveClasses > 0 || exams > 0 || standards > 0) {
      throw new ConflictException(`Cannot delete: Found ${standards} classes, ${batches} batches, ${syllabi} syllabi, ${liveClasses} live classes, and ${exams} exams attached to this board.`);
    }
    return this.prisma.board.delete({ where: { id } });
  }

  async deleteStandard(id: string) {
    const standard = await this.prisma.standard.findUnique({
      where: { id },
      include: {
        _count: { select: { batches: true, syllabi: true, liveClasses: true, exams: true } }
      }
    });
    if (!standard) throw new NotFoundException('Class not found');

    const { batches, syllabi, liveClasses, exams } = standard._count;
    if (batches > 0 || syllabi > 0 || liveClasses > 0 || exams > 0) {
      throw new ConflictException(`Cannot delete: Found ${batches} batches, ${syllabi} syllabi, ${liveClasses} live classes, and ${exams} exams attached to this class. Please remove them first.`);
    }
    return this.prisma.standard.delete({ where: { id } });
  }

  async deleteSubject(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        _count: { select: { syllabi: true, teacherAssignments: true, studentAssignments: true, exams: true } }
      }
    });
    if (!subject) throw new NotFoundException('Subject not found');

    const { syllabi, teacherAssignments, studentAssignments, exams } = subject._count;
    if (syllabi > 0 || teacherAssignments > 0 || studentAssignments > 0 || exams > 0) {
      throw new ConflictException(`Cannot delete: Found ${syllabi} syllabi, ${teacherAssignments} teacher assignments, ${studentAssignments} student assignments, and ${exams} exams attached to this subject.`);
    }
    return this.prisma.subject.delete({ where: { id } });
  }

  async deleteSyllabus(id: string) {
    const syllabus = await this.prisma.syllabus.findUnique({
      where: { id },
      include: { _count: { select: { chapters: true, materials: true } } }
    });
    if (!syllabus) throw new NotFoundException('Syllabus not found');

    if (syllabus._count.chapters > 0 || syllabus._count.materials > 0) {
      throw new ConflictException(`Cannot delete: Found ${syllabus._count.chapters} chapters and ${syllabus._count.materials} study materials attached to this syllabus.`);
    }
    return this.prisma.syllabus.delete({ where: { id } });
  }

  async deleteChapter(id: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
      include: { _count: { select: { topics: true, exams: true, materials: true, assignments: true } } }
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

    const { topics, exams, materials, assignments } = chapter._count;
    if (topics > 0 || exams > 0 || materials > 0 || assignments > 0) {
      throw new ConflictException(`Cannot delete: Found ${topics} topics, ${materials} study materials, ${assignments} assignments, and ${exams} exams attached to this chapter.`);
    }
    return this.prisma.chapter.delete({ where: { id } });
  }

  async deleteTopic(id: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: { _count: { select: { subtopics: true, exams: true, materials: true, assignments: true } } }
    });
    if (!topic) throw new NotFoundException('Topic not found');

    const { subtopics, exams, materials, assignments } = topic._count;
    if (subtopics > 0 || exams > 0 || materials > 0 || assignments > 0) {
      throw new ConflictException(`Cannot delete: Found ${subtopics} subtopics, ${materials} study materials, ${assignments} assignments, and ${exams} exams attached to this topic.`);
    }
    return this.prisma.topic.delete({ where: { id } });
  }

  async deleteSubtopic(id: string) {
    return this.prisma.subtopic.delete({ where: { id } });
  }
}
