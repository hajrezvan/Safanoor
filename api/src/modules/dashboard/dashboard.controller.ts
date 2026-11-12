import { DirectorService } from './director.service';
import { DirectorSummaryDto, DirectorPeoplePageDto } from './director.dto';
import { PaginationDto } from '../../libs/http/http.dto';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import { MentorDashboardDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly director: DirectorService,
  ) {}

  @Get('organization')
  @Policy('organization_report', 'read')
  @ApiOkResponse({ type: DirectorSummaryDto })
  organization(@CurrentActor() actor: Actor): Promise<DirectorSummaryDto> {
    return this.director.summary(actor);
  }

  @Get('organization/people')
  @Policy('organization_report', 'read')
  @ApiOkResponse({ type: DirectorPeoplePageDto })
  organizationPeople(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<DirectorPeoplePageDto> {
    return this.director.people(actor, query);
  }

  @Get('mentor')
  @Policy('dashboard', 'read')
  @ApiOkResponse({ type: MentorDashboardDto })
  mentor(@CurrentActor() actor: Actor): Promise<MentorDashboardDto> {
    return this.dashboard.mentor(actor);
  }
}
