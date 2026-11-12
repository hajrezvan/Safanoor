import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { databaseOptions } from '../src/libs/database/data-source';
import { configureApplication } from '../src/bootstrap';
import { CryptoService } from '../src/libs/security/crypto.service';
import {
  seedHierarchy,
  hierarchyPersonId,
  hierarchyGroupId,
  hierarchyUserId,
} from '../src/seed-hierarchy';
import { seedEveningDemo, eveningId } from '../src/seed-evening-demo';
import { AccessService } from '../src/modules/access/access.service';
import { Actor } from '../src/modules/access/access.types';
import {
  actorFromRole,
  listAvailableRoles,
  roleId,
} from '../src/modules/access/active-role';
import { PolicyGuard } from '../src/modules/access/policy.guard';
import { AuditService } from '../src/modules/audit/audit.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import {
  AssistantMembersPageDto,
  EmergencyCardDto,
} from '../src/modules/assistant/assistant.dto';
import { AssistantController } from '../src/modules/assistant/assistant.controller';
import { AssistantService } from '../src/modules/assistant/assistant.service';
import { ConsultationsService } from '../src/modules/consultations/consultations.service';

describe('Assistant workspace and evening presentation', () => {
  let db: DataSource,
    app: INestApplication,
    access: AccessService,
    actor: Actor,
    assistant: Actor;
  const identity: Actor = {
    personId: hierarchyPersonId(12),
    userId: hierarchyUserId(12),
    isAdmin: true,
    isParent: false,
    external: false,
    orgLevel: 'mentor',
    status: 'active',
    consentRequired: false,
  };
  const group = hierarchyGroupId(27);
  const call = (method: 'get' | 'post' | 'patch', path: string) =>
    request(app.getHttpServer() as import('http').Server)[method](
      `/api/v1/assistant${path}`,
    );
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!url.pathname.endsWith('_test'))
      throw new Error('Test database required');
    url.pathname = url.pathname.replace(/_test$/, '_assistant_test');
    const adminUrl = new URL(url);
    adminUrl.pathname = '/postgres';
    const pg = new Client({ connectionString: adminUrl.toString() });
    await pg.connect();
    const name = url.pathname.slice(1);
    if (
      !(await pg.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]))
        .rowCount
    )
      await pg.query(`CREATE DATABASE "${name}"`);
    await pg.end();
    db = new DataSource({ ...databaseOptions, url: url.toString() });
    await db.initialize();
    await db.query('DROP SCHEMA public CASCADE');
    await db.query('CREATE SCHEMA public');
    await db.runMigrations();
    await seedHierarchy(db);
    await seedEveningDemo(db);
    await seedEveningDemo(db);
    const audit = new AuditService(db);
    access = new AccessService(db, audit);
    const roles = await listAvailableRoles(db, identity);
    assistant = actorFromRole(
      identity,
      roles.find((r) => r.id === roleId('assistant', group))!,
    );
    actor = assistant;
    const module = await Test.createTestingModule({
      controllers: [AssistantController],
      providers: [
        AssistantService,
        { provide: DataSource, useValue: db },
        { provide: AccessService, useValue: access },
        { provide: AuditService, useValue: audit },
        CryptoService,
        NotificationsService,
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureApplication(app);
    app.use((req: { actor: Actor }, _res: unknown, next: () => void) => {
      req.actor = actor;
      next();
    });
    app.useGlobalGuards(new PolicyGuard(new Reflector(), access));
    await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
    if (db?.isInitialized) await db.destroy();
  });
  beforeEach(() => {
    actor = assistant;
  });
  it('adds exactly 12 fictional members, 24 consultations and 60 messages idempotently', async () => {
    for (const [table, count] of [
      ['person', 12],
      ['consultation', 24],
      ['chat_message', 60],
    ] as const)
      expect(
        (
          await db.query<{ n: number }[]>(
            `SELECT count(*)::int AS n FROM ${table} WHERE id::text LIKE '81000000-%'`,
          )
        )[0].n,
      ).toBe(count);
    expect(
      (
        await db.query<{ n: number }[]>(
          'SELECT count(*)::int AS n FROM app_user WHERE is_director',
        )
      )[0].n,
    ).toBe(0);
  });
  it('returns only assigned members, real recorded attendance and paginated workload', async () => {
    const summary = await call('get', '/summary').expect(200);
    expect(summary.body).toMatchObject({
      memberCount: 6,
      openTasks: 5,
      pendingFollowups: 5,
      campDuties: 1,
    });
    const response = await call('get', '/members?limit=2&page=1').expect(200);
    expect((response.body as AssistantMembersPageDto).total).toBe(6);
    expect((response.body as AssistantMembersPageDto).items).toHaveLength(2);
    expect((response.body as AssistantMembersPageDto).items[0]).toMatchObject({
      recordedSessions: 4,
      attendanceRate: 75,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /contact_enc|address|medical|nationalId|phone/,
    );
  });
  it('denies assistant endpoints to the member, technical manager and reporting roles', async () => {
    const roles = await listAvailableRoles(db, identity);
    for (const kind of ['member', 'technical_manager', 'mentor'] as const) {
      actor = actorFromRole(identity, roles.find((r) => r.kind === kind)!);
      for (const route of [
        '/summary',
        '/members',
        '/items',
        '/sessions',
        '/duties',
      ])
        await call('get', route).expect(403);
    }
    actor = { ...assistant, activeRoleKind: 'director', activeGroupId: null };
    await call('get', '/summary').expect(403);
  });
  it('creates, completes and reopens work only for currently assigned members', async () => {
    const input = {
      groupId: group,
      memberId: eveningId(1),
      kind: 'followup',
      title: 'پیگیری آزمایشی آزمون',
      dueAt: new Date().toISOString(),
    };
    await call('post', '/items')
      .send({ ...input, memberId: eveningId(7) })
      .expect(403);
    await call('post', '/items')
      .send({ ...input, title: ' ' })
      .expect(400);
    await call('post', '/items').send(input).expect(200);
    const item = (
      await db.query<{ id: string }[]>(
        'SELECT id FROM follow_up_item WHERE title=$1',
        [input.title],
      )
    )[0];
    await call('patch', `/items/${item.id}`)
      .send({ completed: true })
      .expect(200);
    expect(
      (
        await db.query<{ completed_at: Date | null }[]>(
          'SELECT completed_at FROM follow_up_item WHERE id=$1',
          [item.id],
        )
      )[0].completed_at,
    ).not.toBeNull();
    await call('patch', `/items/${item.id}`)
      .send({ completed: false })
      .expect(200);
    await call('patch', `/items/${eveningId(712)}`)
      .send({ completed: true })
      .expect(403);
  });
  it('persists attendance and refuses another group or an unassigned member', async () => {
    const input = {
      sessionId: eveningId(800),
      memberId: eveningId(1),
      present: true,
    };
    await call('post', '/attendance').send(input).expect(200);
    const roster = await call(
      'get',
      `/members?sessionId=${input.sessionId}`,
    ).expect(200);
    expect(
      (roster.body as AssistantMembersPageDto).items.find(
        (r: { id: string }) => r.id === input.memberId,
      )!.present,
    ).toBe(true);
    await call('post', '/attendance')
      .send({ ...input, memberId: eveningId(7) })
      .expect(403);
    await call('post', '/attendance')
      .send({ ...input, sessionId: eveningId(810) })
      .expect(403);
    await call('get', `/members?sessionId=${eveningId(810)}`).expect(403);
  });
  it('requires an emergency reason, encrypts data at rest, logs reads and informs the mentor', async () => {
    await call('post', `/members/${eveningId(1)}/emergency`)
      .send({})
      .expect(400);
    await call('post', `/members/${eveningId(7)}/emergency`)
      .send({ reasonCode: 'urgent_contact' })
      .expect(403);
    const response = await call('post', `/members/${eveningId(1)}/emergency`)
      .send({ reasonCode: 'urgent_contact' })
      .expect(200);
    expect((response.body as EmergencyCardDto).contact).toContain('نمایشی');
    expect((response.body as EmergencyCardDto).address).toBeNull();
    expect(
      (
        await db.query<{ contact_enc: string }[]>(
          'SELECT contact_enc FROM person_emergency WHERE person_id=$1',
          [eveningId(1)],
        )
      )[0].contact_enc,
    ).not.toContain('نمایشی');
    expect(
      await db.query(
        'SELECT reason_code FROM emergency_access_log WHERE person_id=$1',
        [eveningId(1)],
      ),
    ).toEqual([{ reason_code: 'urgent_contact' }]);
    expect(
      await db.query(
        "SELECT id FROM notification WHERE recipient_id=$1 AND type='emergency.opened'",
        [hierarchyPersonId(37)],
      ),
    ).toHaveLength(1);
  });
  it('keeps consultations in the selected group and resolves assistant note role per group', async () => {
    const consultations = new ConsultationsService(
      db,
      access,
      new AuditService(db),
    );
    const list = await consultations.list(assistant, { page: 1, limit: 100 });
    expect(list.items.length).toBeGreaterThanOrEqual(12);
    expect(list.items.every((i) => i.groupId === group)).toBe(true);
    const resource = await access.resolve(
      'consultation_private_note',
      eveningId(300),
      assistant,
    );
    expect(resource.ownerRole).toBe('assistant');
    const mentorIdentity = {
      ...identity,
      personId: hierarchyPersonId(37),
      userId: hierarchyUserId(37),
      isAdmin: false,
    };
    const roles = await listAvailableRoles(db, mentorIdentity);
    const mentor = actorFromRole(
      mentorIdentity,
      roles.find((r) => r.id === roleId('mentor', group))!,
    );
    expect(await access.level(mentor, 'read', resource)).toBe('detail');
    expect(
      await access.level(
        {
          ...assistant,
          activeRoleKind: 'member',
          activeGroupId: hierarchyGroupId(20),
        },
        'read',
        resource,
      ),
    ).toBe('none');
  });
  it('limits camp emergency rosters to assigned participants in the same group', async () => {
    const roster = await call(
      'get',
      `/members?campId=${eveningId(900)}`,
    ).expect(200);
    expect((roster.body as AssistantMembersPageDto).total).toBe(6);
    await call('get', `/members?campId=${hierarchyGroupId(33)}`).expect(403);
  });
  it('preserves private-note author role after group ownership changes', async () => {
    await db.transaction(async (manager) => {
      await manager.query(
        'UPDATE organization_group SET owner_person_id=$2 WHERE id=$1',
        [group, assistant.personId],
      );
      expect(
        (
          await manager.query<{ author_role: string }[]>(
            'SELECT author_role FROM consultation WHERE id=$1',
            [eveningId(300)],
          )
        )[0].author_role,
      ).toBe('assistant');
      await manager.query(
        'UPDATE organization_group SET owner_person_id=$2 WHERE id=$1',
        [group, hierarchyPersonId(37)],
      );
    });
    await expect(
      db.query("UPDATE consultation SET author_role='mentor' WHERE id=$1", [
        eveningId(300),
      ]),
    ).rejects.toThrow('consultation_author_role_is_immutable');
  });
  it('creates attendance programs only as group mentor, and edits only the responsible duty', async () => {
    const input = {
      groupId: group,
      title: 'برنامهٔ آزمون',
      startsAt: new Date().toISOString(),
    };
    await call('post', '/sessions').send(input).expect(403);
    const service = app.get(AssistantService);
    const mentorIdentity = {
      ...identity,
      personId: hierarchyPersonId(37),
      userId: hierarchyUserId(37),
      isAdmin: false,
    };
    const roles = await listAvailableRoles(db, mentorIdentity);
    actor = actorFromRole(
      mentorIdentity,
      roles.find((r) => r.id === roleId('mentor', group))!,
    );
    await call('post', '/sessions').send(input).expect(200);
    actor = assistant;
    const duty = (await service.duties(actor, { page: 1, limit: 20 })).items[0];
    await call('patch', `/duties/${duty.id}`)
      .send({ title: 'برنامهٔ اصلاح‌شده', day: duty.day })
      .expect(200);
    await call('patch', `/duties/${duty.id}`)
      .send({ title: 'برنامهٔ اصلاح‌شده', day: '2020-01-01' })
      .expect(400);
    await db.query(
      'UPDATE camp_schedule_item SET responsible_person_id=NULL WHERE id=$1',
      [duty.id],
    );
    await call('patch', `/duties/${duty.id}`)
      .send({ title: 'برنامهٔ بدون مسئول', day: duty.day })
      .expect(403);
    await db.query(
      'UPDATE camp_schedule_item SET responsible_person_id=$2 WHERE id=$1',
      [duty.id, hierarchyPersonId(3)],
    );
    await call('patch', `/duties/${duty.id}`)
      .send({ title: 'برنامهٔ اصلاح‌شده', day: duty.day })
      .expect(403);
  });
  it('sends due reminders once and scopes them to the active follow-up assistant', async () => {
    const notifications = new NotificationsService(db, access);
    await notifications.remindFollowUps();
    await notifications.remindFollowUps();
    const reminders = await db.query<
      { recipient_id: string; dedupe_key: string }[]
    >(
      "SELECT recipient_id,dedupe_key FROM notification WHERE type='followup.due'",
    );
    expect(reminders.length).toBeGreaterThan(0);
    expect(reminders.every((n) => n.recipient_id === assistant.personId)).toBe(
      true,
    );
    expect(new Set(reminders.map((n) => n.dedupe_key)).size).toBe(
      reminders.length,
    );
  });
  it('revokes roster and item access immediately when follow-up is reassigned', async () => {
    await db.query(
      'UPDATE follow_up_assignment SET to_date=now() WHERE member_person_id=$1 AND to_date IS NULL',
      [eveningId(6)],
    );
    const roster = await call('get', '/members').expect(200);
    expect((roster.body as AssistantMembersPageDto).total).toBe(5);
    await call('patch', `/items/${eveningId(710)}`)
      .send({ completed: true })
      .expect(403);
    await call('post', `/members/${eveningId(6)}/emergency`)
      .send({ reasonCode: 'urgent_contact' })
      .expect(403);
  });
});
