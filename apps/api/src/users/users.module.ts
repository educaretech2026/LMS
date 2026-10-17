import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { UsersController, ProfileController } from './users.controller';
import { UsersService } from './users.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [UsersController, ProfileController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
