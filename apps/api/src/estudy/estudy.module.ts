import { Module } from '@nestjs/common';
import { EstudyController } from './estudy.controller';
import { EstudyService } from './estudy.service';
import { PrismaService } from '../database/prisma.service';
import { StudyMaterialModule } from '../study-materials/study-materials.module';

@Module({
  imports: [StudyMaterialModule],
  controllers: [EstudyController],
  providers: [EstudyService, PrismaService],
})
export class EstudyModule {}
