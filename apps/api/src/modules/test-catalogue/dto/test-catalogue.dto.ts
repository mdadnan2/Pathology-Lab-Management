import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, Min, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTestCategoryDto {
  @ApiProperty({ example: 'Hematology' }) @IsString() @MaxLength(100) name: string;
  @ApiProperty({ example: 'HEM' }) @IsString() @MaxLength(10) code: string;
}

export class CreateLabTestDto {
  @ApiProperty({ example: 'CBC' }) @IsString() @MaxLength(20) code: string;
  @ApiProperty({ example: 'Complete Blood Count' }) @IsString() @MaxLength(200) name: string;
  @ApiProperty() @IsString() categoryId: string;
  @ApiProperty({ example: 'Blood' }) @IsString() specimenType: string;
  @ApiProperty({ example: 'Hematology' }) @IsString() department: string;
  @ApiProperty({ example: 350 }) @Type(() => Number) @IsNumber() @Min(0) price: number;
  @ApiPropertyOptional({ example: 24 }) @IsOptional() @Type(() => Number) @IsNumber() turnaroundHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdateLabTestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() specimenType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() department?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() turnaroundHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class CreateTestParameterDto {
  @ApiProperty() @IsString() labTestId: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() referenceRangeLow?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() referenceRangeHigh?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() referenceRangeText?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() sortOrder?: number;
}
