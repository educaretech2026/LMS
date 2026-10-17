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
  getAll(@Req() req: any) {
    return this.liveClassService.getAll(req.user);
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  getStats(@Req() req: any) {
    return this.liveClassService.getStats(req.user);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getById(@Param('id') id: string, @Req() req: any) {
    return this.liveClassService.getById(id, req.user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  async create(@Body() data: any, @Req() req: any) {
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
    return this.liveClassService.create(data, req.user);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'SCHEDULED' | 'LIVE' | 'ENDED',
    @Req() req: any
  ) {
    return this.liveClassService.updateStatus(id, status, req.user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.liveClassService.delete(id, req.user);
  }
}

