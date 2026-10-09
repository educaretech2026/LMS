import { Module } from '@nestjs/common';
import { LiveClassController } from './live-class.controller';
import { LiveClassService } from './live-class.service';
import { PrismaService } from '../database/prisma.service';

import { GoogleMeetService } from './google-meet.service';

@Module({
  controllers: [LiveClassController],
  providers: [LiveClassService, PrismaService, GoogleMeetService],
})
export class LiveClassModule {}
