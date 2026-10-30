import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../libs/http/http.dto';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import {
  ConsultationDetailDto,
  ConsultationPrivateNoteDto,
  ConsultationsPageDto,
  CreateConsultationDto,
  UpdateConsultationDto,
  UpsertConsultationPrivateNoteDto,
} from './consultations.dto';
import { ConsultationsService } from './consultations.service';

@ApiTags('consultations')
@ApiBearerAuth()
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultations: ConsultationsService) {}

  @Get()
  @Policy('consultation', 'read')
  @ApiOkResponse({ type: ConsultationsPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<ConsultationsPageDto> {
    return this.consultations.list(actor, query);
  }

  @HttpCode(200)
  @Post()
  @Policy('consultation', 'create')
  @ApiOkResponse({ type: ConsultationDetailDto })
  create(
    @CurrentActor() actor: Actor,
    @Body() input: CreateConsultationDto,
  ): Promise<ConsultationDetailDto> {
    return this.consultations.create(actor, input);
  }

  @Get(':id/private-note')
  @Policy('consultation_private_note', 'read')
  @ApiOkResponse({ type: ConsultationPrivateNoteDto })
  getPrivateNote(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConsultationPrivateNoteDto> {
    return this.consultations.getPrivateNote(actor, id);
  }

  @HttpCode(200)
  @Put(':id/private-note')
  @Policy('consultation_private_note', 'update')
  @ApiOkResponse({ type: ConsultationPrivateNoteDto })
  upsertPrivateNote(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpsertConsultationPrivateNoteDto,
  ): Promise<ConsultationPrivateNoteDto> {
    return this.consultations.upsertPrivateNote(actor, id, input);
  }

  @Get(':id')
  @Policy('consultation', 'read')
  @ApiOkResponse({ type: ConsultationDetailDto })
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConsultationDetailDto> {
    return this.consultations.get(actor, id);
  }

  @Patch(':id')
  @Policy('consultation', 'update')
  @ApiOkResponse({ type: ConsultationDetailDto })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateConsultationDto,
  ): Promise<ConsultationDetailDto> {
    return this.consultations.update(actor, id, input);
  }
}
