import {
  HttpCode,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationDto } from '../../libs/http/http.dto';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import {
  ImportJobDto,
  ImportRowsPageDto,
  ImportsPageDto,
  ImportUploadDto,
} from './imports.dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiBearerAuth()
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}
  @Get()
  @Policy('import', 'read')
  @ApiOkResponse({ type: ImportsPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: PaginationDto,
  ): Promise<ImportsPageDto> {
    return this.imports.list(actor, query);
  }
  @HttpCode(200)
  @Post()
  @Policy('import', 'create')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['groupId', 'file'],
      properties: {
        groupId: { type: 'string', format: 'uuid' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 1 },
    }),
  )
  @ApiOkResponse({ type: ImportJobDto })
  upload(
    @CurrentActor() actor: Actor,
    @Body() input: ImportUploadDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportJobDto> {
    return this.imports.upload(actor, input.groupId, file);
  }
  @Get(':id')
  @Policy('import', 'read')
  @ApiOkResponse({ type: ImportJobDto })
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImportJobDto> {
    return this.imports.get(actor, id);
  }
  @Get(':id/rows')
  @Policy('import', 'read')
  @ApiOkResponse({ type: ImportRowsPageDto })
  preview(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ): Promise<ImportRowsPageDto> {
    return this.imports.preview(actor, id, query);
  }
  @HttpCode(200)
  @Post(':id/confirm')
  @Policy('import', 'update')
  @ApiOkResponse({ type: ImportJobDto })
  confirm(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImportJobDto> {
    return this.imports.confirm(actor, id);
  }
}
