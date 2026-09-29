import { Controller, Get, Post, Delete, Body, Param, UsePipes, ValidationPipe, Query, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { StudyMaterialService } from './study-materials.service';
import { StorageService } from '../storage/storage.service';
import { CloudflareService } from '../cloudflare/cloudflare.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
@Controller('study-materials')
export class StudyMaterialController {
  constructor(
    private readonly studyMaterialService: StudyMaterialService,
    private readonly storageService: StorageService,
    private readonly cloudflareService: CloudflareService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getAll(@Req() req: any) {
    return this.studyMaterialService.getAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-topic/:topicId')
  getByTopic(@Param('topicId') topicId: string) {
    return this.studyMaterialService.getByTopic(topicId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() data: any, @Req() req: any) {
    return this.studyMaterialService.create({ ...data, uploaderId: req.user.id });
  }


  @Delete(':id')
  async delete(@Param('id') id: string) {
    const material = await this.studyMaterialService.getById(id);
    if (material) {
      if (material.url && !material.url.includes('youtube.com')) {
        await this.storageService.deleteFile(material.url);
      }
      if (material.thumbnailUrl) {
        await this.storageService.deleteFile(material.thumbnailUrl);
      }
    }
    return this.studyMaterialService.delete(id);
  }

  @Get('upload-url')
  async getUploadUrl(
    @Query('type') type: 'VIDEO' | 'FILE',
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
  ) {
    // Both VIDEO and FILE now use R2/S3 presigned URLs
    return this.storageService.getPresignedUploadUrl(filename, contentType);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/play-url')
  async getPlayUrl(@Param('id') id: string) {
    const material = await this.studyMaterialService.getById(id);
    if (!material) {
      throw new HttpException('Material not found', HttpStatus.NOT_FOUND);
    }
    
    // If it's a YouTube link, just return the url as is
    if (material.url && material.url.includes('youtube.com')) {
      return { playUrl: material.url };
    }
    
    // Otherwise, generate a short-lived presigned GET URL (e.g. 2 hours)
    // material.url should contain the objectKey or the full public URL. 
    // If it's the full public URL (from old logic), we extract the objectKey.
    let objectKey = material.url;
    if (objectKey && objectKey.startsWith('http')) {
      const parts = objectKey.split('/');
      // e.g. https://domain.com/materials/123-abc-test.mp4
      objectKey = parts.slice(3).join('/'); // 'materials/123-abc-test.mp4'
    }
    
    if (!objectKey) {
      throw new HttpException('Invalid video URL', HttpStatus.BAD_REQUEST);
    }

    const result = await this.storageService.getPresignedDownloadUrl(objectKey, 7200);
    return { playUrl: result.downloadUrl };
  }
}
