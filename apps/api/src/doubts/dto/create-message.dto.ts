import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateDoubtMessageDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsOptional()
  attachments?: any;

  @IsOptional()
  attachmentUrls?: any;

  @IsBoolean()
  @IsOptional()
  isInternalAdminNote?: boolean;
}
