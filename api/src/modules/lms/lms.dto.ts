import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageMetaDto } from '../../libs/http/http.dto';

/** One card on /classes: a series (course) or a single held session. */
export class ClassCardDto {
  @ApiProperty({ description: 'Course id when openAs=course, else lms item id' })
  id!: string;
  @ApiProperty({ enum: ['course', 'item'] })
  openAs!: 'course' | 'item';
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  speaker!: string | null;
  @ApiProperty() summary!: string;
  @ApiProperty() heldAt!: string;
  @ApiProperty() sessionCount!: number;
  @ApiPropertyOptional({ nullable: true, type: String })
  coverFileId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  coverUrl!: string | null;
  @ApiProperty() hasAudio!: boolean;
}

export class ClassSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  speaker!: string | null;
  @ApiProperty() summary!: string;
  @ApiProperty() heldAt!: string;
  @ApiProperty({ description: '1-based chronological order (oldest = 1)' })
  sessionNumber!: number;
  @ApiPropertyOptional({ nullable: true, type: String })
  coverFileId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  coverUrl!: string | null;
  @ApiProperty() hasAudio!: boolean;
  @ApiPropertyOptional({ nullable: true, type: String })
  audioUrl!: string | null;
}

export class ClassDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['course', 'item'] })
  openAs!: 'course' | 'item';
  @ApiProperty() title!: string;
  @ApiProperty() sessionCount!: number;
  @ApiProperty({ type: ClassSessionDto })
  activeSession!: ClassSessionDto;
  /** Present only when sessionCount > 1; ordered last → first (newest first). */
  @ApiProperty({ type: [ClassSessionDto] })
  playlist!: ClassSessionDto[];
}

export class ClassCardsPageDto extends PageMetaDto {
  @ApiProperty({ type: [ClassCardDto] })
  items!: ClassCardDto[];
}

/** @deprecated Prefer ClassCardDto — kept for OpenAPI stability during transition. */
export class LmsItemSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  speaker!: string | null;
  @ApiProperty() summary!: string;
  @ApiProperty() heldAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  courseTitle!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  coverFileId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  coverUrl!: string | null;
  @ApiProperty() hasAudio!: boolean;
  @ApiProperty() publishedAt!: string;
}

export class LmsItemDetailDto extends LmsItemSummaryDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  audioUrl!: string | null;
}

export class LmsItemsPageDto extends PageMetaDto {
  @ApiProperty({ type: [LmsItemSummaryDto] })
  items!: LmsItemSummaryDto[];
}
