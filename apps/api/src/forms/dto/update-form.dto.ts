import { IsString, IsOptional, IsBoolean, IsArray, MaxLength } from 'class-validator';

export class UpdateFormDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsOptional()
  fields?: any[];

  @IsString()
  @IsOptional()
  centreId?: string;
}
