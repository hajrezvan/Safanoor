import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PageMetaDto, PaginationDto } from '../../libs/http/http.dto';

export const CAMP_STATUSES = [
  'draft',
  'permit_pending',
  'permit_ok',
  'registration',
  'running',
  'finished',
  'settled',
] as const;
export type CampStatus = (typeof CAMP_STATUSES)[number];

export class CampsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;
}

export class CreateCampDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  groupId!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiProperty({ format: 'date', description: 'Gregorian YYYY-MM-DD' })
  @IsDateString({ strict: true })
  startsOn!: string;

  @ApiProperty({ format: 'date', description: 'Gregorian YYYY-MM-DD' })
  @IsDateString({ strict: true })
  endsOn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  place?: string;

  @ApiPropertyOptional({ description: 'هدف اردو' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  purpose?: string;

  @ApiPropertyOptional({ description: 'Integer toman' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000_000)
  costAmount?: number;

  @ApiPropertyOptional({ description: 'مدت (متن آزاد، مثلاً ۳ روز)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  durationText?: string;

  @ApiPropertyOptional({ description: 'برنامه زمان‌بندی' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  scheduleText?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  participantIds?: string[];
}

export class UpdateCampDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  title?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  startsOn?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  endsOn?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  place?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  purpose?: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000_000)
  costAmount?: number | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  durationText?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(8000)
  scheduleText?: string | null;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  participantIds?: string[];
}

export class CampParticipantDto {
  @ApiProperty() personId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() status!: string;
}

export class CampPermitDto {
  @ApiProperty() id!: string;
  @ApiProperty() imageFileId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() uploadedBy!: string;
  @ApiProperty() createdAt!: string;
}

export class CampSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  place!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  purpose!: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  costAmount!: number | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  durationText!: string | null;
  @ApiProperty({ format: 'date' }) startsOn!: string;
  @ApiProperty({ format: 'date' }) endsOn!: string;
  @ApiProperty({ enum: CAMP_STATUSES }) status!: CampStatus;
  @ApiProperty() participantCount!: number;
  @ApiProperty() hasPermit!: boolean;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty() canManage!: boolean;
}

export class CampDetailDto extends CampSummaryDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  scheduleText!: string | null;
  @ApiProperty() organizerPersonId!: string;
  @ApiProperty({ type: [CampParticipantDto] })
  participants!: CampParticipantDto[];
  @ApiPropertyOptional({ type: CampPermitDto, nullable: true })
  permit!: CampPermitDto | null;
}

export class CampsPageDto extends PageMetaDto {
  @ApiProperty({ type: [CampSummaryDto] })
  items!: CampSummaryDto[];
}
