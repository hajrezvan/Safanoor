import {
  Body,
  Controller,
  Delete,
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
import { SuccessDto } from '../auth/auth.controller';
import {
  CreateStudyPathDto,
  CreateStudyPathItemDto,
  ReorderStudyPathItemsDto,
  StudyPathDetailDto,
  StudyPathsPageDto,
  UpdateStudyPathDto,
  UpdateReadingDto,
  UpdateStudyPathItemDto,
} from './library.dto';
import { LibraryService } from './library.service';

@ApiTags('library')
@ApiBearerAuth()
@Controller()
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('groups/:id/study-paths')
  @Policy('study_path', 'read')
  @ApiOkResponse({ type: StudyPathsPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ): Promise<StudyPathsPageDto> {
    return this.library.list(actor, id, query);
  }

  @HttpCode(200)
  @Post('groups/:id/study-paths')
  @Policy('study_path', 'create')
  @ApiOkResponse({ type: StudyPathDetailDto })
  create(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateStudyPathDto,
  ): Promise<StudyPathDetailDto> {
    return this.library.create(actor, id, input);
  }

  /** All groups' study paths — technical manager / admin read. */
  @Get('study-paths')
  @Policy('study_path', 'read')
  @ApiOkResponse({ type: StudyPathsPageDto })
  listAll(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<StudyPathsPageDto> {
    return this.library.listAll(actor, query);
  }

  @Get('study-paths/:id')
  @Policy('study_path', 'read')
  @ApiOkResponse({ type: StudyPathDetailDto })
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudyPathDetailDto> {
    return this.library.get(actor, id);
  }

  @Patch('study-paths/:id/items/:itemId/reading')
  @Policy('study_reading', 'update')
  @ApiOkResponse({ type: StudyPathDetailDto })
  updateReading(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() input: UpdateReadingDto,
  ): Promise<StudyPathDetailDto> {
    return this.library.updateReading(actor, id, itemId, input);
  }

  @Get('study-paths/:id/cover')
  @Policy('study_path', 'read')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Binary cover image' })
  async cover(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.library.cover(actor, id);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.body);
  }

  @Patch('study-paths/:id')
  @Policy('study_path', 'update')
  @ApiOkResponse({ type: StudyPathDetailDto })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateStudyPathDto,
  ): Promise<StudyPathDetailDto> {
    return this.library.update(actor, id, input);
  }

  @HttpCode(200)
  @Delete('study-paths/:id')
  @Policy('study_path', 'manage')
  @ApiOkResponse({ type: SuccessDto })
  async remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SuccessDto> {
    await this.library.remove(actor, id);
    return { success: true };
  }

  @HttpCode(200)
  @Post('study-paths/:id/items')
  @Policy('study_path', 'update')
  @ApiOkResponse({ type: StudyPathDetailDto })
  addItem(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CreateStudyPathItemDto,
  ): Promise<StudyPathDetailDto> {
    return this.library.addItem(actor, id, input);
  }

  @HttpCode(200)
  @Post('study-paths/:id/items/reorder')
  @Policy('study_path', 'update')
  @ApiOkResponse({ type: StudyPathDetailDto })
  reorder(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReorderStudyPathItemsDto,
  ): Promise<StudyPathDetailDto> {
    return this.library.reorderItems(actor, id, input);
  }

  @Patch('study-paths/:id/items/:itemId')
  @Policy('study_path', 'update')
  @ApiOkResponse({ type: StudyPathDetailDto })
  updateItem(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() input: UpdateStudyPathItemDto,
  ): Promise<StudyPathDetailDto> {
    return this.library.updateItem(actor, id, itemId, input);
  }

  @HttpCode(200)
  @Delete('study-paths/:id/items/:itemId')
  @Policy('study_path', 'update')
  @ApiOkResponse({ type: StudyPathDetailDto })
  removeItem(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<StudyPathDetailDto> {
    return this.library.removeItem(actor, id, itemId);
  }

  @Get('study-paths/:id/items/:itemId/cover')
  @Policy('study_path', 'read')
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({ description: 'Binary book cover image' })
  async itemCover(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.library.itemCover(actor, id, itemId);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.body);
  }

  @Get('study-paths/:id/items/:itemId/pdf')
  @Policy('study_path', 'read')
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'Binary book PDF' })
  async itemPdf(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.library.itemPdf(actor, id, itemId);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(file.body);
  }

  @HttpCode(200)
  @Post('study-paths/:id/items/:itemId/cover')
  @Policy('study_path', 'update')
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
      limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiOkResponse({ type: StudyPathDetailDto })
  uploadItemCover(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<StudyPathDetailDto> {
    return this.library.uploadItemCover(actor, id, itemId, file);
  }

  @HttpCode(200)
  @Post('study-paths/:id/items/:itemId/pdf')
  @Policy('study_path', 'update')
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
      limits: { fileSize: 16 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiOkResponse({ type: StudyPathDetailDto })
  uploadItemPdf(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<StudyPathDetailDto> {
    return this.library.uploadItemPdf(actor, id, itemId, file);
  }

  @HttpCode(200)
  @Delete('study-paths/:id/items/:itemId/pdf')
  @Policy('study_path', 'update')
  @ApiOkResponse({ type: StudyPathDetailDto })
  removeItemPdf(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<StudyPathDetailDto> {
    return this.library.removeItemPdf(actor, id, itemId);
  }
}
