import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty() @IsUUID() labTestId: string;
}

export class CreateOrderDto {
  @ApiProperty() @IsUUID() patientId: string;
  @ApiPropertyOptional({ type: [OrderItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemDto)
  items?: OrderItemDto[];
  @ApiPropertyOptional({ type: [String], description: 'Optional fixed-price package IDs' })
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true })
  packageIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CancelOrderDto {
  @ApiProperty() @IsString() reason: string;
}
