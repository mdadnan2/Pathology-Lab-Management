import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'rajesh.sharma@pathlab.demo' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Demo@1234' })
  @IsString()
  @MinLength(6)
  password: string;
}
