import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { normalizePersian } from '@safanoor/shared';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { CryptoService } from '../../libs/security/crypto.service';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateAssistantSessionDto,
  UpdateAssistantDutyDto,
  AssistantMembersQueryDto,
  AssistantSummaryDto,
  AssistantMembersPageDto,
  AssistantMemberDto,
  AssistantItemDto,
  AssistantItemsPageDto,
  AssistantSessionDto,
  AssistantSessionsPageDto,
  AssistantDutyDto,
  AssistantDutiesPageDto,
  CreateFollowUpItemDto,
  MarkSessionAttendanceDto,
  EmergencyOpenDto,
  EmergencyCardDto,
} from './assistant.dto';

// Every roster/work-item query repeats this scope. Reassignment immediately revokes access.
const assigned = `EXISTS(SELECT 1 FROM follow_up_assignment f
  JOIN membership m ON m.person_id=f.member_person_id AND m.group_id=f.group_id AND m.role='member' AND m.valid_to IS NULL
  JOIN person active ON active.id=f.member_person_id AND active.status='active'
  WHERE f.assistant_person_id=$1 AND f.group_id=$2 AND f.to_date IS NULL AND f.member_person_id=p.id)`;
@Injectable()
export class AssistantService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
    private readonly notifications: NotificationsService,
  ) {}

  private async scope(actor: Actor): Promise<string> {
    await this.access.require(
      actor,
      'read',
      {
        type: 'assistant_workspace',
        groupIds: actor.activeGroupId ? [actor.activeGroupId] : [],
      },
      'detail',
    );
    if (!actor.activeGroupId) throw new ForbiddenException();
    return actor.activeGroupId;
  }
  async summary(actor: Actor): Promise<AssistantSummaryDto> {
    const group = await this.scope(actor);
    const result = await one<AssistantSummaryDto>(
      this.db,
      `SELECT g.name AS "groupName",
      mentor.first_name||' '||mentor.last_name AS "mentorName", mentor.availability='available' AS "mentorAvailable",
      (SELECT count(*)::int FROM person p WHERE ${assigned}) AS "memberCount",
      (SELECT count(*)::int FROM follow_up_item i JOIN person p ON p.id=i.member_id WHERE i.group_id=$2 AND ${assigned} AND i.kind='task' AND i.completed_at IS NULL) AS "openTasks",
      (SELECT count(*)::int FROM follow_up_item i JOIN person p ON p.id=i.member_id WHERE i.group_id=$2 AND ${assigned} AND i.kind='followup' AND i.completed_at IS NULL) AS "pendingFollowups",
      (SELECT count(*)::int FROM follow_up_item i JOIN person p ON p.id=i.member_id WHERE i.group_id=$2 AND ${assigned} AND i.kind='followup' AND i.completed_at IS NULL AND i.due_at<now()) AS "overdueFollowups",
      (SELECT count(*)::int FROM camp_schedule_item s JOIN camp c ON c.id=s.camp_id WHERE c.group_id=$2 AND s.responsible_person_id=$1 AND c.status NOT IN ('finished','settled') AND s.day>=CURRENT_DATE) AS "campDuties"
      FROM organization_group g JOIN person mentor ON mentor.id=g.owner_person_id WHERE g.id=$2`,
      [actor.personId, group],
    );
    if (!result) throw new NotFoundException();
    return result;
  }
  async members(
    actor: Actor,
    query: AssistantMembersQueryDto,
  ): Promise<AssistantMembersPageDto> {
    const group = await this.scope(actor);
    if (
      query.sessionId &&
      !(await one(
        this.db,
        'SELECT 1 FROM group_session WHERE id=$1 AND group_id=$2',
        [query.sessionId, group],
      ))
    )
      throw new ForbiddenException();
    if (query.campId) {
      if (
        !(await one(this.db, 'SELECT 1 FROM camp WHERE id=$1 AND group_id=$2', [
          query.campId,
          group,
        ]))
      )
        throw new ForbiddenException();
      await this.access.require(actor, 'read', {
        type: 'camp',
        id: query.campId,
        groupIds: [group],
      });
    }
    const params = [
      actor.personId,
      group,
      normalizePersian(query.search ?? ''),
      query.campId ?? null,
    ];
    const scope = `${assigned} AND ($3='' OR p.search_name LIKE '%'||$3||'%') AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM camp_participant cp WHERE cp.camp_id=$4 AND cp.person_id=p.id AND cp.status<>'declined'))`;
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM person p WHERE ${scope}`,
      params,
    );
    const items = await rows<AssistantMemberDto>(
      this.db,
      `SELECT (SELECT a.present FROM session_attendance a WHERE a.session_id=$5::uuid AND a.person_id=p.id) AS present,p.id,p.first_name||' '||p.last_name AS name,p.verified_at IS NOT NULL AS verified,
      (SELECT count(*)::int FROM session_attendance a JOIN group_session s ON s.id=a.session_id WHERE a.person_id=p.id AND s.group_id=$2 AND s.starts_at BETWEEN now()-interval '90 days' AND now()) AS "recordedSessions",
      (SELECT round(100.0*count(*) FILTER(WHERE a.present)/nullif(count(*),0))::int FROM session_attendance a JOIN group_session s ON s.id=a.session_id WHERE a.person_id=p.id AND s.group_id=$2 AND s.starts_at BETWEEN now()-interval '90 days' AND now()) AS "attendanceRate",
      (SELECT count(*)::int FROM follow_up_item i WHERE i.member_id=p.id AND i.group_id=$2 AND i.kind='task' AND i.completed_at IS NULL) AS "openTasks",
      (SELECT count(*)::int FROM follow_up_item i WHERE i.member_id=p.id AND i.group_id=$2 AND i.kind='followup' AND i.completed_at IS NULL AND i.due_at<now()) AS "overdueFollowups",
      (SELECT min(i.due_at)::text FROM follow_up_item i WHERE i.member_id=p.id AND i.group_id=$2 AND i.kind='followup' AND i.completed_at IS NULL) AS "nextFollowup"
      FROM person p WHERE ${scope} ORDER BY p.first_name,p.last_name,p.id LIMIT $6 OFFSET $7`,
      [
        ...params,
        query.sessionId ?? null,
        query.limit,
        (query.page - 1) * query.limit,
      ],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }
  async items(
    actor: Actor,
    query: PaginationDto,
  ): Promise<AssistantItemsPageDto> {
    const group = await this.scope(actor);
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM follow_up_item i JOIN person p ON p.id=i.member_id WHERE i.group_id=$2 AND ${assigned}`,
      [actor.personId, group],
    );
    const items = await rows<AssistantItemDto>(
      this.db,
      `SELECT i.id,i.member_id AS "memberId",p.first_name||' '||p.last_name AS "memberName",i.kind,i.title,i.due_at::text AS "dueAt",i.completed_at::text AS "completedAt"
      FROM follow_up_item i JOIN person p ON p.id=i.member_id WHERE i.group_id=$2 AND ${assigned}
      ORDER BY i.completed_at NULLS FIRST,i.due_at,i.id LIMIT $3 OFFSET $4`,
      [actor.personId, group, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }
  async createItem(
    actor: Actor,
    input: CreateFollowUpItemDto,
  ): Promise<{ id: string }> {
    await this.requireMember(
      actor,
      input.groupId,
      input.memberId,
      'follow_up_item',
      'create',
    );
    const title = normalizePersian(input.title.trim());
    if (title.length < 2)
      throw new BadRequestException('عنوان پیگیری را کامل بنویسید.');
    return this.db.transaction(async (m) => {
      await rows(m, 'SELECT pg_advisory_xact_lock(739201)');
      await this.requireMember(
        actor,
        input.groupId,
        input.memberId,
        'follow_up_item',
        'create',
      );
      const item = await one<{ id: string }>(
        m,
        `INSERT INTO follow_up_item(group_id,member_id,created_by,kind,title,due_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          input.groupId,
          input.memberId,
          actor.personId,
          input.kind,
          title,
          input.dueAt,
        ],
      );
      if (!item) throw new BadRequestException();
      await this.audit.record(
        actor.personId,
        'follow_up_item.created',
        'follow_up_item',
        item.id,
        {},
        m,
      );
      return item;
    });
  }
  async complete(actor: Actor, id: string, completed: boolean): Promise<void> {
    const item = await one<{ groupId: string; memberId: string }>(
      this.db,
      'SELECT group_id AS "groupId",member_id AS "memberId" FROM follow_up_item WHERE id=$1',
      [id],
    );
    if (!item) throw new NotFoundException();
    await this.requireMember(
      actor,
      item.groupId,
      item.memberId,
      'follow_up_item',
      'update',
    );
    await this.db.transaction(async (m) => {
      await rows(m, 'SELECT pg_advisory_xact_lock(739201)');
      await this.requireMember(
        actor,
        item.groupId,
        item.memberId,
        'follow_up_item',
        'update',
      );
      await rows(
        m,
        'UPDATE follow_up_item SET completed_at=CASE WHEN $2 THEN COALESCE(completed_at,now()) ELSE NULL END WHERE id=$1',
        [id, completed],
      );
      await this.audit.record(
        actor.personId,
        'follow_up_item.updated',
        'follow_up_item',
        id,
        { completed },
        m,
      );
    });
  }
  async sessions(
    actor: Actor,
    q: PaginationDto,
  ): Promise<AssistantSessionsPageDto> {
    const group = await this.scope(actor);
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM group_session WHERE group_id=$1 AND starts_at<=now()',
      [group],
    );
    const items = await rows<AssistantSessionDto>(
      this.db,
      'SELECT id,title,starts_at::text AS "startsAt" FROM group_session WHERE group_id=$1 AND starts_at<=now() ORDER BY starts_at DESC,id LIMIT $2 OFFSET $3',
      [group, q.limit, (q.page - 1) * q.limit],
    );
    return pageOf(items, q.page, q.limit, Number(count?.count ?? 0));
  }
  async attendance(
    actor: Actor,
    input: MarkSessionAttendanceDto,
  ): Promise<void> {
    const session = await one<{ groupId: string; started: boolean }>(
      this.db,
      'SELECT group_id AS "groupId",starts_at<=now() AS started FROM group_session WHERE id=$1',
      [input.sessionId],
    );
    if (!session) throw new NotFoundException();
    if (!session.started)
      throw new BadRequestException('زمان برنامه هنوز نرسیده است.');
    await this.requireMember(
      actor,
      session.groupId,
      input.memberId,
      'session_attendance',
      'update',
    );
    await this.db.transaction(async (m) => {
      await rows(m, 'SELECT pg_advisory_xact_lock(739201)');
      await this.requireMember(
        actor,
        session.groupId,
        input.memberId,
        'session_attendance',
        'update',
      );
      await rows(
        m,
        `INSERT INTO session_attendance(session_id,person_id,present,marked_by) VALUES($1,$2,$3,$4)
        ON CONFLICT(session_id,person_id) DO UPDATE SET present=EXCLUDED.present,marked_by=EXCLUDED.marked_by,updated_at=now()`,
        [input.sessionId, input.memberId, input.present, actor.personId],
      );
      await this.audit.record(
        actor.personId,
        'attendance.marked',
        'session_attendance',
        input.sessionId,
        { personId: input.memberId, present: input.present },
        m,
      );
    });
  }
  async createSession(
    actor: Actor,
    input: CreateAssistantSessionDto,
  ): Promise<void> {
    await this.access.require(
      actor,
      'create',
      { type: 'session_attendance', groupIds: [input.groupId] },
      'detail',
    );
    const title = normalizePersian(input.title.trim());
    if (title.length < 2)
      throw new BadRequestException('عنوان برنامه را کامل بنویسید.');
    await this.db.transaction(async (m) => {
      const item = await one<{ id: string }>(
        m,
        'INSERT INTO group_session(group_id,title,starts_at,created_by) VALUES($1,$2,$3,$4) RETURNING id',
        [input.groupId, title, input.startsAt, actor.personId],
      );
      await this.audit.record(
        actor.personId,
        'group_session.created',
        'session_attendance',
        item!.id,
        {},
        m,
      );
    });
  }
  async updateDuty(
    actor: Actor,
    id: string,
    input: UpdateAssistantDutyDto,
  ): Promise<void> {
    const duty = await one<{
      ownerId: string | null;
      groupId: string;
      startsOn: string;
      endsOn: string;
      status: string;
    }>(
      this.db,
      `SELECT s.responsible_person_id AS "ownerId",c.group_id AS "groupId",c.starts_on::text AS "startsOn",c.ends_on::text AS "endsOn",c.status
      FROM camp_schedule_item s JOIN camp c ON c.id=s.camp_id WHERE s.id=$1`,
      [id],
    );
    if (!duty) throw new NotFoundException();
    await this.access.require(
      actor,
      'update',
      {
        type: 'camp_duty',
        ownerId: duty.ownerId ?? undefined,
        groupIds: [duty.groupId],
      },
      'detail',
    );
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.day) ||
      input.day < duty.startsOn ||
      input.day > duty.endsOn ||
      ['finished', 'settled'].includes(duty.status)
    )
      throw new BadRequestException(
        'تاریخ برنامه باید در بازهٔ اردوی باز باشد.',
      );
    const title = normalizePersian(input.title.trim());
    if (title.length < 2)
      throw new BadRequestException('عنوان برنامه را کامل بنویسید.');
    await this.db.transaction(async (m) => {
      await rows(
        m,
        'UPDATE camp_schedule_item SET title=$2,day=$3 WHERE id=$1',
        [id, title, input.day],
      );
      await this.audit.record(
        actor.personId,
        'camp_duty.updated',
        'camp_duty',
        id,
        {},
        m,
      );
    });
  }
  async duties(
    actor: Actor,
    q: PaginationDto,
  ): Promise<AssistantDutiesPageDto> {
    const group = await this.scope(actor);
    const scope = `c.group_id=$2 AND s.responsible_person_id=$1 AND c.status NOT IN ('finished','settled') AND s.day>=CURRENT_DATE`;
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM camp_schedule_item s JOIN camp c ON c.id=s.camp_id WHERE ${scope}`,
      [actor.personId, group],
    );
    const items = await rows<AssistantDutyDto>(
      this.db,
      `SELECT s.id,s.camp_id AS "campId",c.title AS "campTitle",s.title,s.day::text AS day FROM camp_schedule_item s JOIN camp c ON c.id=s.camp_id WHERE ${scope} ORDER BY s.day,s.start_time,s.id LIMIT $3 OFFSET $4`,
      [actor.personId, group, q.limit, (q.page - 1) * q.limit],
    );
    return pageOf(items, q.page, q.limit, Number(count?.count ?? 0));
  }
  async emergency(
    actor: Actor,
    memberId: string,
    input: EmergencyOpenDto,
  ): Promise<EmergencyCardDto> {
    const resource = await this.access.personResource(memberId);
    await this.access.require(
      actor,
      'emergency',
      { ...resource, type: 'emergency' },
      'detail',
    );
    const row = await one<{
      name: string;
      age: number;
      contact: string | null;
      address: string | null;
      medical: string | null;
      mentorId: string;
    }>(
      this.db,
      `SELECT p.first_name||' '||p.last_name AS name,COALESCE(extract(year FROM age(p.birth_date))::int,0) AS age,
      e.contact_enc AS contact,e.address_enc AS address,e.medical_enc AS medical,g.owner_person_id AS "mentorId"
      FROM person p JOIN membership m ON m.person_id=p.id AND m.role='member' AND m.valid_to IS NULL
      JOIN organization_group g ON g.id=m.group_id LEFT JOIN person_emergency e ON e.person_id=p.id WHERE p.id=$1 AND p.status='active'`,
      [memberId],
    );
    if (!row) throw new NotFoundException();
    await this.db.transaction(async (m) => {
      await rows(m, 'SELECT pg_advisory_xact_lock(739201)');
      await this.access.require(
        actor,
        'emergency',
        { ...(await this.access.personResource(memberId)), type: 'emergency' },
        'detail',
      );
      await rows(
        m,
        'INSERT INTO emergency_access_log(person_id,accessed_by,reason_code) VALUES($1,$2,$3)',
        [memberId, actor.personId, input.reasonCode],
      );
      if (actor.personId !== row.mentorId)
        await this.notifications.create(
          row.mentorId,
          'emergency.opened',
          undefined,
          m,
          { personId: memberId, accessedBy: actor.personId },
        );
    });
    return {
      name: row.name,
      age: row.age,
      contact: row.contact
        ? this.crypto.decrypt(row.contact, 'emergency-contact')
        : null,
      address: row.address
        ? this.crypto.decrypt(row.address, 'exact-address')
        : null,
      medical: row.medical
        ? this.crypto.decrypt(row.medical, 'medical-notes')
        : null,
    };
  }
  private async requireMember(
    actor: Actor,
    groupId: string,
    memberId: string,
    type: 'follow_up_item' | 'session_attendance',
    action: 'create' | 'update',
  ): Promise<void> {
    await this.access.require(
      actor,
      action,
      { type, memberId, groupIds: [groupId] },
      'detail',
    );
    if (
      !(await one(
        this.db,
        `SELECT 1 FROM membership m JOIN person p ON p.id=m.person_id WHERE m.person_id=$1 AND m.group_id=$2 AND m.role='member' AND m.valid_to IS NULL AND p.status='active'`,
        [memberId, groupId],
      ))
    )
      throw new BadRequestException('نیروی فعال همین گروه را انتخاب کنید.');
  }
}
