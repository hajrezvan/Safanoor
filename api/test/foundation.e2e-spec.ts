import {
  DirectorSummaryDto,
  DirectorPeoplePageDto,
} from '../src/modules/dashboard/director.dto';
import { AlbumsPageDto, PhotosPageDto } from '../src/modules/album/album.dto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Client } from 'pg';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { AvatarStateDto, MeDto } from '../src/modules/people/people.dto';
import { STORAGE, StorageAdapter } from '../src/modules/files/storage';
import { consentItems } from '@safanoor/shared';
import { AppModule } from '../src/app.module';
import { configureApplication, openApiDocument } from '../src/bootstrap';
import { databaseOptions } from '../src/libs/database/data-source';
import { one, rows } from '../src/libs/database/database.types';
import {
  seed,
  demoId,
  demoGroupId,
  demoNationalId,
  DEMO_PASSWORD,
} from '../src/seed';
import { ImportsService } from '../src/modules/imports/imports.service';
import { AgeTransitionService } from '../src/modules/jobs/age-transition.service';
import {
  FinanceDemoDto,
  MemberFinanceDto,
} from '../src/modules/finance/finance.dto';
import { StudyPathDetailDto } from '../src/modules/library/library.dto';
import { requiredConsentItems } from '@safanoor/shared';

