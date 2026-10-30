import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { STORAGE, StorageAdapter } from '../files/storage';
import {
  ClassCardDto,
  ClassCardsPageDto,
  ClassDetailDto,
  ClassSessionDto,
  LmsItemDetailDto,
} from './lms.dto';

type SessionRow = {
  id: string;
  groupId: string;
  courseId: string | null;
  courseTitle: string | null;
  title: string;
  speaker: string | null;
  summary: string;
  heldAt: string;
  coverFileId: string | null;
  hasAudio: boolean;
  sortOrder: number;
};

@Injectable()
export class LmsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  async list(
    actor: Actor,
    groupId: string,
    query: PaginationDto,
  ): Promise<ClassCardsPageDto> {
    await this.access.require(
      actor,
      'read',
      { type: 'lms_item', groupIds: [groupId] },
      'detail',
    );
    if (
      !(await one(
        this.db,
        'SELECT 1 FROM organization_group WHERE id=$1',
        [groupId],
      ))
    )
      throw new NotFoundException();

    const cards = await rows<ClassCardDto & { sortAt: string }>(
      this.db,
      `WITH published AS (
         SELECT i.id,i.course_id,i.sort_order,i.published_at,
           r.group_id,r.title,r.speaker,r.summary,r.held_at,
           r.cover_file_id,r.audio_file_id,c.title AS course_title
         FROM lms_item i
         JOIN class_recording r ON r.id=i.recording_id
         LEFT JOIN course c ON c.id=i.course_id
         WHERE r.group_id=$1 AND i.published_at IS NOT NULL AND i.revoked_at IS NULL
       ),
       course_cards AS (
         SELECT
           p.course_id::text AS id,
           'course'::text AS "openAs",
           COALESCE(MAX(p.course_title), MAX(p.title)) AS title,
           (ARRAY_AGG(p.speaker ORDER BY p.held_at DESC, p.sort_order DESC, p.id DESC))[1] AS speaker,
           (ARRAY_AGG(p.summary ORDER BY p.held_at DESC, p.sort_order DESC, p.id DESC))[1] AS summary,
           MAX(p.held_at) AS "heldAt",
           count(*)::int AS "sessionCount",
           (ARRAY_AGG(p.cover_file_id ORDER BY p.held_at DESC, p.sort_order DESC, p.id DESC))[1] AS "coverFileId",
           CASE WHEN (ARRAY_AGG(p.cover_file_id ORDER BY p.held_at DESC, p.sort_order DESC, p.id DESC))[1] IS NULL
             THEN NULL
             ELSE '/api/v1/lms/courses/'||p.course_id::text||'/cover'
           END AS "coverUrl",
           bool_or(p.audio_file_id IS NOT NULL) AS "hasAudio",
           MAX(p.held_at) AS "sortAt"
         FROM published p
         WHERE p.course_id IS NOT NULL
         GROUP BY p.course_id
       ),
       item_cards AS (
         SELECT
           p.id::text AS id,
           'item'::text AS "openAs",
           p.title,
           p.speaker,
           p.summary,
           p.held_at AS "heldAt",
           1 AS "sessionCount",
           p.cover_file_id AS "coverFileId",
           CASE WHEN p.cover_file_id IS NULL THEN NULL
             ELSE '/api/v1/lms/items/'||p.id::text||'/cover'
           END AS "coverUrl",
           (p.audio_file_id IS NOT NULL) AS "hasAudio",
           p.held_at AS "sortAt"
         FROM published p
         WHERE p.course_id IS NULL
       )
       SELECT id,"openAs",title,speaker,summary,"heldAt","sessionCount",
         "coverFileId","coverUrl","hasAudio","sortAt"
       FROM (
         SELECT * FROM course_cards
         UNION ALL
         SELECT * FROM item_cards
       ) cards
       ORDER BY "sortAt" DESC, id
       LIMIT $2 OFFSET $3`,
      [groupId, query.limit, (query.page - 1) * query.limit],
    );
    const count = await one<{ count: string }>(
      this.db,
      `SELECT (
         (SELECT count(DISTINCT i.course_id) FROM lms_item i
          JOIN class_recording r ON r.id=i.recording_id
          WHERE r.group_id=$1 AND i.published_at IS NOT NULL AND i.revoked_at IS NULL
            AND i.course_id IS NOT NULL)
         +
         (SELECT count(*) FROM lms_item i
          JOIN class_recording r ON r.id=i.recording_id
          WHERE r.group_id=$1 AND i.published_at IS NOT NULL AND i.revoked_at IS NULL
            AND i.course_id IS NULL)
       )::text AS count`,
      [groupId],
    );
    return pageOf(
      cards.map(({ sortAt: _ignored, ...card }) => card),
      query.page,
      query.limit,
      Number(count?.count ?? 0),
    );
  }

  async getClass(
    actor: Actor,
    id: string,
    activeSessionId?: string,
  ): Promise<ClassDetailDto> {
    const asCourse = await this.loadCourseSessions(id);
    if (asCourse.length > 0) {
      await this.access.require(
        actor,
        'read',
        { type: 'lms_item', groupIds: [asCourse[0]!.groupId] },
        'detail',
      );
      return this.toDetail(
        'course',
        id,
        asCourse[0]!.courseTitle || asCourse[0]!.title,
        asCourse,
        activeSessionId,
      );
    }
    const item = await this.loadSessionRow(id);
    if (!item) throw new NotFoundException();
    await this.access.require(
      actor,
      'read',
      { type: 'lms_item', id, groupIds: [item.groupId] },
      'detail',
    );
    if (item.courseId) {
      const siblings = await this.loadCourseSessions(item.courseId);
      return this.toDetail(
        'course',
        item.courseId,
        item.courseTitle || item.title,
        siblings,
        id,
      );
    }
    return this.toDetail('item', id, item.title, [item], id);
  }

  async get(actor: Actor, id: string): Promise<LmsItemDetailDto> {
    const detail = await this.getClass(actor, id);
    const s = detail.activeSession;
    const row = await this.loadSessionRow(s.id);
    if (!row) throw new NotFoundException();
    return {
      id: s.id,
      groupId: row.groupId,
      title: s.title,
      speaker: s.speaker,
      summary: s.summary,
      heldAt: s.heldAt,
      courseTitle: detail.openAs === 'course' ? detail.title : null,
      coverFileId: s.coverFileId,
      coverUrl: s.coverUrl,
      hasAudio: s.hasAudio,
      publishedAt: s.heldAt,
      audioUrl: s.audioUrl,
    };
  }

  async courseCover(
    actor: Actor,
    courseId: string,
  ): Promise<{ body: Buffer; mime: string }> {
    const sessions = await this.loadCourseSessions(courseId);
    if (sessions.length === 0) throw new NotFoundException();
    await this.access.require(
      actor,
      'read',
      { type: 'lms_item', groupIds: [sessions[0]!.groupId] },
      'detail',
    );
    const newest = [...sessions].sort(
      (a, b) =>
        new Date(b.heldAt).getTime() - new Date(a.heldAt).getTime() ||
        b.sortOrder - a.sortOrder,
    )[0]!;
    if (!newest.coverFileId) throw new NotFoundException();
    return this.readFile(newest.coverFileId);
  }

  async cover(
    actor: Actor,
    id: string,
  ): Promise<{ body: Buffer; mime: string }> {
    const item = await this.loadSessionRow(id);
    if (!item) throw new NotFoundException();
    await this.access.require(
      actor,
      'read',
      { type: 'lms_item', id, groupIds: [item.groupId] },
      'detail',
    );
    if (!item.coverFileId) throw new NotFoundException();
    return this.readFile(item.coverFileId);
  }

  async audio(
    actor: Actor,
    id: string,
  ): Promise<{ body: Buffer; mime: string }> {
    const item = await this.loadSessionRow(id);
    if (!item) throw new NotFoundException();
    await this.access.require(
      actor,
      'read',
      { type: 'lms_item', id, groupIds: [item.groupId] },
      'detail',
    );
    const row = await one<{ audioFileId: string | null }>(
      this.db,
      `SELECT r.audio_file_id AS "audioFileId"
       FROM lms_item i JOIN class_recording r ON r.id=i.recording_id
       WHERE i.id=$1`,
      [id],
    );
    if (!row?.audioFileId) throw new NotFoundException();
    return this.readFile(row.audioFileId);
  }

  private toDetail(
    openAs: 'course' | 'item',
    id: string,
    title: string,
    sessionsAscHeld: SessionRow[],
    activeSessionId?: string,
  ): ClassDetailDto {
    const chronological = [...sessionsAscHeld].sort(
      (a, b) =>
        new Date(a.heldAt).getTime() - new Date(b.heldAt).getTime() ||
        a.sortOrder - b.sortOrder ||
        a.id.localeCompare(b.id),
    );
    const numberById = new Map(
      chronological.map((s, i) => [s.id, i + 1] as const),
    );
    const newestFirst = [...chronological].reverse();
    const mapped = newestFirst.map((s) =>
      this.toSessionDto(s, numberById.get(s.id) ?? 1),
    );
    const active =
      mapped.find((s) => s.id === activeSessionId) ?? mapped[0]!;
    return {
      id,
      openAs,
      title,
      sessionCount: mapped.length,
      activeSession: active,
      playlist: mapped.length > 1 ? mapped : [],
    };
  }

  private toSessionDto(
    row: SessionRow,
    sessionNumber: number,
  ): ClassSessionDto {
    return {
      id: row.id,
      title: row.title,
      speaker: row.speaker,
      summary: row.summary,
      heldAt: row.heldAt,
      sessionNumber,
      coverFileId: row.coverFileId,
      coverUrl: row.coverFileId
        ? `/api/v1/lms/items/${row.id}/cover`
        : null,
      hasAudio: row.hasAudio,
      audioUrl: row.hasAudio ? `/api/v1/lms/items/${row.id}/audio` : null,
    };
  }

  private async loadCourseSessions(courseId: string): Promise<SessionRow[]> {
    return rows<SessionRow>(
      this.db,
      `SELECT i.id,r.group_id AS "groupId",i.course_id AS "courseId",
        c.title AS "courseTitle",
        r.title,r.speaker,r.summary,r.held_at AS "heldAt",
        r.cover_file_id AS "coverFileId",
        (r.audio_file_id IS NOT NULL) AS "hasAudio",
        i.sort_order AS "sortOrder"
       FROM lms_item i
       JOIN class_recording r ON r.id=i.recording_id
       LEFT JOIN course c ON c.id=i.course_id
       WHERE i.course_id=$1 AND i.published_at IS NOT NULL AND i.revoked_at IS NULL
       ORDER BY r.held_at ASC, i.sort_order ASC, i.id ASC`,
      [courseId],
    );
  }

  private async loadSessionRow(id: string): Promise<SessionRow | null> {
    return (
      (await one<SessionRow>(
        this.db,
        `SELECT i.id,r.group_id AS "groupId",i.course_id AS "courseId",
          c.title AS "courseTitle",
          r.title,r.speaker,r.summary,r.held_at AS "heldAt",
          r.cover_file_id AS "coverFileId",
          (r.audio_file_id IS NOT NULL) AS "hasAudio",
          i.sort_order AS "sortOrder"
         FROM lms_item i
         JOIN class_recording r ON r.id=i.recording_id
         LEFT JOIN course c ON c.id=i.course_id
         WHERE i.id=$1 AND i.published_at IS NOT NULL AND i.revoked_at IS NULL`,
        [id],
      )) ?? null
    );
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
}
