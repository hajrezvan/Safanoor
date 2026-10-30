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
import { Actor } from '../access/access.types';
import { CurrentActor, Policy } from '../access/policy.decorator';
import { SuccessDto } from '../auth/auth.controller';
import {
  CampDetailDto,
  CampsPageDto,
  CampsQueryDto,
  CreateCampDto,
  UpdateCampDto,
} from './camps.dto';
import { CampsService } from './camps.service';

@ApiTags('camps')
@ApiBearerAuth()
@Controller('camps')
export class CampsController {
  constructor(private readonly camps: CampsService) {}

  @Get()
  @Policy('camp', 'read')
  @ApiOkResponse({ type: CampsPageDto })
  list(
    @CurrentActor() actor: Actor,
    @Query() query: CampsQueryDto,
  ): Promise<CampsPageDto> {
    return this.camps.list(actor, query);
  }

  @HttpCode(200)
  @Post()
  @Policy('camp', 'create')
  @ApiOkResponse({ type: CampDetailDto })
  create(
    @CurrentActor() actor: Actor,
    @Body() input: CreateCampDto,
  ): Promise<CampDetailDto> {
    return this.camps.create(actor, input);
  }

  @Get(':id')
  @Policy('camp', 'read')
  @ApiOkResponse({ type: CampDetailDto })
  get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CampDetailDto> {
    return this.camps.get(actor, id);
  }

  @Patch(':id')
  @Policy('camp', 'update')
  @ApiOkResponse({ type: CampDetailDto })
  update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCampDto,
  ): Promise<CampDetailDto> {
    return this.camps.update(actor, id, input);
  }

  @HttpCode(200)
  @Delete(':id')
  @Policy('camp', 'manage')
  @ApiOkResponse({ type: SuccessDto })
  async remove(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SuccessDto> {
    await this.camps.remove(actor, id);
    return { success: true };
  }

  @HttpCode(200)
  @Post(':id/permit')
  @Policy('camp', 'update')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  @ApiOkResponse({ type: CampDetailDto })
  uploadPermit(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<CampDetailDto> {
    return this.camps.uploadPermit(actor, id, file);
  }
}
