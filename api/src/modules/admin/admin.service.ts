import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ageOn, normalizePersian } from '@safanoor/shared';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import {
  AUTH_PROVIDER,
  AuthenticationProvider,
} from '../auth/password.provider';
import {
  QualificationDto,
  AccountDto,
  AuditDto,
  AuditPageDto,
  CreateAccountDto,
  JobsStatusDto,
  OverviewDto,
  ParentAccountDto,
  ParentLinkDto,
  RetentionDto,
  RetentionPageDto,
  UpdateRetentionDto,
} from './admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    @Inject(AUTH_PROVIDER) private readonly provider: AuthenticationProvider,
  ) {}
  async overview(actor: Actor): Promise<OverviewDto> {
    await this.access.require(actor, 'read', { type: 'admin' });
    const result = await one<OverviewDto>(
      this.db,
      `WITH visible_groups AS (SELECT id FROM organization_group WHERE $2 OR owner_person_id=$1),visible_people AS (SELECT DISTINCT p.id,p.org_level,p.consent_required FROM person p JOIN membership m ON m.person_id=p.id AND m.role='member' AND m.valid_to IS NULL WHERE p.status='active' AND ($2 OR m.group_id IN (SELECT id FROM visible_groups))) SELECT (SELECT count(*)::int FROM visible_people) AS "peopleCount",(SELECT count(*)::int FROM visible_groups) AS "groupCount",(SELECT count(*)::int FROM visible_people WHERE org_level='assistant') AS "assistantCount",(SELECT count(*)::int FROM visible_people WHERE consent_required) AS "consentPending",(SELECT count(*)::int FROM notification WHERE recipient_id=$1 AND read_at IS NULL) AS "unreadCount",(SELECT count(*)::int FROM import_job WHERE created_by=$1 AND status IN ('queued','validating','ready','committing')) AS "importPending",(SELECT count(*)::int FROM person WHERE org_level='supervisor' AND status='active') AS "supervisorCount"`,
      [actor.personId, actor.isAdmin],
    );
    if (!result) throw new NotFoundException();
    return { ...result, organizationReady: result.supervisorCount === 5 };
  }
  async auditLog(actor: Actor, query: PaginationDto): Promise<AuditPageDto> {
    await this.access.require(actor, 'read', { type: 'audit' });
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM audit_log',
    );
    const items = await rows<AuditDto>(
      this.db,
      'SELECT id,actor_id AS "actorId",action,resource_type AS "resourceType",resource_id AS "resourceId",at,meta FROM audit_log ORDER BY at DESC,id LIMIT $1 OFFSET $2',
      [query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }
  async jobs(actor: Actor): Promise<JobsStatusDto> {
    await this.access.require(actor, 'manage', { type: 'admin' });
    const queues = await rows<{ name: string; state: string; count: number }>(
      this.db,
      'SELECT name,state,count(*)::int FROM pgboss.job GROUP BY name,state ORDER BY name,state',
    );
    return { queues, database: 'ok' };
  }
  async retention(
    actor: Actor,
    query: PaginationDto,
  ): Promise<RetentionPageDto> {
    await this.access.require(actor, 'manage', { type: 'admin' });
    const count = await one<{ count: string }>(
      this.db,
      'SELECT count(*) FROM retention_policy',
    );
    const items = await rows<RetentionDto>(
      this.db,
      'SELECT data_type AS "dataType",keep_days AS "keepDays",action,proposed FROM retention_policy ORDER BY data_type LIMIT $1 OFFSET $2',
      [query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(items, query.page, query.limit, Number(count?.count ?? 0));
  }
  async updateRetention(
    actor: Actor,
    type: string,
    input: UpdateRetentionDto,
  ): Promise<void> {
    await this.access.require(actor, 'manage', { type: 'admin' }, 'detail');
    await this.db.transaction(async (manager) => {
      const found = await rows(
        manager,
        'UPDATE retention_policy SET keep_days=$2,action=$3 WHERE data_type=$1 RETURNING data_type',
        [type, input.keepDays, input.action],
      );
      if (!found.length) throw new NotFoundException();
      await this.audit.record(
        actor.personId,
        'retention.updated',
        'admin',
        null,
        { count: input.keepDays },
        manager,
      );
    });
  }
  async account(actor: Actor, input: CreateAccountDto): Promise<AccountDto> {
    await this.access.require(actor, 'manage', { type: 'admin' }, 'detail');
    const hash = await this.provider.hash(input.password);
    return this.db.transaction(async (manager) => {
      const person = await one<{ phone: string }>(
        manager,
        "SELECT phone FROM person WHERE id=$1 AND status='active'",
        [input.personId],
      );
      if (!person) throw new NotFoundException();
      const result = await one<{ userId: string }>(
        manager,
        'INSERT INTO app_user(person_id,login,password_hash) VALUES($1,$2,$3) ON CONFLICT(person_id) DO UPDATE SET login=$2,password_hash=$3,password_changed_at=now(),failed_attempts=0,locked_until=NULL RETURNING id AS "userId"',
        [input.personId, person.phone, hash],
      );
      if (!result) throw new BadRequestException();
      await rows(
        manager,
        'UPDATE auth_session SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1',
        [result.userId],
      );
      await this.audit.record(
        actor.personId,
        'account.provisioned',
        'person',
        input.personId,
        {},
        manager,
      );
      return { ...result, personId: input.personId };
    });
  }
  async parent(actor: Actor, input: ParentAccountDto): Promise<AccountDto> {
    await this.access.require(actor, 'manage', { type: 'admin' }, 'detail');
    const hash = await this.provider.hash(input.password);
    return this.db.transaction(async (manager) => {
      const person = await one<{ id: string }>(
        manager,
        "INSERT INTO person(first_name,last_name,phone,org_level,external,search_name) VALUES($1,$2,$3,'member',true,$4) RETURNING id",
        [
          input.firstName,
          input.lastName,
          input.phone,
          normalizePersian(`${input.firstName} ${input.lastName}`),
        ],
      );
      if (!person) throw new BadRequestException();
      const user = await one<{ id: string }>(
        manager,
        'INSERT INTO app_user(person_id,login,password_hash,is_parent) VALUES($1,$2,$3,true) RETURNING id',
        [person.id, input.phone, hash],
      );
      if (!user) throw new BadRequestException();
      await this.audit.record(
        actor.personId,
        'parent.created',
        'person',
        person.id,
        {},
        manager,
      );
      return { userId: user.id, personId: person.id };
    });
  }
  async parentLink(actor: Actor, input: ParentLinkDto): Promise<void> {
    const resource = await this.access.personResource(input.childPersonId);
    await this.access.require(actor, 'update', resource, 'detail');
    if (!(await this.access.relations(actor, resource)).mentor)
      throw new BadRequestException(
        'ارتباط والد باید توسط مربی مستقیم تأیید شود.',
      );
    const child = await one<{ birthDate: string }>(
      this.db,
      "SELECT to_char(birth_date,'YYYY-MM-DD') AS \"birthDate\" FROM person WHERE id=$1 AND status='active'",
      [input.childPersonId],
    );
    if (!!input.parentUserId === !!input.parentPhone)
      throw new BadRequestException('یک راه شناسایی والد را انتخاب کنید.');
    const parent = await one<{ id: string }>(
      this.db,
      "SELECT u.id FROM app_user u JOIN person p ON p.id=u.person_id WHERE (u.id=$1::uuid OR u.login=$2) AND u.is_parent AND p.status='active'",
      [input.parentUserId ?? null, input.parentPhone ?? null],
    );
    if (!child || !parent || ageOn(child.birthDate) >= 18)
      throw new BadRequestException('والد یا فرزند زیر ۱۸ سال معتبر نیست.');
    await this.db.transaction(async (manager) => {
      await rows(
        manager,
        'INSERT INTO parent_link(parent_user_id,child_person_id,confirmed_by) VALUES($1,$2,$3) ON CONFLICT(parent_user_id,child_person_id) DO UPDATE SET active=true,archived_at=NULL,confirmed_by=$3',
        [parent.id, input.childPersonId, actor.personId],
      );
      await this.audit.record(
        actor.personId,
        'parent_link.confirmed',
        'person',
        input.childPersonId,
        {},
        manager,
      );
    });
  }
  async qualification(actor: Actor, input: QualificationDto): Promise<void> {
    await this.access.require(actor, 'manage', { type: 'admin' }, 'detail');
    await this.db.transaction(async (manager) => {
      await rows(manager, 'SELECT pg_advisory_xact_lock(739201)');
      const person = await one<{ orgLevel: string }>(
        manager,
        'SELECT org_level AS "orgLevel" FROM person WHERE id=$1 AND status=\'active\' AND NOT external FOR UPDATE',
        [input.personId],
      );
      if (!person || person.orgLevel === 'supervisor')
        throw new BadRequestException('تغییر ناظران از این مسیر مجاز نیست.');
      if (
        ['member', 'assistant'].includes(input.orgLevel) &&
        (await one(
          manager,
          'SELECT 1 FROM organization_group WHERE owner_person_id=$1',
          [input.personId],
        ))
      )
        throw new BadRequestException('ابتدا مسئولیت گروه واگذار شود.');
      if (
        input.orgLevel === 'member' &&
        (await one(
          manager,
          "SELECT 1 FROM membership WHERE person_id=$1 AND role='assistant' AND valid_to IS NULL",
          [input.personId],
        ))
      )
        throw new BadRequestException(
          'ابتدا نقش کمک‌مربی و پیگیری‌ها واگذار شود.',
        );
      await rows(manager, 'UPDATE person SET org_level=$2 WHERE id=$1', [
        input.personId,
        input.orgLevel,
      ]);
      await this.audit.record(
        actor.personId,
        'qualification.changed',
        'person',
        input.personId,
        {},
        manager,
      );
    });
  }
}
