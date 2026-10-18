import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { StudyMaterialService } from './study-materials.service';
import { StorageService } from '../storage/storage.service';
import { CloudflareService } from '../cloudflare/cloudflare.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('study-materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudyMaterialController {
  constructor(
    private readonly studyMaterialService: StudyMaterialService,
    private readonly storageService: StorageService,
    private readonly cloudflareService: CloudflareService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getAll(@Req() req: any) {
    return this.studyMaterialService.getAll(req.user);
  }

  @Get('by-topic/:topicId')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getByTopic(@Param('topicId') topicId: string, @Req() req: any) {
    return this.studyMaterialService.getByTopic(topicId, req.user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  create(@Body() data: any, @Req() req: any) {
    return this.studyMaterialService.create({ ...data, uploaderId: req.user.id }, req.user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  async delete(@Param('id') id: string, @Req() req: any) {
    const material = await this.studyMaterialService.getById(id, req.user);
    if (material) {
      if (material.url && !material.url.includes('youtube.com')) {
        await this.storageService.deleteFile(material.url);
      }
      if (material.thumbnailUrl) {
        await this.storageService.deleteFile(material.thumbnailUrl);
      }
    }
    return this.studyMaterialService.delete(id, req.user);
  }

  @Post(':id/progress')
  @Roles('STUDENT', 'PUBLIC_LEARNER', 'SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  updateProgress(
    @Param('id') id: string,
    @Body() progressData: any,
    @Req() req: any
  ) {
    return this.studyMaterialService.updateProgress(id, req.user.id, progressData);
  }

  @Get('upload-url')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  async getUploadUrl(
    @Query('type') type: 'VIDEO' | 'FILE',
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
  ) {
    return this.storageService.getPresignedUploadUrl(filename, contentType);
  }

  @Get(':id/play-url')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  async getPlayUrl(@Param('id') id: string, @Req() req: any) {
    const material = await this.studyMaterialService.getById(id, req.user);
    if (!material) {
      throw new HttpException('Material not found', HttpStatus.NOT_FOUND);
    }
    
    // If it's a YouTube link, just return the url as is
    if (material.url && material.url.includes('youtube.com')) {
      return { playUrl: material.url };
    }
    
    let objectKey = material.url;
    if (objectKey && objectKey.startsWith('http')) {
      const parts = objectKey.split('/');
      objectKey = parts.slice(3).join('/');
    }
    
    if (!objectKey) {
      throw new HttpException('Invalid video URL', HttpStatus.BAD_REQUEST);
    }

    const result = await this.storageService.getPresignedDownloadUrl(objectKey, 7200);
    return { playUrl: result.downloadUrl };
  }
}

