import { Controller, Get, Post, Delete, Body, Param, UsePipes, ValidationPipe, Query, UseGuards, Req } from '@nestjs/common';
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
  delete(@Param('id') id: string) {
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
}
