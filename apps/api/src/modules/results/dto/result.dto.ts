import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsIn,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ResultParameterValueDto {
  @ApiProperty()
  @IsUUID()
  testParameterId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  value: string;
}

export class SaveResultDto {
  @ApiProperty({ type: [ResultParameterValueDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ResultParameterValueDto)
  parameters: ResultParameterValueDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReviewResultDto {
  @ApiProperty({ enum: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'] })
  @IsIn(['UNDER_REVIEW', 'APPROVED', 'REJECTED'])
  @IsString()
  status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
}
