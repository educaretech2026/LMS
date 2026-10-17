import { Controller, Post, UseGuards } from '@nestjs/common';
import { CloudflareService } from './cloudflare.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('cloudflare')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CloudflareController {
  constructor(private readonly cloudflareService: CloudflareService) {}

  @Post('upload-url')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  async getUploadUrl() {
    return this.cloudflareService.getDirectUploadUrl();
  }
}
