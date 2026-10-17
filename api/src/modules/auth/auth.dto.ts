import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizePhone } from '@safanoor/shared';

export class LoginDto {
  @ApiProperty({ example: '+989100000001' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePhone(value) : value,
  )
  @Matches(/^\+989\d{9}$/)
  login!: string;
  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  password!: string;
}
export class RefreshDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(40, 128)
  refreshToken?: string;
}
export class PasswordDto {
  @ApiProperty() @IsString() @Length(1, 128) currentPassword!: string;
  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  newPassword!: string;
}
export class ClientDto {
  @IsOptional() @IsIn(['web', 'native']) client?: string;
}
