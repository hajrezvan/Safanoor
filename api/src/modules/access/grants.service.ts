import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { CryptoService } from '../../libs/security/crypto.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateGrantDto, GrantDto, GrantsPageDto } from './access.dto';
import { AccessService } from './access.service';
import { Actor } from './access.types';

@Injectable()
export class GrantsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly crypto: CryptoService,
  ) {}
  async list(actor: Actor, query: PaginationDto): Promise<GrantsPageDto> {
    await this.access.require(actor, 'read', {
      type: 'grant',
      ownerId: actor.personId,
    });
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM access_grant WHERE granted_by=$1 OR grantee_person_id=$1',
      [actor.personId],
    );
    const items = await rows<GrantDto>(
      this.db,
      'SELECT id,resource_type AS "resourceType",resource_id AS "resourceId",member_person_id AS "memberPersonId",grantee_person_id AS "granteePersonId",granted_by AS "grantedBy",granted_at AS "grantedAt",revoked_at AS "revokedAt",false AS "canRevoke" FROM access_grant WHERE granted_by=$1 OR grantee_person_id=$1 ORDER BY granted_at DESC LIMIT $2 OFFSET $3',
      [actor.personId, query.limit, (query.page - 1) * query.limit],
    );
    for (const item of items)
      item.canRevoke =
        !item.revokedAt &&
        (await this.access.level(actor, 'revoke', {
          ...(await this.access.personResource(item.memberPersonId)),
          type: 'grant',
        })) === 'detail';
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }
  async create(actor: Actor, input: CreateGrantDto): Promise<GrantDto> {
    const registry = await one<{ memberId: string }>(
      this.db,
      'SELECT member_person_id AS "memberId" FROM resource_registry WHERE resource_type=$1 AND resource_id=$2',
      [input.resourceType, input.resourceId],
    );
    if (!registry) throw new NotFoundException('منبع قابل ارجاع پیدا نشد.');
    await this.access.require(
      actor,
      'grant',
      {
        ...(await this.access.personResource(registry.memberId)),
        type: 'grant',
      },
      'detail',
    );
    const target = await one<{ id: string }>(
      this.db,
      "SELECT id FROM person WHERE id=$1 AND status='active'",
      [input.granteePersonId],
    );
    if (!target) throw new BadRequestException('گیرنده معتبر نیست.');
    let allowed = false;
    if (input.resourceType === 'person_file')
      allowed = !!(await one(
        this.db,
        "SELECT 1 FROM person WHERE id=$1 AND org_level='supervisor' AND status='active'",
        [target.id],
      ));
    if (input.resourceType === 'confidential_note')
      allowed = !!(await one(
        this.db,
        'SELECT 1 FROM follow_up_assignment f WHERE f.member_person_id=$1 AND f.assistant_person_id=$2 AND f.to_date IS NULL AND EXISTS(SELECT 1 FROM follow_up_assignment h WHERE h.member_person_id=$1 AND h.assistant_person_id<>$2 AND h.to_date IS NOT NULL AND h.to_date<=f.from_date)',
        [registry.memberId, target.id],
      ));
    if (input.resourceType === 'consultation_summary')
      allowed = !!(await one(
        this.db,
        "SELECT 1 FROM parent_link l JOIN app_user u ON u.id=l.parent_user_id JOIN person p ON p.id=l.child_person_id WHERE u.person_id=$1 AND l.child_person_id=$2 AND l.active AND p.status='active' AND p.birth_date+interval '18 years'>CURRENT_DATE",
        [target.id, registry.memberId],
      ));
    if (!allowed)
      throw new BadRequestException('این ارجاع با سیاست دسترسی سازگار نیست.');
    if (input.parentMessage && input.resourceType !== 'consultation_summary')
      throw new BadRequestException('پیام والد فقط برای خلاصهٔ مشاوره است.');
    const result = await this.db.transaction(async (manager) => {
      const grant = await one<{ id: string }>(
        manager,
        'INSERT INTO access_grant(resource_type,resource_id,member_person_id,grantee_person_id,granted_by,reason,parent_message_enc) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [
          input.resourceType,
          input.resourceId,
          registry.memberId,
          target.id,
          actor.personId,
          input.reason,
          input.parentMessage
            ? this.crypto.encrypt(input.parentMessage, 'parent-message')
            : null,
        ],
      );
      if (!grant) throw new BadRequestException();
      await this.audit.record(
        actor.personId,
        'grant.created',
        input.resourceType,
        input.resourceId,
        {},
        manager,
      );
      await this.notifications.create(
        target.id,
        'grant.received',
        `grant:${grant.id}`,
        manager,
      );
      if (input.resourceType === 'consultation_summary')
        await this.notifications.create(
          registry.memberId,
          'consultation.parent_released',
          `parent-release:${grant.id}`,
          manager,
        );
      return grant;
    });
    const item = (await this.list(actor, { page: 1, limit: 100 })).items.find(
      (item) => item.id === result.id,
    );
    if (!item) throw new NotFoundException();
    return item;
  }
  async revoke(actor: Actor, id: string): Promise<void> {
    const grant = await one<{
      memberId: string;
      type: string;
      resourceId: string;
      granteeId: string;
    }>(
      this.db,
      'SELECT member_person_id AS "memberId",resource_type AS type,resource_id AS "resourceId",grantee_person_id AS "granteeId" FROM access_grant WHERE id=$1',
      [id],
    );
    if (!grant) throw new NotFoundException();
    await this.access.require(
      actor,
      'revoke',
      { ...(await this.access.personResource(grant.memberId)), type: 'grant' },
      'detail',
    );
    await this.db.transaction(async (manager) => {
      const changed = await rows<{ id: string }>(
        manager,
        'UPDATE access_grant SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL RETURNING id',
        [id],
      );
      if (!changed.length) return;
      await this.audit.record(
        actor.personId,
        'grant.revoked',
        grant.type,
        grant.resourceId,
        {},
        manager,
      );
      await this.notifications.create(
        grant.granteeId,
        'grant.revoked',
        `grant-revoke:${id}`,
        manager,
      );
      if (grant.type === 'consultation_summary')
        await this.notifications.create(
          grant.memberId,
          'consultation.parent_revoked',
          `parent-revoke:${id}`,
          manager,
        );
    });
  }
}
