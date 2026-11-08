import {
  HttpCode,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../libs/http/http.dto';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import { SuccessDto } from '../auth/auth.controller';
import {
  QualificationDto,
  AccountDto,
  AuditPageDto,
  CreateAccountDto,
  JobsStatusDto,
  OpsDashboardDto,
  OverviewDto,
  ParentAccountDto,
  ParentLinkDto,
  RetentionPageDto,
  StorageSettingsDto,
  UpdateRetentionDto,
  UpdateStorageSettingsDto,
} from './admin.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('overview')
  @Policy('admin', 'read')
  @ApiOkResponse({ type: OverviewDto })
  overview(@CurrentActor() actor: Actor): Promise<OverviewDto> {
    return this.admin.overview(actor);
  }
  @Get('ops-dashboard')
  @Policy('admin', 'manage')
  @ApiOkResponse({ type: OpsDashboardDto })
  opsDashboard(@CurrentActor() actor: Actor): Promise<OpsDashboardDto> {
    return this.admin.opsDashboard(actor);
  }
  @Get('audit')
  @Policy('audit', 'read')
  @ApiOkResponse({ type: AuditPageDto })
  audit(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<AuditPageDto> {
    return this.admin.auditLog(actor, query);
  }
  @Get('jobs')
  @Policy('admin', 'manage')
  @ApiOkResponse({ type: JobsStatusDto })
  jobs(@CurrentActor() actor: Actor): Promise<JobsStatusDto> {
    return this.admin.jobs(actor);
  }
  @Get('retention')
  @Policy('admin', 'manage')
  @ApiOkResponse({ type: RetentionPageDto })
  retention(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<RetentionPageDto> {
    return this.admin.retention(actor, query);
  }
  @Patch('retention/:type')
  @Policy('admin', 'manage')
  @ApiOkResponse({ type: SuccessDto })
  async updateRetention(
    @CurrentActor() actor: Actor,
    @Param('type') type: string,
    @Body() input: UpdateRetentionDto,
  ): Promise<SuccessDto> {
    await this.admin.updateRetention(actor, type, input);
    return { success: true };
  }
  @HttpCode(200)
  @Post('accounts')
  @Policy('admin', 'manage')
  @ApiOkResponse({ type: AccountDto })
  account(
    @CurrentActor() actor: Actor,
    @Body() input: CreateAccountDto,
  ): Promise<AccountDto> {
    return this.admin.account(actor, input);
  }
  @HttpCode(200)
  @Post('parents')
  @Policy('admin', 'manage')
  @ApiOkResponse({ type: AccountDto })
  parent(
    @CurrentActor() actor: Actor,
    @Body() input: ParentAccountDto,
  ): Promise<AccountDto> {
    return this.admin.parent(actor, input);
  }
  @HttpCode(200)
  @Post('parent-links')
  @Policy('person', 'read')
  @ApiOkResponse({ type: SuccessDto })
  async parentLink(
    @CurrentActor() actor: Actor,
    @Body() input: ParentLinkDto,
  ): Promise<SuccessDto> {
    await this.admin.parentLink(actor, input);
    return { success: true };
  }
  @HttpCode(200)
  @Post('qualifications')
  @Policy('admin', 'manage')
  @ApiOkResponse({ type: SuccessDto })
  async qualification(
    @CurrentActor() actor: Actor,
    @Body() input: QualificationDto,
  ): Promise<SuccessDto> {
    await this.admin.qualification(actor, input);
    return { success: true };
  }
  @Get('storage')
  @Policy('admin', 'manage')
  @ApiOkResponse({ type: StorageSettingsDto })
  storage(@CurrentActor() actor: Actor): Promise<StorageSettingsDto> {
    return this.admin.storageSettings(actor);
  }
  @Patch('storage')
  @Policy('admin', 'manage')
  @ApiOkResponse({ type: StorageSettingsDto })
  updateStorage(
    @CurrentActor() actor: Actor,
    @Body() input: UpdateStorageSettingsDto,
  ): Promise<StorageSettingsDto> {
    return this.admin.updateStorageSettings(actor, input);
  }
}
