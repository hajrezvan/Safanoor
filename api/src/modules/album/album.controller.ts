import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PaginationDto } from '../../libs/http/http.dto';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import {
  PhotoDetailDto,
  PhotosPageDto,
  UpdatePhotoTagsDto,
  UploadPhotoDto,
} from './album.dto';
import { AlbumService } from './album.service';

@ApiTags('album')
@ApiBearerAuth()
@Controller('album')
export class AlbumController {
  constructor(private readonly album: AlbumService) {}

  @Get('photos')
  @Policy('photo', 'read')
  @ApiOkResponse({ type: PhotosPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<PhotosPageDto> {
    return this.album.list(actor, query);
  }

  @HttpCode(200)
  @Post('photos')
  @Policy('photo', 'create')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['groupId', 'file'],
      properties: {
        groupId: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        eventNote: { type: 'string' },
        locationOptionId: { type: 'string', format: 'uuid' },
        place: { type: 'string' },
        taggedPersonIds: {
          type: 'string',
          description: 'JSON array of person UUIDs',
        },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 10 },
    }),
  )
  @ApiOkResponse({ type: PhotoDetailDto })
  upload(
    @CurrentActor() actor: Actor,
    @Body() input: UploadPhotoDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<PhotoDetailDto> {
    return this.album.upload(actor, input, file);
  }

  @Get('photos/:id')
  @Policy('photo', 'read')
  @ApiOkResponse({ type: PhotoDetailDto })
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PhotoDetailDto> {
    return this.album.get(actor, id);
  }

  @Get('photos/:id/content')
  @Policy('photo', 'read')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Binary image bytes' })
  async content(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.album.content(actor, id);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.body);
  }

  @Patch('photos/:id/tags')
  @Policy('photo', 'update')
  @ApiOkResponse({ type: PhotoDetailDto })
  updateTags(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdatePhotoTagsDto,
  ): Promise<PhotoDetailDto> {
    return this.album.updateTags(actor, id, input.taggedPersonIds);
  }
}
