import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../libs/http/http.dto';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import {
  CreateMeetingDto,
  MeetingDetailDto,
  MeetingsPageDto,
  UpdateMeetingDto,
} from './meetings.dto';
import { MeetingsService } from './meetings.service';

@ApiTags('meetings')
@ApiBearerAuth()
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  @Policy('meeting', 'read')
  @ApiOkResponse({ type: MeetingsPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<MeetingsPageDto> {
    return this.meetings.list(actor, query);
  }

  @HttpCode(200)
  @Post()
  @Policy('meeting', 'create')
  @ApiOkResponse({ type: MeetingDetailDto })
  create(
    @CurrentActor() actor: Actor,
    @Body() input: CreateMeetingDto,
  ): Promise<MeetingDetailDto> {
    return this.meetings.create(actor, input);
  }

  @Get(':id')
  @Policy('meeting', 'read')
  @ApiOkResponse({ type: MeetingDetailDto })
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MeetingDetailDto> {
    return this.meetings.get(actor, id);
  }

  @Patch(':id')
  @Policy('meeting', 'update')
  @ApiOkResponse({ type: MeetingDetailDto })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateMeetingDto,
  ): Promise<MeetingDetailDto> {
    return this.meetings.update(actor, id, input);
  }
}
