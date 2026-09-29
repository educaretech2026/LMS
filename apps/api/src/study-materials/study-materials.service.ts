import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class StudyMaterialService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    try {
      return await this.prisma.studyMaterial.findMany({
        include: {
          academicYear: true,
          syllabus: {
            include: { board: true, standard: true, subject: true }
          },
          chapter: true,
          topic: true,
          uploader: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to fetch study materials', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getById(id: string) {
    return this.prisma.studyMaterial.findUnique({
      where: { id },
    });
  }

  async create(data: any) {
    try {
      let { academicYearId, syllabusId } = data;

      // Handle dummy values for testing
      if (academicYearId === "dummy-academic-year" || !academicYearId) {
        const year = await this.prisma.academicYear.findFirst();
        academicYearId = year?.id;
      }
      
      if (syllabusId === "dummy-syllabus-id" || !syllabusId) {
        let syllabus = null;
        if (data.boardId && data.standardId && data.subjectId) {
          syllabus = await this.prisma.syllabus.findFirst({
            where: {
              boardId: data.boardId,
              standardId: data.standardId,
              subjectId: data.subjectId,
            }
          });
        }
        
        if (!syllabus) {
          syllabus = await this.prisma.syllabus.findFirst();
        }
        
        if (!syllabus) {
           // create a dummy board, standard, subject, and syllabus if none exist
           const board = await this.prisma.board.findFirst() || await this.prisma.board.create({ data: { name: 'Dummy Board' } });
           const standard = await this.prisma.standard.findFirst() || await this.prisma.standard.create({ data: { name: 'Dummy Standard', boardId: board.id } });
           const subject = await this.prisma.subject.findFirst() || await this.prisma.subject.create({ data: { name: 'Dummy Subject' } });
           syllabus = await this.prisma.syllabus.create({ data: { boardId: board.id, standardId: standard.id, subjectId: subject.id } });
        }
        syllabusId = syllabus.id;
      }

      return await this.prisma.studyMaterial.create({
        data: {
          title: data.title,
          type: data.type,
          url: data.url,
          thumbnailUrl: data.thumbnailUrl,
          academicYearId,
          syllabusId,
          chapterId: data.chapterId,
          topicId: data.topicId,
          uploaderId: data.uploaderId,
          targetTrack: data.targetTrack || 'BOTH',
        },
      });
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to create study material', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getByTopic(topicId: string) {
    return this.prisma.studyMaterial.findMany({
      where: { topicId },
      include: {
        academicYear: true,
        syllabus: {
          include: { board: true, standard: true, subject: true }
        },
        chapter: true,
        topic: true,
        uploader: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async delete(id: string) {
    try {
      return await this.prisma.studyMaterial.delete({
        where: { id },
      });
    } catch (error) {
      console.error(error);
      throw new HttpException('Failed to delete study material', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
