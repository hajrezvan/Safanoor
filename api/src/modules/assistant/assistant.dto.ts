import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsDateString,
  IsIn,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PageMetaDto, PaginationDto } from '../../libs/http/http.dto';

export class AssistantMembersQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() campId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sessionId?: string;
}
export class AssistantMemberDto {
  @ApiProperty({ nullable: true, type: Boolean }) present!: boolean | null;
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() verified!: boolean;
  @ApiProperty() recordedSessions!: number;
  @ApiProperty({ nullable: true, type: Number }) attendanceRate!: number | null;
  @ApiProperty() openTasks!: number;
  @ApiProperty() overdueFollowups!: number;
  @ApiProperty({ nullable: true, type: String }) nextFollowup!: string | null;
}
export class AssistantMembersPageDto extends PageMetaDto {
  @ApiProperty({ type: [AssistantMemberDto] }) items!: AssistantMemberDto[];
}
export class AssistantItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() memberId!: string;
  @ApiProperty() memberName!: string;
  @ApiProperty({ enum: ['followup', 'task'] }) kind!: 'followup' | 'task';
  @ApiProperty() title!: string;
  @ApiProperty() dueAt!: string;
  @ApiProperty({ nullable: true, type: String }) completedAt!: string | null;
}
export class AssistantItemsPageDto extends PageMetaDto {
  @ApiProperty({ type: [AssistantItemDto] }) items!: AssistantItemDto[];
}
export class AssistantSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() startsAt!: string;
}
export class AssistantSessionsPageDto extends PageMetaDto {
  @ApiProperty({ type: [AssistantSessionDto] }) items!: AssistantSessionDto[];
}
export class AssistantDutyDto {
  @ApiProperty() id!: string;
  @ApiProperty() campId!: string;
  @ApiProperty() campTitle!: string;
  @ApiProperty() title!: string;
  @ApiProperty() day!: string;
}
export class AssistantDutiesPageDto extends PageMetaDto {
  @ApiProperty({ type: [AssistantDutyDto] }) items!: AssistantDutyDto[];
}
export class AssistantSummaryDto {
  @ApiProperty() groupName!: string;
  @ApiProperty() mentorName!: string;
  @ApiProperty() mentorAvailable!: boolean;
  @ApiProperty() memberCount!: number;
  @ApiProperty() openTasks!: number;
  @ApiProperty() pendingFollowups!: number;
  @ApiProperty() overdueFollowups!: number;
  @ApiProperty() campDuties!: number;
}
export class CreateFollowUpItemDto {
  @ApiProperty() @IsUUID() groupId!: string;
  @ApiProperty() @IsUUID() memberId!: string;
  @ApiProperty({ enum: ['followup', 'task'] })
  @IsIn(['followup', 'task'])
  kind!: 'followup' | 'task';
  @ApiProperty() @IsString() @Length(2, 200) title!: string;
  @ApiProperty() @IsDateString() dueAt!: string;
}
export class CompleteFollowUpItemDto {
  @ApiProperty() @IsBoolean() completed!: boolean;
}
export class MarkSessionAttendanceDto {
  @ApiProperty() @IsUUID() sessionId!: string;
  @ApiProperty() @IsUUID() memberId!: string;
  @ApiProperty() @IsBoolean() present!: boolean;
}
export class EmergencyOpenDto {
  @ApiProperty({ enum: ['urgent_contact', 'camp_incident', 'medical_help'] })
  @IsIn(['urgent_contact', 'camp_incident', 'medical_help'])
  reasonCode!: string;
}
export class EmergencyCardDto {
  @ApiProperty() name!: string;
  @ApiProperty() age!: number;
  @ApiPropertyOptional({ nullable: true, type: String }) contact!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, type: String }) address!:
    | string
    | null;
  @ApiPropertyOptional({ nullable: true, type: String }) medical!:
    | string
    | null;
}

export class CreateAssistantSessionDto {
  @ApiProperty() @IsUUID() groupId!: string;
  @ApiProperty() @IsString() @Length(2, 200) title!: string;
  @ApiProperty() @IsDateString() startsAt!: string;
}
export class UpdateAssistantDutyDto {
  @ApiProperty() @IsString() @Length(2, 200) title!: string;
  @ApiProperty() @IsDateString({ strict: true }) day!: string;
}
