import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
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

export class StudyPathItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() pathId!: string;
  @ApiProperty() position!: number;
  @ApiProperty() bookTitle!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  bookAuthor!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  notes!: string | null;
}

export class StudyPathSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  description!: string | null;
  @ApiProperty() itemCount!: number;
  @ApiProperty() createdBy!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty() canManage!: boolean;
}

export class StudyPathDetailDto extends StudyPathSummaryDto {
  @ApiProperty({ type: [StudyPathItemDto] }) items!: StudyPathItemDto[];
}

export class StudyPathsPageDto extends PageMetaDto {
  @ApiProperty({ type: [StudyPathSummaryDto] })
  items!: StudyPathSummaryDto[];
}
