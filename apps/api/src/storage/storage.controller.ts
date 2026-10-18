import { Controller, Get, Post, Body, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('presigned-url')
  @ApiOperation({ summary: 'Get a presigned URL for direct client-side upload to R2' })
  async getPresignedUrl(
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
    @Req() req: any,
  ) {
    return this.storageService.getPresignedUploadUrl(filename, contentType, req.user?.id, { prefix: 'materials' });
  }

  @Post('finalize')
  @ApiOperation({ summary: 'Verify and finalize an upload, binding strictly to upload owner' })
  async finalizeUpload(
    @Body('objectKey') objectKey: string,
    @Req() req: any,
  ) {
    if (!objectKey) {
      throw new BadRequestException('objectKey is required to finalize upload');
    }
    return this.storageService.finalizeUpload(objectKey, req.user);
  }
}

