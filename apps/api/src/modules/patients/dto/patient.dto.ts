import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsEmail, IsOptional, IsEnum, IsDateString,
  MaxLength, Matches, IsNotEmpty,
} from 'class-validator';
import { Gender, BloodGroup } from '@prisma/client';

export class CreatePatientDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) lastName: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Must be a valid 10-digit Indian mobile number' })
  phone: string;

  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;

  @ApiProperty({ example: '1990-05-15' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: Gender }) @IsEnum(Gender) gender: Gender;
  @ApiPropertyOptional({ enum: BloodGroup }) @IsOptional() @IsEnum(BloodGroup) bloodGroup?: BloodGroup;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
}

export class UpdatePatientDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[6-9]\d{9}$/) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(BloodGroup) bloodGroup?: BloodGroup;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
