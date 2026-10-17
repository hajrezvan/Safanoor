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
import { PeopleService } from '../people/people.service';
import {
  GroupRoleDto,
  AssignmentDto,
  CreateGroupDto,
  GroupDto,
  GroupsPageDto,
  MembersPageDto,
  MembershipDto,
} from './groups.dto';

@Injectable()
export class GroupsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly people: PeopleService,
    private readonly audit: AuditService,
  ) {}
  async list(actor: Actor, query: PaginationDto): Promise<GroupsPageDto> {
    await this.access.require(actor, 'read', {
      type: 'group',
      ownerId: actor.personId,
    });
    const scope = `($2 OR g.owner_person_id=$1 OR EXISTS(SELECT 1 FROM membership m WHERE m.group_id=g.id AND m.person_id=$1 AND m.valid_to IS NULL) OR EXISTS(SELECT 1 FROM person_ancestors a WHERE a.person_id=g.owner_person_id AND a.ancestor_id=$1)) AND ($3='' OR g.name LIKE '%'||$3||'%')`;
    const params = [
      actor.personId,
      actor.isAdmin,
      normalizePersian(query.search ?? ''),
    ];
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM organization_group g WHERE ${scope}`,
      params,
    );
    const items = await rows<GroupDto>(
      this.db,
      `SELECT g.id,g.name,g.owner_person_id AS "ownerPersonId",p.first_name||' '||p.last_name AS "ownerName",(SELECT count(*)::int FROM membership WHERE group_id=g.id AND role='member' AND valid_to IS NULL) AS "memberCount",(SELECT count(*)::int FROM membership WHERE group_id=g.id AND role='assistant' AND valid_to IS NULL) AS "assistantCount",($2 OR g.owner_person_id=$1) AS "canManage" FROM organization_group g JOIN person p ON p.id=g.owner_person_id WHERE ${scope} ORDER BY g.name,g.id LIMIT $4 OFFSET $5`,
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }
  async create(actor: Actor, input: CreateGroupDto): Promise<GroupDto> {
    await this.access.require(actor, 'create', { type: 'group' }, 'detail');
    const owner = await one<{ id: string }>(
      this.db,
      "SELECT id FROM person WHERE id=$1 AND status='active' AND org_level IN ('supervisor','head_mentor','mentor')",
      [input.ownerPersonId],
    );
    if (!owner)
      throw new BadRequestException('مربی فعال و واجد شرایط انتخاب کنید.');
    const group = await this.db.transaction(async (manager) => {
      const result = await one<{ id: string }>(
        manager,
        'INSERT INTO organization_group(name,owner_person_id) VALUES($1,$2) RETURNING id',
        [normalizePersian(input.name), input.ownerPersonId],
      );
      if (!result) throw new BadRequestException();
      await this.audit.record(
        actor.personId,
        'group.created',
        'group',
        result.id,
        {},
        manager,
      );
      return result;
    });
    const item = await one<GroupDto>(
      this.db,
      `SELECT g.id,g.name,g.owner_person_id AS "ownerPersonId",p.first_name||' '||p.last_name AS "ownerName",0::int AS "memberCount",0::int AS "assistantCount",true AS "canManage" FROM organization_group g JOIN person p ON p.id=g.owner_person_id WHERE g.id=$1`,
      [group.id],
    );
    if (!item) throw new NotFoundException();
    return item;
  }
  async financeOfficer(
    actor: Actor,
    id: string,
    input: GroupRoleDto,
  ): Promise<void> {
    await this.access.require(
      actor,
      'assign',
      { type: 'assignment', groupIds: [id] },
      'detail',
    );
    await this.db.transaction(async (manager) => {
      await rows(manager, 'SELECT pg_advisory_xact_lock(739201)');
      if (
        !(await one(
          manager,
          "SELECT 1 FROM membership WHERE person_id=$1 AND group_id=$2 AND role='assistant' AND valid_to IS NULL",
          [input.personId, id],
        ))
      )
        throw new BadRequestException(
          'مسئول مالی باید کمک‌مربی فعال همین گروه باشد.',
        );
      await rows(
        manager,
        "UPDATE group_role SET valid_to=now() WHERE group_id=$1 AND role='finance_officer' AND valid_to IS NULL",
        [id],
      );
      await rows(
        manager,
        "INSERT INTO group_role(group_id,person_id,role) VALUES($1,$2,'finance_officer')",
        [id, input.personId],
      );
      await this.audit.record(
        actor.personId,
        'group.finance_officer_assigned',
        'group',
        id,
        {},
        manager,
      );
    });
  }
  async members(
    actor: Actor,
    id: string,
    query: PaginationDto,
  ): Promise<MembersPageDto> {
    await this.access.require(
      actor,
      'assign',
      { type: 'membership', groupIds: [id] },
      'detail',
    );
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM membership WHERE group_id=$1 AND valid_to IS NULL',
      [id],
    );
    const items = await rows<{
      id: string;
      name: string;
      role: string;
      assistantId?: string;
      assistantName?: string;
    }>(
      this.db,
      `SELECT p.id,p.first_name||' '||p.last_name AS name,m.role,f.assistant_person_id AS "assistantId",a.first_name||' '||a.last_name AS "assistantName" FROM membership m JOIN person p ON p.id=m.person_id LEFT JOIN follow_up_assignment f ON f.member_person_id=p.id AND f.to_date IS NULL LEFT JOIN person a ON a.id=f.assistant_person_id WHERE m.group_id=$1 AND m.valid_to IS NULL AND p.status='active' ORDER BY p.first_name,m.role LIMIT $2 OFFSET $3`,
      [id, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }
  async membership(
    actor: Actor,
    id: string,
    input: MembershipDto,
  ): Promise<void> {
    await this.access.require(
      actor,
      'assign',
      { type: 'membership', groupIds: [id] },
      'detail',
    );
    const currentResource = await this.access.personResource(input.personId);
    await this.access.require(actor, 'update', currentResource, 'detail');
    await this.db.transaction(async (manager) => {
      await rows(manager, 'SELECT pg_advisory_xact_lock(739201)');
      if (input.role === 'member') {
        if (currentResource.groupIds?.[0] === id) return;
        if (currentResource.groupIds?.[0])
          await this.access.require(
            actor,
            'assign',
            { type: 'membership', groupIds: currentResource.groupIds },
            'detail',
          );
        const open = await one<{ blocked: boolean }>(
          manager,
          'SELECT EXISTS(SELECT 1 FROM follow_up_assignment WHERE assistant_person_id=$1 AND to_date IS NULL) AS blocked',
          [input.personId],
        );
        if (open?.blocked)
          throw new ConflictException(
            'ابتدا پیگیری‌های کمک‌مربی را واگذار کنید.',
          );
        await rows(
          manager,
          'UPDATE membership SET valid_to=now() WHERE person_id=$1 AND valid_to IS NULL',
          [input.personId],
        );
        await rows(
          manager,
          'UPDATE follow_up_assignment SET to_date=now() WHERE member_person_id=$1 AND to_date IS NULL',
          [input.personId],
        );
      } else {
        if (currentResource.groupIds?.[0] !== id)
          throw new BadRequestException('کمک‌مربی باید عضو همین گروه باشد.');
        if (
          currentResource.ownerRole !== 'assistant' &&
          currentResource.ownerRole !== 'mentor'
        )
          throw new BadRequestException(
            'صلاحیت کمک‌مربی باید توسط مدیر ثبت شده باشد.',
          );
      }
      await rows(
        manager,
        'INSERT INTO membership(person_id,group_id,role) VALUES($1,$2,$3)',
        [input.personId, id, input.role],
      );
      await this.people.rebuildHierarchy(manager);
      await this.audit.record(
        actor.personId,
        'membership.assigned',
        'person',
        input.personId,
        {},
        manager,
      );
    });
  }
  async assign(actor: Actor, id: string, input: AssignmentDto): Promise<void> {
    await this.access.require(
      actor,
      'assign',
      { type: 'assignment', groupIds: [id] },
      'detail',
    );
    await this.db.transaction(async (manager) => {
      await rows(manager, 'SELECT pg_advisory_xact_lock(739201)');
      const member = await one(
        manager,
        "SELECT 1 FROM membership WHERE person_id=$1 AND group_id=$2 AND role='member' AND valid_to IS NULL",
        [input.memberPersonId, id],
      );
      if (!member) throw new BadRequestException('عضو متعلق به این گروه نیست.');
      if (input.assistantPersonId) {
        const assistant = await one(
          manager,
          "SELECT 1 FROM membership m JOIN person p ON p.id=m.person_id WHERE m.person_id=$1 AND m.group_id=$2 AND m.role='assistant' AND m.valid_to IS NULL AND p.status='active'",
          [input.assistantPersonId, id],
        );
        if (!assistant)
          throw new BadRequestException(
            'کمک‌مربی فعال همین گروه را انتخاب کنید.',
          );
      }
      await rows(
        manager,
        'UPDATE follow_up_assignment SET to_date=now() WHERE member_person_id=$1 AND to_date IS NULL',
        [input.memberPersonId],
      );
      if (input.assistantPersonId)
        await rows(
          manager,
          'INSERT INTO follow_up_assignment(member_person_id,assistant_person_id,group_id) VALUES($1,$2,$3)',
          [input.memberPersonId, input.assistantPersonId, id],
        );
      await this.audit.record(
        actor.personId,
        'assignment.changed',
        'person',
        input.memberPersonId,
        {},
        manager,
      );
    });
  }
}
