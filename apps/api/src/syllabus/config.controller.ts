import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProgressService } from './progress.service';
import { PrismaService } from '../database/prisma.service';
import { SyllabusConfiguration } from '@educare/database';

import { Permissions } from '../common/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard)
@Controller('syllabus-config')
@Permissions('SYLLABUS')
export class ConfigController {
  constructor(
    private progressService: ProgressService,
    private prisma: PrismaService
  ) {}

  @Get()
  async getConfig(): Promise<SyllabusConfiguration> {
    return this.progressService.getConfiguration();
  }

  @Put()
  async updateConfig(@Body() data: any): Promise<SyllabusConfiguration> {
    const config = await this.progressService.getConfiguration();
    return this.prisma.syllabusConfiguration.update({
      where: { id: config.id },
      data: data
    });
  }
}
