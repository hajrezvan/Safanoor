import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PageMetaDto } from '../../libs/http/http.dto';

export class ResolutionInputDto {
  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  text!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true, type: String })
  @IsOptional()
  @IsDateString({ strict: true })
  dueDate?: string | null;
}

export class CreateMeetingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  groupId!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  heldAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  place?: string;

  @ApiProperty({ enum: ['public', 'workgroup'] })
  @IsIn(['public', 'workgroup'])
  kind!: 'public' | 'workgroup';

  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  attendeeIds!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  agenda?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  summary?: string;

  @ApiPropertyOptional({ type: [ResolutionInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolutionInputDto)
  resolutions?: ResolutionInputDto[];
}

export class UpdateMeetingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  title?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  heldAt?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  place?: string | null;

  @ApiPropertyOptional({ enum: ['public', 'workgroup'] })
  @IsOptional()
  @IsIn(['public', 'workgroup'])
  kind?: 'public' | 'workgroup';

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  attendeeIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  agenda?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  summary?: string;

  @ApiPropertyOptional({ type: [ResolutionInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolutionInputDto)
  resolutions?: ResolutionInputDto[];
}

export class MeetingAttendeeDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class ResolutionDto {
  @ApiProperty() id!: string;
  @ApiProperty() text!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  assigneeId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  assigneeName!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  dueDate!: string | null;
}

export class MeetingSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty() title!: string;
  @ApiProperty() heldAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  place!: string | null;
  @ApiProperty({ enum: ['public', 'workgroup'] })
  kind!: 'public' | 'workgroup';
  @ApiProperty({ enum: ['draft', 'recorded', 'approved'] })
  status!: 'draft' | 'recorded' | 'approved';
  @ApiProperty() attendeeCount!: number;
  @ApiProperty() attendeePreview!: string;
  @ApiProperty() canManage!: boolean;
}

export class MeetingDetailDto extends MeetingSummaryDto {
  @ApiProperty() agenda!: string;
  @ApiProperty() summary!: string;
  @ApiProperty({ type: [MeetingAttendeeDto] }) attendees!: MeetingAttendeeDto[];
  @ApiProperty({ type: [ResolutionDto] }) resolutions!: ResolutionDto[];
}

export class MeetingsPageDto extends PageMetaDto {
  @ApiProperty({ type: [MeetingSummaryDto] }) items!: MeetingSummaryDto[];
}
