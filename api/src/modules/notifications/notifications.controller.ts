import {
  HttpCode,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { PageMetaDto, PaginationDto } from '../../libs/http/http.dto';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import { SuccessDto } from '../auth/auth.controller';
import { NotificationsService } from './notifications.service';

export class NotificationDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: Record<string, unknown>;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true, type: String }) readAt!: string | null;
}
export class NotificationsPageDto extends PageMetaDto {
  @ApiProperty({ type: [NotificationDto] }) items!: NotificationDto[];
}
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get()
  @Policy('notification', 'read')
  @ApiOkResponse({ type: NotificationsPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<NotificationsPageDto> {
    return this.notifications.list(actor, query);
  }
  @HttpCode(200)
  @Post(':id/read')
  @Policy('notification', 'update')
  @ApiOkResponse({ type: SuccessDto })
  async read(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SuccessDto> {
    await this.notifications.markRead(actor, id);
    return { success: true };
  }
}
