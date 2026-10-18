import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { UsersController, ProfileController } from './users.controller';
import { UsersService } from './users.service';
import { RedisModule } from '../redis/redis.module';

import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [DatabaseModule, RedisModule, StorageModule],
  controllers: [UsersController, ProfileController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
