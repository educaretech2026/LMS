import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { LiveClassService } from './live-class.service';
import { GoogleMeetService } from './google-meet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Throttle } from '@nestjs/throttler';
import { StrictThrottlerGuard } from '../common/guards/strict-throttler.guard';

@Controller('live-class')
@UseGuards(JwtAuthGuard, RolesGuard)
@Permissions('LIVE_CLASSES')
export class LiveClassController {
  constructor(
    private readonly liveClassService: LiveClassService,
    private readonly googleMeetService: GoogleMeetService,
  ) {}

  @Get()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getAll(@Req() req: any): Promise<any> {
    return this.liveClassService.getAll(req.user);
  }

  @Get('stats')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getStats(@Req() req: any) {
    return this.liveClassService.getStats(req.user);
  }

  // LiveKit Token Endpoint: generates a signed JWT room token for in-app classroom
  @Get('token')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getToken(
    @Query('classId') classId: string,
    @Query('roomId') roomId: string,
    @Query('identity') identity: string,
    @Query('name') name: string,
    @Query('role') role: string,
    @Req() req: any,
  ) {
    const classIdentifier = classId || roomId;
    return this.liveClassService.generateLiveKitToken(classIdentifier, req.user, role, identity, name);
  }

  // Public Endpoint: Retrieve public webinar/class info (no auth required)
  @Public()
  @Get('public/:id')
  getPublicClass(@Param('id') id: string) {
    return this.liveClassService.getPublicClass(id);
  }

  // Public Endpoint: Generate LiveKit token for registered attendees of a public webinar
  @Public()
  @UseGuards(StrictThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Get('public/:id/token')
  getPublicToken(
    @Param('id') id: string,
    @Query('registrationToken') registrationToken: string,
    @Query('email') email: string,
    @Query('name') name: string,
  ) {
    return this.liveClassService.generatePublicLiveKitToken(id, registrationToken, email, name);
  }

  // Public Endpoint: Submit registration form & retrieve session access credential
  @Public()
  @UseGuards(StrictThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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

  // Server-Side Moderation: Mute Student, Mute All, Remove Participant
  @Post(':id/moderate')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  moderate(
    @Param('id') id: string,
    @Body() body: {
      action: 'MUTE_STUDENT' | 'MUTE_ALL' | 'REMOVE_PARTICIPANT';
      targetIdentity?: string;
      trackSid?: string;
      muted?: boolean;
    },
    @Req() req: any,
  ) {
    return this.liveClassService.moderateParticipant(
      id,
      body.action,
      body.targetIdentity,
      body.trackSid,
      body.muted ?? true,
      req.user,
    );
  }

  // Persistent Classroom Chat
  @Get(':id/messages')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getChatMessages(@Param('id') id: string, @Req() req: any) {
    return this.liveClassService.getChatMessages(id, req.user);
  }

  @Post(':id/messages')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  saveChatMessage(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const content = body?.message || body?.content || (typeof body === 'string' ? body : '');
    return this.liveClassService.saveChatMessage(id, content, req.user);
  }

  // Persistent Classroom Files
  @Get(':id/files')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getClassFiles(@Param('id') id: string, @Req() req: any) {
    return this.liveClassService.getClassFiles(id, req.user);
  }

  @Post(':id/files')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  saveClassFile(
    @Param('id') id: string,
    @Body() fileData: { fileName: string; fileUrl: string; fileSize?: number; mimeType?: string },
    @Req() req: any,
  ) {
    return this.liveClassService.saveClassFile(id, fileData, req.user);
  }

  // Persistent Whiteboard Snapshot
  @Get(':id/whiteboard-snapshot')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getWhiteboardSnapshot(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.liveClassService.getWhiteboardSnapshot(id, req.user);
  }

  @Post(':id/whiteboard-snapshot')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  saveWhiteboardSnapshot(
    @Param('id') id: string,
    @Body('snapshot') snapshot: any,
    @Req() req: any,
  ): Promise<any> {
    return this.liveClassService.saveWhiteboardSnapshot(id, snapshot, req.user);
  }

  // Centralized Recording
  @Post(':id/recording/start')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  startRecording(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.liveClassService.startRecording(id, req.user);
  }

  @Post(':id/recording/stop')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  stopRecording(
    @Param('id') id: string,
    @Body('recordingUrl') recordingUrl: string,
    @Req() req: any,
  ): Promise<any> {
    return this.liveClassService.stopRecording(id, recordingUrl, req.user);
  }

  @Get(':id/recording')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT')
  getRecording(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.liveClassService.getRecording(id, req.user);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER')
  getById(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.liveClassService.getById(id, req.user);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  async create(@Body() data: any, @Req() req: any): Promise<any> {
    const platform = (data.platform || data.meetingType || data.deliveryProvider || '').toUpperCase();
    if (platform === 'GOOGLE_MEET') {
      if (!data.zoomLink) {
        try {
          data.zoomLink = await this.googleMeetService.createMeetLink(
            data.title,
            data.subject,
            new Date(data.scheduledAt),
            data.duration || 60
          );
          data.deliveryProvider = 'GOOGLE_MEET';
          data.externalMeetingUrl = data.zoomLink;
        } catch (e: any) {
          // If Google Calendar API fails or is unconfigured, fallback cleanly to internal LiveKit room
          // Do NOT generate fake Math.random() URLs!
          const generatedRoomId = `edumeet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          data.zoomLink = generatedRoomId;
          data.deliveryProvider = 'LIVEKIT';
        }
      } else {
        data.deliveryProvider = 'GOOGLE_MEET';
        data.externalMeetingUrl = data.zoomLink;
      }
    } else {
      // Default to Native LiveKit (Edu-Meet)
      data.deliveryProvider = 'LIVEKIT';
      if (!data.zoomLink) {
        data.zoomLink = `edumeet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  ): Promise<any> {
    return this.liveClassService.update(id, data, req.user);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'SCHEDULED' | 'LIVE' | 'ENDED',
    @Req() req: any
  ): Promise<any> {
    return this.liveClassService.updateStatus(id, status, req.user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'CENTRE_ADMIN')
  delete(@Param('id') id: string, @Req() req: any): Promise<any> {
    return this.liveClassService.delete(id, req.user);
  }
}
