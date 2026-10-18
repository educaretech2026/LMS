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
    const deleted = await this.studyMaterialService.delete(id, req.user);
    if (deleted) {
      if (deleted.url && !deleted.url.includes('youtube.com')) {
        const stillInUse = await this.studyMaterialService.isStorageUrlInUse(deleted.url, deleted.id);
        if (!stillInUse) {
          try {
            await this.storageService.deleteFile(deleted.url);
          } catch (e: any) {
            console.warn(`[Storage] Failed to delete file object for material ${id}:`, e?.message || e);
          }
        }
      }
      if (deleted.thumbnailUrl) {
        const thumbInUse = await this.studyMaterialService.isStorageUrlInUse(deleted.thumbnailUrl, deleted.id);
        if (!thumbInUse) {
          try {
            await this.storageService.deleteFile(deleted.thumbnailUrl);
          } catch (e: any) {
            console.warn(`[Storage] Failed to delete thumbnail object for material ${id}:`, e?.message || e);
          }
        }
      }
    }
    return deleted;
  }

  @Post(':id/progress')
  @Roles('STUDENT')
  updateProgress(
    @Param('id') id: string,
    @Body() progressData: any,
    @Req() req: any
  ) {
    return this.studyMaterialService.updateProgress(id, req.user.id, progressData, req.user);
  }

  @Get('upload-url')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  async getUploadUrl(
    @Query('type') type: 'VIDEO' | 'FILE',
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
    @Req() req: any,
  ) {
    return this.storageService.getPresignedUploadUrl(filename, contentType, req.user?.id);
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
    
    if (!material.url) {
      throw new HttpException('Invalid video URL', HttpStatus.BAD_REQUEST);
    }

    const result = await this.storageService.getPresignedDownloadUrl(material.url, 7200);
    return { playUrl: result.downloadUrl };
  }
}

