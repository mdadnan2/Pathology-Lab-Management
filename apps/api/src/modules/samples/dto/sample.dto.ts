import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SampleStatus } from '@prisma/client';

export class UpdateSampleStatusDto {
  @ApiProperty({ enum: SampleStatus }) @IsEnum(SampleStatus) status: SampleStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) rejectionReason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}
