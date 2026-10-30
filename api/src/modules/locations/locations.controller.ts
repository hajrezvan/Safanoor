import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import {
  CreateLocationDto,
  LocationOptionDto,
  LocationQueryDto,
  LocationsPageDto,
} from './locations.dto';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @Policy('location_option', 'read')
  @ApiOkResponse({ type: LocationsPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: LocationQueryDto,
  ): Promise<LocationsPageDto> {
    return this.locations.list(actor, query);
  }

  @HttpCode(200)
  @Post()
  @Policy('location_option', 'create')
  @ApiOkResponse({ type: LocationOptionDto })
  create(
    @CurrentActor() actor: Actor,
    @Body() input: CreateLocationDto,
  ): Promise<LocationOptionDto> {
    return this.locations.create(actor, input);
  }
}
