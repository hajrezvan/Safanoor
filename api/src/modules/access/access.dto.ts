import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { PageMetaDto } from '../../libs/http/http.dto';

export class PolicyDto {
  @ApiProperty() resourceType!: string;
  @ApiProperty() action!: string;
  @ApiProperty() ownerRole!: string;
  @ApiProperty() viewerRelation!: string;
  @ApiProperty() level!: string;
}
export class PoliciesPageDto extends PageMetaDto {
  @ApiProperty({ type: [PolicyDto] }) items!: PolicyDto[];
}
export class CreateGrantDto {
  @ApiProperty({
    enum: ['person_file', 'confidential_note', 'consultation_summary'],
  })
  @IsIn(['person_file', 'confidential_note', 'consultation_summary'])
  resourceType!: 'person_file' | 'confidential_note' | 'consultation_summary';
  @ApiProperty({ format: 'uuid' }) @IsUUID() resourceId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() granteePersonId!: string;
  @ApiProperty() @IsString() @Length(5, 300) reason!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  parentMessage?: string;
}
export class GrantDto {
  @ApiProperty() id!: string;
  @ApiProperty() resourceType!: string;
  @ApiProperty() resourceId!: string;
  @ApiProperty() memberPersonId!: string;
  @ApiProperty() granteePersonId!: string;
  @ApiProperty() grantedBy!: string;
  @ApiProperty() grantedAt!: string;
  @ApiProperty({ nullable: true, type: String }) revokedAt!: string | null;
  @ApiProperty() canRevoke!: boolean;
}
export class GrantsPageDto extends PageMetaDto {
  @ApiProperty({ type: [GrantDto] }) items!: GrantDto[];
}
