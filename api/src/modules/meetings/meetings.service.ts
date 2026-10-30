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
  CreateMeetingDto,
  MeetingAttendeeDto,
  MeetingDetailDto,
  MeetingSummaryDto,
  MeetingsPageDto,
  ResolutionDto,
  ResolutionInputDto,
  UpdateMeetingDto,
} from './meetings.dto';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor, query: PaginationDto): Promise<MeetingsPageDto> {
    if (actor.isParent || actor.external)
      throw new ForbiddenException('اجازهٔ دسترسی به این بخش را ندارید.');
    const visible = this.visibleSql(1);
    const search = normalizePersian(query.search ?? '');
    const scope = `${visible} AND ($2='' OR m.title LIKE '%'||$2||'%' OR COALESCE(m.place,'') LIKE '%'||$2||'%')`;
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM meeting m WHERE ${scope}`,
      [actor.personId, search],
    );
    const items = await rows<MeetingSummaryDto>(
      this.db,
      `SELECT ${this.summarySelect(3)}
       FROM meeting m
       JOIN organization_group g ON g.id=m.group_id
       WHERE ${scope}
       ORDER BY m.held_at DESC, m.id
       LIMIT $4 OFFSET $5`,
      [
        actor.personId,
        search,
        actor.personId,
        query.limit,
        (query.page - 1) * query.limit,
      ],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }

  async get(actor: Actor, id: string): Promise<MeetingDetailDto> {
    await this.access.require(
      actor,
      'read',
      await this.access.resolve('meeting', id, actor),
      'detail',
    );
    return this.loadDetail(actor, id);
  }

  async create(
    actor: Actor,
    input: CreateMeetingDto,
  ): Promise<MeetingDetailDto> {
    await this.access.require(
      actor,
      'create',
      { type: 'meeting', groupIds: [input.groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, input.groupId);
    const title = normalizePersian(input.title.trim());
    if (title.length < 2) throw new BadRequestException('عنوان جلسه را وارد کن.');
    const heldAt = this.parseHeldAt(input.heldAt);
    const place = this.normalizePlace(input.place);
    const agenda = normalizePersian((input.agenda ?? '').trim());
    const summary = normalizePersian((input.summary ?? '').trim());
    const attendeeIds = await this.validateAttendees(
      input.groupId,
      input.attendeeIds,
      actor.personId,
    );
    const resolutions = input.resolutions ?? [];
    await this.validateResolutions(input.groupId, resolutions);
    const created = await this.db.transaction(async (manager) => {
      const row = await one<{ id: string }>(
        manager,
        `INSERT INTO meeting(group_id,held_at,kind,title,place,status,created_by,agenda,summary)
         VALUES($1,$2,$3,$4,$5,'recorded',$6,$7,$8) RETURNING id`,
        [
          input.groupId,
          heldAt,
          input.kind,
          title,
          place,
          actor.personId,
          agenda,
          summary,
        ],
      );
      if (!row) throw new BadRequestException();
      await this.replaceAttendees(manager, row.id, attendeeIds);
      await this.replaceResolutions(manager, row.id, resolutions);
      await this.audit.record(
        actor.personId,
        'meeting.created',
        'meeting',
        row.id,
        { kind: input.kind },
        manager,
      );
      return row.id;
    });
    return this.loadDetail(actor, created);
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateMeetingDto,
  ): Promise<MeetingDetailDto> {
    const resource = await this.access.resolve('meeting', id, actor);
    await this.access.require(actor, 'update', resource, 'detail');
    const current = await this.loadRow(id);
    await this.requireOwnedGroup(actor, current.groupId);
    const title =
      input.title !== undefined
        ? normalizePersian(input.title.trim())
        : current.title;
    if (title.length < 2) throw new BadRequestException('عنوان جلسه را وارد کن.');
    const heldAt =
      input.heldAt !== undefined
        ? this.parseHeldAt(input.heldAt)
        : current.heldAt;
    const place =
      input.place !== undefined
        ? this.normalizePlace(input.place)
        : current.place;
    const kind = input.kind ?? current.kind;
    const agenda =
      input.agenda !== undefined
        ? normalizePersian(input.agenda.trim())
        : current.agenda;
    const summary =
      input.summary !== undefined
        ? normalizePersian(input.summary.trim())
        : current.summary;
    const attendeeIds =
      input.attendeeIds !== undefined
        ? await this.validateAttendees(
            current.groupId,
            input.attendeeIds,
            actor.personId,
          )
        : undefined;
    if (input.resolutions)
      await this.validateResolutions(current.groupId, input.resolutions);
    await this.db.transaction(async (manager) => {
      await rows(
        manager,
        `UPDATE meeting
         SET title=$2,held_at=$3,place=$4,kind=$5,agenda=$6,summary=$7,updated_at=now()
         WHERE id=$1`,
        [id, title, heldAt, place, kind, agenda, summary],
      );
      if (attendeeIds) await this.replaceAttendees(manager, id, attendeeIds);
      if (input.resolutions)
        await this.replaceResolutions(manager, id, input.resolutions);
      await this.audit.record(
        actor.personId,
        'meeting.updated',
        'meeting',
        id,
        {},
        manager,
      );
    });
    return this.loadDetail(actor, id);
  }

  private visibleSql(personParam: number): string {
    return `(
      EXISTS(
        SELECT 1 FROM meeting_attendee a
        WHERE a.meeting_id=m.id AND a.person_id=$${personParam}
      )
      OR EXISTS(
        SELECT 1 FROM meeting_attendee a
        JOIN person_ancestors pa ON pa.person_id=a.person_id AND pa.ancestor_id=$${personParam}
        WHERE a.meeting_id=m.id
      )
      OR EXISTS(
        SELECT 1 FROM organization_group g
        WHERE g.id=m.group_id AND g.owner_person_id=$${personParam}
      )
    )`;
  }

  private summarySelect(canManagePersonParam: number): string {
    return `m.id,m.group_id AS "groupId",g.name AS "groupName",m.title,
      m.held_at::text AS "heldAt",m.place,m.kind,m.status,
      (SELECT count(*)::int FROM meeting_attendee a WHERE a.meeting_id=m.id) AS "attendeeCount",
      COALESCE(
        (SELECT string_agg(p.first_name||' '||p.last_name, '، ' ORDER BY p.first_name,p.last_name)
           FROM meeting_attendee a JOIN person p ON p.id=a.person_id
           WHERE a.meeting_id=m.id),
        ''
      ) AS "attendeePreview",
      EXISTS(
        SELECT 1 FROM organization_group og
        WHERE og.id=m.group_id AND og.owner_person_id=$${canManagePersonParam}
      ) AS "canManage"`;
  }

  private async loadDetail(
    actor: Actor,
    id: string,
  ): Promise<MeetingDetailDto> {
    const summary = await one<MeetingSummaryDto & { agenda: string; summary: string }>(
      this.db,
      `SELECT ${this.summarySelect(2)}, m.agenda, m.summary AS summary
       FROM meeting m
       JOIN organization_group g ON g.id=m.group_id
       WHERE m.id=$1`,
      [id, actor.personId],
    );
    if (!summary) throw new NotFoundException();
    const attendees = await rows<MeetingAttendeeDto>(
      this.db,
      `SELECT p.id, p.first_name||' '||p.last_name AS name
       FROM meeting_attendee a JOIN person p ON p.id=a.person_id
       WHERE a.meeting_id=$1
       ORDER BY p.first_name,p.last_name,p.id`,
      [id],
    );
    const resolutions = await rows<ResolutionDto>(
      this.db,
      `SELECT r.id,r.body AS text,r.assignee_id AS "assigneeId",
        CASE WHEN r.assignee_id IS NULL THEN NULL
             ELSE a.first_name||' '||a.last_name END AS "assigneeName",
        r.due_date::text AS "dueDate"
       FROM resolution r
       LEFT JOIN person a ON a.id=r.assignee_id
       WHERE r.meeting_id=$1
       ORDER BY r.sort_order,r.id`,
      [id],
    );
    const preview = attendees
      .slice(0, 3)
      .map((row) => row.name)
      .join('، ');
    return {
      ...summary,
      attendeePreview: preview,
      attendees,
      resolutions,
    };
  }

  private async loadRow(id: string): Promise<{
    id: string;
    groupId: string;
    title: string;
    heldAt: string;
    place: string | null;
    kind: 'public' | 'workgroup';
    agenda: string;
    summary: string;
  }> {
    const row = await one<{
      id: string;
      groupId: string;
      title: string;
      heldAt: string;
      place: string | null;
      kind: 'public' | 'workgroup';
      agenda: string;
      summary: string;
    }>(
      this.db,
      `SELECT id,group_id AS "groupId",title,held_at::text AS "heldAt",place,kind,agenda,summary
       FROM meeting WHERE id=$1`,
      [id],
    );
    if (!row) throw new NotFoundException();
    return row;
  }

  private parseHeldAt(value: string): string {
    const time = Date.parse(value);
    if (Number.isNaN(time))
      throw new BadRequestException('تاریخ جلسه معتبر نیست.');
    return new Date(time).toISOString();
  }

  private normalizePlace(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const place = normalizePersian(value.trim());
    return place || null;
  }

  private async validateAttendees(
    groupId: string,
    attendeeIds: string[],
    mentorId: string,
  ): Promise<string[]> {
    const unique = [...new Set([...attendeeIds, mentorId])];
    if (unique.length < 1)
      throw new BadRequestException('حداقل یک عضو حاضر انتخاب کن.');
    const allowed = await rows<{ id: string }>(
      this.db,
      `SELECT p.id FROM person p
       WHERE p.id=ANY($1::uuid[]) AND p.status='active'
         AND (
           p.id=$3
           OR EXISTS(
             SELECT 1 FROM membership m
             WHERE m.person_id=p.id AND m.group_id=$2 AND m.valid_to IS NULL
           )
           OR EXISTS(
             SELECT 1 FROM organization_group g
             WHERE g.id=$2 AND g.owner_person_id=p.id
           )
         )`,
      [unique, groupId, mentorId],
    );
    if (allowed.length !== unique.length)
      throw new BadRequestException(
        'اعضای حاضر باید از افراد فعال همین گروه باشند.',
      );
    return unique;
  }

  private async validateResolutions(
    groupId: string,
    resolutions: ResolutionInputDto[],
  ): Promise<void> {
    for (const item of resolutions) {
      if (!normalizePersian(item.text.trim()))
        throw new BadRequestException('متن مصوبه را وارد کن.');
      if (!item.assigneeId) continue;
      const ok = await one(
        this.db,
        `SELECT 1 FROM person p
         WHERE p.id=$1 AND p.status='active'
           AND (
             EXISTS(
               SELECT 1 FROM membership m
               WHERE m.person_id=p.id AND m.group_id=$2 AND m.valid_to IS NULL
             )
             OR EXISTS(
               SELECT 1 FROM organization_group g
               WHERE g.id=$2 AND g.owner_person_id=p.id
             )
           )`,
        [item.assigneeId, groupId],
      );
      if (!ok)
        throw new BadRequestException(
          'مسئول مصوبه باید عضو فعال همین گروه باشد.',
        );
      if (item.dueDate) {
        const due = Date.parse(item.dueDate);
        if (Number.isNaN(due))
          throw new BadRequestException('مهلت مصوبه معتبر نیست.');
      }
    }
  }

  private async replaceAttendees(
    manager: EntityManager,
    meetingId: string,
    attendeeIds: string[],
  ): Promise<void> {
    await rows(manager, 'DELETE FROM meeting_attendee WHERE meeting_id=$1', [
      meetingId,
    ]);
    for (const personId of attendeeIds)
      await rows(
        manager,
        'INSERT INTO meeting_attendee(meeting_id,person_id) VALUES($1,$2)',
        [meetingId, personId],
      );
  }

  private async replaceResolutions(
    manager: EntityManager,
    meetingId: string,
    resolutions: ResolutionInputDto[],
  ): Promise<void> {
    await rows(manager, 'DELETE FROM resolution WHERE meeting_id=$1', [
      meetingId,
    ]);
    for (const [index, item] of resolutions.entries())
      await rows(
        manager,
        `INSERT INTO resolution(meeting_id,body,assignee_id,due_date,sort_order)
         VALUES($1,$2,$3,$4,$5)`,
        [
          meetingId,
          normalizePersian(item.text.trim()),
          item.assigneeId || null,
          item.dueDate || null,
          index,
        ],
      );
  }

  private async requireOwnedGroup(
    actor: Actor,
    groupId: string,
  ): Promise<void> {
    if (
      !(await one(
        this.db,
        'SELECT 1 FROM organization_group WHERE id=$1 AND owner_person_id=$2',
        [groupId, actor.personId],
      ))
    )
      throw new ForbiddenException(
        'فقط مربی صاحب گروه می‌تواند جلسه را مدیریت کند.',
      );
  }
}
