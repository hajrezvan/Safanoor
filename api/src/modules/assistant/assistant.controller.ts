import {
  Body,
  Controller,
  Get,
  HttpCode,
  Header,
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
import { SuccessDto } from '../auth/auth.controller';
import { AssistantService } from './assistant.service';
import {
  CreateAssistantSessionDto,
  UpdateAssistantDutyDto,
  AssistantMembersQueryDto,
  AssistantSummaryDto,
  AssistantMembersPageDto,
  AssistantItemsPageDto,
  AssistantSessionsPageDto,
  AssistantDutiesPageDto,
  CreateFollowUpItemDto,
  CompleteFollowUpItemDto,
  MarkSessionAttendanceDto,
  EmergencyOpenDto,
  EmergencyCardDto,
} from './assistant.dto';

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  constructor(private readonly service: AssistantService) {}
  @Get('summary')
  @Policy('assistant_workspace', 'read')
  @ApiOkResponse({ type: AssistantSummaryDto })
  summary(@CurrentActor() a: Actor) {
    return this.service.summary(a);
  }
  @Get('members')
  @Policy('assistant_workspace', 'read')
  @ApiOkResponse({ type: AssistantMembersPageDto })
  members(@CurrentActor() a: Actor, @Query() q: AssistantMembersQueryDto) {
    return this.service.members(a, q);
  }
  @Get('items')
  @Policy('assistant_workspace', 'read')
  @ApiOkResponse({ type: AssistantItemsPageDto })
  items(@CurrentActor() a: Actor, @Query() q: PaginationDto) {
    return this.service.items(a, q);
  }
  @Get('sessions')
  @Policy('assistant_workspace', 'read')
  @ApiOkResponse({ type: AssistantSessionsPageDto })
  sessions(@CurrentActor() a: Actor, @Query() q: PaginationDto) {
    return this.service.sessions(a, q);
  }
  @Post('sessions')
  @HttpCode(200)
  @Policy('person', 'read')
  @ApiOkResponse({ type: SuccessDto })
  async createSession(
    @CurrentActor() a: Actor,
    @Body() body: CreateAssistantSessionDto,
  ) {
    await this.service.createSession(a, body);
    return { success: true };
  }
  @Patch('duties/:dutyId')
  @Policy('person', 'read')
  @ApiOkResponse({ type: SuccessDto })
  async updateDuty(
    @CurrentActor() a: Actor,
    @Param('dutyId', ParseUUIDPipe) id: string,
    @Body() body: UpdateAssistantDutyDto,
  ) {
    await this.service.updateDuty(a, id, body);
    return { success: true };
  }
  @Get('duties')
  @Policy('assistant_workspace', 'read')
  @ApiOkResponse({ type: AssistantDutiesPageDto })
  duties(@CurrentActor() a: Actor, @Query() q: PaginationDto) {
    return this.service.duties(a, q);
  }
  // Broad guard only authenticates; each service operation requires its resolved member policy.
  @Post('items')
  @HttpCode(200)
  @Policy('person', 'read')
  @ApiOkResponse({ type: SuccessDto })
  async create(@CurrentActor() a: Actor, @Body() body: CreateFollowUpItemDto) {
    await this.service.createItem(a, body);
    return { success: true };
  }
  @Patch('items/:itemId')
  @Policy('person', 'read')
  @ApiOkResponse({ type: SuccessDto })
  async complete(
    @CurrentActor() a: Actor,
    @Param('itemId', ParseUUIDPipe) id: string,
    @Body() body: CompleteFollowUpItemDto,
  ) {
    await this.service.complete(a, id, body.completed);
    return { success: true };
  }
  @Post('attendance')
  @HttpCode(200)
  @Policy('person', 'read')
  @ApiOkResponse({ type: SuccessDto })
  async attendance(
    @CurrentActor() a: Actor,
    @Body() body: MarkSessionAttendanceDto,
  ) {
    await this.service.attendance(a, body);
    return { success: true };
  }
  @Header('Cache-Control', 'private, no-store')
  @Post('members/:memberId/emergency')
  @HttpCode(200)
  @Policy('person', 'read')
  @ApiOkResponse({ type: EmergencyCardDto })
  emergency(
    @CurrentActor() a: Actor,
    @Param('memberId', ParseUUIDPipe) id: string,
    @Body() body: EmergencyOpenDto,
  ) {
    return this.service.emergency(a, id, body);
  }
}
