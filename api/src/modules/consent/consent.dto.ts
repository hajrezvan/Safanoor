import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { consentItems, ConsentItem } from '@safanoor/shared';

export class ConsentItemDto {
  @ApiProperty({ enum: consentItems }) @IsIn(consentItems) key!: ConsentItem;
  @ApiProperty() @IsString() @Length(3, 500) text!: string;
  @ApiProperty() @IsBoolean() required!: boolean;
}
export class PublishConsentDto {
  @ApiProperty() @IsString() @Length(3, 150) title!: string;
  @ApiProperty({ type: [ConsentItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsentItemDto)
  items!: ConsentItemDto[];
}
export class RecordConsentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() personId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() versionId!: string;
  @ApiProperty({ enum: consentItems, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsIn(consentItems, { each: true })
  acceptedItems!: ConsentItem[];
}
export class ConsentVersionDto {
  @ApiProperty() id!: string;
  @ApiProperty() version!: number;
  @ApiProperty() title!: string;
  @ApiProperty({ type: [ConsentItemDto] }) items!: ConsentItemDto[];
  @ApiProperty() publishedAt!: string;
}
export class ConsentRecordDto {
  @ApiProperty() id!: string;
  @ApiProperty() personId!: string;
  @ApiProperty() versionId!: string;
  @ApiProperty({ type: [String] }) acceptedItems!: string[];
  @ApiProperty() at!: string;
}
export class ConsentStatusDto {
  @ApiProperty({ type: ConsentVersionDto }) version!: ConsentVersionDto;
  @ApiProperty({ type: [ConsentRecordDto] }) records!: ConsentRecordDto[];
  @ApiProperty() canSign!: boolean;
  @ApiProperty() signerIsParent!: boolean;
}
export class ConsentQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  personId?: string;
}
