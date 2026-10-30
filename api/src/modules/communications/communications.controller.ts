import {
  HttpCode,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../libs/http/http.dto';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import {
  ChatMessageDto,
  ChatMessagesPageDto,
  ChatThreadsPageDto,
  PostChatMessageDto,
} from './communications.dto';
import { CommunicationsService } from './communications.service';

@ApiTags('communications')
@ApiBearerAuth()
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get('threads')
  @Policy('group', 'read')
  @ApiOkResponse({ type: ChatThreadsPageDto })
  listThreads(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<ChatThreadsPageDto> {
    return this.communications.listThreads(actor, query);
  }

  @Get('threads/:id/messages')
  @Policy('chat_thread', 'read')
  @ApiOkResponse({ type: ChatMessagesPageDto })
  listMessages(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ): Promise<ChatMessagesPageDto> {
    return this.communications.listMessages(actor, id, query);
  }

  @HttpCode(200)
  @Post('threads/:id/messages')
  @Policy('chat_thread', 'create')
  @ApiOkResponse({ type: ChatMessageDto })
  postMessage(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: PostChatMessageDto,
  ): Promise<ChatMessageDto> {
    return this.communications.postMessage(actor, id, input);
  }
}
