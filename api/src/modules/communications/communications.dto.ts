import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { PageMetaDto } from '../../libs/http/http.dto';

export class ChatParticipantDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  phone!: string | null;
}

export class ChatThreadDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['group', 'direct'] }) kind!: 'group' | 'direct';
  @ApiProperty() groupId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: [ChatParticipantDto] })
  participants!: ChatParticipantDto[];
  @ApiPropertyOptional({ nullable: true, type: String })
  preview!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String })
  lastMessageAt!: string | null;
  @ApiProperty() messageCount!: number;
  @ApiProperty() canPost!: boolean;
}
export class ChatThreadsPageDto extends PageMetaDto {
  @ApiProperty({ type: [ChatThreadDto] }) items!: ChatThreadDto[];
}
export class ChatMessageDto {
  @ApiProperty() id!: string;
  @ApiProperty() threadId!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() authorName!: string;
  @ApiProperty() body!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() mine!: boolean;
}
export class ChatMessagesPageDto extends PageMetaDto {
  @ApiProperty({ type: [ChatMessageDto] }) items!: ChatMessageDto[];
}
export class PostChatMessageDto {
  @ApiProperty()
  @IsString()
  @Length(1, 4000)
  body!: string;
}
