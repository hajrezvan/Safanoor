import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { one, rows } from '../../libs/database/database.types';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import { STORAGE, StorageAdapter } from '../files/storage';
import { AvatarStateDto } from './people.dto';

@Injectable()
export class AvatarService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  async state(actor: Actor): Promise<AvatarStateDto> {
    const resource = { type: 'avatar' as const, ownerId: actor.personId };
    const canUploadAvatar =
      (await this.access.level(actor, 'update', resource)) === 'detail';
    if ((await this.access.level(actor, 'read', resource)) !== 'detail')
      return { canUploadAvatar };
    const person = await one<{ fileId: string | null }>(
      this.db,
      `SELECT avatar_file_id AS "fileId" FROM person WHERE id=$1 AND status='active'`,
      [actor.personId],
    );
    return {
      canUploadAvatar,
      ...(person?.fileId
        ? { avatarUrl: `/api/v1/people/me/avatar?v=${person.fileId}` }
        : {}),
    };
  }

  async upload(
    actor: Actor,
    file: Express.Multer.File,
  ): Promise<AvatarStateDto> {
    await this.access.require(
      actor,
      'update',
      { type: 'avatar', ownerId: actor.personId },
      'detail',
    );
    if (!file?.buffer?.length || file.buffer.length > 2 * 1024 * 1024)
      throw new BadRequestException('عکس باید حداکثر ۲ مگابایت باشد.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      throw new BadRequestException(
        'عکس را با فرمت JPEG، PNG یا WebP انتخاب کن.',
      );
    let body: Buffer;
    try {
      const image = sharp(file.buffer, {
        limitInputPixels: 16_777_216,
        failOn: 'warning',
      });
      const meta = await image.metadata();
      if (
        !meta.format ||
        !['jpeg', 'png', 'webp'].includes(meta.format) ||
        (meta.pages ?? 1) > 1
      )
        throw new Error('Unsupported image');
      // Sharp omits EXIF/GPS and other metadata by default.
      body = await image
        .rotate()
        .resize(512, 512, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'فایل عکس معتبر نیست یا ابعاد آن بیش از حد بزرگ است.',
      );
    }
    const fileId = randomUUID();
    const key = randomUUID();
    await this.storage.put(key, body, 'image/webp');
    await this.db.transaction(async (manager) => {
      const person = await one<{ oldId: string | null }>(
        manager,
        `SELECT avatar_file_id AS "oldId" FROM person WHERE id=$1 AND status='active' FOR UPDATE`,
        [actor.personId],
      );
      if (!person) throw new NotFoundException();
      await rows(
        manager,
        `INSERT INTO file_record(id,kind,storage_key,size,mime_type,created_by)
        VALUES($1,'avatar',$2,$3,'image/webp',$4)`,
        [fileId, key, body.length, actor.personId],
      );
      await rows(
        manager,
        'UPDATE person SET avatar_file_id=$2,updated_at=now() WHERE id=$1',
        [actor.personId, fileId],
      );
      if (person.oldId)
        await rows(
          manager,
          `UPDATE file_record SET purge_after=COALESCE(purge_after,now()+interval '3 days') WHERE id=$1`,
          [person.oldId],
        );
      await this.audit.record(
        actor.personId,
        'person.avatar_updated',
        'avatar',
        actor.personId,
        {},
        manager,
      );
    });
    return this.state(actor);
  }

  async content(actor: Actor): Promise<Buffer> {
    await this.access.require(
      actor,
      'read',
      { type: 'avatar', ownerId: actor.personId },
      'detail',
    );
    const file = await one<{ key: string }>(
      this.db,
      `SELECT f.storage_key AS key FROM person p JOIN file_record f ON f.id=p.avatar_file_id
       WHERE p.id=$1 AND p.status='active' AND (f.purge_after IS NULL OR f.purge_after>now())`,
      [actor.personId],
    );
    if (!file) throw new NotFoundException();
    return this.storage.get(file.key);
  }
}
