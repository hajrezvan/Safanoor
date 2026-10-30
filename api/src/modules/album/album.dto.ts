import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { PageMetaDto } from '../../libs/http/http.dto';

function parseUuidList(value: unknown): string[] | unknown {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value.split(',');
  } catch {
    return value.split(',').map((part) => part.trim()).filter(Boolean);
  }
}

export class UploadPhotoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  groupId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  eventNote?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  locationOptionId?: string;

  @ApiPropertyOptional({
    description: 'Free-text place; registered as location_option when new',
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  place?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @Transform(({ value }) => parseUuidList(value))
  @IsArray()
  @ArrayMaxSize(40)
  @IsUUID('4', { each: true })
  taggedPersonIds?: string[];
}

export class UpdatePhotoTagsDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMaxSize(40)
  @IsUUID('4', { each: true })
  taggedPersonIds!: string[];
}

export class PhotoTagDto {
  @ApiProperty() personId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
}

export class PhotoSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() hostGroupId!: string;
  @ApiProperty() hostGroupName!: string;
  @ApiProperty() fileId!: string;
  @ApiProperty() contentUrl!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  title!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  eventNote!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String, format: 'uuid' })
  locationOptionId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  placeLabel!: string | null;
  @ApiProperty() uploadedBy!: string;
  @ApiProperty() uploaderName!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() canManage!: boolean;
  @ApiProperty() tagCount!: number;
}

export class PhotoDetailDto extends PhotoSummaryDto {
  @ApiProperty({ type: [PhotoTagDto] }) tags!: PhotoTagDto[];
}

export class PhotosPageDto extends PageMetaDto {
  @ApiProperty({ type: [PhotoSummaryDto] }) items!: PhotoSummaryDto[];
}
