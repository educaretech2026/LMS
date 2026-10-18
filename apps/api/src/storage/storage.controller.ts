import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
}

