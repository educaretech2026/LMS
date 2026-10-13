import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateDoubtMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  attachments?: any;

  @IsBoolean()
  @IsOptional()
  isInternalAdminNote?: boolean;
}
