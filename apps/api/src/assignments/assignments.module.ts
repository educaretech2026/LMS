import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { SyllabusModule } from '../syllabus/syllabus.module';

@Module({
  imports: [SyllabusModule],
  controllers: [AssignmentsController],
  providers: [AssignmentsService]
})
export class AssignmentsModule {}
