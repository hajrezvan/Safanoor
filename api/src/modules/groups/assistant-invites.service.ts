import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { normalizePersian } from '@safanoor/shared';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PeopleService } from '../people/people.service';
import {
  AssistantInviteCandidateDto,
  AssistantInviteCandidatesPageDto,
  AssistantInviteDto,
  AssistantInvitesPageDto,
  CreateAssistantInviteDto,
  RespondAssistantInviteDto,
} from './assistant-invites.dto';

@Injectable()
export class AssistantInvitesService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly people: PeopleService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    actor: Actor,
    groupId: string,
    query: PaginationDto,
  ): Promise<AssistantInvitesPageDto> {
    await this.access.require(
      actor,
      'read',
      { type: 'assistant_invite', groupIds: [groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, groupId);
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM assistant_invite WHERE group_id=$1',
      [groupId],
    );
    const items = await rows<AssistantInviteDto>(
      this.db,
      `SELECT i.id,i.group_id AS "groupId",g.name AS "groupName",
        i.mentor_person_id AS "mentorPersonId",m.first_name||' '||m.last_name AS "mentorName",
        i.invitee_person_id AS "inviteePersonId",p.first_name||' '||p.last_name AS "inviteeName",
        i.status,i.created_at AS "createdAt",i.responded_at AS "respondedAt"
       FROM assistant_invite i
       JOIN organization_group g ON g.id=i.group_id
       JOIN person m ON m.id=i.mentor_person_id
       JOIN person p ON p.id=i.invitee_person_id
       WHERE i.group_id=$1
       ORDER BY i.created_at DESC,i.id
       LIMIT $2 OFFSET $3`,
      [groupId, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }

  async candidates(
    actor: Actor,
    groupId: string,
    query: PaginationDto,
  ): Promise<AssistantInviteCandidatesPageDto> {
    await this.access.require(
      actor,
      'create',
      { type: 'assistant_invite', groupIds: [groupId] },
      'detail',
    );
    await this.requireOwnedGroup(actor, groupId);
    const search = normalizePersian(query.search ?? '');
    const scope = `p.status='active'
      AND p.id<>$1
      AND p.org_level IN ('assistant','mentor')
      AND NOT EXISTS(
        SELECT 1 FROM membership
        WHERE person_id=p.id AND group_id=$2 AND role='assistant' AND valid_to IS NULL
      )
      AND NOT EXISTS(
        SELECT 1 FROM assistant_invite
        WHERE group_id=$2 AND invitee_person_id=p.id AND status='pending'
      )
      AND ($3='' OR p.search_name LIKE '%'||$3||'%')`;
    const params = [actor.personId, groupId, search];
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM person p WHERE ${scope}`,
      params,
    );
    const items = await rows<AssistantInviteCandidateDto>(
      this.db,
      `SELECT p.id,p.first_name AS "firstName",p.last_name AS "lastName",p.org_level AS "orgLevel"
       FROM person p WHERE ${scope}
       ORDER BY p.first_name,p.last_name,p.id
       LIMIT $4 OFFSET $5`,
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }

  async create(
    actor: Actor,
    groupId: string,
    input: CreateAssistantInviteDto,
  ): Promise<AssistantInviteDto> {
    await this.access.require(
      actor,
      'create',
      { type: 'assistant_invite', groupIds: [groupId] },
      'detail',
    );
    const group = await this.requireOwnedGroup(actor, groupId);
    if (input.inviteePersonId === actor.personId)
      throw new BadRequestException('نمی‌توانی خودت را دعوت کنی.');
    const invitee = await one<{
      id: string;
      firstName: string;
      lastName: string;
      orgLevel: string;
      status: string;
    }>(
      this.db,
      `SELECT id,first_name AS "firstName",last_name AS "lastName",org_level AS "orgLevel",status
       FROM person WHERE id=$1`,
      [input.inviteePersonId],
    );
    if (!invitee || invitee.status !== 'active')
      throw new BadRequestException('فرد فعال انتخاب کن.');
    if (!['assistant', 'mentor'].includes(invitee.orgLevel))
      throw new BadRequestException(
        'صلاحیت کمک‌مربی باید قبلاً توسط مدیر ثبت شده باشد.',
      );
    if (
      await one(
        this.db,
        "SELECT 1 FROM membership WHERE person_id=$1 AND group_id=$2 AND role='assistant' AND valid_to IS NULL",
        [input.inviteePersonId, groupId],
      )
    )
      throw new ConflictException('این فرد هم‌اکنون کمک‌مربی این گروه است.');
    if (
      await one(
        this.db,
        "SELECT 1 FROM assistant_invite WHERE group_id=$1 AND invitee_person_id=$2 AND status='pending'",
        [groupId, input.inviteePersonId],
      )
    )
      throw new ConflictException('دعوت در انتظار پاسخ برای این فرد وجود دارد.');

    const mentorName = await one<{ name: string }>(
      this.db,
      `SELECT first_name||' '||last_name AS name FROM person WHERE id=$1`,
      [actor.personId],
    );
    const invite = await this.db.transaction(async (manager) => {
      const created = await one<{ id: string }>(
        manager,
        `INSERT INTO assistant_invite(group_id,mentor_person_id,invitee_person_id)
         VALUES($1,$2,$3) RETURNING id`,
        [groupId, actor.personId, input.inviteePersonId],
      );
      if (!created) throw new BadRequestException();
      await this.audit.record(
        actor.personId,
        'assistant_invite.created',
        'assistant_invite',
        created.id,
        {},
        manager,
      );
      await this.notifications.create(
        input.inviteePersonId,
        'assistant.invite',
        `assistant-invite:${created.id}`,
        manager,
        {
          inviteId: created.id,
          groupName: group.name,
          mentorName: mentorName?.name ?? '',
          status: 'pending',
        },
      );
      return created;
    });
    return this.get(invite.id);
  }

  async respond(
    actor: Actor,
    id: string,
    input: RespondAssistantInviteDto,
  ): Promise<AssistantInviteDto> {
    await this.access.require(
      actor,
      'update',
      await this.access.resolve('assistant_invite', id, actor),
      'detail',
    );
    const invite = await one<{
      id: string;
      groupId: string;
      groupName: string;
      mentorPersonId: string;
      inviteePersonId: string;
      status: string;
    }>(
      this.db,
      `SELECT i.id,i.group_id AS "groupId",g.name AS "groupName",
        i.mentor_person_id AS "mentorPersonId",i.invitee_person_id AS "inviteePersonId",i.status
       FROM assistant_invite i JOIN organization_group g ON g.id=i.group_id
       WHERE i.id=$1`,
      [id],
    );
    if (!invite) throw new NotFoundException();
    if (invite.inviteePersonId !== actor.personId)
      throw new BadRequestException('فقط دعوت‌شونده می‌تواند پاسخ دهد.');
    if (invite.status !== 'pending')
      throw new ConflictException('به این دعوت قبلاً پاسخ داده شده است.');

    const inviteeName = await one<{ name: string }>(
      this.db,
      `SELECT first_name||' '||last_name AS name FROM person WHERE id=$1`,
      [actor.personId],
    );

    await this.db.transaction(async (manager) => {
      await rows(manager, 'SELECT pg_advisory_xact_lock(739201)');
      const locked = await one<{ id: string }>(
        manager,
        "UPDATE assistant_invite SET status=$2,responded_at=now() WHERE id=$1 AND status='pending' RETURNING id",
        [id, input.decision],
      );
      if (!locked)
        throw new ConflictException('به این دعوت قبلاً پاسخ داده شده است.');

      if (input.decision === 'accepted') {
        const person = await one<{ orgLevel: string; status: string }>(
          manager,
          'SELECT org_level AS "orgLevel",status FROM person WHERE id=$1',
          [actor.personId],
        );
        if (!person || person.status !== 'active')
          throw new BadRequestException('حساب فعال نیست.');
        if (!['assistant', 'mentor'].includes(person.orgLevel))
          throw new BadRequestException(
            'صلاحیت کمک‌مربی باید توسط مدیر ثبت شده باشد.',
          );

        const memberOfGroup = await one(
          manager,
          "SELECT 1 FROM membership WHERE person_id=$1 AND group_id=$2 AND role='member' AND valid_to IS NULL",
          [actor.personId, invite.groupId],
        );
        if (!memberOfGroup) {
          const openAsAssistant = await one<{ blocked: boolean }>(
            manager,
            'SELECT EXISTS(SELECT 1 FROM follow_up_assignment WHERE assistant_person_id=$1 AND to_date IS NULL) AS blocked',
            [actor.personId],
          );
          if (openAsAssistant?.blocked)
            throw new ConflictException(
              'ابتدا پیگیری‌های کمک‌مربی در گروه فعلی را واگذار کن.',
            );
          await rows(
            manager,
            'UPDATE membership SET valid_to=now() WHERE person_id=$1 AND role=$2 AND valid_to IS NULL',
            [actor.personId, 'member'],
          );
          await rows(
            manager,
            'UPDATE follow_up_assignment SET to_date=now() WHERE member_person_id=$1 AND to_date IS NULL',
            [actor.personId],
          );
          await rows(
            manager,
            "INSERT INTO membership(person_id,group_id,role) VALUES($1,$2,'member')",
            [actor.personId, invite.groupId],
          );
        }

        if (
          !(await one(
            manager,
            "SELECT 1 FROM membership WHERE person_id=$1 AND group_id=$2 AND role='assistant' AND valid_to IS NULL",
            [actor.personId, invite.groupId],
          ))
        )
          await rows(
            manager,
            "INSERT INTO membership(person_id,group_id,role) VALUES($1,$2,'assistant')",
            [actor.personId, invite.groupId],
          );
        await this.people.rebuildHierarchy(manager);
      }

      await rows(
        manager,
        `UPDATE notification SET payload = payload || $2::jsonb
         WHERE type='assistant.invite' AND payload->>'inviteId'=$1`,
        [id, JSON.stringify({ status: input.decision })],
      );
      await this.audit.record(
        actor.personId,
        `assistant_invite.${input.decision}`,
        'assistant_invite',
        id,
        {},
        manager,
      );
      await this.notifications.create(
        invite.mentorPersonId,
        input.decision === 'accepted'
          ? 'assistant.invite.accepted'
          : 'assistant.invite.rejected',
        `assistant-invite-${input.decision}:${id}`,
        manager,
        {
          inviteId: id,
          groupName: invite.groupName,
          inviteeName: inviteeName?.name ?? '',
        },
      );
    });
    return this.get(id);
  }

  private async get(id: string): Promise<AssistantInviteDto> {
    const item = await one<AssistantInviteDto>(
      this.db,
      `SELECT i.id,i.group_id AS "groupId",g.name AS "groupName",
        i.mentor_person_id AS "mentorPersonId",m.first_name||' '||m.last_name AS "mentorName",
        i.invitee_person_id AS "inviteePersonId",p.first_name||' '||p.last_name AS "inviteeName",
        i.status,i.created_at AS "createdAt",i.responded_at AS "respondedAt"
       FROM assistant_invite i
       JOIN organization_group g ON g.id=i.group_id
       JOIN person m ON m.id=i.mentor_person_id
       JOIN person p ON p.id=i.invitee_person_id
       WHERE i.id=$1`,
      [id],
    );
    if (!item) throw new NotFoundException();
    return item;
  }

  private async requireOwnedGroup(
    actor: Actor,
    groupId: string,
  ): Promise<{ id: string; name: string }> {
    const group = await one<{ id: string; name: string; ownerId: string }>(
      this.db,
      'SELECT id,name,owner_person_id AS "ownerId" FROM organization_group WHERE id=$1',
      [groupId],
    );
    if (!group) throw new NotFoundException();
    if (group.ownerId !== actor.personId)
      throw new BadRequestException('فقط مربی صاحب گروه می‌تواند دعوت بفرستد.');
    return group;
  }
}
