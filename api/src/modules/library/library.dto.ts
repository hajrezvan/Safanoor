import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { PageMetaDto } from '../../libs/http/http.dto';

export class CreateStudyPathDto {
  @ApiProperty() @IsString() @Length(2, 200) title!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateStudyPathDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  title?: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class CreateStudyPathItemDto {
  @ApiProperty({ minimum: 1, maximum: 100000 })
  @IsInt()
  @Min(1)
  @Max(100000)
  totalPages!: number;
  @ApiProperty() @IsString() @Length(1, 300) bookTitle!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bookAuthor?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateStudyPathItemDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  totalPages?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 300)
  bookTitle?: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bookAuthor?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class ReorderStudyPathItemsDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  itemIds!: string[];
}

export class UpdateReadingDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  currentPage?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() confirmCompleted?: boolean;
  @ApiProperty({ enum: ['not_started', 'reading', 'completed'] })
  @IsIn(['not_started', 'reading', 'completed'])
  status!: 'not_started' | 'reading' | 'completed';
}

export class StudyReadingProgressDto {
  @ApiProperty() started!: boolean;
  @ApiProperty() completedCount!: number;
  @ApiProperty() totalCount!: number;
  @ApiProperty() percent!: number;
}

export class ReadingDayDto {
  @ApiProperty() day!: string;
  @ApiProperty() pages!: number;
}
export class StudyPathItemDto {
  @ApiProperty({ nullable: true, type: Number }) totalPages!: number | null;
  @ApiProperty() currentPage!: number;
  @ApiProperty({ type: [ReadingDayDto] }) readingHistory!: ReadingDayDto[];
  @ApiProperty({ enum: ['not_started', 'reading', 'completed'] })
  readingStatus!: 'not_started' | 'reading' | 'completed';
  @ApiProperty() id!: string;
  @ApiProperty() pathId!: string;
  @ApiProperty() position!: number;
  @ApiProperty() bookTitle!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  bookAuthor!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  notes!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  coverFileId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  coverUrl!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  pdfFileId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  pdfUrl!: string | null;
}

export class StudyPathSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiPropertyOptional() groupName?: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  description!: string | null;
  @ApiProperty() itemCount!: number;
  @ApiPropertyOptional({ nullable: true, type: String })
  coverFileId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  coverUrl!: string | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty() canManage!: boolean;
}

export class StudyPathDetailDto extends StudyPathSummaryDto {
  @ApiProperty() canTrackReading!: boolean;
  @ApiPropertyOptional({ type: StudyReadingProgressDto, nullable: true })
  readingProgress!: StudyReadingProgressDto | null;
  @ApiProperty({ type: [StudyPathItemDto] }) items!: StudyPathItemDto[];
}

export class StudyPathsPageDto extends PageMetaDto {
  @ApiProperty({ type: [StudyPathSummaryDto] })
  items!: StudyPathSummaryDto[];
}
