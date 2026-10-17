import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ageOn, normalizePersian, personSchema } from '@safanoor/shared';
import { CryptoService } from '../../libs/security/crypto.service';
import { one, pageOf, rows } from '../../libs/database/database.types';
import { PaginationDto } from '../../libs/http/http.dto';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import {
  CreatePersonDto,
  MeDto,
  PeoplePageDto,
  PersonDto,
  UpdatePersonDto,
} from './people.dto';

interface PersonRow {
  id: string;
  firstName: string;
  lastName: string;
  orgLevel: string;
  status: string;
  age: number;
  availability: string;
  groupId?: string;
  groupName?: string;
  verified: boolean;
}
@Injectable()
export class PeopleService {
  constructor(
    private readonly db: DataSource,
    private readonly access: AccessService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}
  async list(actor: Actor, query: PaginationDto): Promise<PeoplePageDto> {
    await this.access.require(actor, 'read', {
      type: 'person',
      ownerId: actor.personId,
    });
    const scope = `p.status='active' AND (p.id=$1 OR $2 OR EXISTS(SELECT 1 FROM membership m JOIN organization_group g ON g.id=m.group_id WHERE m.person_id=p.id AND m.role='member' AND m.valid_to IS NULL AND g.owner_person_id=$1) OR EXISTS(SELECT 1 FROM follow_up_assignment f WHERE f.member_person_id=p.id AND f.assistant_person_id=$1 AND f.to_date IS NULL)) AND ($3='' OR p.search_name LIKE '%'||$3||'%')`;
    const params = [
      actor.personId,
      actor.isAdmin,
      normalizePersian(query.search ?? ''),
    ];
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM person p WHERE ${scope}`,
      params,
    );
    const ids = await rows<{ id: string }>(
      this.db,
      `SELECT p.id FROM person p WHERE ${scope} ORDER BY p.first_name,p.last_name,p.id LIMIT $4 OFFSET $5`,
      [...params, query.limit, (query.page - 1) * query.limit],
    );
    return pageOf(
      await Promise.all(ids.map(({ id }) => this.get(actor, id))),
      query.page,
      query.limit,
      Number(count?.count ?? 0),
    );
  }
  async get(actor: Actor, id: string): Promise<PersonDto> {
    const resource = await this.access.personResource(id);
    const level = await this.access.require(actor, 'read', resource);
    const item = await one<PersonRow>(
      this.db,
      `SELECT p.id,p.first_name AS "firstName",p.last_name AS "lastName",p.org_level AS "orgLevel",p.status,COALESCE(extract(year FROM age(CURRENT_DATE,p.birth_date))::int,0) AS age,p.availability,(p.verified_at IS NOT NULL) AS verified,m.group_id AS "groupId",g.name AS "groupName" FROM person p LEFT JOIN membership m ON m.person_id=p.id AND m.role='member' AND m.valid_to IS NULL LEFT JOIN organization_group g ON g.id=m.group_id WHERE p.id=$1`,
      [id],
    );
    if (!item) throw new NotFoundException();
    const detail =
      level === 'detail'
        ? await one<{ fatherName: string; birthDate: string; phone: string }>(
            this.db,
            `SELECT father_name AS "fatherName",to_char(birth_date,'YYYY-MM-DD') AS "birthDate",phone FROM person WHERE id=$1`,
            [id],
          )
        : {};
    const relations = await this.access.relations(actor, resource);
    const visibleDetail = Object.fromEntries(
      Object.entries(detail ?? {}).filter(([, value]) => value !== null),
    );
    return {
      ...item,
      ...visibleDetail,
      nationalIdMasked: '••••••••••',
      capabilities: {
        ownGroup:
          actor.isAdmin &&
          ['supervisor', 'head_mentor', 'mentor'].includes(item.orgLevel),
        linkParent: relations.mentor && item.age < 18,
        update:
          (await this.access.level(actor, 'update', resource)) === 'detail',
        deactivate:
          (await this.access.level(actor, 'deactivate', resource)) ===
            'detail' && id !== actor.personId,
        verify: relations.mentor,
      },
    };
  }
  async me(actor: Actor): Promise<MeDto> {
    const checks = await Promise.all([
      this.access.level(actor, 'read', { type: 'admin' }),
      this.access.level(actor, 'create', { type: 'person' }),
      this.access.level(actor, 'create', { type: 'group' }),
      this.access.level(actor, 'create', { type: 'import' }),
      this.access.level(actor, 'read', { type: 'policy' }),
      this.access.level(actor, 'read', { type: 'audit' }),
      this.access.level(actor, 'manage', { type: 'admin' }),
    ]);
    const children = actor.isParent
      ? await rows<{ id: string; name: string }>(
          this.db,
          `SELECT p.id,p.first_name||' '||p.last_name AS name FROM parent_link l JOIN person p ON p.id=l.child_person_id WHERE l.parent_user_id=$1 AND l.active AND p.status='active' AND p.birth_date+interval '18 years'>CURRENT_DATE ORDER BY p.first_name`,
          [actor.userId],
        )
      : [];
    return {
      person: await this.get(actor, actor.personId),
      isParent: actor.isParent,
      consentRequired: actor.consentRequired,
      capabilities: {
        createGroups: checks[2] !== 'none',
        admin: checks[0] !== 'none',
        managePeople: checks[1] !== 'none',
        manageGroups: checks[2] !== 'none' || checks[1] !== 'none',
        importPeople: checks[3] !== 'none',
        viewPolicies: checks[4] !== 'none',
        viewAudit: checks[5] !== 'none',
        manageSettings: checks[6] !== 'none',
      },
      children,
      moneyUnit: process.env.MONEY_UNIT ?? 'toman',
    };
  }
  async create(
    actor: Actor,
    input: CreatePersonDto,
    transaction?: EntityManager,
  ): Promise<{ id: string }> {
    const parsed = personSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException('اطلاعات هویتی یا کد ملی معتبر نیست.');
    if (input.orgLevel !== 'supervisor' && !input.groupId)
      throw new BadRequestException('عضویت در یک گروه الزامی است.');
    await this.access.require(
      actor,
      'create',
      { type: 'person', groupIds: input.groupId ? [input.groupId] : [] },
      'detail',
    );
    if (input.orgLevel !== 'member' && !actor.isAdmin)
      await this.access.require(actor, 'manage', { type: 'admin' }, 'detail');
    const create = async (manager: EntityManager) => {
      await rows(manager, 'SELECT pg_advisory_xact_lock(739201)');
      const result = await one<{ id: string }>(
        manager,
        `INSERT INTO person(first_name,last_name,father_name,birth_date,national_id_enc,national_id_hash,phone,org_level,search_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          input.firstName,
          input.lastName,
          input.fatherName,
          input.birthDate,
          this.crypto.encrypt(input.nationalId, 'national-id'),
          this.crypto.nationalIdHash(input.nationalId),
          input.phone,
          input.orgLevel,
          normalizePersian(`${input.firstName} ${input.lastName}`),
        ],
      );
      if (!result) throw new BadRequestException();
      if (input.groupId)
        await rows(
          manager,
          `INSERT INTO membership(person_id,group_id,role) VALUES($1,$2,'member')`,
          [result.id, input.groupId],
        );
      await this.rebuildHierarchy(manager);
      await this.audit.record(
        actor.personId,
        'person.created',
        'person',
        result.id,
        {},
        manager,
      );
      return result;
    };
    return transaction ? create(transaction) : this.db.transaction(create);
  }
  async update(
    actor: Actor,
    id: string,
    input: UpdatePersonDto,
  ): Promise<PersonDto> {
    const resource = await this.access.personResource(id);
    await this.access.require(actor, 'update', resource, 'detail');
    if (input.groupId || input.orgLevel)
      throw new BadRequestException(
        'تغییر نقش و گروه از بخش عضویت انجام می‌شود.',
      );
    if (
      input.nationalId &&
      !personSchema.shape.nationalId.safeParse(input.nationalId).success
    )
      throw new BadRequestException('کد ملی معتبر نیست.');
    if (
      input.birthDate &&
      (!personSchema.shape.birthDate.safeParse(input.birthDate).success ||
        ageOn(input.birthDate) < 0)
    )
      throw new BadRequestException('تاریخ تولد معتبر نیست.');
    await this.db.transaction(async (manager) => {
      const old = await one<{ firstName: string; lastName: string }>(
        manager,
        'SELECT first_name AS "firstName",last_name AS "lastName" FROM person WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!old) throw new NotFoundException();
      await rows(
        manager,
        `UPDATE person SET first_name=COALESCE($2,first_name),last_name=COALESCE($3,last_name),father_name=COALESCE($4,father_name),birth_date=COALESCE($5::date,birth_date),phone=COALESCE($6,phone),national_id_enc=COALESCE($7,national_id_enc),national_id_hash=COALESCE($8,national_id_hash),availability=COALESCE($9,availability),search_name=$10,verified_at=NULL,verified_by=NULL,updated_at=now() WHERE id=$1`,
        [
          id,
          input.firstName ?? null,
          input.lastName ?? null,
          input.fatherName ?? null,
          input.birthDate ?? null,
          input.phone ?? null,
          input.nationalId
            ? this.crypto.encrypt(input.nationalId, 'national-id')
            : null,
          input.nationalId
            ? this.crypto.nationalIdHash(input.nationalId)
            : null,
          input.availability ?? null,
          normalizePersian(
            `${input.firstName ?? old.firstName} ${input.lastName ?? old.lastName}`,
          ),
        ],
      );
      await this.audit.record(
        actor.personId,
        'person.identity_updated',
        'person',
        id,
        { fieldCount: Object.keys(input).length },
        manager,
      );
    });
    return this.get(actor, id);
  }
  async verify(actor: Actor, id: string): Promise<PersonDto> {
    const resource = await this.access.personResource(id);
    await this.access.require(actor, 'update', resource, 'detail');
    if (!(await this.access.relations(actor, resource)).mentor)
      throw new BadRequestException(
        'تأیید هویت فقط توسط مربی مستقیم انجام می‌شود.',
      );
    await this.db.transaction(async (manager) => {
      await rows(
        manager,
        'UPDATE person SET verified_at=now(),verified_by=$2 WHERE id=$1',
        [id, actor.personId],
      );
      await this.audit.record(
        actor.personId,
        'person.verified',
        'person',
        id,
        {},
        manager,
      );
    });
    return this.get(actor, id);
  }
  async deactivate(actor: Actor, id: string): Promise<void> {
    await this.access.require(
      actor,
      'deactivate',
      await this.access.personResource(id),
      'detail',
    );
    if (id === actor.personId)
      throw new BadRequestException('غیرفعال‌سازی حساب خود مجاز نیست.');
    await this.db.transaction(async (manager) => {
      await rows(manager, 'SELECT pg_advisory_xact_lock(739201)');
      const open = await one<{ blocked: boolean }>(
        manager,
        `SELECT EXISTS(SELECT 1 FROM follow_up_assignment WHERE assistant_person_id=$1 AND to_date IS NULL) OR EXISTS(SELECT 1 FROM organization_group g JOIN membership m ON m.group_id=g.id WHERE g.owner_person_id=$1 AND m.valid_to IS NULL) AS blocked`,
        [id],
      );
      if (open?.blocked)
        throw new ConflictException(
          'ابتدا اعضا و پیگیری‌های باز را واگذار کنید.',
        );
      await rows(
        manager,
        "UPDATE person SET status='left',left_at=now(),purge_after=now()+COALESCE((SELECT keep_days FROM retention_policy WHERE data_type='left_person'),395)*interval '1 day' WHERE id=$1",
        [id],
      );
      await rows(
        manager,
        'UPDATE membership SET valid_to=now() WHERE person_id=$1 AND valid_to IS NULL',
        [id],
      );
      await rows(
        manager,
        'UPDATE follow_up_assignment SET to_date=now() WHERE member_person_id=$1 AND to_date IS NULL',
        [id],
      );
      await rows(
        manager,
        'UPDATE group_role SET valid_to=now() WHERE person_id=$1 AND valid_to IS NULL',
        [id],
      );
      await rows(
        manager,
        'UPDATE parent_link SET active=false,archived_at=now() WHERE child_person_id=$1',
        [id],
      );
      await rows(
        manager,
        'UPDATE auth_session SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id IN (SELECT id FROM app_user WHERE person_id=$1)',
        [id],
      );
      await this.rebuildHierarchy(manager);
      await this.audit.record(
        actor.personId,
        'person.deactivated',
        'person',
        id,
        {},
        manager,
      );
    });
  }
  async rebuildHierarchy(manager: EntityManager): Promise<void> {
    await rows(manager, 'DELETE FROM person_ancestors');
    await rows(
      manager,
      `INSERT INTO person_ancestors(person_id,ancestor_id,depth) WITH RECURSIVE chain(person_id,ancestor_id,depth,path) AS (SELECT m.person_id,g.owner_person_id,1,ARRAY[m.person_id,g.owner_person_id] FROM membership m JOIN organization_group g ON g.id=m.group_id WHERE m.role='member' AND m.valid_to IS NULL UNION ALL SELECT c.person_id,g.owner_person_id,c.depth+1,c.path||g.owner_person_id FROM chain c JOIN membership m ON m.person_id=c.ancestor_id AND m.role='member' AND m.valid_to IS NULL JOIN organization_group g ON g.id=m.group_id WHERE NOT g.owner_person_id=ANY(c.path)) SELECT person_id,ancestor_id,min(depth) FROM chain GROUP BY person_id,ancestor_id`,
    );
  }
}
