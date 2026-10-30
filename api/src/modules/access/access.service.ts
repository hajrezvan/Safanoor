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
      EXISTS(
        SELECT 1 FROM follow_up_assignment
        WHERE assistant_person_id=$1 AND to_date IS NULL
          AND (
            member_person_id=$3
            OR (cardinality($8::uuid[])>0 AND member_person_id=ANY($8::uuid[]))
          )
      ) AS "followingAssistant",
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
    if (type === 'assistant_invite' && id) {
      const invite = await one<{
        inviteeId: string;
        groupId: string;
      }>(
        this.db,
        'SELECT invitee_person_id AS "inviteeId",group_id AS "groupId" FROM assistant_invite WHERE id=$1',
        [id],
      );
      if (invite)
        return {
          type,
          id,
          ownerId: invite.inviteeId,
          groupIds: [invite.groupId],
        };
      return { type, id, groupIds: [id] };
    }
    if (type === 'study_path' && id) {
      const path = await one<{ groupId: string }>(
        this.db,
        'SELECT group_id AS "groupId" FROM study_path WHERE id=$1',
        [id],
      );
      if (path) return { type, id, groupIds: [path.groupId] };
      return { type, id, groupIds: [id] };
    }
    if (type === 'photo') {
      if (id) {
        const photo = await one<{
          hostGroupId: string;
          uploadedBy: string;
        }>(
          this.db,
          `SELECT host_group_id AS "hostGroupId",uploaded_by AS "uploadedBy"
           FROM photo WHERE id=$1`,
          [id],
        );
        if (!photo) throw new NotFoundException();
        const attached = await rows<{ groupId: string }>(
          this.db,
          `SELECT group_id AS "groupId" FROM photo_group
           WHERE photo_id=$1 AND hidden_by_group=false`,
          [id],
        );
        return {
          type,
          id,
          hostGroupId: photo.hostGroupId,
          ownerId: photo.uploadedBy,
          groupIds: attached.map((row) => row.groupId),
        };
      }
      return {
        type,
        hostGroupId: groupId,
        groupIds: groupId ? [groupId] : [],
      };
    }
    if (type === 'program_event' && id) {
      const destination = await one<{ groupId: string }>(
        this.db,
        'SELECT group_id AS "groupId" FROM program_event WHERE id=$1',
        [id],
      );
      if (destination) return { type, id, groupIds: [destination.groupId] };
      return { type, id, groupIds: [id] };
    }
    if (type === 'camp' && id) {
      const camp = await one<{ groupId: string }>(
        this.db,
        'SELECT group_id AS "groupId" FROM camp WHERE id=$1',
        [id],
      );
      if (camp) return { type, id, groupIds: [camp.groupId] };
      return { type, id, groupIds: [id] };
    }
    if (type === 'meeting') {
      if (!id)
        return {
          type,
          attendeeIds: [actor.personId],
          groupIds: groupId ? [groupId] : [],
        };
      const meeting = await one<{ groupId: string }>(
        this.db,
        'SELECT group_id AS "groupId" FROM meeting WHERE id=$1',
        [id],
      );
      if (!meeting) throw new NotFoundException();
      const attendees = await rows<{ personId: string }>(
        this.db,
        'SELECT person_id AS "personId" FROM meeting_attendee WHERE meeting_id=$1',
        [id],
      );
      return {
        type,
        id,
        groupIds: [meeting.groupId],
        hostGroupId: meeting.groupId,
        attendeeIds: attendees.map((row) => row.personId),
      };
    }
    if (type === 'consultation') {
      if (!id)
        return {
          type,
          ownerId: actor.personId,
          groupIds: groupId ? [groupId] : [],
        };
      const consultation = await one<{
        groupId: string;
        authorId: string;
      }>(
        this.db,
        `SELECT group_id AS "groupId", author_id AS "authorId"
         FROM consultation WHERE id=$1`,
        [id],
      );
      if (!consultation) throw new NotFoundException();
      const members = await rows<{ personId: string }>(
        this.db,
        'SELECT person_id AS "personId" FROM consultation_member WHERE consultation_id=$1',
        [id],
      );
      const attendeeIds = members.map((row) => row.personId);
      return {
        type,
        id,
        ownerId: consultation.authorId,
        memberId: attendeeIds[0],
        groupIds: [consultation.groupId],
        hostGroupId: consultation.groupId,
        attendeeIds,
      };
    }
    if (type === 'consultation_private_note') {
      if (!id)
        return {
          type,
          ownerId: actor.personId,
          ownerRole: actor.orgLevel === 'mentor' ? 'mentor' : 'assistant',
        };
      const consultation = await one<{
        groupId: string;
        authorId: string;
        authorLevel: string;
      }>(
        this.db,
        `SELECT c.group_id AS "groupId", c.author_id AS "authorId",
                p.org_level AS "authorLevel"
         FROM consultation c
         JOIN person p ON p.id=c.author_id
         WHERE c.id=$1`,
        [id],
      );
      if (!consultation) {
        const note = await one<{
          id: string;
          consultationId: string;
          authorId: string;
          authorLevel: string;
          groupId: string;
        }>(
          this.db,
          `SELECT n.id, n.consultation_id AS "consultationId", n.author_id AS "authorId",
                  p.org_level AS "authorLevel", c.group_id AS "groupId"
           FROM consultation_private_note n
           JOIN consultation c ON c.id=n.consultation_id
           JOIN person p ON p.id=n.author_id
           WHERE n.id=$1`,
          [id],
        );
        if (!note) throw new NotFoundException();
        return {
          type,
          id: note.id,
          ownerId: note.authorId,
          memberId: note.authorId,
          ownerRole: note.authorLevel === 'mentor' ? 'mentor' : 'assistant',
          groupIds: [note.groupId],
        };
      }
      const note = await one<{ id: string }>(
        this.db,
        'SELECT id FROM consultation_private_note WHERE consultation_id=$1',
        [id],
      );
      return {
        type,
        id: note?.id ?? id,
        ownerId: consultation.authorId,
        memberId: consultation.authorId,
        ownerRole:
          consultation.authorLevel === 'mentor' ? 'mentor' : 'assistant',
        groupIds: [consultation.groupId],
      };
    }
    if (type === 'chat_thread' && id) {
      const thread = await one<{ groupId: string }>(
        this.db,
        'SELECT group_id AS "groupId" FROM chat_thread WHERE id=$1',
        [id],
      );
      if (!thread) throw new NotFoundException();
      const participants = await rows<{ personId: string }>(
        this.db,
        'SELECT person_id AS "personId" FROM chat_thread_participant WHERE thread_id=$1',
        [id],
      );
      return {
        type,
        id,
        groupIds: [thread.groupId],
        attendeeIds: participants.map((row) => row.personId),
      };
    }
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
