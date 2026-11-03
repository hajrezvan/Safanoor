import {
  Body,
  Controller,
  Delete,
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
  CreateCostItemDto,
  MemberFinanceDto,
  CreateProgramEventDto,
  ProgramEventDetailDto,
  ProgramEventsPageDto,
} from './finance.dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@ApiBearerAuth()
@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('finance/me')
  @Policy('member_finance', 'read')
  @ApiOkResponse({ type: MemberFinanceDto })
  mine(@CurrentActor() actor: Actor): Promise<MemberFinanceDto> {
    return this.finance.mine(actor);
  }

  @Get('groups/:id/finance/destinations')
  @Policy('program_event', 'read')
  @ApiOkResponse({ type: ProgramEventsPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ): Promise<ProgramEventsPageDto> {
    return this.finance.list(actor, id, query);
  }

  @HttpCode(200)
  @Post('groups/:id/finance/destinations')
  @Policy('program_event', 'create')
  @ApiOkResponse({ type: ProgramEventDetailDto })
  create(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateProgramEventDto,
  ): Promise<ProgramEventDetailDto> {
    return this.finance.create(actor, id, input);
  }

  @Get('finance/destinations/:id')
  @Policy('program_event', 'read')
  @ApiOkResponse({ type: ProgramEventDetailDto })
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProgramEventDetailDto> {
    return this.finance.get(actor, id);
  }

  @HttpCode(200)
  @Post('finance/destinations/:id/cost-items')
  @Policy('program_event', 'update')
  @ApiOkResponse({ type: ProgramEventDetailDto })
  addCostItem(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateCostItemDto,
  ): Promise<ProgramEventDetailDto> {
    return this.finance.addCostItem(actor, id, input);
  }

  @HttpCode(200)
  @Delete('finance/destinations/:id/cost-items/:itemId')
  @Policy('program_event', 'update')
  @ApiOkResponse({ type: ProgramEventDetailDto })
  removeCostItem(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<ProgramEventDetailDto> {
    return this.finance.removeCostItem(actor, id, itemId);
  }
}
