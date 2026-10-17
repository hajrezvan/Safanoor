import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { PageMetaDto } from '../../libs/http/http.dto';

export class CreateGroupDto {
  @ApiProperty() @IsString() @Length(2, 100) name!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() ownerPersonId!: string;
}
export class MembershipDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() personId!: string;
  @ApiProperty({ enum: ['member', 'assistant'] })
  @IsIn(['member', 'assistant'])
  role!: 'member' | 'assistant';
}
export class AssignmentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() memberPersonId!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assistantPersonId?: string;
}
export class GroupRoleDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() personId!: string;
  @ApiProperty({ enum: ['finance_officer'] })
  @IsIn(['finance_officer'])
  role!: 'finance_officer';
}
export class GroupDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() ownerPersonId!: string;
  @ApiProperty() ownerName!: string;
  @ApiProperty() memberCount!: number;
  @ApiProperty() assistantCount!: number;
  @ApiProperty() canManage!: boolean;
}
export class GroupsPageDto extends PageMetaDto {
  @ApiProperty({ type: [GroupDto] }) items!: GroupDto[];
}
export class GroupMemberDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
  @ApiPropertyOptional() assistantId?: string;
  @ApiPropertyOptional() assistantName?: string;
}
export class MembersPageDto extends PageMetaDto {
  @ApiProperty({ type: [GroupMemberDto] }) items!: GroupMemberDto[];
}
