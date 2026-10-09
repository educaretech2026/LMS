import { Controller, Get, Post, Patch, Delete, Body, Param, UsePipes, ValidationPipe, Query } from '@nestjs/common';
import { LiveClassService } from './live-class.service';
import { GoogleMeetService } from './google-meet.service';

@UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
@Controller('live-class')
export class LiveClassController {
  constructor(
    private readonly liveClassService: LiveClassService,
    private readonly googleMeetService: GoogleMeetService,
  ) {}

  @Get()
  getAll() {
    return this.liveClassService.getAll();
  }

  @Get('stats')
  getStats() {
    return this.liveClassService.getStats();
  }

  @Post()
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
  updateStatus(@Param('id') id: string, @Body('status') status: 'SCHEDULED' | 'LIVE' | 'ENDED') {
    return this.liveClassService.updateStatus(id, status);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.liveClassService.delete(id);
  }
}
