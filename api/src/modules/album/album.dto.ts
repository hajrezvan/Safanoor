import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
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

/** Sentinel album key for photos without an album_title. */
export const OTHER_ALBUM_KEY = '__other__';

export class UploadPhotoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  groupId!: string;

  @ApiPropertyOptional({
    description: 'Program/event album name; photos with the same title form one album',
  })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  albumTitle?: string;

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

export class ListPhotosQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({
    description:
      'Album key from GET /album/albums (exact album title, or __other__ for untitled)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  albumKey?: string;
}

export class ListAlbumsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
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
  albumTitle!: string | null;
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

export class AlbumSummaryDto {
  @ApiProperty({
    description: 'Stable album key (album title, or __other__ when untitled)',
  })
  key!: string;
  @ApiProperty() title!: string;
  @ApiProperty() photoCount!: number;
  @ApiProperty({ format: 'uuid' }) coverPhotoId!: string;
  @ApiProperty() coverContentUrl!: string;
  @ApiProperty({ description: 'Newest photo created_at in this album' })
  latestAt!: string;
}

export class AlbumsPageDto extends PageMetaDto {
  @ApiProperty({ type: [AlbumSummaryDto] }) items!: AlbumSummaryDto[];
}
