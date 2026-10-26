import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StudyMaterialService } from '../study-materials/study-materials.service';

@Injectable()
export class EstudyService {
  private studyMaterialService: StudyMaterialService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() studyMaterialService?: StudyMaterialService,
  ) {
    this.studyMaterialService = studyMaterialService || new StudyMaterialService(prisma);
  }

  async getMaterials(currentUser?: any) {
    return this.studyMaterialService.getAll(currentUser);
  }

  async createMaterial(data: any, currentUser?: any) {
    let syllabusId = data?.syllabusId;
    if (!syllabusId) {
      const firstSyllabus = this.prisma.syllabus?.findFirst ? await this.prisma.syllabus.findFirst() : null;
      if (!firstSyllabus) {
        throw new BadRequestException('A valid syllabus must be configured before creating study materials');
      }
      syllabusId = firstSyllabus.id;
    }

    let academicYearId = data?.academicYearId;
    if (!academicYearId) {
      const ay = (this.prisma.academicYear?.findFirst && await this.prisma.academicYear.findFirst({ where: { isActive: true } })) ||
        (this.prisma.academicYear?.findFirst && await this.prisma.academicYear.findFirst());
      if (!ay) {
        throw new BadRequestException('An active academic year must be configured before creating study materials');
      }
      academicYearId = ay.id;
    }

    return this.studyMaterialService.create({ ...data, syllabusId, academicYearId }, currentUser);
  }
}
