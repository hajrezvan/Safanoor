import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import { MentorDashboardDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('mentor')
  @Policy('dashboard', 'read')
  @ApiOkResponse({ type: MentorDashboardDto })
  mentor(@CurrentActor() actor: Actor): Promise<MentorDashboardDto> {
    return this.dashboard.mentor(actor);
  }
}
