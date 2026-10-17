import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PageMetaDto } from '../../libs/http/http.dto';

export class OverviewDto {
  @ApiProperty() peopleCount!: number;
  @ApiProperty() groupCount!: number;
  @ApiProperty() assistantCount!: number;
  @ApiProperty() consentPending!: number;
  @ApiProperty() unreadCount!: number;
  @ApiProperty() importPending!: number;
  @ApiProperty() supervisorCount!: number;
  @ApiProperty() organizationReady!: boolean;
}
export class AuditDto {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) actorId!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty({ nullable: true, type: String }) resourceId!: string | null;
  @ApiProperty() at!: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) meta!: Record<
    string,
    unknown
  >;
}
export class AuditPageDto extends PageMetaDto {
  @ApiProperty({ type: [AuditDto] }) items!: AuditDto[];
}
export class JobCountDto {
  @ApiProperty() name!: string;
  @ApiProperty() state!: string;
  @ApiProperty() count!: number;
}
export class JobsStatusDto {
  @ApiProperty({ type: [JobCountDto] }) queues!: JobCountDto[];
  @ApiProperty() database!: string;
}
export class RetentionDto {
  @ApiProperty() dataType!: string;
  @ApiProperty() keepDays!: number;
  @ApiProperty() action!: string;
  @ApiProperty() proposed!: boolean;
}
export class RetentionPageDto extends PageMetaDto {
  @ApiProperty({ type: [RetentionDto] }) items!: RetentionDto[];
}
export class UpdateRetentionDto {
  @ApiProperty() @IsInt() @Min(1) @Max(3650) keepDays!: number;
  @ApiProperty({ enum: ['delete', 'anonymize', 'archive'] })
  @IsIn(['delete', 'anonymize', 'archive'])
  action!: string;
}
export class CreateAccountDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() personId!: string;
  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  password!: string;
}
export class ParentLinkDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentUserId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+989\d{9}$/)
  parentPhone?: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() childPersonId!: string;
}
export class ParentAccountDto {
  @ApiProperty() @IsString() @Length(2, 80) firstName!: string;
  @ApiProperty() @IsString() @Length(2, 100) lastName!: string;
  @ApiProperty() @Matches(/^\+989\d{9}$/) phone!: string;
  @ApiProperty() @IsString() @Length(12, 128) password!: string;
}
export class AccountDto {
  @ApiProperty() userId!: string;
  @ApiProperty() personId!: string;
}

export class QualificationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() personId!: string;
  @ApiProperty({ enum: ['member', 'assistant', 'mentor', 'head_mentor'] })
  @IsIn(['member', 'assistant', 'mentor', 'head_mentor'])
  orgLevel!: 'member' | 'assistant' | 'mentor' | 'head_mentor';
}
