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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiBody,
  ApiConsumes,
  ApiProduces,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AvatarService } from './avatar.service';
import { PaginationDto } from '../../libs/http/http.dto';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import { SuccessDto } from '../auth/auth.controller';
import {
  AvatarStateDto,
  CreatePersonDto,
  MeDto,
  PeoplePageDto,
  PersonDossierDto,
  PersonDto,
  UpdatePersonDto,
} from './people.dto';
import { PeopleService } from './people.service';

@ApiTags('people')
@ApiBearerAuth()
@Controller('people')
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly avatar: AvatarService,
  ) {}
  @Get('me')
  @Policy('person', 'read')
  @ApiOkResponse({ type: MeDto })
  async me(@CurrentActor() actor: Actor): Promise<MeDto> {
    return {
      ...(await this.people.me(actor)),
      ...(await this.avatar.state(actor)),
    };
  }
  @Post('me/avatar')
  @HttpCode(200)
  @Policy('avatar', 'update')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  @ApiOkResponse({ type: AvatarStateDto })
  uploadAvatar(
    @CurrentActor() actor: Actor,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<AvatarStateDto> {
    return this.avatar.upload(actor, file);
  }
  @Get('me/avatar')
  @Policy('avatar', 'read')
  @ApiProduces('image/webp')
  @ApiOkResponse({ description: 'Private profile avatar image' })
  async avatarContent(
    @CurrentActor() actor: Actor,
    @Res() response: Response,
  ): Promise<void> {
    const body = await this.avatar.content(actor);
    response.setHeader('Content-Type', 'image/webp');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Disposition', 'inline');
    response.send(body);
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
  @Get(':id/dossier')
  @Policy('person', 'read')
  @ApiOkResponse({ type: PersonDossierDto })
  dossier(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PersonDossierDto> {
    return this.people.dossier(actor, id);
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
