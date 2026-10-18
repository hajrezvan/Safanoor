import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../src/libs/database/data-source';
import { one, rows } from '../src/libs/database/database.types';
import { CryptoService } from '../src/libs/security/crypto.service';
import { demoId, DEMO_PASSWORD } from '../src/seed';
import { seedDemo } from '../src/seed-demo';
import { demoAccountNumbers, demoFixtureId } from '../src/demo/fixtures';
import { AccessService } from '../src/modules/access/access.service';
import { Actor } from '../src/modules/access/access.types';
import { GrantsService } from '../src/modules/access/grants.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { PasswordProvider } from '../src/modules/auth/password.provider';
import { ImportsService } from '../src/modules/imports/imports.service';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PeopleService } from '../src/modules/people/people.service';

describe('Presentation data with PostgreSQL', () => {
  let db: DataSource;
  let audit: AuditService;
  let access: AccessService;
  let notifications: NotificationsService;
  let imports: ImportsService;
  let grants: GrantsService;
  const actors = new Map<number, Actor>();

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!url.pathname.endsWith('_test'))
      throw new Error('A test database is required');
    url.pathname = url.pathname.replace(/_test$/, '_demo_test');
    const name = url.pathname.slice(1);
    const adminUrl = new URL(url);
    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    if (
      !(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]))
        .rowCount
    )
      await admin.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
    await admin.end();
    db = new DataSource({ ...databaseOptions, url: url.toString() });
    await db.initialize();
    await db.query('DROP SCHEMA public CASCADE');
    await db.query('CREATE SCHEMA public');
    await db.runMigrations();
    await seedDemo(db);
    audit = new AuditService(db);
    access = new AccessService(db, audit);
    notifications = new NotificationsService(db, access);
    const crypto = new CryptoService();
    const people = new PeopleService(db, access, crypto, audit);
    imports = new ImportsService(
      db,
      access,
      crypto,
      audit,
      new JobsService(),
      people,
      notifications,
    );
    grants = new GrantsService(db, access, audit, notifications, crypto);
    const records = await rows<Actor>(
      db,
      `SELECT u.id AS "userId",p.id AS "personId",u.is_admin AS "isAdmin",u.is_parent AS "isParent",
       p.external,p.org_level AS "orgLevel",p.status,p.consent_required AS "consentRequired"
       FROM app_user u JOIN person p ON p.id=u.person_id`,
    );
    for (const record of records)
      actors.set(Number(record.personId.slice(-12)), record);
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  it('prepares every demo account without adding people or changing their passwords', async () => {
    expect(
      (await one<{ count: string }>(db, 'SELECT count(*) FROM person'))?.count,
    ).toBe('22');
    expect(actors.size).toBe(demoAccountNumbers.length);
    const passwords = await rows<{ hash: string }>(
      db,
      'SELECT password_hash AS hash FROM app_user',
    );
    const provider = new PasswordProvider();
    for (const password of passwords)
      expect(await provider.verify(password.hash, DEMO_PASSWORD)).toBe(true);
    for (const actor of actors.values()) {
      const feed = await notifications.list(actor, { page: 1, limit: 15 });
      expect(feed.total).toBe(6);
      expect(feed.items.filter((item) => !item.readAt).length).toBeGreaterThan(
        0,
      );
      expect(feed.items.filter((item) => !!item.readAt).length).toBeGreaterThan(
        0,
      );
      expect(new Set(feed.items.map((item) => item.type)).size).toBe(6);
    }
    const identities = await rows<{
      father: string;
      verified: boolean;
      birth: string;
    }>(
      db,
      `SELECT father_name AS father,verified_at IS NOT NULL AS verified,to_char(birth_date,'MM-DD') AS birth
       FROM person WHERE NOT external`,
    );
    expect(new Set(identities.map((item) => item.father)).size).toBeGreaterThan(
      3,
    );
    expect(new Set(identities.map((item) => item.birth)).size).toBeGreaterThan(
      3,
    );
    expect(identities.some((item) => item.verified)).toBe(true);
    expect(identities.some((item) => !item.verified)).toBe(true);
    expect(
      (
        await one<{ count: string }>(
          db,
          'SELECT count(*) FROM person WHERE external AND (birth_date IS NOT NULL OR national_id_enc IS NOT NULL)',
        )
      )?.count,
    ).toBe('0');
    expect(
      (
        await one<{ required: boolean }>(
          db,
          'SELECT consent_required AS required FROM person WHERE id=$1',
          [demoId(15)],
        )
      )?.required,
    ).toBe(true);
  });

  it('keeps import previews and referrals inside the real access policy', async () => {
    const stages = await rows<{ status: string; count: string }>(
      db,
      'SELECT status,count(*) FROM import_job GROUP BY status',
    );
    expect(
      Object.fromEntries(
        stages.map((item) => [item.status, Number(item.count)]),
      ),
    ).toEqual({ completed: 3, ready: 3, invalid: 3 });
    const readyId = demoFixtureId(4, 31);
    const preview = await imports.preview(actors.get(3)!, readyId, {
      page: 1,
      limit: 15,
    });
    expect(preview.items).toHaveLength(2);
    expect(
      preview.items.every((item) => item.nationalIdMasked.startsWith('••••••')),
    ).toBe(true);
    await expect(
      imports.preview(actors.get(4)!, readyId, { page: 1, limit: 15 }),
    ).rejects.toThrow();
    await expect(
      imports.preview(actors.get(11)!, readyId, { page: 1, limit: 15 }),
    ).rejects.toThrow();
    const referred = await access.resolve(
      'person_file',
      demoFixtureId(8, 1),
      actors.get(1)!,
    );
    expect(await access.level(actors.get(1)!, 'read', referred)).toBe('detail');
    expect(await access.level(actors.get(40)!, 'read', referred)).toBe('none');
    const supervisorGrants = await grants.list(actors.get(1)!, {
      page: 1,
      limit: 15,
    });
    expect(
      supervisorGrants.items.filter((item) => !item.revokedAt),
    ).toHaveLength(2);
    expect(
      supervisorGrants.items.filter((item) => !!item.revokedAt),
    ).toHaveLength(1);
  });

  it('allows a ready sample import to complete through the actual service', async () => {
    const id = demoFixtureId(4, 401);
    await rows(
      db,
      "UPDATE import_job SET status='committing',confirmed_at=now() WHERE id=$1",
      [id],
    );
    await imports.commit(id);
    expect(
      (
        await one<{ status: string }>(
          db,
          'SELECT status FROM import_job WHERE id=$1',
          [id],
        )
      )?.status,
    ).toBe('completed');
    expect(
      (await one<{ count: string }>(db, 'SELECT count(*) FROM person'))?.count,
    ).toBe('24');
    await imports.commit(id);
    expect(
      (await one<{ count: string }>(db, 'SELECT count(*) FROM person'))?.count,
    ).toBe('24');
  });

  it('preserves edited data, read messages, revoked grants and finished imports when rerun', async () => {
    await rows(
      db,
      "UPDATE person SET first_name='نام ویرایش‌شده',father_name='نام پدر ویرایش‌شده' WHERE id=$1",
      [demoId(11)],
    );
    await rows(db, 'UPDATE notification SET read_at=now() WHERE id=$1', [
      demoFixtureId(6, 110),
    ]);
    await grants.revoke(actors.get(3)!, demoFixtureId(7, 1));
    await rows(db, 'UPDATE app_user SET failed_attempts=3 WHERE person_id=$1', [
      demoId(11),
    ]);
    const before = await one<{
      notifications: string;
      audits: string;
      records: string;
    }>(
      db,
      `SELECT (SELECT count(*) FROM notification) AS notifications,
       (SELECT count(*) FROM audit_log) AS audits,(SELECT count(*) FROM consent_record) AS records`,
    );
    await seedDemo(db);
    await seedDemo(db);
    expect(
      await one(
        db,
        `SELECT (SELECT count(*) FROM notification) AS notifications,
       (SELECT count(*) FROM audit_log) AS audits,(SELECT count(*) FROM consent_record) AS records`,
      ),
    ).toEqual(before);
    expect(
      (
        await one<{ first: string }>(
          db,
          'SELECT first_name AS first FROM person WHERE id=$1',
          [demoId(11)],
        )
      )?.first,
    ).toBe('نام ویرایش‌شده');
    expect(
      (
        await one<{ readAt: Date }>(
          db,
          'SELECT read_at AS "readAt" FROM notification WHERE id=$1',
          [demoFixtureId(6, 110)],
        )
      )?.readAt,
    ).toBeTruthy();
    expect(
      (
        await one<{ revokedAt: Date }>(
          db,
          'SELECT revoked_at AS "revokedAt" FROM access_grant WHERE id=$1',
          [demoFixtureId(7, 1)],
        )
      )?.revokedAt,
    ).toBeTruthy();
    expect(
      (
        await one<{ attempts: number }>(
          db,
          'SELECT failed_attempts AS attempts FROM app_user WHERE person_id=$1',
          [demoId(11)],
        )
      )?.attempts,
    ).toBe(3);
    expect(
      (await one<{ count: string }>(db, 'SELECT count(*) FROM person'))?.count,
    ).toBe('24');
    expect(
      (
        await one<{ status: string }>(
          db,
          'SELECT status FROM import_job WHERE id=$1',
          [demoFixtureId(4, 401)],
        )
      )?.status,
    ).toBe('completed');
  });

  it('refuses production without changing the database', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(seedDemo(db)).rejects.toThrow('disabled in production');
    } finally {
      process.env.NODE_ENV = previous;
    }
    expect(
      (await one<{ count: string }>(db, 'SELECT count(*) FROM person'))?.count,
    ).toBe('24');
  });
});
