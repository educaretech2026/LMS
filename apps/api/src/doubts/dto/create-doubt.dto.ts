import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';

export enum DoubtPriorityDto {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateDoubtDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  teacherId?: string;

  @IsString()
  @IsOptional()
  assignedTeacherId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  chapterId?: string;

  @IsString()
  @IsOptional()
  topicId?: string;

  @IsString()
  @IsOptional()
  centreId?: string;

  @IsEnum(DoubtPriorityDto)
  @IsOptional()
  priority?: DoubtPriorityDto;

  @IsOptional()
  attachments?: any;

  @IsOptional()
  attachmentUrls?: any;
}
