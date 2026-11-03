import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { one } from '../../libs/database/database.types';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { CurrentActor, Policy, Public } from '../access/policy.decorator';
import {
  EncryptedStorageAdapter,
  LocalStorageAdapter,
  STORAGE,
  StorageAdapter,
} from './storage';

export class FileUrlDto {
  @ApiProperty() url!: string;
  @ApiProperty() expiresIn!: number;
}
export class DownloadQueryDto {
  @ApiProperty() @IsString() @Length(20, 1000) token!: string;
}
@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}
  @Get('download')
  @Public()
  async download(
    @Query() query: DownloadQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    if (
      !(this.storage instanceof LocalStorageAdapter) &&
      !(this.storage instanceof EncryptedStorageAdapter)
    )
      throw new ForbiddenException();
    let signed: { key: string; actorId: string };
    try {
      signed = this.storage.verify(query.token);
    } catch {
      throw new ForbiddenException('پیوند منقضی یا نامعتبر است.');
    }
    const actor = await one<Actor>(
      this.db,
      'SELECT u.id AS "userId",p.id AS "personId",u.is_admin AS "isAdmin",u.is_parent AS "isParent",p.org_level AS "orgLevel",p.status,p.external,p.consent_required AS "consentRequired" FROM app_user u JOIN person p ON p.id=u.person_id WHERE p.id=$1',
      [signed.actorId],
    );
    if (!actor) throw new ForbiddenException();
    const file = await one<{ id: string; ownerId: string; mime: string }>(
      this.db,
      'SELECT id,created_by AS "ownerId",mime_type AS mime FROM file_record WHERE storage_key=$1 AND (purge_after IS NULL OR purge_after>now())',
      [signed.key],
    );
    if (!file) throw new ForbiddenException();
    await this.access.require(
      actor,
      'read',
      { type: 'file', id: file.id, ownerId: file.ownerId },
      'detail',
    );
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Disposition', 'attachment');
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(await this.storage.get(signed.key));
  }
  @Get(':id/url')
  @Policy('file', 'read')
  @ApiOkResponse({ type: FileUrlDto })
  async url(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FileUrlDto> {
    const file = await one<{ key: string; ownerId: string }>(
      this.db,
      'SELECT storage_key AS key,created_by AS "ownerId" FROM file_record WHERE id=$1 AND (purge_after IS NULL OR purge_after>now())',
      [id],
    );
    if (!file) throw new ForbiddenException();
    await this.access.require(
      actor,
      'read',
      { type: 'file', id, ownerId: file.ownerId },
      'detail',
    );
    return {
      url: await this.storage.signedGetUrl(file.key, actor.personId, 60),
      expiresIn: 60,
    };
  }
}
