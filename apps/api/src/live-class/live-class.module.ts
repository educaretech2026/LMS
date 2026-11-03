import { Module } from '@nestjs/common';
import { LiveClassController } from './live-class.controller';
import { LiveClassService } from './live-class.service';
import { PrismaService } from '../database/prisma.service';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';
import { GoogleMeetService } from './google-meet.service';

@Module({
  imports: [RedisModule, StorageModule],
  controllers: [LiveClassController],
  providers: [LiveClassService, PrismaService, GoogleMeetService],
  exports: [LiveClassService],
})
export class LiveClassModule {}
