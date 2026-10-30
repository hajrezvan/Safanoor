import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageMetaDto } from '../../libs/http/http.dto';

export class CreateConsultationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  groupId!: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  memberIds!: string[];

  @ApiProperty({ enum: ['in_person', 'phone'] })
  @IsIn(['in_person', 'phone'])
  kind!: 'in_person' | 'phone';

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  heldAt!: string;

  @ApiProperty({ minimum: 1, maximum: 480 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(480)
  durationMinutes!: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  place?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  sharedSummary?: string;
}

export class UpdateConsultationDto {
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  memberIds?: string[];

  @ApiPropertyOptional({ enum: ['in_person', 'phone'] })
  @IsOptional()
  @IsIn(['in_person', 'phone'])
  kind?: 'in_person' | 'phone';

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  heldAt?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 480 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  place?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  sharedSummary?: string;
}

export class ConsultationMemberDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class ConsultationSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() authorName!: string;
  @ApiProperty() heldAt!: string;
  @ApiProperty({ enum: ['in_person', 'phone'] })
  kind!: 'in_person' | 'phone';
  @ApiProperty() durationMinutes!: number;
  @ApiPropertyOptional({ nullable: true, type: String })
  place!: string | null;
  @ApiProperty() memberCount!: number;
  @ApiProperty() memberPreview!: string;
  @ApiProperty() sharedSummaryPreview!: string;
  @ApiProperty() canManage!: boolean;
}

export class ConsultationDetailDto extends ConsultationSummaryDto {
  @ApiProperty() sharedSummary!: string;
  @ApiProperty({ type: [ConsultationMemberDto] })
  members!: ConsultationMemberDto[];
}

export class ConsultationsPageDto extends PageMetaDto {
  @ApiProperty({ type: [ConsultationSummaryDto] })
  items!: ConsultationSummaryDto[];
}

export class UpsertConsultationPrivateNoteDto {
  @ApiProperty()
  @IsString()
  @MaxLength(8000)
  body!: string;
}

export class ConsultationPrivateNoteDto {
  @ApiPropertyOptional({ nullable: true, type: String, format: 'uuid' })
  id!: string | null;
  @ApiProperty() consultationId!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() body!: string;
  @ApiProperty() canWrite!: boolean;
}
