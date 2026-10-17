import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EstudyService {
  constructor(private readonly prisma: PrismaService) {}

  async getMaterials() {
    return this.prisma.studyMaterial.findMany({
      include: {
        academicYear: true,
        syllabus: {
          include: {
            subject: true,
            standard: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createMaterial(data: any) {
    let syllabusId = data.syllabusId;
    if (!syllabusId) {
      const firstSyllabus = await this.prisma.syllabus.findFirst();
      if (!firstSyllabus) {
        throw new BadRequestException('A valid syllabus must be configured before creating study materials');
      }
      syllabusId = firstSyllabus.id;
    }

    let academicYearId = data.academicYearId;
    if (!academicYearId) {
      const ay = await this.prisma.academicYear.findFirst({ where: { isActive: true } }) || await this.prisma.academicYear.findFirst();
      if (!ay) {
        throw new BadRequestException('An active academic year must be configured before creating study materials');
      }
      academicYearId = ay.id;
    }

    return this.prisma.studyMaterial.create({
      data: {
        title: data.title,
        type: data.type || 'VIDEO',
        url: data.url, 
        academicYearId,
        syllabusId,
      }
    });
  }
}
