import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { latinDigits, normalizePhone, orgLevels } from '@safanoor/shared';
import { PageMetaDto } from '../../libs/http/http.dto';

export class CreatePersonDto {
  @ApiProperty() @IsString() @Length(2, 80) firstName!: string;
  @ApiProperty() @IsString() @Length(2, 100) lastName!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  fatherName?: string;
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== ''
      ? latinDigits(value)
      : undefined,
  )
  @Matches(/^\d{10}$/)
  nationalId?: string;
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePhone(value) : value,
  )
  @Matches(/^\+989\d{9}$/)
  phone!: string;
  @ApiProperty({ enum: orgLevels })
  @IsIn(orgLevels)
  orgLevel!: (typeof orgLevels)[number];
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  groupId?: string;
}
export class UpdatePersonDto extends PartialType(CreatePersonDto) {
  @ApiPropertyOptional({ enum: ['available', 'unavailable'] })
  @IsOptional()
  @IsIn(['available', 'unavailable'])
  availability?: string;
}
export class PersonCapabilitiesDto {
  @ApiProperty() ownGroup!: boolean;
  @ApiProperty() linkParent!: boolean;
  @ApiProperty() update!: boolean;
  @ApiProperty() deactivate!: boolean;
  @ApiProperty() verify!: boolean;
}
export class PersonDto {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() orgLevel!: string;
  @ApiProperty() status!: string;
  @ApiProperty() age!: number;
  @ApiProperty() availability!: string;
  @ApiProperty() nationalIdMasked!: string;
  @ApiPropertyOptional({
    description:
      'Returned only to the verified person viewing their own profile',
  })
  nationalId?: string;
  @ApiPropertyOptional() fatherName?: string;
  @ApiPropertyOptional({ format: 'date' }) birthDate?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() groupId?: string;
  @ApiPropertyOptional() groupName?: string;
  @ApiProperty() verified!: boolean;
  @ApiProperty({ type: PersonCapabilitiesDto })
  capabilities!: PersonCapabilitiesDto;
}
export class PeoplePageDto extends PageMetaDto {
  @ApiProperty({ type: [PersonDto] }) items!: PersonDto[];
}

/** Compact timeline row for the person dossier (no private notes / emergency). */
export class PersonDossierItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  subtitle!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  at!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  href!: string | null;
}

export class PersonDossierSectionDto {
  @ApiProperty({
    enum: [
      'books',
      'payments',
      'camps',
      'consultations',
      'communications',
      'photos',
    ],
  })
  key!:
    | 'books'
    | 'payments'
    | 'camps'
    | 'consultations'
    | 'communications'
    | 'photos';
  /** False when the backing store/API is not ready yet — UI shows a Persian placeholder. */
  @ApiProperty() available!: boolean;
  @ApiProperty({ type: [PersonDossierItemDto] })
  items!: PersonDossierItemDto[];
}

export class PersonDossierDto {
  @ApiProperty({ type: PersonDto }) person!: PersonDto;
  @ApiProperty({ type: [PersonDossierSectionDto] })
  sections!: PersonDossierSectionDto[];
}
export class MeCapabilitiesDto {
  @ApiProperty() viewCamps!: boolean;
  @ApiProperty() viewOrganizationReports!: boolean;
  @ApiProperty() createGroups!: boolean;
  @ApiProperty() admin!: boolean;
  @ApiProperty() managePeople!: boolean;
  @ApiProperty() manageGroups!: boolean;
  @ApiProperty() importPeople!: boolean;
  @ApiProperty() viewPolicies!: boolean;
  @ApiProperty() viewAudit!: boolean;
  @ApiProperty() manageSettings!: boolean;
}
export class ParentChildDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}
export class AvatarStateDto {
  @ApiPropertyOptional() avatarUrl?: string;
  @ApiProperty() canUploadAvatar!: boolean;
}
export class ActiveRoleDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: [
      'technical_manager',
      'director',
      'supervisor',
      'head_mentor',
      'mentor',
      'assistant',
      'member',
    ],
  })
  kind!: string;
  @ApiPropertyOptional() groupId?: string;
  @ApiPropertyOptional() groupName?: string;
  @ApiProperty() label!: string;
}
export class SetActiveRoleDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  roleId!: string;
}
export class MeDto {
  @ApiPropertyOptional() avatarUrl?: string;
  @ApiPropertyOptional() canUploadAvatar?: boolean;
  @ApiProperty({ type: PersonDto }) person!: PersonDto;
  @ApiProperty() isParent!: boolean;
  @ApiProperty() consentRequired!: boolean;
  @ApiProperty({ type: MeCapabilitiesDto }) capabilities!: MeCapabilitiesDto;
  @ApiProperty({ type: [ParentChildDto] }) children!: ParentChildDto[];
  @ApiProperty() moneyUnit!: string;
  @ApiProperty({ type: ActiveRoleDto }) activeRole!: ActiveRoleDto;
  @ApiProperty({ type: [ActiveRoleDto] }) availableRoles!: ActiveRoleDto[];
}
export class VerifyDto {
  @ApiProperty() @IsBoolean() verified!: boolean;
}
