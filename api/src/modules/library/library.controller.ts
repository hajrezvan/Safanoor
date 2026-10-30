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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
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

  @Get('study-paths/:id')
  @Policy('study_path', 'read')
  @ApiOkResponse({ type: StudyPathDetailDto })
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudyPathDetailDto> {
    return this.library.get(actor, id);
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
}
