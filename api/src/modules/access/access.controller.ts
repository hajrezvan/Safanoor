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
import { DataSource } from 'typeorm';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { SuccessDto } from '../auth/auth.controller';
import { Actor, PolicyRow } from './access.types';
import {
  CreateGrantDto,
  GrantDto,
  GrantsPageDto,
  PoliciesPageDto,
} from './access.dto';
import { AccessService } from './access.service';
import { GrantsService } from './grants.service';
import { CurrentActor, Policy } from './policy.decorator';

@ApiTags('access')
@ApiBearerAuth()
@Controller('access')
export class AccessController {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly grants: GrantsService,
  ) {}
  @Get('policies')
  @Policy('policy', 'read')
  @ApiOkResponse({ type: PoliciesPageDto })
  async policies(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<PoliciesPageDto> {
    await this.access.require(actor, 'read', { type: 'policy' });
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM access_policy',
    );
    const items = await rows<PolicyRow>(
      this.db,
      'SELECT resource_type AS "resourceType",action,owner_role AS "ownerRole",viewer_relation AS "viewerRelation",level FROM access_policy ORDER BY resource_type,action,viewer_relation LIMIT $1 OFFSET $2',
      [query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }
  @Get('grants')
  @Policy('grant', 'read')
  @ApiOkResponse({ type: GrantsPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<GrantsPageDto> {
    return this.grants.list(actor, query);
  }
  @HttpCode(200)
  @Post('grants')
  @Policy('grant', 'grant')
  @ApiOkResponse({ type: GrantDto })
  create(
    @CurrentActor() actor: Actor,
    @Body() input: CreateGrantDto,
  ): Promise<GrantDto> {
    return this.grants.create(actor, input);
  }
  @HttpCode(200)
  @Post('grants/:id/revoke')
  @Policy('grant', 'read')
  @ApiOkResponse({ type: SuccessDto })
  async revoke(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SuccessDto> {
    await this.grants.revoke(actor, id);
    return { success: true };
  }
}
