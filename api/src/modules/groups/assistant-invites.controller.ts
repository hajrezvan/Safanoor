import {
  Body,
  Controller,
  Get,
  HttpCode,
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
  AssistantInviteCandidatesPageDto,
  AssistantInviteDto,
  AssistantInvitesPageDto,
  CreateAssistantInviteDto,
  RespondAssistantInviteDto,
} from './assistant-invites.dto';
import { AssistantInvitesService } from './assistant-invites.service';

@ApiTags('assistant-invites')
@ApiBearerAuth()
@Controller()
export class AssistantInvitesController {
  constructor(private readonly invites: AssistantInvitesService) {}

  @Get('groups/:id/assistant-invites')
  @Policy('assistant_invite', 'read')
  @ApiOkResponse({ type: AssistantInvitesPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ): Promise<AssistantInvitesPageDto> {
    return this.invites.list(actor, id, query);
  }

  @Get('groups/:id/assistant-invite-candidates')
  @Policy('assistant_invite', 'create')
  @ApiOkResponse({ type: AssistantInviteCandidatesPageDto })
  candidates(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ): Promise<AssistantInviteCandidatesPageDto> {
    return this.invites.candidates(actor, id, query);
  }

  @HttpCode(200)
  @Post('groups/:id/assistant-invites')
  @Policy('assistant_invite', 'create')
  @ApiOkResponse({ type: AssistantInviteDto })
  create(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateAssistantInviteDto,
  ): Promise<AssistantInviteDto> {
    return this.invites.create(actor, id, input);
  }

  @HttpCode(200)
  @Post('assistant-invites/:id/respond')
  @Policy('assistant_invite', 'update')
  @ApiOkResponse({ type: AssistantInviteDto })
  respond(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RespondAssistantInviteDto,
  ): Promise<AssistantInviteDto> {
    return this.invites.respond(actor, id, input);
  }
}
