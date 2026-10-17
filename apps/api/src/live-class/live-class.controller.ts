import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { LiveClassService } from './live-class.service';
import { GoogleMeetService } from './google-meet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('live-class')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LiveClassController {
  constructor(
    private readonly liveClassService: LiveClassService,
    private readonly googleMeetService: GoogleMeetService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getAll() {
    return this.liveClassService.getAll();
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  getStats() {
    return this.liveClassService.getStats();
  }

  @Post()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  async create(@Body() data: any) {
    if (!data.zoomLink) {
      try {
        data.zoomLink = await this.googleMeetService.createMeetLink(
          data.title,
          data.subject,
          new Date(data.scheduledAt),
          data.duration
        );
      } catch (e) {
        console.error("Failed to create Google Meet link, falling back to empty link", e);
      }
    }
    return this.liveClassService.create(data);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  updateStatus(@Param('id') id: string, @Body('status') status: 'SCHEDULED' | 'LIVE' | 'ENDED') {
    return this.liveClassService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  delete(@Param('id') id: string) {
    return this.liveClassService.delete(id);
  }
}
