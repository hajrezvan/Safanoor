import { HttpCode, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import {
  ConsentQueryDto,
  ConsentRecordDto,
  ConsentStatusDto,
  ConsentVersionDto,
  PublishConsentDto,
  RecordConsentDto,
} from './consent.dto';
import { ConsentService } from './consent.service';

@ApiTags('consent')
@ApiBearerAuth()
@Controller('consent')
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}
  @Get()
  @Policy('consent', 'read')
  @ApiOkResponse({ type: ConsentStatusDto })
  status(
    @CurrentActor() actor: Actor,
    @Query() query: ConsentQueryDto,
  ): Promise<ConsentStatusDto> {
    return this.consent.status(actor, query.personId);
  }
  @HttpCode(200)
  @Post('records')
  @Policy('consent', 'create')
  @ApiOkResponse({ type: ConsentRecordDto })
  record(
    @CurrentActor() actor: Actor,
    @Body() input: RecordConsentDto,
  ): Promise<ConsentRecordDto> {
    return this.consent.record(actor, input);
  }
  @HttpCode(200)
  @Post('versions')
  @Policy('consent', 'manage')
  @ApiOkResponse({ type: ConsentVersionDto })
  publish(
    @CurrentActor() actor: Actor,
    @Body() input: PublishConsentDto,
  ): Promise<ConsentVersionDto> {
    return this.consent.publish(actor, input);
  }
}
