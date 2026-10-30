import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProduces,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import type { Response } from 'express';
import { PaginationDto } from '../../libs/http/http.dto';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import {
  ClassCardsPageDto,
  ClassDetailDto,
  LmsItemDetailDto,
} from './lms.dto';
import { LmsService } from './lms.service';

class ClassDetailQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

@ApiTags('lms')
@ApiBearerAuth()
@Controller()
export class LmsController {
  constructor(private readonly lms: LmsService) {}

  @Get('groups/:id/classes')
  @Policy('lms_item', 'read')
  @ApiOkResponse({ type: ClassCardsPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ): Promise<ClassCardsPageDto> {
    return this.lms.list(actor, id, query);
  }

  @Get('lms/classes/:id')
  @Policy('lms_item', 'read')
  @ApiOkResponse({ type: ClassDetailDto })
  getClass(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ClassDetailQueryDto,
  ): Promise<ClassDetailDto> {
    return this.lms.getClass(actor, id, query.sessionId);
  }

  @Get('lms/courses/:id/cover')
  @Policy('lms_item', 'read')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Series cover from latest session' })
  async courseCover(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.lms.courseCover(actor, id);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.body);
  }

  @Get('lms/items/:id')
  @Policy('lms_item', 'read')
  @ApiOkResponse({ type: LmsItemDetailDto })
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LmsItemDetailDto> {
    return this.lms.get(actor, id);
  }

  @Get('lms/items/:id/cover')
  @Policy('lms_item', 'read')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Binary cover image' })
  async cover(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.lms.cover(actor, id);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.body);
  }

  @Get('lms/items/:id/audio')
  @Policy('lms_item', 'read')
  @ApiProduces('audio/wav', 'audio/mpeg', 'audio/ogg')
  @ApiOkResponse({ description: 'Binary class audio' })
  async audio(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.lms.audio(actor, id);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.body);
  }
}
