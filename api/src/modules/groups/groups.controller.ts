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
import { SuccessDto } from '../auth/auth.controller';
import {
  GroupRoleDto,
  AssignmentDto,
  CreateGroupDto,
  GroupDto,
  GroupsPageDto,
  MembersPageDto,
  MembershipDto,
} from './groups.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}
  @Get()
  @Policy('group', 'read')
  @ApiOkResponse({ type: GroupsPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<GroupsPageDto> {
    return this.groups.list(actor, query);
  }
  @HttpCode(200)
  @Post()
  @Policy('group', 'create')
  @ApiOkResponse({ type: GroupDto })
  create(
    @CurrentActor() actor: Actor,
    @Body() input: CreateGroupDto,
  ): Promise<GroupDto> {
    return this.groups.create(actor, input);
  }
  @Get(':id/members')
  @Policy('membership', 'assign')
  @ApiOkResponse({ type: MembersPageDto })
  members(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ): Promise<MembersPageDto> {
    return this.groups.members(actor, id, query);
  }
  @HttpCode(200)
  @Post(':id/memberships')
  @Policy('membership', 'assign')
  @ApiOkResponse({ type: SuccessDto })
  async membership(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MembershipDto,
  ): Promise<SuccessDto> {
    await this.groups.membership(actor, id, input);
    return { success: true };
  }
  @HttpCode(200)
  @Post(':id/assignments')
  @Policy('assignment', 'assign')
  @ApiOkResponse({ type: SuccessDto })
  async assign(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignmentDto,
  ): Promise<SuccessDto> {
    await this.groups.assign(actor, id, input);
    return { success: true };
  }
  @HttpCode(200)
  @Post(':id/finance-officer')
  @Policy('assignment', 'assign')
  @ApiOkResponse({ type: SuccessDto })
  async financeOfficer(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: GroupRoleDto,
  ): Promise<SuccessDto> {
    await this.groups.financeOfficer(actor, id, input);
    return { success: true };
  }
}
