import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterUserDto {
  @ApiProperty({ example: 'user@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsString()
  @MinLength(6)
  confirmPassword!: string;

  @ApiProperty({ example: 'Thiago' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@email.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'a3f7c7b9d2f14e2e9a6f6e87123d8fb95e9f26ce7d9f2cf9b7bf3e7c8c71d0d2',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: '123456', minLength: 6 })
  @IsString()
  @MinLength(6)
  confirmPassword!: string;
}
