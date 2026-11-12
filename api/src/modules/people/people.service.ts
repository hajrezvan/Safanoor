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
import {
  assertSelectableRole,
  listAvailableRoles,
  loadActorWithRole,
  persistActiveRole,
  resolveActiveRole,
} from '../access/active-role';
import { AccessService } from '../access/access.service';
import { Actor } from '../access/access.types';
import { AuditService } from '../audit/audit.service';
import {
  CreatePersonDto,
  MeDto,
  PeoplePageDto,
  PersonDossierDto,
  PersonDossierItemDto,
  PersonDossierSectionDto,
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
    const allowMentor =
      !actor.activeRoleKind || actor.activeRoleKind === 'mentor';
    const allowAssistant =
      !actor.activeRoleKind || actor.activeRoleKind === 'assistant';
    const allowSuperior =
      !actor.activeRoleKind ||
      actor.activeRoleKind === 'supervisor' ||
      actor.activeRoleKind === 'head_mentor';
    const activeGroup = actor.activeGroupId ?? null;
    const scope = `p.status='active' AND (
      p.id=$1
      OR $2
      OR ($4::boolean AND EXISTS(
        SELECT 1 FROM membership m
        JOIN organization_group g ON g.id=m.group_id
        WHERE m.person_id=p.id AND m.role='member' AND m.valid_to IS NULL
          AND g.owner_person_id=$1
          AND ($7::uuid IS NULL OR g.id=$7::uuid)
      ))
      OR ($5::boolean AND EXISTS(
        SELECT 1 FROM follow_up_assignment f
        WHERE f.member_person_id=p.id AND f.assistant_person_id=$1 AND f.to_date IS NULL
          AND ($7::uuid IS NULL OR f.group_id=$7::uuid)
      ))
      OR ($6::boolean AND EXISTS(
        SELECT 1 FROM person_ancestors pa
        WHERE pa.person_id=p.id AND pa.ancestor_id=$1
      ))
    ) AND ($3='' OR p.search_name LIKE '%'||$3||'%')`;
    const params = [
      actor.personId,
      actor.isAdmin,
      normalizePersian(query.search ?? ''),
      allowMentor,
      allowAssistant,
      allowSuperior,
      activeGroup,
    ];
    const count = await one<{ count: string }>(
      this.db,
      `SELECT count(*) FROM person p WHERE ${scope}`,
      params,
    );
    const ids = await rows<{ id: string }>(
      this.db,
      `SELECT p.id FROM person p WHERE ${scope} ORDER BY p.first_name,p.last_name,p.id LIMIT $8 OFFSET $9`,
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
      `SELECT p.id,p.first_name AS "firstName",p.last_name AS "lastName",p.org_level AS "orgLevel",p.status,COALESCE(extract(year FROM age(CURRENT_DATE,p.birth_date))::int,0) AS age,p.availability,(p.verified_at IS NOT NULL) AS verified,m.group_id AS "groupId",COALESCE(owned.name,g.name) AS "groupName"
       FROM person p
       LEFT JOIN LATERAL (
         SELECT name FROM organization_group
         WHERE owner_person_id=p.id
         ORDER BY name,id LIMIT 1
       ) owned ON true
       LEFT JOIN membership m ON m.person_id=p.id AND m.role='member' AND m.valid_to IS NULL
       LEFT JOIN organization_group g ON g.id=m.group_id
       WHERE p.id=$1`,
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
  /**
   * Aggregate person history for the dossier UI. Reuses visibility rules of each
   * domain (never private notes / emergency). Missing backends return available=false.
   */
  async dossier(actor: Actor, id: string): Promise<PersonDossierDto> {
    const person = await this.get(actor, id);
    const limit = 30;
    const [consultations, camps, photos, communications] = await Promise.all([
      this.dossierConsultations(actor, id, limit),
      this.dossierCamps(actor, id, limit),
      this.dossierPhotos(actor, id, limit),
      this.dossierCommunications(actor, id, limit),
    ]);
    const sections: PersonDossierSectionDto[] = [
      { key: 'books', available: false, items: [] },
      { key: 'payments', available: false, items: [] },
      { key: 'camps', available: true, items: camps },
      { key: 'consultations', available: true, items: consultations },
      { key: 'communications', available: true, items: communications },
      { key: 'photos', available: true, items: photos },
    ];
    return { person, sections };
  }

  private async dossierConsultations(
    actor: Actor,
    personId: string,
    limit: number,
  ): Promise<PersonDossierItemDto[]> {
    if (actor.isParent || actor.external) return [];
    const visible = `(
      c.author_id=$1
      OR EXISTS(
        SELECT 1 FROM consultation_member m
        WHERE m.consultation_id=c.id AND m.person_id=$1
      )
      OR EXISTS(
        SELECT 1 FROM organization_group g
        WHERE g.id=c.group_id AND g.owner_person_id=$1
      )
      OR EXISTS(
        SELECT 1 FROM consultation_member m
        JOIN follow_up_assignment f
          ON f.member_person_id=m.person_id
         AND f.assistant_person_id=$1
         AND f.to_date IS NULL
        WHERE m.consultation_id=c.id
      )
    )`;
    return rows<PersonDossierItemDto>(
      this.db,
      `SELECT c.id,
        COALESCE(NULLIF(left(c.shared_summary, 80), ''), g.name) AS title,
        author.first_name||' '||author.last_name AS subtitle,
        c.held_at::text AS at,
        '/consultations' AS href
       FROM consultation c
       JOIN organization_group g ON g.id=c.group_id
       JOIN person author ON author.id=c.author_id
       WHERE ${visible}
         AND EXISTS(
           SELECT 1 FROM consultation_member m
           WHERE m.consultation_id=c.id AND m.person_id=$2
         )
       ORDER BY c.held_at DESC, c.id
       LIMIT $3`,
      [actor.personId, personId, limit],
    );
  }

  private async dossierCamps(
    actor: Actor,
    personId: string,
    limit: number,
  ): Promise<PersonDossierItemDto[]> {
    if (actor.isParent || actor.external) return [];
    const visible = `(
      EXISTS(
        SELECT 1 FROM organization_group g
        WHERE g.id=c.group_id AND g.owner_person_id=$1
      )
      OR EXISTS(
        SELECT 1 FROM membership m
        WHERE m.group_id=c.group_id AND m.person_id=$1 AND m.valid_to IS NULL
      )
    )`;
    return rows<PersonDossierItemDto>(
      this.db,
      `SELECT c.id, c.title,
        COALESCE(c.place, c.status) AS subtitle,
        c.starts_on::text AS at,
        '/camp-attendance' AS href
       FROM camp c
       WHERE ${visible}
         AND EXISTS(
           SELECT 1 FROM camp_participant p
           WHERE p.camp_id=c.id AND p.person_id=$2
         )
       ORDER BY c.starts_on DESC, c.id
       LIMIT $3`,
      [actor.personId, personId, limit],
    );
  }

  private async dossierPhotos(
    actor: Actor,
    personId: string,
    limit: number,
  ): Promise<PersonDossierItemDto[]> {
    const accessible = await rows<{ id: string }>(
      this.db,
      `SELECT DISTINCT g.id FROM organization_group g
       WHERE g.owner_person_id=$1
          OR EXISTS(
            SELECT 1 FROM membership m
            WHERE m.group_id=g.id AND m.person_id=$1 AND m.valid_to IS NULL
          )`,
      [actor.personId],
    );
    const groupIds = accessible.map((row) => row.id);
    if (groupIds.length === 0) return [];
    return rows<PersonDossierItemDto>(
      this.db,
      `SELECT DISTINCT ON (p.created_at, p.id) p.id,
        COALESCE(NULLIF(p.title, ''), g.name) AS title,
        COALESCE(loc.label, p.event_note) AS subtitle,
        p.created_at::text AS at,
        '/group-album' AS href
       FROM photo p
       JOIN photo_group pg ON pg.photo_id=p.id AND pg.hidden_by_group=false
       JOIN organization_group g ON g.id=p.host_group_id
       LEFT JOIN location_option loc ON loc.id=p.location_option_id
       WHERE pg.group_id=ANY($1::uuid[])
         AND EXISTS(
           SELECT 1 FROM photo_tag t
           WHERE t.photo_id=p.id AND t.person_id=$2
         )
       ORDER BY p.created_at DESC, p.id
       LIMIT $3`,
      [groupIds, personId, limit],
    );
  }

  private async dossierCommunications(
    actor: Actor,
    personId: string,
    limit: number,
  ): Promise<PersonDossierItemDto[]> {
    return rows<PersonDossierItemDto>(
      this.db,
      `SELECT t.id,
        CASE
          WHEN t.kind='group' THEN g.name
          ELSE COALESCE(
            (SELECT string_agg(p.first_name||' '||p.last_name, '، ' ORDER BY p.first_name)
               FROM chat_thread_participant cp JOIN person p ON p.id=cp.person_id
               WHERE cp.thread_id=t.id AND cp.person_id<>$2),
            g.name
          )
        END AS title,
        (SELECT m.body FROM chat_message m
          WHERE m.thread_id=t.id
          ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS subtitle,
        (SELECT m.created_at::text FROM chat_message m
          WHERE m.thread_id=t.id
          ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS at,
        '/communications' AS href
       FROM chat_thread t
       JOIN organization_group g ON g.id=t.group_id
       WHERE EXISTS(
           SELECT 1 FROM chat_thread_participant cp
           WHERE cp.thread_id=t.id AND cp.person_id=$2
         )
         AND (
           g.owner_person_id=$1
           OR EXISTS(
             SELECT 1 FROM chat_thread_participant cp
             WHERE cp.thread_id=t.id AND cp.person_id=$1
           )
         )
       ORDER BY COALESCE(
         (SELECT m.created_at FROM chat_message m
           WHERE m.thread_id=t.id ORDER BY m.created_at DESC LIMIT 1),
         t.created_at
       ) DESC, t.id
       LIMIT $3`,
      [actor.personId, personId, limit],
    );
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
      this.access.level(actor, 'read', { type: 'organization_report' }),
      this.access.level(actor, 'read', { type: 'camp' }),
    ]);
    const children = actor.isParent
      ? await rows<{ id: string; name: string }>(
          this.db,
          `SELECT p.id,p.first_name||' '||p.last_name AS name FROM parent_link l JOIN person p ON p.id=l.child_person_id WHERE l.parent_user_id=$1 AND l.active AND p.status='active' AND p.birth_date+interval '18 years'>CURRENT_DATE ORDER BY p.first_name`,
          [actor.userId],
        )
      : [];
    const isAdmin = await this.rawIsAdmin(actor.userId);
    const orgLevel = await this.rawOrgLevel(actor.personId);
    const availableRoles = await listAvailableRoles(this.db, {
      personId: actor.personId,
      userId: actor.userId,
      isAdmin,
      orgLevel,
    });
    const activeRole =
      availableRoles.find((role) => role.id === actor.activeRoleId) ??
      resolveActiveRole(availableRoles, actor.activeRoleId, orgLevel);
    const person = await this.get(actor, actor.personId);
    const nationalIdRow = person.verified
      ? await one<{ encrypted: string | null }>(
          this.db,
          'SELECT national_id_enc AS encrypted FROM person WHERE id=$1',
          [actor.personId],
        )
      : undefined;
    const nationalId = nationalIdRow?.encrypted
      ? this.crypto.decrypt(nationalIdRow.encrypted, 'national-id')
      : undefined;
    return {
      person: {
        ...person,
        ...(nationalId ? { nationalId } : {}),
        orgLevel:
          activeRole.kind === 'technical_manager'
            ? 'technical_manager'
            : activeRole.kind,
        groupId: activeRole.groupId,
        groupName: activeRole.groupName,
      },
      isParent: actor.isParent,
      consentRequired: actor.consentRequired,
      capabilities: {
        viewOrganizationReports: checks[7] !== 'none',
        viewCamps: checks[8] !== 'none',
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
      activeRole,
      availableRoles,
    };
  }

  async setActiveRole(
    actor: Actor,
    sessionId: string,
    roleId: string,
  ): Promise<MeDto> {
    const isAdmin = await this.rawIsAdmin(actor.userId);
    const orgLevel = await this.rawOrgLevel(actor.personId);
    await assertSelectableRole(
      this.db,
      {
        personId: actor.personId,
        userId: actor.userId,
        isAdmin,
        orgLevel,
      },
      roleId,
    );
    await persistActiveRole(this.db, sessionId, actor.userId, roleId);
    const { actor: next } = await loadActorWithRole(
      this.db,
      {
        userId: actor.userId,
        personId: actor.personId,
        isAdmin,
        isParent: actor.isParent,
        external: actor.external,
        orgLevel,
        status: actor.status,
        consentRequired: actor.consentRequired,
      },
      roleId,
    );
    return this.me(next);
  }

  private async rawIsAdmin(userId: string): Promise<boolean> {
    const row = await one<{ isAdmin: boolean }>(
      this.db,
      'SELECT is_admin AS "isAdmin" FROM app_user WHERE id=$1',
      [userId],
    );
    return !!row?.isAdmin;
  }

  private async rawOrgLevel(personId: string): Promise<string> {
    const row = await one<{ orgLevel: string }>(
      this.db,
      'SELECT org_level AS "orgLevel" FROM person WHERE id=$1',
      [personId],
    );
    return row?.orgLevel ?? 'member';
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
          input.fatherName ?? null,
          input.birthDate ?? null,
          input.nationalId
            ? this.crypto.encrypt(input.nationalId, 'national-id')
            : null,
          input.nationalId
            ? this.crypto.nationalIdHash(input.nationalId)
            : null,
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
      if (input.phone !== undefined)
        await rows(manager, 'UPDATE app_user SET login=$2 WHERE person_id=$1', [
          id,
          input.phone,
        ]);
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
