import { Controller, Get, Put, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ProgressService } from './progress.service';
import { PrismaService } from '../database/prisma.service';
import { SyllabusConfiguration } from '@educare/database';
import { Permissions } from '../common/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('syllabus-config')
@Permissions('SYLLABUS')
export class ConfigController {
  constructor(
    private progressService: ProgressService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async getConfig(): Promise<SyllabusConfiguration> {
    return this.progressService.getConfiguration();
  }

  @Put()
  @Roles('SUPER_ADMIN')
  async updateConfig(@Body() data: any): Promise<SyllabusConfiguration> {
    const config = await this.progressService.getConfiguration();

    // Whitelist and validate configuration fields
    const allowedFields = [
      'lectureWeight',
      'materialWeight',
      'practiceWeight',
      'testWeight',
      'inProgressThreshold',
      'completedThreshold',
      'masteryCompletionThreshold',
      'masteryAccuracyThreshold',
      'masteryTestScoreThreshold',
      'masteryMinQuestions',
      'weakPracticeThreshold',
      'weakTestThreshold',
      'revisionIntervalsDays',
    ];

    const sanitizedData: any = {};
    for (const key of Object.keys(data || {})) {
      if (allowedFields.includes(key)) {
        sanitizedData[key] = data[key];
      }
    }

    if (Object.keys(sanitizedData).length === 0) {
      throw new BadRequestException('No valid configuration fields provided for update.');
    }

    return this.prisma.syllabusConfiguration.update({
      where: { id: config.id },
      data: sanitizedData,
    });
  }
}
