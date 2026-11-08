import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { normalizePersian } from '@safanoor/shared';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import {
  ConsultationDetailDto,
  ConsultationMemberDto,
  ConsultationPrivateNoteDto,
  ConsultationSummaryDto,
  ConsultationsPageDto,
  CreateConsultationDto,
  UpdateConsultationDto,
  UpsertConsultationPrivateNoteDto,
} from './consultations.dto';

@Injectable()
export class ConsultationsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async list(
    actor: Actor,
    query: PaginationDto,
  ): Promise<ConsultationsPageDto> {
    if (actor.isParent || actor.external)
      throw new ForbiddenException('اجازهٔ دسترسی به این بخش را ندارید.');
    // Technical manager (isAdmin): org-wide shared summaries; private notes stay gated.
    // Parameter layout differs so unused $n never appears (Postgres rejects that).
    const search = normalizePersian(query.search ?? '');
    const offset = (query.page - 1) * query.limit;
    const searchClause = (param: number) => `(
      $${param}='' OR COALESCE(c.place,'') LIKE '%'||$${param}||'%'
      OR EXISTS(
        SELECT 1 FROM consultation_member m
        JOIN person p ON p.id=m.person_id
        WHERE m.consultation_id=c.id
          AND (p.search_name LIKE '%'||$${param}||'%'
            OR p.first_name||' '||p.last_name LIKE '%'||$${param}||'%')
      )
      OR author.first_name||' '||author.last_name LIKE '%'||$${param}||'%'
      OR to_char(c.held_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')
           LIKE '%'||$${param}||'%'
      OR g.name LIKE '%'||$${param}||'%'
    )`;
    const scope = actor.isAdmin
      ? searchClause(1)
      : `${this.visibleSql(1)} AND ${searchClause(2)}`;
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM consultation c
       JOIN organization_group g ON g.id=c.group_id
       JOIN person author ON author.id=c.author_id
       WHERE ${scope}`,
      actor.isAdmin ? [search] : [actor.personId, search],
    );
    const items = await rows<ConsultationSummaryDto>(
      this.db,
      `SELECT ${this.summarySelect(actor.isAdmin ? 2 : 3)}
       FROM consultation c
       JOIN organization_group g ON g.id=c.group_id
       JOIN person author ON author.id=c.author_id
       WHERE ${scope}
       ORDER BY c.held_at DESC, c.id
       LIMIT $${actor.isAdmin ? 3 : 4} OFFSET $${actor.isAdmin ? 4 : 5}`,
      actor.isAdmin
        ? [search, actor.personId, query.limit, offset]
        : [actor.personId, search, actor.personId, query.limit, offset],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }

  async get(actor: Actor, id: string): Promise<ConsultationDetailDto> {
    await this.access.require(
      actor,
      'read',
      await this.access.resolve('consultation', id, actor),
      'detail',
    );
    return this.loadDetail(actor, id);
  }

  async create(
    actor: Actor,
    input: CreateConsultationDto,
  ): Promise<ConsultationDetailDto> {
    await this.access.require(
      actor,
      'create',
      {
        type: 'consultation',
        groupIds: [input.groupId],
        ownerId: actor.personId,
      },
      'detail',
    );
    const role = await this.requireAuthorRole(actor, input.groupId);
    const heldAt = this.parseHeldAt(input.heldAt);
    const kind = input.kind;
    const place = this.normalizePlace(kind, input.place);
    const sharedSummary = normalizePersian((input.sharedSummary ?? '').trim());
    const memberIds = await this.validateMembers(
      actor,
      input.groupId,
      input.memberIds,
      role,
    );
    const created = await this.db.transaction(async (manager) => {
      const row = await one<{ id: string }>(
        manager,
        `INSERT INTO consultation(
           group_id,author_id,held_at,kind,duration_minutes,place,shared_summary
         ) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          input.groupId,
          actor.personId,
          heldAt,
          kind,
          input.durationMinutes,
          place,
          sharedSummary,
        ],
      );
      if (!row) throw new BadRequestException();
      await this.replaceMembers(manager, row.id, memberIds);
      await this.audit.record(
        actor.personId,
        'consultation.created',
        'consultation',
        row.id,
        { kind, memberCount: memberIds.length },
        manager,
      );
      return row.id;
    });
    return this.loadDetail(actor, created);
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateConsultationDto,
  ): Promise<ConsultationDetailDto> {
    const resource = await this.access.resolve('consultation', id, actor);
    await this.access.require(actor, 'update', resource, 'detail');
    const current = await this.loadRow(id);
    const role = await this.requireAuthorRole(actor, current.groupId);
    if (actor.personId !== current.authorId && role !== 'mentor')
      throw new ForbiddenException(
        'فقط نویسنده یا مربی گروه می‌تواند مشاوره را ویرایش کند.',
      );
    const kind = input.kind ?? current.kind;
    const heldAt =
      input.heldAt !== undefined
        ? this.parseHeldAt(input.heldAt)
        : current.heldAt;
    const durationMinutes = input.durationMinutes ?? current.durationMinutes;
    const place =
      input.place !== undefined || input.kind !== undefined
        ? this.normalizePlace(
            kind,
            input.place !== undefined ? input.place : current.place,
          )
        : current.place;
    const sharedSummary =
      input.sharedSummary !== undefined
        ? normalizePersian(input.sharedSummary.trim())
        : current.sharedSummary;
    const memberIds =
      input.memberIds !== undefined
        ? await this.validateMembers(
            actor,
            current.groupId,
            input.memberIds,
            role === 'mentor' || actor.personId === current.authorId
              ? role
              : 'assistant',
          )
        : undefined;
    await this.db.transaction(async (manager) => {
      await rows(
        manager,
        `UPDATE consultation
         SET held_at=$2,kind=$3,duration_minutes=$4,place=$5,shared_summary=$6,updated_at=now()
         WHERE id=$1`,
        [id, heldAt, kind, durationMinutes, place, sharedSummary],
      );
      if (memberIds) await this.replaceMembers(manager, id, memberIds);
      await this.audit.record(
        actor.personId,
        'consultation.updated',
        'consultation',
        id,
        {},
        manager,
      );
    });
    return this.loadDetail(actor, id);
  }

  async getPrivateNote(
    actor: Actor,
    consultationId: string,
  ): Promise<ConsultationPrivateNoteDto> {
    const resource = await this.access.resolve(
      'consultation_private_note',
      consultationId,
      actor,
    );
    await this.access.require(actor, 'read', resource, 'detail');
    const consultation = await this.loadRow(consultationId);
    const note = await one<{ id: string; body: string; authorId: string }>(
      this.db,
      `SELECT id, body, author_id AS "authorId"
       FROM consultation_private_note WHERE consultation_id=$1`,
      [consultationId],
    );
    return {
      id: note?.id ?? null,
      consultationId,
      authorId: note?.authorId ?? consultation.authorId,
      body: note?.body ?? '',
      canWrite: actor.personId === consultation.authorId,
    };
  }

  async upsertPrivateNote(
    actor: Actor,
    consultationId: string,
    input: UpsertConsultationPrivateNoteDto,
  ): Promise<ConsultationPrivateNoteDto> {
    const consultation = await this.loadRow(consultationId);
    if (actor.personId !== consultation.authorId)
      throw new ForbiddenException(
        'فقط نویسندهٔ مشاوره می‌تواند یادداشت خصوصی را بنویسد.',
      );
    const resource = await this.access.resolve(
      'consultation_private_note',
      consultationId,
      actor,
    );
    const existing = await one<{ id: string }>(
      this.db,
      'SELECT id FROM consultation_private_note WHERE consultation_id=$1',
      [consultationId],
    );
    await this.access.require(
      actor,
      existing ? 'update' : 'create',
      resource,
      'detail',
    );
    const body = normalizePersian(input.body.trim());
    await this.db.transaction(async (manager) => {
      if (existing) {
        await rows(
          manager,
          `UPDATE consultation_private_note
           SET body=$2, updated_at=now() WHERE id=$1`,
          [existing.id, body],
        );
      } else {
        await rows(
          manager,
          `INSERT INTO consultation_private_note(consultation_id,author_id,body)
           VALUES($1,$2,$3)`,
          [consultationId, actor.personId, body],
        );
      }
      await this.audit.record(
        actor.personId,
        existing
          ? 'consultation_private_note.updated'
          : 'consultation_private_note.created',
        'consultation_private_note',
        consultationId,
        {},
        manager,
      );
    });
    return this.getPrivateNote(actor, consultationId);
  }

  private visibleSql(personParam: number): string {
    return `(
      c.author_id=$${personParam}
      OR EXISTS(
        SELECT 1 FROM consultation_member m
        WHERE m.consultation_id=c.id AND m.person_id=$${personParam}
      )
      OR EXISTS(
        SELECT 1 FROM organization_group g
        WHERE g.id=c.group_id AND g.owner_person_id=$${personParam}
      )
      OR EXISTS(
        SELECT 1 FROM consultation_member m
        JOIN follow_up_assignment f
          ON f.member_person_id=m.person_id
         AND f.assistant_person_id=$${personParam}
         AND f.to_date IS NULL
        WHERE m.consultation_id=c.id
      )
    )`;
  }

  private summarySelect(canManagePersonParam: number): string {
    return `c.id,c.group_id AS "groupId",g.name AS "groupName",
      c.author_id AS "authorId",author.first_name||' '||author.last_name AS "authorName",
      c.held_at::text AS "heldAt",c.kind,c.duration_minutes AS "durationMinutes",c.place,
      (SELECT count(*)::int FROM consultation_member m WHERE m.consultation_id=c.id) AS "memberCount",
      COALESCE(
        (SELECT string_agg(p.first_name||' '||p.last_name, '، ' ORDER BY p.first_name,p.last_name)
           FROM consultation_member m JOIN person p ON p.id=m.person_id
           WHERE m.consultation_id=c.id),
        ''
      ) AS "memberPreview",
      left(c.shared_summary, 120) AS "sharedSummaryPreview",
      (
        c.author_id=$${canManagePersonParam}
        OR EXISTS(
          SELECT 1 FROM organization_group og
          WHERE og.id=c.group_id AND og.owner_person_id=$${canManagePersonParam}
        )
      ) AS "canManage"`;
  }

  private async loadDetail(
    actor: Actor,
    id: string,
  ): Promise<ConsultationDetailDto> {
    const summary = await one<
      ConsultationSummaryDto & { sharedSummary: string }
    >(
      this.db,
      `SELECT ${this.summarySelect(2)}, c.shared_summary AS "sharedSummary"
       FROM consultation c
       JOIN organization_group g ON g.id=c.group_id
       JOIN person author ON author.id=c.author_id
       WHERE c.id=$1`,
      [id, actor.personId],
    );
    if (!summary) throw new NotFoundException();
    const members = await rows<ConsultationMemberDto>(
      this.db,
      `SELECT p.id, p.first_name||' '||p.last_name AS name
       FROM consultation_member m JOIN person p ON p.id=m.person_id
       WHERE m.consultation_id=$1
       ORDER BY p.first_name,p.last_name,p.id`,
      [id],
    );
    return {
      ...summary,
      memberPreview: members
        .slice(0, 3)
        .map((row) => row.name)
        .join('، '),
      members,
    };
  }

  private async loadRow(id: string): Promise<{
    id: string;
    groupId: string;
    authorId: string;
    heldAt: string;
    kind: 'in_person' | 'phone';
    durationMinutes: number;
    place: string | null;
    sharedSummary: string;
  }> {
    const row = await one<{
      id: string;
      groupId: string;
      authorId: string;
      heldAt: string;
      kind: 'in_person' | 'phone';
      durationMinutes: number;
      place: string | null;
      sharedSummary: string;
    }>(
      this.db,
      `SELECT id,group_id AS "groupId",author_id AS "authorId",held_at::text AS "heldAt",
        kind,duration_minutes AS "durationMinutes",place,shared_summary AS "sharedSummary"
       FROM consultation WHERE id=$1`,
      [id],
    );
    if (!row) throw new NotFoundException();
    return row;
  }

  private parseHeldAt(value: string): string {
    const time = Date.parse(value);
    if (Number.isNaN(time))
      throw new BadRequestException('تاریخ مشاوره معتبر نیست.');
    return new Date(time).toISOString();
  }

  private normalizePlace(
    kind: 'in_person' | 'phone',
    value?: string | null,
  ): string | null {
    if (kind === 'phone') {
      if (value === undefined || value === null) return null;
      const place = normalizePersian(value.trim());
      return place || null;
    }
    const place = normalizePersian((value ?? '').trim());
    if (!place)
      throw new BadRequestException('مکان مشاوره حضوری را وارد کن.');
    return place;
  }

  private async requireAuthorRole(
    actor: Actor,
    groupId: string,
  ): Promise<'mentor' | 'assistant'> {
    if (
      await one(
        this.db,
        'SELECT 1 FROM organization_group WHERE id=$1 AND owner_person_id=$2',
        [groupId, actor.personId],
      )
    )
      return 'mentor';
    if (
      await one(
        this.db,
        `SELECT 1 FROM membership
         WHERE person_id=$1 AND group_id=$2 AND role='assistant' AND valid_to IS NULL`,
        [actor.personId, groupId],
      )
    )
      return 'assistant';
    throw new ForbiddenException(
      'فقط مربی یا کمک‌مربی همین گروه می‌تواند مشاوره ثبت کند.',
    );
  }

  private async validateMembers(
    actor: Actor,
    groupId: string,
    memberIds: string[],
    role: 'mentor' | 'assistant',
  ): Promise<string[]> {
    const unique = [...new Set(memberIds)];
    if (unique.length < 1)
      throw new BadRequestException('حداقل یک نیرو انتخاب کن.');
    const allowed =
      role === 'mentor'
        ? await rows<{ id: string }>(
            this.db,
            `SELECT p.id FROM person p
             JOIN membership m ON m.person_id=p.id
             WHERE p.id=ANY($1::uuid[]) AND p.status='active'
               AND m.group_id=$2 AND m.role='member' AND m.valid_to IS NULL`,
            [unique, groupId],
          )
        : await rows<{ id: string }>(
            this.db,
            `SELECT p.id FROM person p
             JOIN membership m ON m.person_id=p.id
             JOIN follow_up_assignment f
               ON f.member_person_id=p.id
              AND f.assistant_person_id=$3
              AND f.to_date IS NULL
             WHERE p.id=ANY($1::uuid[]) AND p.status='active'
               AND m.group_id=$2 AND m.role='member' AND m.valid_to IS NULL`,
            [unique, groupId, actor.personId],
          );
    if (allowed.length !== unique.length)
      throw new BadRequestException(
        role === 'mentor'
          ? 'نیروها باید اعضای فعال همین گروه باشند.'
          : 'کمک‌مربی فقط می‌تواند نیروهای زیر پیگیری خودش را انتخاب کند.',
      );
    return unique;
  }

  private async replaceMembers(
    manager: EntityManager,
    consultationId: string,
    memberIds: string[],
  ): Promise<void> {
    await rows(
      manager,
      'DELETE FROM consultation_member WHERE consultation_id=$1',
      [consultationId],
    );
    for (const personId of memberIds)
      await rows(
        manager,
        'INSERT INTO consultation_member(consultation_id,person_id) VALUES($1,$2)',
        [consultationId, personId],
      );
  }
}
