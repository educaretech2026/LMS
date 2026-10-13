import { Module } from '@nestjs/common';
import { DoubtsController } from './doubts.controller';
import { DoubtsService } from './doubts.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [DoubtsController],
  providers: [DoubtsService],
  exports: [DoubtsService],
})
export class DoubtsModule {}
