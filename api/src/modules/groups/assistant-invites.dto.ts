import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';
import { PageMetaDto } from '../../libs/http/http.dto';

export class CreateAssistantInviteDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() inviteePersonId!: string;
}

export class RespondAssistantInviteDto {
  @ApiProperty({ enum: ['accepted', 'rejected'] })
  @IsIn(['accepted', 'rejected'])
  decision!: 'accepted' | 'rejected';
}

export class AssistantInviteDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() groupName!: string;
  @ApiProperty() mentorPersonId!: string;
  @ApiProperty() mentorName!: string;
  @ApiProperty() inviteePersonId!: string;
  @ApiProperty() inviteeName!: string;
  @ApiProperty({ enum: ['pending', 'accepted', 'rejected'] })
  status!: 'pending' | 'accepted' | 'rejected';
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  respondedAt!: string | null;
}

export class AssistantInvitesPageDto extends PageMetaDto {
  @ApiProperty({ type: [AssistantInviteDto] }) items!: AssistantInviteDto[];
}

export class AssistantInviteCandidateDto {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() orgLevel!: string;
}

export class AssistantInviteCandidatesPageDto extends PageMetaDto {
  @ApiProperty({ type: [AssistantInviteCandidateDto] })
  items!: AssistantInviteCandidateDto[];
}
