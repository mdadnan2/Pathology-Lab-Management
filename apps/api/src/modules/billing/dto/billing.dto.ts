import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class RecordPaymentDto {
  @ApiProperty() @IsNumber() @IsPositive() amount: number;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) referenceNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class ApplyDiscountDto {
  @ApiProperty() @IsNumber() @IsPositive() amount: number;
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

export class CancelInvoiceDto {
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

export class ReversePaymentDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) reason: string;
}
