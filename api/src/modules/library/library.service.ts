import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import { STORAGE, StorageAdapter } from '../files/storage';
import {
  CreateStudyPathDto,
  CreateStudyPathItemDto,
  ReorderStudyPathItemsDto,
  StudyPathDetailDto,
  StudyPathItemDto,
  StudyPathSummaryDto,
  StudyPathsPageDto,
  UpdateStudyPathDto,
  UpdateReadingDto,
  UpdateStudyPathItemDto,
} from './library.dto';

@Injectable()
export class LibraryService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  async list(
    actor: Actor,
    groupId: string,
    query: PaginationDto,
  ): Promise<StudyPathsPageDto> {
    await this.access.require(
      actor,
      'read',
      { type: 'study_path', groupIds: [groupId] },
      'detail',
    );
    await this.requireVisibleGroup(groupId);
    const canManage = await this.isGroupMentor(actor, groupId);
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM study_path WHERE group_id=$1',
      [groupId],
    );
    const items = await rows<StudyPathSummaryDto>(
      this.db,
      `SELECT p.id,p.group_id AS "groupId",g.name AS "groupName",p.title,p.description,
        (SELECT count(*)::int FROM study_path_item i WHERE i.path_id=p.id) AS "itemCount",
        p.cover_file_id AS "coverFileId",
        CASE WHEN p.cover_file_id IS NULL THEN NULL
             ELSE '/api/v1/study-paths/'||p.id::text||'/cover' END AS "coverUrl",
        p.created_by AS "createdBy",p.created_at AS "createdAt",p.updated_at AS "updatedAt",
        $2::boolean AS "canManage"
       FROM study_path p
       JOIN organization_group g ON g.id=p.group_id
       WHERE p.group_id=$1
       ORDER BY p.created_at DESC,p.id
       LIMIT $3 OFFSET $4`,
      [groupId, canManage, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }

  /** Org-wide catalogue for technical manager during development. */
  async listAll(
    actor: Actor,
    query: PaginationDto,
  ): Promise<StudyPathsPageDto> {
    if (!actor.isAdmin)
      throw new ForbiddenException('اجازهٔ دسترسی به این بخش را ندارید.');
    await this.access.require(actor, 'read', { type: 'study_path' }, 'detail');
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM study_path',
    );
    const items = await rows<StudyPathSummaryDto>(
      this.db,
      `SELECT p.id,p.group_id AS "groupId",g.name AS "groupName",p.title,p.description,
        (SELECT count(*)::int FROM study_path_item i WHERE i.path_id=p.id) AS "itemCount",
        p.cover_file_id AS "coverFileId",
        CASE WHEN p.cover_file_id IS NULL THEN NULL
             ELSE '/api/v1/study-paths/'||p.id::text||'/cover' END AS "coverUrl",
        p.created_by AS "createdBy",p.created_at AS "createdAt",p.updated_at AS "updatedAt",
        false AS "canManage"
       FROM study_path p
       JOIN organization_group g ON g.id=p.group_id
       ORDER BY g.name, p.created_at DESC, p.id
       LIMIT $1 OFFSET $2`,
      [query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }

  async create(
    actor: Actor,
    groupId: string,
    input: CreateStudyPathDto,
  ): Promise<StudyPathDetailDto> {
    await this.access.require(
      actor,
      'create',
      { type: 'study_path', groupIds: [groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, groupId);
    const title = input.title.trim();
    if (title.length < 2) throw new BadRequestException('عنوان را وارد کن.');
    const description = input.description?.trim() || null;
    const created = await this.db.transaction(async (manager) => {
      const row = await one<{ id: string }>(
        manager,
        `INSERT INTO study_path(group_id,title,description,created_by)
         VALUES($1,$2,$3,$4) RETURNING id`,
        [groupId, title, description, actor.personId],
      );
      if (!row) throw new BadRequestException();
      await this.audit.record(
        actor.personId,
        'study_path.created',
        'study_path',
        row.id,
        {},
        manager,
      );
      return row;
    });
    return this.get(actor, created.id);
  }

  async get(actor: Actor, id: string): Promise<StudyPathDetailDto> {
    const path = await this.loadPath(id);
    await this.access.require(
      actor,
      'read',
      { type: 'study_path', id, groupIds: [path.groupId] },
      'detail',
    );
    const canManage = await this.isGroupMentor(actor, path.groupId);
    const items = await rows<StudyPathItemDto>(
      this.db,
      `SELECT id,path_id AS "pathId",position,book_title AS "bookTitle",
        book_author AS "bookAuthor",notes,total_pages AS "totalPages",
        cover_file_id AS "coverFileId",
        CASE WHEN cover_file_id IS NULL THEN NULL
             ELSE '/api/v1/study-paths/'||path_id::text||'/items/'||id::text||'/cover'
        END AS "coverUrl",
        pdf_file_id AS "pdfFileId",
        CASE WHEN pdf_file_id IS NULL THEN NULL
             ELSE '/api/v1/study-paths/'||path_id::text||'/items/'||id::text||'/pdf'
        END AS "pdfUrl"
       FROM study_path_item WHERE path_id=$1 ORDER BY position,id`,
      [id],
    );
    const canTrackReading =
      !actor.isAdmin &&
      (await this.access.level(actor, 'read', {
        type: 'study_reading',
        ownerId: actor.personId,
      })) === 'detail';
    const reading = canTrackReading
      ? await rows<{
          itemId: string;
          status: 'reading' | 'completed';
          currentPage: number;
        }>(
          this.db,
          `SELECT r.item_id AS "itemId",r.status,r.current_page AS "currentPage" FROM study_path_reading r
       JOIN study_path_item i ON i.id=r.item_id WHERE i.path_id=$1 AND r.person_id=$2`,
          [id, actor.personId],
        )
      : [];
    const history = canTrackReading
      ? await rows<{ itemId: string; day: string; pages: number }>(
          this.db,
          `SELECT e.item_id AS "itemId",e.reading_day::text AS day,sum(e.delta)::int AS pages
       FROM study_reading_event e JOIN study_path_item i ON i.id=e.item_id
       WHERE i.path_id=$1 AND e.person_id=$2 AND e.reading_day >= (now() AT TIME ZONE 'Asia/Tehran')::date-89 GROUP BY e.item_id,e.reading_day ORDER BY e.reading_day DESC`,
          [id, actor.personId],
        )
      : [];
    const statuses = new Map(reading.map((row) => [row.itemId, row.status]));
    const completedCount = reading.filter(
      (row) => row.status === 'completed',
    ).length;
    return {
      ...path,
      itemCount: items.length,
      canManage,
      canTrackReading,
      items: items.map((item) => ({
        ...item,
        readingStatus: statuses.get(item.id) ?? 'not_started',
        currentPage:
          reading.find((r) => r.itemId === item.id)?.currentPage ?? 0,
        readingHistory: history
          .filter((r) => r.itemId === item.id)
          .map(({ day, pages }) => ({ day, pages })),
      })),
      readingProgress: canTrackReading
        ? {
            started: reading.length > 0,
            completedCount,
            totalCount: items.length,
            percent: items.length
              ? Math.round((completedCount * 100) / items.length)
              : 0,
          }
        : null,
    };
  }

  async updateReading(
    actor: Actor,
    pathId: string,
    itemId: string,
    input: UpdateReadingDto,
  ): Promise<StudyPathDetailDto> {
    if (actor.isAdmin)
      throw new ForbiddenException('اجازهٔ ثبت پیشرفت مطالعه را ندارید.');
    const path = await this.loadPath(pathId);
    await this.access.require(
      actor,
      'read',
      { type: 'study_path', id: pathId, groupIds: [path.groupId] },
      'detail',
    );
    await this.access.require(
      actor,
      'update',
      { type: 'study_reading', ownerId: actor.personId },
      'detail',
    );
    await this.db.transaction(async (manager) => {
      const item = await one<{ totalPages: number | null }>(
        manager,
        'SELECT total_pages AS "totalPages" FROM study_path_item WHERE id=$1 AND path_id=$2 FOR UPDATE',
        [itemId, pathId],
      );
      if (!item) throw new NotFoundException();
      const previous = await one<{ currentPage: number }>(
        manager,
        'SELECT current_page AS "currentPage" FROM study_path_reading WHERE item_id=$1 AND person_id=$2',
        [itemId, actor.personId],
      );
      const page =
        input.status === 'not_started'
          ? 0
          : (input.currentPage ?? previous?.currentPage ?? 0);
      if (page > 0 && (!item.totalPages || page > item.totalPages))
        throw new BadRequestException('صفحه خارج از محدودهٔ کتاب است.');
      if (
        input.status === 'completed' &&
        (!input.confirmCompleted ||
          !item.totalPages ||
          page !== item.totalPages)
      )
        throw new BadRequestException(
          'پایان کتاب باید در صفحهٔ آخر تأیید شود.',
        );
      if (
        input.status === 'reading' &&
        item.totalPages &&
        page === item.totalPages
      )
        throw new BadRequestException(
          'پایان کتاب را تأیید کنید یا صفحه را اصلاح کنید.',
        );
      if (page !== (previous?.currentPage ?? 0))
        await rows(
          manager,
          'INSERT INTO study_reading_event(person_id,item_id,from_page,to_page) VALUES($1,$2,$3,$4)',
          [actor.personId, itemId, previous?.currentPage ?? 0, page],
        );
      if (input.status === 'not_started')
        await rows(
          manager,
          'DELETE FROM study_path_reading WHERE item_id=$1 AND person_id=$2',
          [itemId, actor.personId],
        );
      else
        await rows(
          manager,
          `INSERT INTO study_path_reading(item_id,person_id,status,current_page) VALUES($1,$2,$3,$4)
        ON CONFLICT(person_id,item_id) DO UPDATE SET status=EXCLUDED.status,current_page=EXCLUDED.current_page,updated_at=now()`,
          [itemId, actor.personId, input.status, page],
        );
    });
    return this.get(actor, pathId);
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateStudyPathDto,
  ): Promise<StudyPathDetailDto> {
    const path = await this.loadPath(id);
    await this.access.require(
      actor,
      'update',
      { type: 'study_path', id, groupIds: [path.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, path.groupId);
    if (input.title === undefined && input.description === undefined)
      throw new BadRequestException('چیزی برای ویرایش ارسال نشده است.');
    const title = input.title !== undefined ? input.title.trim() : path.title;
    if (title.length < 2) throw new BadRequestException('عنوان را وارد کن.');
    const description =
      input.description === undefined
        ? path.description
        : input.description === null
          ? null
          : input.description.trim() || null;
    await this.db.transaction(async (manager) => {
      await rows(
        manager,
        `UPDATE study_path SET title=$2,description=$3,updated_at=now() WHERE id=$1`,
        [id, title, description],
      );
      await this.audit.record(
        actor.personId,
        'study_path.updated',
        'study_path',
        id,
        {},
        manager,
      );
    });
    return this.get(actor, id);
  }

  async cover(
    actor: Actor,
    id: string,
  ): Promise<{ body: Buffer; mime: string }> {
    const path = await this.loadPath(id);
    await this.access.require(
      actor,
      'read',
      { type: 'study_path', id, groupIds: [path.groupId] },
      'detail',
    );
    if (!path.coverFileId) throw new NotFoundException();
    const file = await one<{ key: string; mime: string }>(
      this.db,
      `SELECT storage_key AS key,mime_type AS mime FROM file_record
       WHERE id=$1 AND (purge_after IS NULL OR purge_after>now())`,
      [path.coverFileId],
    );
    if (!file) throw new NotFoundException();
    return { body: await this.storage.get(file.key), mime: file.mime };
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const path = await this.loadPath(id);
    await this.access.require(
      actor,
      'manage',
      { type: 'study_path', id, groupIds: [path.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, path.groupId);
    await this.db.transaction(async (manager) => {
      await rows(manager, 'DELETE FROM study_path WHERE id=$1', [id]);
      await this.audit.record(
        actor.personId,
        'study_path.deleted',
        'study_path',
        id,
        {},
        manager,
      );
    });
  }

  async addItem(
    actor: Actor,
    pathId: string,
    input: CreateStudyPathItemDto,
  ): Promise<StudyPathDetailDto> {
    const path = await this.loadPath(pathId);
    await this.access.require(
      actor,
      'update',
      { type: 'study_path', id: pathId, groupIds: [path.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, path.groupId);
    const bookTitle = input.bookTitle.trim();
    if (!bookTitle) throw new BadRequestException('عنوان کتاب را وارد کن.');
    const bookAuthor = input.bookAuthor?.trim() || null;
    const notes = input.notes?.trim() || null;
    await this.db.transaction(async (manager) => {
      const next = await one<{ position: number }>(
        manager,
        `SELECT COALESCE(MAX(position),-1)+1 AS position FROM study_path_item WHERE path_id=$1`,
        [pathId],
      );
      await rows(
        manager,
        `INSERT INTO study_path_item(path_id,position,book_title,book_author,notes,total_pages)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [
          pathId,
          next?.position ?? 0,
          bookTitle,
          bookAuthor,
          notes,
          input.totalPages ?? null,
        ],
      );
      await rows(
        manager,
        'UPDATE study_path SET updated_at=now() WHERE id=$1',
        [pathId],
      );
      await this.audit.record(
        actor.personId,
        'study_path.item_added',
        'study_path',
        pathId,
        {},
        manager,
      );
    });
    return this.get(actor, pathId);
  }

  async updateItem(
    actor: Actor,
    pathId: string,
    itemId: string,
    input: UpdateStudyPathItemDto,
  ): Promise<StudyPathDetailDto> {
    const path = await this.loadPath(pathId);
    await this.access.require(
      actor,
      'update',
      { type: 'study_path', id: pathId, groupIds: [path.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, path.groupId);
    const item = await one<StudyPathItemDto>(
      this.db,
      `SELECT id,path_id AS "pathId",position,book_title AS "bookTitle",
        book_author AS "bookAuthor",notes,total_pages AS "totalPages"
       FROM study_path_item WHERE id=$1 AND path_id=$2`,
      [itemId, pathId],
    );
    if (!item) throw new NotFoundException();
    if (
      input.bookTitle === undefined &&
      input.bookAuthor === undefined &&
      input.notes === undefined &&
      input.totalPages === undefined
    )
      throw new BadRequestException('چیزی برای ویرایش ارسال نشده است.');
    const bookTitle =
      input.bookTitle !== undefined ? input.bookTitle.trim() : item.bookTitle;
    if (!bookTitle) throw new BadRequestException('عنوان کتاب را وارد کن.');
    const bookAuthor =
      input.bookAuthor === undefined
        ? item.bookAuthor
        : input.bookAuthor === null
          ? null
          : input.bookAuthor.trim() || null;
    const notes =
      input.notes === undefined
        ? item.notes
        : input.notes === null
          ? null
          : input.notes.trim() || null;
    await this.db.transaction(async (manager) => {
      await rows(
        manager,
        'SELECT id FROM study_path_item WHERE id=$1 FOR UPDATE',
        [itemId],
      );
      if (
        input.totalPages !== undefined &&
        (await one(
          manager,
          'SELECT 1 FROM study_path_reading WHERE item_id=$1 AND current_page>$2 LIMIT 1',
          [itemId, input.totalPages],
        ))
      )
        throw new BadRequestException(
          'تعداد صفحات از پیشرفت ثبت‌شده کمتر است.',
        );
      await rows(
        manager,
        `UPDATE study_path_item
         SET book_title=$3,book_author=$4,notes=$5,total_pages=COALESCE($6,total_pages),updated_at=now()
         WHERE id=$1 AND path_id=$2`,
        [
          itemId,
          pathId,
          bookTitle,
          bookAuthor,
          notes,
          input.totalPages ?? null,
        ],
      );
      await rows(
        manager,
        'UPDATE study_path SET updated_at=now() WHERE id=$1',
        [pathId],
      );
      await this.audit.record(
        actor.personId,
        'study_path.item_updated',
        'study_path',
        pathId,
        {},
        manager,
      );
    });
    return this.get(actor, pathId);
  }

  async removeItem(
    actor: Actor,
    pathId: string,
    itemId: string,
  ): Promise<StudyPathDetailDto> {
    const path = await this.loadPath(pathId);
    await this.access.require(
      actor,
      'update',
      { type: 'study_path', id: pathId, groupIds: [path.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, path.groupId);
    await this.db.transaction(async (manager) => {
      const deleted = await one<{ id: string }>(
        manager,
        'DELETE FROM study_path_item WHERE id=$1 AND path_id=$2 RETURNING id',
        [itemId, pathId],
      );
      if (!deleted) throw new NotFoundException();
      await rows(
        manager,
        `WITH ordered AS (
           SELECT id,ROW_NUMBER() OVER (ORDER BY position,id)-1 AS position
           FROM study_path_item WHERE path_id=$1
         )
         UPDATE study_path_item i SET position=o.position
         FROM ordered o WHERE i.id=o.id`,
        [pathId],
      );
      await rows(
        manager,
        'UPDATE study_path SET updated_at=now() WHERE id=$1',
        [pathId],
      );
      await this.audit.record(
        actor.personId,
        'study_path.item_removed',
        'study_path',
        pathId,
        {},
        manager,
      );
    });
    return this.get(actor, pathId);
  }

  async reorderItems(
    actor: Actor,
    pathId: string,
    input: ReorderStudyPathItemsDto,
  ): Promise<StudyPathDetailDto> {
    const path = await this.loadPath(pathId);
    await this.access.require(
      actor,
      'update',
      { type: 'study_path', id: pathId, groupIds: [path.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, path.groupId);
    const existing = await rows<{ id: string }>(
      this.db,
      'SELECT id FROM study_path_item WHERE path_id=$1 ORDER BY position,id',
      [pathId],
    );
    const existingIds = new Set(existing.map((row) => row.id));
    if (
      input.itemIds.length !== existingIds.size ||
      input.itemIds.some((id) => !existingIds.has(id))
    )
      throw new BadRequestException('ترتیب گام‌ها با فهرست فعلی هم‌خوان نیست.');
    await this.db.transaction(async (manager) => {
      // Two-phase update avoids unique (path_id, position) collisions.
      await rows(
        manager,
        `UPDATE study_path_item SET position = position + 100000 WHERE path_id=$1`,
        [pathId],
      );
      for (const [index, itemId] of input.itemIds.entries())
        await rows(
          manager,
          'UPDATE study_path_item SET position=$3,updated_at=now() WHERE id=$1 AND path_id=$2',
          [itemId, pathId, index],
        );
      await rows(
        manager,
        'UPDATE study_path SET updated_at=now() WHERE id=$1',
        [pathId],
      );
      await this.audit.record(
        actor.personId,
        'study_path.items_reordered',
        'study_path',
        pathId,
        {},
        manager,
      );
    });
    return this.get(actor, pathId);
  }

  async itemCover(
    actor: Actor,
    pathId: string,
    itemId: string,
  ): Promise<{ body: Buffer; mime: string }> {
    const path = await this.loadPath(pathId);
    await this.access.require(
      actor,
      'read',
      { type: 'study_path', id: pathId, groupIds: [path.groupId] },
      'detail',
    );
    const item = await one<{ coverFileId: string | null }>(
      this.db,
      'SELECT cover_file_id AS "coverFileId" FROM study_path_item WHERE id=$1 AND path_id=$2',
      [itemId, pathId],
    );
    if (!item?.coverFileId) throw new NotFoundException();
    return this.readFile(item.coverFileId);
  }

  async itemPdf(
    actor: Actor,
    pathId: string,
    itemId: string,
  ): Promise<{ body: Buffer; mime: string }> {
    const path = await this.loadPath(pathId);
    await this.access.require(
      actor,
      'read',
      { type: 'study_path', id: pathId, groupIds: [path.groupId] },
      'detail',
    );
    const item = await one<{ pdfFileId: string | null }>(
      this.db,
      'SELECT pdf_file_id AS "pdfFileId" FROM study_path_item WHERE id=$1 AND path_id=$2',
      [itemId, pathId],
    );
    if (!item?.pdfFileId) throw new NotFoundException();
    return this.readFile(item.pdfFileId);
  }

  async uploadItemCover(
    actor: Actor,
    pathId: string,
    itemId: string,
    file: Express.Multer.File,
  ): Promise<StudyPathDetailDto> {
    await this.requireItemManage(actor, pathId, itemId);
    const fileId = await this.storeUpload(actor, file, 'study_path_cover', [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    await rows(
      this.db,
      `UPDATE study_path_item SET cover_file_id=$3,updated_at=now()
       WHERE id=$1 AND path_id=$2`,
      [itemId, pathId, fileId],
    );
    await rows(this.db, 'UPDATE study_path SET updated_at=now() WHERE id=$1', [
      pathId,
    ]);
    return this.get(actor, pathId);
  }

  async uploadItemPdf(
    actor: Actor,
    pathId: string,
    itemId: string,
    file: Express.Multer.File,
  ): Promise<StudyPathDetailDto> {
    await this.requireItemManage(actor, pathId, itemId);
    const fileId = await this.storeUpload(actor, file, 'study_path_pdf', [
      'application/pdf',
    ]);
    await rows(
      this.db,
      `UPDATE study_path_item SET pdf_file_id=$3,updated_at=now()
       WHERE id=$1 AND path_id=$2`,
      [itemId, pathId, fileId],
    );
    await rows(this.db, 'UPDATE study_path SET updated_at=now() WHERE id=$1', [
      pathId,
    ]);
    return this.get(actor, pathId);
  }

  async removeItemPdf(
    actor: Actor,
    pathId: string,
    itemId: string,
  ): Promise<StudyPathDetailDto> {
    await this.requireItemManage(actor, pathId, itemId);
    await rows(
      this.db,
      `UPDATE study_path_item SET pdf_file_id=NULL,updated_at=now()
       WHERE id=$1 AND path_id=$2`,
      [itemId, pathId],
    );
    await rows(this.db, 'UPDATE study_path SET updated_at=now() WHERE id=$1', [
      pathId,
    ]);
    return this.get(actor, pathId);
  }

  private async requireItemManage(
    actor: Actor,
    pathId: string,
    itemId: string,
  ): Promise<void> {
    const path = await this.loadPath(pathId);
    await this.access.require(
      actor,
      'update',
      { type: 'study_path', id: pathId, groupIds: [path.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, path.groupId);
    if (
      !(await one(
        this.db,
        'SELECT 1 FROM study_path_item WHERE id=$1 AND path_id=$2',
        [itemId, pathId],
      ))
    )
      throw new NotFoundException();
  }

  private async storeUpload(
    actor: Actor,
    file: Express.Multer.File,
    kind: string,
    allowed: string[],
  ): Promise<string> {
    if (!file?.buffer?.length)
      throw new BadRequestException('فایل را انتخاب کن.');
    if (!allowed.includes(file.mimetype))
      throw new BadRequestException('نوع فایل مجاز نیست.');
    const fileId = randomUUID();
    const storageKey = randomUUID();
    await this.storage.put(storageKey, file.buffer, file.mimetype);
    await rows(
      this.db,
      `INSERT INTO file_record(id,kind,storage_key,size,mime_type,created_by)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [
        fileId,
        kind,
        storageKey,
        file.buffer.length,
        file.mimetype,
        actor.personId,
      ],
    );
    return fileId;
  }

  private async readFile(
    fileId: string,
  ): Promise<{ body: Buffer; mime: string }> {
    const file = await one<{ key: string; mime: string }>(
      this.db,
      `SELECT storage_key AS key,mime_type AS mime FROM file_record
       WHERE id=$1 AND (purge_after IS NULL OR purge_after>now())`,
      [fileId],
    );
    if (!file) throw new NotFoundException();
    return { body: await this.storage.get(file.key), mime: file.mime };
  }

  private async loadPath(id: string): Promise<StudyPathSummaryDto> {
    const path = await one<StudyPathSummaryDto>(
      this.db,
      `SELECT p.id,p.group_id AS "groupId",g.name AS "groupName",p.title,p.description,
        (SELECT count(*)::int FROM study_path_item i WHERE i.path_id=p.id) AS "itemCount",
        p.cover_file_id AS "coverFileId",
        CASE WHEN p.cover_file_id IS NULL THEN NULL
             ELSE '/api/v1/study-paths/'||p.id::text||'/cover' END AS "coverUrl",
        p.created_by AS "createdBy",p.created_at AS "createdAt",p.updated_at AS "updatedAt",
        false AS "canManage"
       FROM study_path p
       JOIN organization_group g ON g.id=p.group_id
       WHERE p.id=$1`,
      [id],
    );
    if (!path) throw new NotFoundException();
    return path;
  }

  private async requireVisibleGroup(groupId: string): Promise<void> {
    if (
      !(await one(this.db, 'SELECT 1 FROM organization_group WHERE id=$1', [
        groupId,
      ]))
    )
      throw new NotFoundException();
  }

  private async requireOwnedGroup(
    actor: Actor,
    groupId: string,
  ): Promise<void> {
    await this.requireVisibleGroup(groupId);
    if (!(await this.isGroupMentor(actor, groupId)))
      throw new BadRequestException(
        'فقط مربی صاحب گروه می‌تواند سیر مطالعاتی را مدیریت کند.',
      );
  }

  private async isGroupMentor(actor: Actor, groupId: string): Promise<boolean> {
    return !!(await one(
      this.db,
      'SELECT 1 FROM organization_group WHERE id=$1 AND owner_person_id=$2',
      [groupId, actor.personId],
    ));
  }
}