interface Login {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}
describe('Foundation with PostgreSQL', () => {
  let app: INestApplication;
  let db: DataSource;
  const tokens = new Map<number, Login>();
  const server = () => app.getHttpServer() as import('http').Server;
  const call = (n: number, method: 'get' | 'post' | 'patch', path: string) =>
    request(server())
      [method](`/api/v1${path}`)
      .set('authorization', `Bearer ${tokens.get(n)!.accessToken}`)
      .set('x-client-type', 'native');
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!url.pathname.endsWith('_test'))
      throw new Error('Refusing to reset a non-test database');
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
    const setup = new DataSource({ ...databaseOptions, url: url.toString() });
    await setup.initialize();
    await setup.query('DROP SCHEMA IF EXISTS pgboss CASCADE');
    await setup.query('DROP SCHEMA public CASCADE');
    await setup.query('CREATE SCHEMA public');
    await setup.runMigrations();
    await seed(setup);
    await seed(setup);
    await setup.destroy();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
    db = app.get(DataSource);
    for (const n of [1, 2, 3, 4, 5, 7, 11, 15, 31, 32, 40]) {
      const response = await request(server())
        .post('/api/v1/auth/login')
        .set('x-client-type', 'native')
        .send({
          login: `+98910${String(n).padStart(7, '0')}`,
          password: DEMO_PASSWORD,
        })
        .expect(200);
      tokens.set(n, response.body as Login);
    }
  });
  afterAll(async () => {
    if (app) await app.close();
  });
  it('seed is idempotent and preserves dual assistant membership', async () => {
    expect(
      (await one<{ count: string }>(db, 'SELECT count(*) FROM person'))?.count,
    ).toBe('22');
    expect(
      (
        await rows(
          db,
          'SELECT role FROM membership WHERE person_id=$1 AND valid_to IS NULL',
          [demoId(5)],
        )
      ).length,
    ).toBe(2);
  });
  it('uploads private avatars, strips metadata, rejects invalid files and isolates owners', async () => {
    const avatar = (n: number) =>
      request(server())
        .post('/api/v1/people/me/avatar')
        .set('authorization', `Bearer ${tokens.get(n)!.accessToken}`)
        .set('x-client-type', 'native');
    await call(11, 'get', '/people/me/avatar').expect(404);
    const image = await sharp({
      create: { width: 120, height: 160, channels: 3, background: '#126452' },
    })
      .jpeg()
      .withMetadata()
      .toBuffer();
    await request(server())
      .post('/api/v1/people/me/avatar')
      .set('x-client-type', 'native')
      .attach('file', image, 'avatar.jpg')
      .expect(401);
    const uploaded = await avatar(11)
      .attach('file', image, 'avatar.jpg')
      .expect(200);
    const state = uploaded.body as AvatarStateDto;
    expect(state.canUploadAvatar).toBe(true);
    expect(state.avatarUrl).toMatch(/^\/api\/v1\/people\/me\/avatar\?v=/);
    const me = await call(11, 'get', '/people/me').expect(200);
    expect((me.body as MeDto).avatarUrl).toBe(state.avatarUrl);
    const content = await call(11, 'get', '/people/me/avatar')
      .expect(200)
      .expect('Content-Type', /image\/webp/);
    expect(content.headers['cache-control']).toBe('private, no-store');
    const output = await sharp(content.body as Buffer).metadata();
    expect(output).toMatchObject({ format: 'webp', width: 512, height: 512 });
    expect(output.exif).toBeUndefined();
    expect(output.xmp).toBeUndefined();
    await call(5, 'get', `/people/me/avatar?personId=${demoId(11)}`).expect(
      404,
    );
    await call(5, 'get', `/people/${demoId(11)}/avatar`).expect(404);
    await request(server()).get('/api/v1/people/me/avatar').expect(401);
    await avatar(15).attach('file', image, 'avatar.jpg').expect(403);
    await avatar(11)
      .attach('file', Buffer.from('<html>bad image</html>'), 'avatar.png')
      .expect(400);
    await avatar(11)
      .attach(
        'file',
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>',
        ),
        'avatar.png',
      )
      .expect(400);
    await avatar(11)
      .attach('file', Buffer.alloc(2 * 1024 * 1024 + 1), 'large.png')
      .expect(413);
    const retained = await call(11, 'get', '/people/me').expect(200);
    expect((retained.body as MeDto).avatarUrl).toBe(state.avatarUrl);
    const next = await avatar(11)
      .attach('file', image, 'replacement.jpg')
      .expect(200);
    expect((next.body as AvatarStateDto).avatarUrl).not.toBe(state.avatarUrl);
    const expired = await one<{ purge: Date | null }>(
      db,
      'SELECT purge_after AS purge FROM file_record WHERE id=$1',
      [state.avatarUrl!.split('v=')[1]],
    );
    expect(expired?.purge).not.toBeNull();
  });
  it('authorizes multipart album uploads before parsing the file and rejects mismatched groups', async () => {
    const group = demoGroupId(3);
    const image = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#126452' },
    })
      .png()
      .toBuffer();
    const upload = (n: number, scope: string) =>
      request(server())
        .post(`/api/v1/album/photos${scope}`)
        .set('authorization', `Bearer ${tokens.get(n)!.accessToken}`)
        .set('x-client-type', 'native');
    await upload(3, '')
      .field('groupId', group)
      .attach('file', image, 'sample.png')
      .expect(400);
    await upload(3, '?groupId=invalid')
      .field('groupId', group)
      .attach('file', image, 'sample.png')
      .expect(400);
    await upload(11, `?groupId=${group}`)
      .field('groupId', group)
      .attach('file', image, 'sample.png')
      .expect(403);
    await upload(3, `?groupId=${demoGroupId(4)}`)
      .field('groupId', demoGroupId(4))
      .attach('file', image, 'sample.png')
      .expect(403);
    await upload(3, `?groupId=${group}`)
      .field('groupId', demoGroupId(4))
      .attach('file', image, 'sample.png')
      .expect(400);
    const uploaded = await upload(3, `?groupId=${group}`)
      .field('groupId', group)
      .field('taggedPersonIds', JSON.stringify([demoId(11)]))
      .attach('file', image, 'sample.png')
      .expect(200);
    const photo = uploaded.body as { id: string };
    await db.query(
      "UPDATE photo SET album_title='آلبوم من',created_at='2025-01-01' WHERE id=$1",
      [photo.id],
    );
    const others: string[] = [];
    for (let index = 0; index < 2; index++) {
      const response = await upload(3, `?groupId=${group}`)
        .field('groupId', group)
        .field('albumTitle', 'آلبوم پرعکس')
        .attach('file', image, 'other.png')
        .expect(200);
      others.push((response.body as { id: string }).id);
    }
    await db.query(
      "UPDATE photo SET created_at='2020-01-01' WHERE id=ANY($1::uuid[])",
      [others],
    );
    const many = await call(11, 'get', '/album/albums?sort=most_photos').expect(
      200,
    );
    expect((many.body as AlbumsPageDto).items[0]).toMatchObject({
      title: 'آلبوم پرعکس',
      photoCount: 2,
    });
    const privatePhoto = await upload(4, `?groupId=${demoGroupId(4)}`)
      .field('groupId', demoGroupId(4))
      .field('albumTitle', 'آلبوم نامرتبط')
      .attach('file', image, 'private.png')
      .expect(200);
    await db.query(
      'INSERT INTO photo_tag(photo_id,person_id,tagged_by) VALUES($1,$2,$3)',
      [(privatePhoto.body as { id: string }).id, demoId(11), demoId(4)],
    );
    const mine = await call(11, 'get', '/album/albums?myOnly=true').expect(200);
    expect((mine.body as AlbumsPageDto).items).toHaveLength(1);
    expect((mine.body as AlbumsPageDto).items[0]).toMatchObject({
      title: 'آلبوم من',
      photoCount: 1,
      coverPhotoId: photo.id,
    });
    const oldest = await call(11, 'get', '/album/albums?sort=oldest').expect(
      200,
    );
    expect((oldest.body as AlbumsPageDto).items[0].title).toBe('آلبوم پرعکس');
    const newest = await call(
      11,
      'get',
      '/album/albums?myOnly=false&sort=newest',
    ).expect(200);
    expect((newest.body as AlbumsPageDto).items[0].title).toBe('آلبوم من');
    const ownPhotos = await call(11, 'get', '/album/photos?myOnly=true').expect(
      200,
    );
    expect(
      (ownPhotos.body as PhotosPageDto).items.map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual([photo.id]);
    const unrelated = await call(4, 'get', '/album/albums?myOnly=true').expect(
      200,
    );
    expect((unrelated.body as AlbumsPageDto).items).toHaveLength(0);
    await call(11, 'get', '/album/albums?sort=invalid').expect(400);
    await call(11, 'get', '/album/photos?myOnly=invalid').expect(400);

    await call(11, 'get', `/album/photos/${photo.id}/content`)
      .expect(200)
      .expect('Content-Type', /image\/png/);
    await call(4, 'get', `/album/photos/${photo.id}/content`).expect(403);
    await request(server())
      .get(`/api/v1/album/photos/${photo.id}/content`)
      .expect(401);
  });
  it('hides and denies camps in member role while retaining mentor and assistant access', async () => {
    const groupId = demoGroupId(3);
    const camp = await one<{ id: string }>(
      db,
      `INSERT INTO camp(group_id,organizer_person_id,title,starts_on,ends_on,created_by) VALUES($1,$2,'اردوی آزمون دسترسی','2026-11-15','2026-11-16',$2) RETURNING id`,
      [groupId, demoId(3)],
    );
    try {
      const member = (await call(11, 'get', '/people/me').expect(200))
        .body as MeDto;
      expect(member.capabilities.viewCamps).toBe(false);
      await call(11, 'get', '/camps').expect(403);
      await call(11, 'get', `/camps?groupId=${groupId}`).expect(403);
      await call(11, 'get', `/camps/${camp!.id}`).expect(403);
      await call(11, 'post', '/camps').send({}).expect(403);
      for (const n of [3, 5]) {
        const staff = (await call(n, 'get', '/people/me').expect(200))
          .body as MeDto;
        expect(staff.capabilities.viewCamps).toBe(true);
        await call(n, 'get', `/camps?groupId=${groupId}`).expect(200);
        await call(n, 'get', `/camps/${camp!.id}`).expect(200);
      }
    } finally {
      await db.query('DELETE FROM camp WHERE id=$1', [camp!.id]);
    }
  });

  it('isolates the unassigned read-only director role and returns only safe organization reports', async () => {
    await call(11, 'get', '/dashboard/organization').expect(403);
    await call(40, 'get', '/dashboard/organization').expect(403);
    await call(11, 'post', '/people/me/active-role')
      .send({ roleId: 'director' })
      .expect(400);
    expect(
      (
        await one<{ count: string }>(
          db,
          'SELECT count(*) FROM app_user WHERE is_director',
        )
      )?.count,
    ).toBe('0');
    await db.query('UPDATE app_user SET is_director=true WHERE person_id=$1', [
      demoId(11),
    ]);
    try {
      const me = (
        await call(11, 'post', '/people/me/active-role')
          .send({ roleId: 'director' })
          .expect(200)
      ).body as MeDto;
      expect(me.activeRole?.kind).toBe('director');
      expect(me.capabilities.viewOrganizationReports).toBe(true);
      expect(me.capabilities.managePeople).toBe(false);
      expect(me.capabilities.importPeople).toBe(false);
      const summary = (
        await call(11, 'get', '/dashboard/organization').expect(200)
      ).body as DirectorSummaryDto;
      expect(
        summary.metrics.find((metric) => metric.key === 'people')?.count,
      ).toBeGreaterThan(0);
      const people = (
        await call(11, 'get', '/dashboard/organization/people?limit=2').expect(
          200,
        )
      ).body as DirectorPeoplePageDto;
      expect(people.items).toHaveLength(2);
      for (const person of people.items)
        expect(Object.keys(person).sort()).toEqual([
          'groupName',
          'id',
          'name',
          'orgLevel',
        ]);
      await call(11, 'get', '/dashboard/organization/people?limit=101').expect(
        400,
      );
      await call(11, 'get', `/people/${demoId(7)}`).expect(403);
      await call(
        11,
        'get',
        `/groups/${demoGroupId(3)}/finance/destinations`,
      ).expect(403);
      await call(11, 'post', '/people').send({}).expect(403);
      await call(11, 'post', '/groups').send({}).expect(403);
      await call(11, 'patch', `/people/${demoId(11)}`)
        .send({ firstName: 'ممنوع' })
        .expect(403);
      // Membership role remains usable after switching back; powers do not merge.
      await call(11, 'post', '/people/me/active-role')
        .send({ roleId: `member:${demoGroupId(3)}` })
        .expect(200);
      await call(11, 'get', '/dashboard/organization').expect(403);
    } finally {
      await db.query(
        'UPDATE app_user SET is_director=false WHERE person_id=$1',
        [demoId(11)],
      );
    }
  });

  it('serves fictional finance samples only in development and denies privileged or parent scopes', async () => {
    const original = process.env.NODE_ENV;
    try {
      await call(11, 'get', '/finance/demo').expect(404);
      process.env.NODE_ENV = 'development';
      const response = await call(11, 'get', '/finance/demo').expect(200);
      const data = response.body as FinanceDemoDto;
      expect(data.isDemo).toBe(true);
      expect(data.items.map((item) => item.status)).toEqual([
        'settled',
        'partial',
        'unpaid',
      ]);
      expect(data.remaining).toBe(780000);
      for (const item of data.items) {
        expect(item.amount).toBe(
          item.lines.reduce((sum, line) => sum + line.amount, 0),
        );
        expect(item.paid).toBe(
          item.payments.reduce((sum, payment) => sum + payment.amount, 0),
        );
        expect(item.remaining).toBe(item.amount - item.paid);
      }
      await call(31, 'get', '/finance/demo').expect(404);
      await call(40, 'get', '/finance/demo').expect(404);
      process.env.NODE_ENV = 'production';
      await call(11, 'get', '/finance/demo').expect(404);
      const status = (await call(11, 'get', '/finance/me').expect(200))
        .body as MemberFinanceDto;
      expect(status.demoAvailable).toBeUndefined();
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('returns personal finance status without exposing internal group costs or treating errors as no debt', async () => {
    const group3 = demoGroupId(3);
    const memberStatus = async () => {
      const response = await call(11, 'get', '/finance/me').expect(200);
      return response.body as MemberFinanceDto;
    };
    expect(await memberStatus()).toEqual({
      groupId: group3,
      canViewGroupFinance: false,
      status: 'no_costs',
    });
    await call(11, 'get', `/groups/${group3}/finance/destinations`).expect(403);
    const officer = await call(5, 'get', '/finance/me').expect(200);
    expect((officer.body as MemberFinanceDto).canViewGroupFinance).toBe(true);
    const parent = await call(31, 'get', '/finance/me').expect(200);
    expect(parent.body as MemberFinanceDto).toEqual({
      groupId: null,
      canViewGroupFinance: false,
      status: 'no_group',
    });
    const otherId = randomUUID();
    const ownId = randomUUID();
    await db.query(
      `INSERT INTO program_event(id,group_id,kind,title,total_amount,member_payment_amount,created_by)
      VALUES($1,$2,'custom','آزمون هزینهٔ گروه دیگر',50000,0,$3),($4,$5,'custom','آزمون بدون هزینه',0,0,$6)`,
      [otherId, demoGroupId(4), demoId(4), ownId, group3, demoId(3)],
    );
    expect((await memberStatus()).status).toBe('no_costs');
    const forged = await call(
      11,
      'get',
      `/finance/me?groupId=${demoGroupId(4)}&personId=${demoId(7)}`,
    ).expect(200);
    expect(forged.body as MemberFinanceDto).toEqual({
      groupId: group3,
      canViewGroupFinance: false,
      status: 'no_costs',
    });
    await db.query('UPDATE program_event SET total_amount=10000 WHERE id=$1', [
      ownId,
    ]);
    expect(await memberStatus()).toEqual({
      groupId: group3,
      canViewGroupFinance: false,
      status: 'costs_defined',
    });
    await db.query('UPDATE program_event SET total_amount=0 WHERE id=$1', [
      ownId,
    ]);
    await db.query(
      `INSERT INTO cost_item(owner_type,owner_id,title,amount,created_by)
      VALUES('program_event',$1,'هزینهٔ جزئی',5000,$2)`,
      [ownId, demoId(3)],
    );
    expect((await memberStatus()).status).toBe('costs_defined');
    await db.query('DELETE FROM cost_item WHERE owner_id=$1', [ownId]);
    await db.query('DELETE FROM program_event WHERE id=ANY($1::uuid[])', [
      [ownId, otherId],
    ]);
  });
  it('keeps study progress personal, persistent and limited to accessible paths', async () => {
    const created = await call(
      3,
      'post',
      `/groups/${demoGroupId(3)}/study-paths`,
    )
      .send({ title: 'سیر آزمون مطالعه' })
      .expect(200);
    const pathId = (created.body as { id: string }).id;
    await call(3, 'post', `/study-paths/${pathId}/items`)
      .send({ bookTitle: 'بدون تعداد صفحات' })
      .expect(400);
    await call(3, 'post', `/study-paths/${pathId}/items`)
      .send({ bookTitle: 'کتاب اول', totalPages: 100 })
      .expect(200);
    const added = await call(3, 'post', `/study-paths/${pathId}/items`)
      .send({ bookTitle: 'کتاب دوم', totalPages: 100 })
      .expect(200);
    const itemId = (added.body as StudyPathDetailDto).items[0].id;
    const url = `/study-paths/${pathId}/items/${itemId}/reading`;
    const before = await call(11, 'get', `/study-paths/${pathId}`).expect(200);
    expect((before.body as StudyPathDetailDto).readingProgress).toMatchObject({
      started: false,
      percent: 0,
    });
    const started = await call(11, 'patch', url)
      .send({ status: 'reading' })
      .expect(200);
    expect((started.body as StudyPathDetailDto).readingProgress).toMatchObject({
      started: true,
      percent: 0,
    });
    await call(11, 'patch', url)
      .send({ status: 'reading', currentPage: 20 })
      .expect(200);
    await db.query(
      "UPDATE study_reading_event SET reading_day=((now() AT TIME ZONE 'Asia/Tehran')::date-1),recorded_at=now()-interval '1 day' WHERE item_id=$1",
      [itemId],
    );
    const progressed = await call(11, 'patch', url)
      .send({ status: 'reading', currentPage: 60 })
      .expect(200);
    const book = (progressed.body as StudyPathDetailDto).items.find(
      (i) => i.id === itemId,
    )!;
    expect(book.currentPage).toBe(60);
    expect(book.readingHistory.map((day) => day.pages)).toEqual([40, 20]);
    await call(11, 'patch', url)
      .send({ status: 'reading', currentPage: 60 })
      .expect(200);
    expect(
      await rows(db, 'SELECT id FROM study_reading_event WHERE item_id=$1', [
        itemId,
      ]),
    ).toHaveLength(2);
    for (const currentPage of [-1, 101, 2.5])
      await call(11, 'patch', url)
        .send({ status: 'reading', currentPage })
        .expect(400);
    await call(11, 'patch', url)
      .send({ status: 'reading', currentPage: 100 })
      .expect(400);
    await call(11, 'patch', url)
      .send({ status: 'completed', currentPage: 100 })
      .expect(400);
    await call(3, 'patch', `/study-paths/${pathId}/items/${itemId}`)
      .send({ totalPages: 50 })
      .expect(400);
    await call(11, 'patch', url)
      .send({ status: 'completed', currentPage: 100, confirmCompleted: true })
      .expect(200);
    await call(11, 'patch', url)
      .send({ status: 'completed', currentPage: 100, confirmCompleted: true })
      .expect(200);
    const saved = await call(11, 'get', `/study-paths/${pathId}`).expect(200);
    expect((saved.body as StudyPathDetailDto).readingProgress).toEqual({
      started: true,
      percent: 50,
      completedCount: 1,
      totalCount: 2,
    });
    for (const n of [3, 5]) {
      const other = await call(n, 'get', `/study-paths/${pathId}`).expect(200);
      expect(
        (other.body as StudyPathDetailDto).items.every(
          (item) => item.readingHistory.length === 0,
        ),
      ).toBe(true);
      expect((other.body as StudyPathDetailDto).readingProgress).toMatchObject({
        started: false,
        percent: 0,
      });
    }
    for (const n of [4, 7, 31, 40])
      await call(n, 'patch', url).send({ status: 'reading' }).expect(403);
    await call(11, 'patch', url)
      .send({ status: 'reading', personId: demoId(3) })
      .expect(400);
    await call(11, 'patch', url).send({ status: 'invalid' }).expect(400);
    await call(
      11,
      'patch',
      `/study-paths/${pathId}/items/${randomUUID()}/reading`,
    )
      .send({ status: 'reading' })
      .expect(404);
    const reset = await call(11, 'patch', url)
      .send({ status: 'not_started' })
      .expect(200);
    expect((reset.body as StudyPathDetailDto).readingProgress).toMatchObject({
      started: false,
      percent: 0,
    });
  });
  it('every protected API route rejects unauthenticated callers', async () => {
    const document = openApiDocument(app);
    let count = 0;
    for (const [path, operations] of Object.entries(document.paths))
      for (const method of ['get', 'post', 'patch'] as const) {
        if (
          !operations?.[method] ||
          path.includes('/auth/login') ||
          path.includes('/auth/refresh') ||
          path.includes('/auth/csrf') ||
          path.includes('/health') ||
          path.includes('/files/download')
        )
          continue;
        const response = await request(server())
          [method](
            path
              .replaceAll('{id}', demoId(11))
              .replaceAll('{type}', 'notification'),
          )
          .set('x-client-type', 'native')
          .send(method === 'get' ? undefined : {});
        expect({ path, method, status: response.status }).toEqual({
          path,
          method,
          status: 401,
        });
        count++;
      }
    expect(count).toBeGreaterThan(25);
  });
  it('redacts identity at query level for assistants and technical administrators', async () => {
    const mentor = await call(3, 'get', `/people/${demoId(11)}`).expect(200);
    expect((mentor.body as Record<string, unknown>).fatherName).toBeDefined();
    for (const n of [5, 40]) {
      const result = await call(n, 'get', `/people/${demoId(11)}`).expect(200);
      expect((result.body as Record<string, unknown>).phone).toBeUndefined();
      expect(
        (result.body as Record<string, unknown>).birthDate,
      ).toBeUndefined();
      expect(
        (result.body as Record<string, unknown>).fatherName,
      ).toBeUndefined();
      expect(JSON.stringify(result.body)).not.toContain('nationalIdEnc');
    }
    for (const n of [1, 2, 4, 7, 31, 32])
      await call(n, 'get', `/people/${demoId(11)}`).expect(403);
  });
  it('returns a verified national ID only on the owner self endpoint', async () => {
    const unverified = await call(11, 'get', '/people/me').expect(200);
    expect((unverified.body as MeDto).person.nationalId).toBeUndefined();
    await db.query(
      'UPDATE person SET verified_at=now(),verified_by=$2 WHERE id=$1',
      [demoId(11), demoId(3)],
    );
    try {
      const self = await call(11, 'get', '/people/me').expect(200);
      expect((self.body as MeDto).person.nationalId).toBe(demoNationalId(11));
      const mentor = await call(3, 'get', `/people/${demoId(11)}`).expect(200);
      expect(
        (mentor.body as Record<string, unknown>).nationalId,
      ).toBeUndefined();
    } finally {
      await db.query(
        'UPDATE person SET verified_at=NULL,verified_by=NULL WHERE id=$1',
        [demoId(11)],
      );
    }
  });
  it('restricts policy, audit, jobs, settings, groups and imports by capability', async () => {
    for (const path of [
      '/access/policies',
      '/admin/audit',
      '/admin/jobs',
      '/admin/retention',
    ]) {
      await call(40, 'get', path).expect(200);
      for (const n of [3, 5, 11, 31]) await call(n, 'get', path).expect(403);
    }
    await call(3, 'get', `/groups/${demoGroupId(3)}/members`).expect(200);
    await call(4, 'get', `/groups/${demoGroupId(3)}/members`).expect(403);
    await call(11, 'post', '/groups')
      .send({ name: 'گروه غیرمجاز', ownerPersonId: demoId(11) })
      .expect(403);
  });
  it('guards browser CSRF and sends only secure httpOnly cookies', async () => {
    await request(server())
      .post('/api/v1/auth/login')
      .set('origin', process.env.APP_ORIGIN!)
      .send({ login: '+989100000003', password: DEMO_PASSWORD })
      .expect(403);
    const csrf = await request(server()).get('/api/v1/auth/csrf').expect(200);
    const value = (csrf.body as { csrfToken: string }).csrfToken;
    const response = await request(server())
      .post('/api/v1/auth/login')
      .set('origin', process.env.APP_ORIGIN!)
      .set('cookie', `sf_csrf=${value}`)
      .set('x-csrf-token', value)
      .send({ login: '+989100000003', password: DEMO_PASSWORD })
      .expect(200);
    expect(
      (response.body as Record<string, unknown>).accessToken,
    ).toBeUndefined();
    expect(
      (response.body as Record<string, unknown>).refreshToken,
    ).toBeUndefined();
    for (const cookie of response.headers['set-cookie'] as unknown as string[])
      expect(cookie).toMatch(/HttpOnly; Secure; SameSite=Strict/);
  });
  it('rotates refresh tokens and revokes the family on replay', async () => {
    const response = await request(server())
      .post('/api/v1/auth/login')
      .set('x-client-type', 'native')
      .send({ login: '+989100000022', password: DEMO_PASSWORD })
      .expect(200);
    const old = response.body as Login;
    const rotated = await request(server())
      .post('/api/v1/auth/refresh')
      .set('x-client-type', 'native')
      .send({ refreshToken: old.refreshToken })
      .expect(200);
    await request(server())
      .post('/api/v1/auth/refresh')
      .set('x-client-type', 'native')
      .send({ refreshToken: old.refreshToken })
      .expect(401);
    await request(server())
      .get('/api/v1/people/me')
      .set('authorization', `Bearer ${(rotated.body as Login).accessToken}`)
      .expect(401);
    const session = await one<{ refreshHash: string }>(
      db,
      'SELECT refresh_hash AS "refreshHash" FROM auth_session ORDER BY created_at DESC LIMIT 1',
    );
    expect(session?.refreshHash).not.toBe(old.refreshToken);
  });
  it('requires the confirmed parent to sign for a minor and permits declining publication', async () => {
    const result = await call(
      31,
      'get',
      `/consent?personId=${demoId(11)}`,
    ).expect(200);
    const version = (result.body as { version: { id: string } }).version.id;
    await call(11, 'post', '/consent/records')
      .send({
        personId: demoId(11),
        versionId: version,
        acceptedItems: requiredConsentItems,
      })
      .expect(400);
    await call(32, 'post', '/consent/records')
      .send({
        personId: demoId(11),
        versionId: version,
        acceptedItems: requiredConsentItems,
      })
      .expect(403);
    await call(31, 'post', '/consent/records')
      .send({
        personId: demoId(11),
        versionId: version,
        acceptedItems: requiredConsentItems,
      })
      .expect(200);
    expect(
      (
        (await call(11, 'get', '/people/me').expect(200)).body as {
          consentRequired: boolean;
        }
      ).consentRequired,
    ).toBe(false);
  });
  it('blocks actions until consent is recorded', async () => {
    await call(15, 'get', '/groups').expect(403);
    await call(15, 'get', '/people/me').expect(200);
    await call(15, 'get', '/notifications').expect(200);
  });
  it('keeps follow-up history and rejects cross-group assignments and hierarchy cycles', async () => {
    await call(3, 'post', `/groups/${demoGroupId(3)}/assignments`)
      .send({ memberPersonId: demoId(11), assistantPersonId: demoId(6) })
      .expect(200);
    expect(
      (
        await rows(
          db,
          'SELECT id FROM follow_up_assignment WHERE member_person_id=$1',
          [demoId(11)],
        )
      ).length,
    ).toBe(2);
    await call(3, 'post', `/groups/${demoGroupId(3)}/assignments`)
      .send({ memberPersonId: demoId(11), assistantPersonId: demoId(7) })
      .expect(400);
    await call(40, 'post', `/groups/${demoGroupId(3)}/memberships`)
      .send({ personId: demoId(3), role: 'member' })
      .expect(400);
    await call(3, 'post', `/people/${demoId(6)}/deactivate`).expect(409);
  });
  it('supports revocable mentor referrals and never grants technical admin implicit access', async () => {
    const input = {
      resourceType: 'person_file',
      resourceId: demoId(51),
      granteePersonId: demoId(1),
      reason: 'ارجاع پروندهٔ آزمایشی',
    };
    await call(40, 'post', '/access/grants').send(input).expect(403);
    await call(4, 'post', '/access/grants').send(input).expect(403);
    const response = await call(3, 'post', '/access/grants')
      .send(input)
      .expect(200);
    await call(
      3,
      'post',
      `/access/grants/${(response.body as { id: string }).id}/revoke`,
    ).expect(200);
  });
  it('validates CSV before writing, requires confirmation, masks previews and commits idempotently', async () => {
    const csv = `firstName,lastName,fatherName,birthDate,nationalId,phone,group\nآزمون,ورودی,حسن,1392/01/01,${demoNationalId(890)},09123456789,رویش\n`;
    const before = await one<{ count: string }>(
      db,
      'SELECT count(*) FROM person',
    );
    const uploaded = await call(3, 'post', '/imports')
      .field('groupId', demoGroupId(3))
      .attach('file', Buffer.from(csv), 'people.csv')
      .expect(200);
    const id = (uploaded.body as { id: string }).id;
    const imports = app.get(ImportsService);
    await imports.validate(id);
    const preview = await call(3, 'get', `/imports/${id}/rows`).expect(200);
    expect(JSON.stringify(preview.body)).not.toContain(demoNationalId(890));
    expect(
      (await one<{ count: string }>(db, 'SELECT count(*) FROM person'))?.count,
    ).toBe(before?.count);
    expect(
      (
        (await call(3, 'get', `/imports/${id}`).expect(200)).body as {
          status: string;
        }
      ).status,
    ).toBe('ready');
    await call(4, 'get', `/imports/${id}`).expect(403);
    await call(3, 'post', `/imports/${id}/confirm`).expect(200);
    await imports.commit(id);
    await imports.commit(id);
    await call(3, 'post', `/imports/${id}/confirm`).expect(200);
    expect(
      (
        (await call(3, 'get', `/imports/${id}`).expect(200)).body as {
          status: string;
        }
      ).status,
    ).toBe('completed');
    expect(
      Number(
        (await one<{ count: string }>(db, 'SELECT count(*) FROM person'))
          ?.count,
      ),
    ).toBe(Number(before?.count) + 1);
    const duplicate = await call(3, 'post', '/imports')
      .field('groupId', demoGroupId(3))
      .attach('file', Buffer.from(csv), 'people.csv')
      .expect(200);
    expect((duplicate.body as { id: string }).id).toBe(id);
    await call(4, 'post', '/imports')
      .field('groupId', demoGroupId(3))
      .attach('file', Buffer.from(csv), 'people.csv')
      .expect(403);
  });
  it('protects encrypted import rows with PostgreSQL RLS and makes audit append-only', async () => {
    const row = await one<{ dataEnc: string }>(
      db,
      'SELECT data_enc AS "dataEnc" FROM import_row LIMIT 1',
    );
    expect(row?.dataEnc).not.toContain('آزمون');
    await db.query(
      "DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='safanoor_rls_probe') THEN CREATE ROLE safanoor_rls_probe NOLOGIN; END IF; END $$",
    );
    await db.query('GRANT USAGE ON SCHEMA public TO safanoor_rls_probe');
    await db.query(
      'GRANT SELECT ON import_job,import_row TO safanoor_rls_probe',
    );
    await db.transaction(async (manager) => {
      await manager.query('SET LOCAL ROLE safanoor_rls_probe');
      expect((await rows(manager, 'SELECT * FROM import_row')).length).toBe(0);
      await manager.query("SELECT set_config('app.actor_id',$1,true)", [
        demoId(3),
      ]);
      expect(
        (await rows(manager, 'SELECT * FROM import_row')).length,
      ).toBeGreaterThan(0);
    });
    await expect(
      db.query(
        "UPDATE audit_log SET action='changed' WHERE id=(SELECT id FROM audit_log LIMIT 1)",
      ),
    ).rejects.toThrow();
  });
  it('archives parent links exactly at 18, notifies both, and requires new consent', async () => {
    await db.query("UPDATE person SET birth_date='2008-10-17' WHERE id=$1", [
      demoId(12),
    ]);
    const service = app.get(AgeTransitionService);
    await service.run(new Date('2026-09-17T00:00:00Z'));
    await service.run(new Date('2026-10-17T00:00:00Z'));
    await service.run(new Date('2026-10-17T00:00:00Z'));
    const state = await one<{ active: boolean; consent: boolean }>(
      db,
      'SELECT l.active,p.consent_required AS consent FROM parent_link l JOIN person p ON p.id=l.child_person_id WHERE p.id=$1',
      [demoId(12)],
    );
    expect(state).toEqual({ active: false, consent: true });
    await call(31, 'get', `/consent?personId=${demoId(12)}`).expect(403);
  });
  it('locks a password account after five failed attempts', async () => {
    for (let i = 0; i < 5; i++)
      await request(server())
        .post('/api/v1/auth/login')
        .set('x-client-type', 'native')
        .send({ login: '+989100000021', password: 'incorrect-password' })
        .expect(401);
    await request(server())
      .post('/api/v1/auth/login')
      .set('x-client-type', 'native')
      .send({ login: '+989100000021', password: DEMO_PASSWORD })
      .expect(401);
    expect(
      (
        await one<{ locked: boolean }>(
          db,
          'SELECT locked_until>now() AS locked FROM app_user WHERE person_id=$1',
          [demoId(21)],
        )
      )?.locked,
    ).toBe(true);
  });
  it('tests real endpoint rate limiting independently of the policy fixture override', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const limited = module.createNestApplication({ logger: false });
    configureApplication(limited);
    await limited.init();
    try {
      for (let i = 0; i < 120; i++)
        await request(limited.getHttpServer() as import('http').Server)
          .get('/api/v1/health')
          .expect(200);
      await request(limited.getHttpServer() as import('http').Server)
        .get('/api/v1/health')
        .expect(429);
    } finally {
      await limited.close();
    }
  });
  it('assigns a finance officer only within the managed group and restricts qualifications', async () => {
    await call(3, 'post', `/groups/${demoGroupId(3)}/finance-officer`)
      .send({ personId: demoId(6), role: 'finance_officer' })
      .expect(200);
    await call(3, 'post', `/groups/${demoGroupId(3)}/finance-officer`)
      .send({ personId: demoId(7), role: 'finance_officer' })
      .expect(400);
    await call(4, 'post', `/groups/${demoGroupId(3)}/finance-officer`)
      .send({ personId: demoId(6), role: 'finance_officer' })
      .expect(403);
    await call(3, 'post', '/admin/qualifications')
      .send({ personId: demoId(16), orgLevel: 'assistant' })
      .expect(403);
    await call(40, 'post', '/admin/qualifications')
      .send({ personId: demoId(16), orgLevel: 'assistant' })
      .expect(200);
  });
  it('logs identity changes, verifies them only by the direct mentor, and soft-deletes safely', async () => {
    await call(40, 'post', `/people/${demoId(16)}/verify`).expect(400);
    await call(3, 'post', `/people/${demoId(16)}/verify`).expect(200);
    await call(3, 'patch', `/people/${demoId(16)}`)
      .send({ fatherName: 'حسن آزمایشی' })
      .expect(200);
    await call(11, 'patch', `/people/${demoId(11)}`)
      .send({ phone: '۰۹۱۹۹۹۹۹۹۱۱' })
      .expect(200);
    expect(
      await one<{ phone: string; login: string }>(
        db,
        `SELECT p.phone,u.login
         FROM person p
         JOIN app_user u ON u.person_id=p.id
         WHERE p.id=$1`,
        [demoId(11)],
      ),
    ).toEqual({ phone: '+989199999911', login: '+989199999911' });
    await request(server())
      .post('/api/v1/auth/login')
      .set('x-client-type', 'native')
      .send({ login: '09199999911', password: DEMO_PASSWORD })
      .expect(200);
    expect(
      (
        await one<{ verified: boolean }>(
          db,
          'SELECT verified_at IS NOT NULL AS verified FROM person WHERE id=$1',
          [demoId(16)],
        )
      )?.verified,
    ).toBe(false);
    await call(3, 'post', `/people/${demoId(16)}/deactivate`).expect(200);
    const person = await one<{ status: string; sealed: boolean }>(
      db,
      'SELECT status,purge_after IS NOT NULL AS sealed FROM person WHERE id=$1',
      [demoId(16)],
    );
    expect(person).toEqual({ status: 'left', sealed: true });
    expect(
      (
        await rows(
          db,
          'SELECT id FROM membership WHERE person_id=$1 AND valid_to IS NULL',
          [demoId(16)],
        )
      ).length,
    ).toBe(0);
    const logs = await rows<{ meta: unknown }>(
      db,
      "SELECT meta FROM audit_log WHERE resource_id=$1 AND action='person.identity_updated'",
      [demoId(16)],
    );
    expect(JSON.stringify(logs)).not.toContain('حسن');
  });
  it('creates people with Persian digits, provisions passwords and links parents by phone', async () => {
    const provisionedPassword = 'SafanoorTest#1405';
    const id = demoNationalId(901).replace(
      /\d/g,
      (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)],
    );
    const created = await call(3, 'post', '/people')
      .send({
        firstName: 'نوید',
        lastName: 'آزمایشی',
        fatherName: 'حسن',
        birthDate: '2012-03-20',
        nationalId: id,
        phone: '09129999991',
        orgLevel: 'member',
        groupId: demoGroupId(3),
      })
      .expect(200);
    const person = (created.body as { id: string }).id;
    await call(40, 'post', '/admin/accounts')
      .send({ personId: person, password: provisionedPassword })
      .expect(200);
    await request(server())
      .post('/api/v1/auth/login')
      .set('x-client-type', 'native')
      .send({ login: '+989129999991', password: provisionedPassword })
      .expect(200);
    await call(40, 'post', '/admin/parents')
      .send({
        firstName: 'والد',
        lastName: 'آزمایشی',
        phone: '+989129999992',
        password: provisionedPassword,
      })
      .expect(200);
    await call(4, 'post', '/admin/parent-links')
      .send({ childPersonId: person, parentPhone: '+989129999992' })
      .expect(403);
    await call(3, 'post', '/admin/parent-links')
      .send({ childPersonId: person, parentPhone: '+989129999992' })
      .expect(200);
    const parent = await request(server())
      .post('/api/v1/auth/login')
      .set('x-client-type', 'native')
      .send({ login: '+989129999992', password: provisionedPassword })
      .expect(200);
    const consent = await request(server())
      .get(`/api/v1/consent?personId=${person}`)
      .set('authorization', `Bearer ${(parent.body as Login).accessToken}`)
      .expect(200);
    expect((consent.body as { canSign: boolean }).canSign).toBe(true);
  });
  it('checks signed downloads again, denies unrelated users, and rejects tampering', async () => {
    const key = randomUUID();
    const file = randomUUID();
    const storage = app.get<StorageAdapter>(STORAGE);
    await storage.put(key, Buffer.from('synthetic file'), 'text/plain');
    await rows(
      db,
      "INSERT INTO file_record(id,kind,storage_key,size,mime_type,created_by) VALUES($1,'test',$2,14,'text/plain',$3)",
      [file, key, demoId(11)],
    );
    await call(40, 'get', `/files/${file}/url`).expect(403);
    await call(3, 'get', `/files/${file}/url`).expect(403);
    const result = await call(11, 'get', `/files/${file}/url`).expect(200);
    const url = (result.body as { url: string }).url;
    await request(server()).get(url).expect(200, 'synthetic file');
    await request(server())
      .get(url + 'x')
      .expect(403);
    await rows(db, "UPDATE person SET status='left' WHERE id=$1", [demoId(11)]);
    await request(server()).get(url).expect(403);
  });
  it('publishes a new immutable consent version and requires everyone to accept again', async () => {
    const items = consentItems.map((key) => ({
      key,
      text: 'متن فارسی آزمایشی برای رضایت آگاهانه',
      required: requiredConsentItems.includes(key),
    }));
    await call(3, 'post', '/consent/versions')
      .send({ title: 'نسخهٔ آزمایش', items })
      .expect(403);
    await call(40, 'post', '/consent/versions')
      .send({ title: 'نسخهٔ آزمایش', items })
      .expect(200);
    await expect(
      db.query(
        "UPDATE consent_form_version SET title='changed' WHERE version=1",
      ),
    ).rejects.toThrow();
    await call(40, 'get', '/admin/jobs').expect(403);
  });
});
