import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
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
import { PageMetaDto } from '../../libs/http/http.dto';

export const PROGRAM_KINDS = ['camp', 'custom'] as const;
export type ProgramKind = (typeof PROGRAM_KINDS)[number];

export class CreateProgramEventDto {
  @ApiProperty({ enum: PROGRAM_KINDS })
  @IsIn(PROGRAM_KINDS)
  kind!: ProgramKind;

  @ApiPropertyOptional({
    description: 'Required for custom programs. For camp, taken from the selected camp.',
  })
  @ValidateIf((input: CreateProgramEventDto) => input.kind === 'custom')
  @IsString()
  @Length(2, 200)
  title?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required when kind=camp. Links costs to an existing camp.',
  })
  @ValidateIf((input: CreateProgramEventDto) => input.kind === 'camp')
  @IsUUID()
  campId?: string;

  @ApiPropertyOptional({
    description: 'ISO date or datetime (UTC). Optional for custom programs.',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @ValidateIf(
    (_, value) => value !== null && value !== undefined && value !== '',
  )
  @IsString()
  heldAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  place?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ description: 'Integer total amount in toman' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000_000)
  totalAmount!: number;

  @ApiProperty({ description: 'Integer member payment amount in toman' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000_000)
  memberPaymentAmount!: number;
}

export class CreateCostItemDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  title!: string;
  @ApiProperty({ description: 'Integer amount in toman' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000_000)
  amount!: number;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  perPerson?: boolean;
}

export class CostItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() ownerType!: string;
  @ApiProperty() ownerId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() perPerson!: boolean;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: string;
}

export class ProgramEventSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty({ enum: PROGRAM_KINDS }) kind!: ProgramKind;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  campId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  heldAt!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  place!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  notes!: string | null;
  @ApiProperty({ description: 'Stored destination total in toman (independent of cost_item sum)' })
  totalAmount!: number;
  @ApiProperty({ description: 'Stored member payment total in toman' })
  memberPaymentAmount!: number;
  @ApiProperty() itemCount!: number;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty() canManage!: boolean;
}

export class ProgramEventDetailDto extends ProgramEventSummaryDto {
  @ApiProperty({ type: [CostItemDto] }) items!: CostItemDto[];
}

export class ProgramEventsPageDto extends PageMetaDto {
  @ApiProperty({ type: [ProgramEventSummaryDto] })
  items!: ProgramEventSummaryDto[];
}
