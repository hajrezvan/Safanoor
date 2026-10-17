import {
  HttpCode,
  Body,
  Controller,
  Get,
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
import {
  CreatePersonDto,
  MeDto,
  PeoplePageDto,
  PersonDto,
  UpdatePersonDto,
} from './people.dto';
import { PeopleService } from './people.service';

@ApiTags('people')
@ApiBearerAuth()
@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}
  @Get('me')
  @Policy('person', 'read')
  @ApiOkResponse({ type: MeDto })
  me(@CurrentActor() actor: Actor): Promise<MeDto> {
    return this.people.me(actor);
  }
  @Get()
  @Policy('person', 'read')
  @ApiOkResponse({ type: PeoplePageDto })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<PeoplePageDto> {
    return this.people.list(actor, query);
  }
  @Get(':id')
  @Policy('person', 'read')
  @ApiOkResponse({ type: PersonDto })
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PersonDto> {
    return this.people.get(actor, id);
  }
  @HttpCode(200)
  @Post()
  @Policy('person', 'create')
  @ApiOkResponse({ type: PersonDto })
  async create(
    @CurrentActor() actor: Actor,
    @Body() input: CreatePersonDto,
  ): Promise<PersonDto> {
    return this.people.get(actor, (await this.people.create(actor, input)).id);
  }
  @Patch(':id')
  @Policy('person', 'update')
  @ApiOkResponse({ type: PersonDto })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdatePersonDto,
  ): Promise<PersonDto> {
    return this.people.update(actor, id, input);
  }
  @HttpCode(200)
  @Post(':id/verify')
  @Policy('person', 'update')
  @ApiOkResponse({ type: PersonDto })
  verify(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PersonDto> {
    return this.people.verify(actor, id);
  }
  @HttpCode(200)
  @Post(':id/deactivate')
  @Policy('person', 'deactivate')
  @ApiOkResponse({ type: SuccessDto })
  async deactivate(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SuccessDto> {
    await this.people.deactivate(actor, id);
    return { success: true };
  }
}
