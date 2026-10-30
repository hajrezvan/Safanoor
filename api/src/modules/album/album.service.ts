import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import { STORAGE, StorageAdapter } from '../files/storage';
import { LocationsService } from '../locations/locations.service';
import {
  AlbumsPageDto,
  ListAlbumsQueryDto,
  ListPhotosQueryDto,
  OTHER_ALBUM_KEY,
  PhotoDetailDto,
  PhotoSummaryDto,
  PhotoTagDto,
  PhotosPageDto,
  UploadPhotoDto,
} from './album.dto';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024;

@Injectable()
export class AlbumService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly locations: LocationsService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  async listAlbums(
    actor: Actor,
    query: ListAlbumsQueryDto,
  ): Promise<AlbumsPageDto> {
    const accessible = await this.accessibleGroupIds(actor.personId);
    if (accessible.length === 0)
      return pageOf([], query.page, query.limit, 0);

    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*)::text AS count FROM (
         SELECT COALESCE(NULLIF(BTRIM(p.album_title), ''), $2) AS album_key
         FROM photo p
         JOIN photo_group pg ON pg.photo_id=p.id AND pg.hidden_by_group=false
         WHERE pg.group_id=ANY($1::uuid[])
         GROUP BY 1
       ) albums`,
      [accessible, OTHER_ALBUM_KEY],
    );

    const items = await rows<{
      key: string;
      title: string;
      photoCount: number;
      coverPhotoId: string;
      coverContentUrl: string;
      latestAt: string;
    }>(
      this.db,
      `SELECT
          album_key AS key,
          CASE WHEN album_key = $2 THEN '' ELSE album_key END AS title,
          photo_count AS "photoCount",
          cover_photo_id AS "coverPhotoId",
          '' AS "coverContentUrl",
          latest_at AS "latestAt"
       FROM (
         SELECT
           COALESCE(NULLIF(BTRIM(p.album_title), ''), $2) AS album_key,
           count(DISTINCT p.id)::int AS photo_count,
           (array_agg(p.id ORDER BY p.created_at DESC, p.id DESC))[1] AS cover_photo_id,
           max(p.created_at) AS latest_at
         FROM photo p
         JOIN photo_group pg ON pg.photo_id=p.id AND pg.hidden_by_group=false
         WHERE pg.group_id=ANY($1::uuid[])
         GROUP BY 1
       ) grouped
       ORDER BY latest_at DESC, key
       LIMIT $3 OFFSET $4`,
      [accessible, OTHER_ALBUM_KEY, query.limit, (query.page - 1) * query.limit],
    );

    return pageOf(
      items.map((item) => ({
        ...item,
        coverContentUrl: `/api/v1/album/photos/${item.coverPhotoId}/content`,
      })),
      query.page,
      query.limit,
      Number(count?.count ?? 0),
    );
  }

  async list(actor: Actor, query: ListPhotosQueryDto): Promise<PhotosPageDto> {
    const accessible = await this.accessibleGroupIds(actor.personId);
    if (accessible.length === 0)
      return pageOf([], query.page, query.limit, 0);

    const albumClause =
      !query.albumKey
        ? 'TRUE'
        : query.albumKey === OTHER_ALBUM_KEY
          ? `(p.album_title IS NULL OR BTRIM(p.album_title) = '')`
          : `NULLIF(BTRIM(p.album_title), '') = $2`;

    const countParams: unknown[] =
      query.albumKey && query.albumKey !== OTHER_ALBUM_KEY
        ? [accessible, query.albumKey.trim()]
        : [accessible];

    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(DISTINCT p.id)::text AS count
       FROM photo p
       JOIN photo_group pg ON pg.photo_id=p.id AND pg.hidden_by_group=false
       WHERE pg.group_id=ANY($1::uuid[])
         AND (${albumClause})`,
      countParams,
    );

    const listParams: unknown[] = [accessible, actor.personId];
    let listAlbumClause = 'TRUE';
    if (query.albumKey === OTHER_ALBUM_KEY) {
      listAlbumClause = `(p.album_title IS NULL OR BTRIM(p.album_title) = '')`;
    } else if (query.albumKey) {
      listParams.push(query.albumKey.trim());
      listAlbumClause = `NULLIF(BTRIM(p.album_title), '') = $3`;
    }
    const limitPh = `$${listParams.length + 1}`;
    const offsetPh = `$${listParams.length + 2}`;
    listParams.push(query.limit, (query.page - 1) * query.limit);

    const items = await rows<PhotoSummaryDto>(
      this.db,
      `SELECT DISTINCT ON (p.created_at,p.id)
          p.id,p.host_group_id AS "hostGroupId",g.name AS "hostGroupName",
          p.file_id AS "fileId",
          NULLIF(BTRIM(p.album_title), '') AS "albumTitle",
          p.title,p.event_note AS "eventNote",
          p.location_option_id AS "locationOptionId",
          loc.label AS "placeLabel",
          p.uploaded_by AS "uploadedBy",
          up.first_name||' '||up.last_name AS "uploaderName",
          p.created_at AS "createdAt",
          (g.owner_person_id=$2) AS "canManage",
          (SELECT count(*)::int FROM photo_tag t WHERE t.photo_id=p.id) AS "tagCount",
          '' AS "contentUrl"
       FROM photo p
       JOIN photo_group pg ON pg.photo_id=p.id AND pg.hidden_by_group=false
       JOIN organization_group g ON g.id=p.host_group_id
       JOIN person up ON up.id=p.uploaded_by
       LEFT JOIN location_option loc ON loc.id=p.location_option_id
       WHERE pg.group_id=ANY($1::uuid[])
         AND (${listAlbumClause})
       ORDER BY p.created_at DESC,p.id
       LIMIT ${limitPh} OFFSET ${offsetPh}`,
      listParams,
    );

    return pageOf(
      items.map((item) => this.withContentUrl(item)),
      query.page,
      query.limit,
      Number(count?.count ?? 0),
    );
  }

  async get(actor: Actor, id: string): Promise<PhotoDetailDto> {
    const photo = await this.loadPhoto(id);
    await this.access.require(
      actor,
      'read',
      {
        type: 'photo',
        id,
        hostGroupId: photo.hostGroupId,
        groupIds: photo.groupIds,
        ownerId: photo.uploadedBy,
      },
      'detail',
    );
    const tags = await rows<PhotoTagDto>(
      this.db,
      `SELECT t.person_id AS "personId",p.first_name AS "firstName",p.last_name AS "lastName"
       FROM photo_tag t JOIN person p ON p.id=t.person_id
       WHERE t.photo_id=$1 ORDER BY p.last_name,p.first_name,t.person_id`,
      [id],
    );
    return {
      ...this.withContentUrl({
        ...photo,
        canManage: await this.isHostMentor(actor, photo.hostGroupId),
      }),
      tags,
    };
  }

  async upload(
    actor: Actor,
    input: UploadPhotoDto,
    file: Express.Multer.File,
  ): Promise<PhotoDetailDto> {
    await this.access.require(
      actor,
      'create',
      {
        type: 'photo',
        hostGroupId: input.groupId,
        groupIds: [input.groupId],
      },
      'detail',
    );
    await this.requireHostMentor(actor, input.groupId);
    this.assertImage(file);
    const albumTitle = input.albumTitle?.trim() || null;
    const title = input.title?.trim() || null;
    const eventNote = input.eventNote?.trim() || null;
    const locationOptionId = await this.resolvePlace(
      actor,
      input.locationOptionId,
      input.place,
    );
    const tagIds = [...new Set(input.taggedPersonIds ?? [])];
    await this.assertTaggablePeople(input.groupId, tagIds);
    const storageKey = randomUUID();
    const fileId = randomUUID();
    await this.storage.put(storageKey, file.buffer, file.mimetype);
    const created = await this.db.transaction(async (manager) => {
      await rows(
        manager,
        `INSERT INTO file_record(id,kind,storage_key,size,mime_type,created_by)
         VALUES($1,'album_photo',$2,$3,$4,$5)`,
        [fileId, storageKey, file.size, file.mimetype, actor.personId],
      );
      const photo = await one<{ id: string }>(
        manager,
        `INSERT INTO photo(host_group_id,file_id,uploaded_by,album_title,title,event_note,location_option_id)
         VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          input.groupId,
          fileId,
          actor.personId,
          albumTitle,
          title,
          eventNote,
          locationOptionId,
        ],
      );
      if (!photo) throw new BadRequestException();
      await rows(
        manager,
        `INSERT INTO photo_group(photo_id,group_id) VALUES($1,$2)`,
        [photo.id, input.groupId],
      );
      for (const personId of tagIds)
        await rows(
          manager,
          `INSERT INTO photo_tag(photo_id,person_id,tagged_by) VALUES($1,$2,$3)`,
          [photo.id, personId, actor.personId],
        );
      await this.audit.record(
        actor.personId,
        'photo.uploaded',
        'photo',
        photo.id,
        { groupId: input.groupId, albumTitle },
        manager,
      );
      return photo.id;
    });
    return this.get(actor, created);
  }

  async updateTags(
    actor: Actor,
    id: string,
    taggedPersonIds: string[],
  ): Promise<PhotoDetailDto> {
    const photo = await this.loadPhoto(id);
    await this.access.require(
      actor,
      'update',
      {
        type: 'photo',
        id,
        hostGroupId: photo.hostGroupId,
        groupIds: photo.groupIds,
        ownerId: photo.uploadedBy,
      },
      'detail',
    );
    await this.requireHostMentor(actor, photo.hostGroupId);
    const tagIds = [...new Set(taggedPersonIds)];
    await this.assertTaggablePeople(photo.hostGroupId, tagIds);
    await this.db.transaction(async (manager) => {
      await rows(manager, 'DELETE FROM photo_tag WHERE photo_id=$1', [id]);
      for (const personId of tagIds)
        await rows(
          manager,
          `INSERT INTO photo_tag(photo_id,person_id,tagged_by) VALUES($1,$2,$3)`,
          [id, personId, actor.personId],
        );
      await rows(
        manager,
        'UPDATE photo SET updated_at=now() WHERE id=$1',
        [id],
      );
      await this.audit.record(
        actor.personId,
        'photo.tags_updated',
        'photo',
        id,
        {},
        manager,
      );
    });
    return this.get(actor, id);
  }

  async content(
    actor: Actor,
    id: string,
  ): Promise<{ body: Buffer; mime: string }> {
    const photo = await this.loadPhoto(id);
    await this.access.require(
      actor,
      'read',
      {
        type: 'photo',
        id,
        hostGroupId: photo.hostGroupId,
        groupIds: photo.groupIds,
        ownerId: photo.uploadedBy,
      },
      'detail',
    );
    const file = await one<{ key: string; mime: string }>(
      this.db,
      `SELECT storage_key AS key,mime_type AS mime FROM file_record
       WHERE id=$1 AND (purge_after IS NULL OR purge_after>now())`,
      [photo.fileId],
    );
    if (!file) throw new NotFoundException();
    return { body: await this.storage.get(file.key), mime: file.mime };
  }

  private withContentUrl(item: PhotoSummaryDto): PhotoSummaryDto {
    return {
      ...item,
      contentUrl: `/api/v1/album/photos/${item.id}/content`,
    };
  }

  private async loadPhoto(
    id: string,
  ): Promise<PhotoSummaryDto & { groupIds: string[] }> {
    const photo = await one<PhotoSummaryDto>(
      this.db,
      `SELECT p.id,p.host_group_id AS "hostGroupId",g.name AS "hostGroupName",
        p.file_id AS "fileId",
        NULLIF(BTRIM(p.album_title), '') AS "albumTitle",
        p.title,p.event_note AS "eventNote",
        p.location_option_id AS "locationOptionId",
        loc.label AS "placeLabel",
        p.uploaded_by AS "uploadedBy",
        up.first_name||' '||up.last_name AS "uploaderName",
        p.created_at AS "createdAt",
        false AS "canManage",
        (SELECT count(*)::int FROM photo_tag t WHERE t.photo_id=p.id) AS "tagCount",
        '' AS "contentUrl"
       FROM photo p
       JOIN organization_group g ON g.id=p.host_group_id
       JOIN person up ON up.id=p.uploaded_by
       LEFT JOIN location_option loc ON loc.id=p.location_option_id
       WHERE p.id=$1`,
      [id],
    );
    if (!photo) throw new NotFoundException();
    const groups = await rows<{ groupId: string }>(
      this.db,
      `SELECT group_id AS "groupId" FROM photo_group
       WHERE photo_id=$1 AND hidden_by_group=false`,
      [id],
    );
    return { ...photo, groupIds: groups.map((row) => row.groupId) };
  }

  private async isHostMentor(
    actor: Actor,
    groupId: string,
  ): Promise<boolean> {
    return !!(await one(
      this.db,
      'SELECT 1 FROM organization_group WHERE id=$1 AND owner_person_id=$2',
      [groupId, actor.personId],
    ));
  }

  private async accessibleGroupIds(personId: string): Promise<string[]> {
    const groups = await rows<{ id: string }>(
      this.db,
      `SELECT group_id AS id FROM membership WHERE person_id=$1 AND valid_to IS NULL
       UNION
       SELECT id FROM organization_group WHERE owner_person_id=$1
       UNION
       SELECT g.id FROM organization_group g
       JOIN person_ancestors a ON a.person_id=g.owner_person_id
       WHERE a.ancestor_id=$1`,
      [personId],
    );
    return groups.map((row) => row.id);
  }

  private async requireHostMentor(
    actor: Actor,
    groupId: string,
  ): Promise<void> {
    if (!(await this.isHostMentor(actor, groupId)))
      throw new BadRequestException(
        'فقط مربی صاحب گروه می‌تواند عکس آلبوم را مدیریت کند.',
      );
  }

  private assertImage(file: Express.Multer.File): void {
    if (!file?.buffer?.length)
      throw new BadRequestException('فایل تصویر را انتخاب کن.');
    if (file.size > MAX_BYTES)
      throw new BadRequestException('حجم تصویر حداکثر ۸ مگابایت است.');
    if (!IMAGE_MIME.has(file.mimetype))
      throw new BadRequestException(
        'فقط تصویر JPEG، PNG یا WebP پذیرفته می‌شود.',
      );
  }

  private async assertTaggablePeople(
    groupId: string,
    personIds: string[],
  ): Promise<void> {
    if (personIds.length === 0) return;
    const found = await rows<{ id: string }>(
      this.db,
      `SELECT DISTINCT p.id FROM person p
       JOIN membership m ON m.person_id=p.id AND m.valid_to IS NULL
       WHERE m.group_id=$1 AND p.status='active' AND p.id=ANY($2::uuid[])`,
      [groupId, personIds],
    );
    if (found.length !== personIds.length)
      throw new BadRequestException(
        'برچسب فقط برای اعضای فعال همان گروه مجاز است.',
      );
  }

  private async resolvePlace(
    actor: Actor,
    locationOptionId: string | undefined,
    place: string | undefined,
  ): Promise<string | null> {
    if (locationOptionId) {
      const existing = await one<{ id: string }>(
        this.db,
        'SELECT id FROM location_option WHERE id=$1 AND active=true',
        [locationOptionId],
      );
      if (!existing)
        throw new BadRequestException('مکان انتخاب‌شده معتبر نیست.');
      return existing.id;
    }
    const label = place?.trim();
    if (!label) return null;
    const created = await this.locations.upsert(actor.personId, label);
    return created.id;
  }
}
