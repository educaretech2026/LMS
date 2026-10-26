import { Module } from '@nestjs/common';
import { StudyMaterialController } from './study-materials.controller';
import { StudyMaterialService } from './study-materials.service';
import { StorageModule } from '../storage/storage.module';
import { CloudflareModule } from '../cloudflare/cloudflare.module';
import { PrismaService } from '../database/prisma.service';

@Module({
  imports: [StorageModule, CloudflareModule],
  controllers: [StudyMaterialController],
  providers: [StudyMaterialService, PrismaService],
  exports: [StudyMaterialService],
})
export class StudyMaterialModule {}
