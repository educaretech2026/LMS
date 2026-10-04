import { Controller, Get, Post, Patch, Delete, Body, Param, UsePipes, ValidationPipe, Query } from '@nestjs/common';
import { LiveClassService } from './live-class.service';
import { LiveKitService } from './livekit.service';

@UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
@Controller('live-class')
export class LiveClassController {
  constructor(
    private readonly liveClassService: LiveClassService,
    private readonly liveKitService: LiveKitService,
  ) {}

  @Get()
  getAll() {
    return this.liveClassService.getAll();
  }

  @Get('stats')
  getStats() {
    return this.liveClassService.getStats();
  }

  /**
   * Generate a LiveKit join token.
   * Query params: roomId, identity, name, role (ADMIN|STAFF|STUDENT)
   */
  @Get('token')
  async getToken(
    @Query('roomId') roomId: string,
    @Query('identity') identity: string,
    @Query('name') name: string,
    @Query('role') role: string,
  ) {
    // Students can subscribe only; admins/staff can publish
    const canPublish = role?.toUpperCase() !== 'STUDENT';
    return this.liveKitService.generateToken(roomId, identity, name, canPublish);
  }

  @Post()
  create(@Body() data: any) {
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
