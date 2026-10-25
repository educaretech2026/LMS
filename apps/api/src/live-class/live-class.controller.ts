import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { LiveClassService } from './live-class.service';
import { GoogleMeetService } from './google-meet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('live-class')
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions('LIVE_CLASSES')
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

  // Public Endpoint: Retrieve public webinar/class info (no auth required)
  @Public()
  @Get('public/:id')
  getPublicClass(@Param('id') id: string) {
    return this.liveClassService.getPublicClass(id);
  }

  // Public Endpoint: Submit registration form & retrieve Google Meet access
  @Public()
  @Post('public/:id/register')
  registerAttendee(
    @Param('id') id: string,
    @Body() body: { name: string; email: string; phone: string; organization: string; honeypot?: string },
  ) {
    return this.liveClassService.registerAttendee(id, body);
  }

  // Admin / Teacher: View all registered attendees for a live class
  @Get(':id/registrations')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  getRegistrations(@Param('id') id: string, @Req() req: any) {
    return this.liveClassService.getRegistrations(id, req.user);
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

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  update(
    @Param('id') id: string,
    @Body() data: any,
    @Req() req: any
  ) {
    return this.liveClassService.update(id, data, req.user);
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

