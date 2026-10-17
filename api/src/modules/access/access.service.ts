import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { one, rows } from '../../libs/database/database.types';
import { AuditService } from '../audit/audit.service';
import { can } from './can';
import {
  AccessLevel,
  Action,
  Actor,
  GrantRow,
  PolicyRow,
  Relations,
  Resource,
  ResourceType,
} from './access.types';

@Injectable()
export class AccessService {
  constructor(
    private readonly db: DataSource,
    private readonly audit: AuditService,
  ) {}
  async relations(actor: Actor, resource: Resource): Promise<Relations> {
    const subject = resource.memberId ?? resource.ownerId ?? actor.personId;
    const groups = resource.groupIds ?? [];
    const result = await one<Relations>(
      this.db,
      `SELECT
      $1::uuid=$2::uuid AS self,
      EXISTS(SELECT 1 FROM membership m JOIN organization_group g ON g.id=m.group_id WHERE m.person_id=$3 AND m.role='member' AND m.valid_to IS NULL AND g.owner_person_id=$1) AS mentor,
      EXISTS(SELECT 1 FROM person_ancestors WHERE person_id=$3 AND ancestor_id=$1 AND depth=2) AS "headMentor",
      EXISTS(SELECT 1 FROM person_ancestors WHERE person_id=$3 AND ancestor_id=$1) AS ancestor,
      EXISTS(SELECT 1 FROM follow_up_assignment WHERE member_person_id=$3 AND assistant_person_id=$1 AND to_date IS NULL) AS "followingAssistant",
      EXISTS(SELECT 1 FROM membership WHERE person_id=$1 AND role='assistant' AND valid_to IS NULL AND group_id=ANY($4::uuid[])) AS "otherAssistant",
      ($5::boolean AND EXISTS(SELECT 1 FROM person_ancestors WHERE person_id=$3 AND ancestor_id=$1)) AS supervisor,
      EXISTS(SELECT 1 FROM parent_link l JOIN person p ON p.id=l.child_person_id WHERE l.parent_user_id=$6 AND l.child_person_id=$3 AND l.active AND p.status='active' AND p.birth_date+interval '18 years'>CURRENT_DATE) AS parent,
      EXISTS(SELECT 1 FROM membership WHERE person_id=$1 AND valid_to IS NULL AND (cardinality($4::uuid[])=0 OR group_id=ANY($4::uuid[]))) AS "sameGroup",
      EXISTS(SELECT 1 FROM organization_group WHERE owner_person_id=$1 AND (cardinality($4::uuid[])=0 OR id=ANY($4::uuid[]))) AS "groupMentor",
      EXISTS(SELECT 1 FROM organization_group WHERE owner_person_id=$1 AND id=$7::uuid) AS "hostMentor",
      EXISTS(SELECT 1 FROM group_role WHERE person_id=$1 AND group_id=ANY($4::uuid[]) AND role='finance_officer' AND valid_to IS NULL) AS "financeOfficer",
      $1::uuid=ANY($8::uuid[]) AS attendee,
      EXISTS(SELECT 1 FROM person_ancestors WHERE ancestor_id=$1 AND person_id=ANY($8::uuid[])) AS "attendeeAncestor",
      false AS "campLead",false AS "campActive",
      EXISTS(SELECT 1 FROM follow_up_assignment WHERE member_person_id=$3 AND assistant_person_id=$1 AND to_date IS NULL) AS "authorizedFollower"`,
      [
        actor.personId,
        resource.ownerId ?? actor.personId,
        subject,
        groups,
        actor.orgLevel === 'supervisor',
        actor.userId,
        resource.hostGroupId ?? null,
        resource.attendeeIds ?? [],
      ],
    );
    if (!result) throw new ForbiddenException();
    result.campLead =
      resource.campLeadId === actor.personId &&
      !!resource.campParticipantIds?.includes(subject);
    result.campActive =
      !!resource.campStartsAt &&
      !!resource.campEndsAt &&
      Date.now() >= Date.parse(resource.campStartsAt) &&
      Date.now() <= Date.parse(resource.campEndsAt);
    return result;
  }
  async level(
    actor: Actor,
    action: Action,
    resource: Resource,
  ): Promise<AccessLevel> {
    const [policies, relations, grants] = await Promise.all([
      rows<PolicyRow>(
        this.db,
        'SELECT resource_type AS "resourceType",action,owner_role AS "ownerRole",viewer_relation AS "viewerRelation",level FROM access_policy WHERE resource_type=$1 AND action=$2',
        [resource.type, action],
      ),
      this.relations(actor, resource),
      resource.id
        ? rows<GrantRow>(
            this.db,
            'SELECT resource_type AS "resourceType",resource_id AS "resourceId",grantee_person_id AS "granteePersonId",revoked_at AS "revokedAt" FROM access_grant WHERE grantee_person_id=$1 AND resource_type=$2 AND resource_id=$3 AND revoked_at IS NULL',
            [actor.personId, resource.type, resource.id],
          )
        : Promise.resolve([]),
    ]);
    if (
      actor.consentRequired &&
      !['consent', 'notification'].includes(resource.type) &&
      !(resource.type === 'person' && relations.self && action === 'read')
    )
      return 'none';
    return can(actor, action, resource, { policies, relations, grants });
  }
  async require(
    actor: Actor,
    action: Action,
    resource: Resource,
    minimum: AccessLevel = 'summary',
  ): Promise<AccessLevel> {
    const level = await this.level(actor, action, resource);
    if (level === 'none' || (minimum === 'detail' && level !== 'detail'))
      throw new ForbiddenException('اجازهٔ دسترسی به این بخش را ندارید.');
    if (
      actor.isAdmin ||
      [
        'person_file',
        'confidential_note',
        'consultation_private_note',
        'emergency',
      ].includes(resource.type)
    )
      await this.audit.record(
        actor.personId,
        `access.${action}`,
        resource.type,
        resource.id ?? null,
        { level },
      );
    return level;
  }
  async personResource(id: string): Promise<Resource> {
    const item = await one<{
      id: string;
      status: string;
      orgLevel: string;
      groupIds: string[];
    }>(
      this.db,
      `SELECT p.id,p.status,p.org_level AS "orgLevel",COALESCE(array_agg(m.group_id) FILTER(WHERE m.group_id IS NOT NULL),'{}') AS "groupIds" FROM person p LEFT JOIN membership m ON m.person_id=p.id AND m.role='member' AND m.valid_to IS NULL WHERE p.id=$1 GROUP BY p.id`,
      [id],
    );
    if (!item) throw new NotFoundException();
    return {
      type: 'person',
      id,
      ownerId: id,
      memberId: id,
      ownerRole: item.orgLevel,
      groupIds: item.groupIds,
      status: item.status,
    };
  }
  async grantResource(
    type: string | undefined,
    id: string | undefined,
  ): Promise<Resource> {
    if (!type || !id) throw new NotFoundException();
    const item = await one<{ memberId: string }>(
      this.db,
      'SELECT member_person_id AS "memberId" FROM resource_registry WHERE resource_type=$1 AND resource_id=$2',
      [type, id],
    );
    if (!item) throw new NotFoundException();
    return { ...(await this.personResource(item.memberId)), type: 'grant' };
  }
  async resolve(
    type: ResourceType,
    id: string | undefined,
    actor: Actor,
    groupId?: string,
  ): Promise<Resource> {
    if (type === 'person' && id) return this.personResource(id);
    if (type === 'group' && id) return { type, id, groupIds: [id] };
    if (
      (type === 'notification' || type === 'import' || type === 'file') &&
      id
    ) {
      const table =
        type === 'notification'
          ? 'notification'
          : type === 'file'
            ? 'file_record'
            : 'import_job';
      const field = type === 'notification' ? 'recipient_id' : 'created_by';
      const item = await one<{ ownerId: string }>(
        this.db,
        `SELECT ${field} AS "ownerId" FROM ${table} WHERE id=$1`,
        [id],
      );
      if (!item) throw new NotFoundException();
      return { type, id, ownerId: item.ownerId };
    }
    return {
      type,
      id,
      ownerId: actor.personId,
      groupIds: groupId ? [groupId] : [],
    };
  }
}
