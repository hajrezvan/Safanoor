import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import {
  CreateStudyPathDto,
  CreateStudyPathItemDto,
  ReorderStudyPathItemsDto,
  StudyPathDetailDto,
  StudyPathItemDto,
  StudyPathSummaryDto,
  StudyPathsPageDto,
  UpdateStudyPathDto,
  UpdateStudyPathItemDto,
} from './library.dto';

@Injectable()
export class LibraryService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
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
      `SELECT p.id,p.group_id AS "groupId",p.title,p.description,
        (SELECT count(*)::int FROM study_path_item i WHERE i.path_id=p.id) AS "itemCount",
        p.created_by AS "createdBy",p.created_at AS "createdAt",p.updated_at AS "updatedAt",
        $2::boolean AS "canManage"
       FROM study_path p
       WHERE p.group_id=$1
       ORDER BY p.created_at DESC,p.id
       LIMIT $3 OFFSET $4`,
      [groupId, canManage, query.limit, (query.page - 1) * query.limit],
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
        book_author AS "bookAuthor",notes
       FROM study_path_item WHERE path_id=$1 ORDER BY position,id`,
      [id],
    );
    return { ...path, itemCount: items.length, canManage, items };
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
    const title =
      input.title !== undefined ? input.title.trim() : path.title;
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
        `INSERT INTO study_path_item(path_id,position,book_title,book_author,notes)
         VALUES($1,$2,$3,$4,$5)`,
        [pathId, next?.position ?? 0, bookTitle, bookAuthor, notes],
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
        book_author AS "bookAuthor",notes
       FROM study_path_item WHERE id=$1 AND path_id=$2`,
      [itemId, pathId],
    );
    if (!item) throw new NotFoundException();
    if (
      input.bookTitle === undefined &&
      input.bookAuthor === undefined &&
      input.notes === undefined
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
        `UPDATE study_path_item
         SET book_title=$3,book_author=$4,notes=$5,updated_at=now()
         WHERE id=$1 AND path_id=$2`,
        [itemId, pathId, bookTitle, bookAuthor, notes],
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

  private async loadPath(id: string): Promise<StudyPathSummaryDto> {
    const path = await one<StudyPathSummaryDto>(
      this.db,
      `SELECT p.id,p.group_id AS "groupId",p.title,p.description,
        (SELECT count(*)::int FROM study_path_item i WHERE i.path_id=p.id) AS "itemCount",
        p.created_by AS "createdBy",p.created_at AS "createdAt",p.updated_at AS "updatedAt",
        false AS "canManage"
       FROM study_path p WHERE p.id=$1`,
      [id],
    );
    if (!path) throw new NotFoundException();
    return path;
  }

  private async requireVisibleGroup(groupId: string): Promise<void> {
    if (
      !(await one(
        this.db,
        'SELECT 1 FROM organization_group WHERE id=$1',
        [groupId],
      ))
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

  private async isGroupMentor(
    actor: Actor,
    groupId: string,
  ): Promise<boolean> {
    return !!(await one(
      this.db,
      'SELECT 1 FROM organization_group WHERE id=$1 AND owner_person_id=$2',
      [groupId, actor.personId],
    ));
  }
}
