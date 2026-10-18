import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, MaxLength } from 'class-validator';

export class CreateFormDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsNotEmpty()
  fields: any[];

  @IsString()
  @IsOptional()
  centreId?: string;
}
