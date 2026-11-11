import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../src/libs/database/data-source';
import { IndependentAssistantGroup1792195200029 } from '../src/libs/database/migrations/1792195200029-IndependentAssistantGroup';
import {
  seedHierarchy,
  hierarchyAccounts,
  hierarchyPersonId,
  hierarchyGroupId,
  hierarchyUserId,
} from '../src/seed-hierarchy';
import { rebuildSeedHierarchy } from '../src/seed';
import { AuditService } from '../src/modules/audit/audit.service';
import { AccessService } from '../src/modules/access/access.service';
import {
  actorFromRole,
  listAvailableRoles,
  roleId,
} from '../src/modules/access/active-role';

describe('Independent primary and assistant groups', () => {
  let db: DataSource;
  const personId = hierarchyPersonId(12);
  const group20 = hierarchyGroupId(20);
  const group27 = hierarchyGroupId(27);
  const identity = {
    personId,
    userId: hierarchyUserId(12),
    isAdmin: true,
    isParent: false,
    external: false,
    orgLevel: 'mentor',
    status: 'active',
    consentRequired: false,
  };

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!url.pathname.endsWith('_test'))
      throw new Error('A test database is required');
    url.pathname = url.pathname.replace(/_test$/, '_independent_test');
    const adminUrl = new URL(url);
    adminUrl.pathname = '/postgres';
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    const name = url.pathname.slice(1);
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
    await seedHierarchy(db);
    await seedHierarchy(db);
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  it('keeps exactly one member role in 20 alongside assistant 27 and mentor 33 after reseeding', async () => {
    expect(hierarchyAccounts().find((row) => row.n === 12)).toMatchObject({
      memberOf: 20,
      assistantOf: 27,
      owns: 33,
    });
    const roles = await listAvailableRoles(db, identity);
    expect(roles.map((role) => role.label)).toEqual(
      expect.arrayContaining([
        'مدیر فنی',
        'صفا ۳۳ - مربی',
        'صفا ۲۷ - کمک‌مربی',
        'صفا ۲۰ - نیرو',
      ]),
    );
    expect(roles.filter((role) => role.kind === 'member')).toHaveLength(1);
    expect(roles.some((role) => role.id === roleId('member', group27))).toBe(
      false,
    );
    expect(
      await db.query(
        'SELECT ancestor_id FROM person_ancestors WHERE person_id=$1 AND depth=1',
        [personId],
      ),
    ).toEqual([{ ancestor_id: hierarchyPersonId(1) }]);
  });

  it('repairs existing data with membership history, sessions, follow-ups and audit intact', async () => {
    await db.transaction(async (manager) => {
      await manager.query(
        "UPDATE membership SET valid_to=now() WHERE person_id=$1 AND role='member' AND valid_to IS NULL",
        [personId],
      );
      await manager.query(
        "INSERT INTO membership(person_id,group_id,role) VALUES($1,$2,'member')",
        [personId, group27],
      );
      await manager.query(
        'INSERT INTO follow_up_assignment(member_person_id,assistant_person_id,group_id) VALUES($1,$2,$3),($4,$1,$3)',
        [personId, hierarchyPersonId(3), group27, hierarchyPersonId(4)],
      );
      await manager.query(
        "INSERT INTO auth_session(user_id,family_id,refresh_hash,csrf_hash,expires_at,active_role_id) VALUES($1,gen_random_uuid(),repeat('a',64),repeat('b',64),now()+interval '1 day',$2)",
        [identity.userId, roleId('member', group27)],
      );
      await rebuildSeedHierarchy(manager);
    });
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await new IndependentAssistantGroup1792195200029().up(runner);
      await new IndependentAssistantGroup1792195200029().up(runner);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    expect(
      await db.query(
        "SELECT group_id FROM membership WHERE person_id=$1 AND role='member' AND valid_to IS NULL",
        [personId],
      ),
    ).toEqual([{ group_id: group20 }]);
    expect(
      await db.query(
        "SELECT id FROM membership WHERE person_id=$1 AND role='member' AND group_id=$2 AND valid_to IS NOT NULL",
        [personId, group27],
      ),
    ).toHaveLength(1);
    expect(
      await db.query(
        'SELECT active_role_id FROM auth_session WHERE user_id=$1',
        [identity.userId],
      ),
    ).toEqual([{ active_role_id: roleId('member', group20) }]);
    expect(
      await db.query(
        'SELECT id FROM follow_up_assignment WHERE assistant_person_id=$1 AND to_date IS NULL',
        [personId],
      ),
    ).toHaveLength(1);
    expect(
      await db.query(
        'SELECT id FROM follow_up_assignment WHERE member_person_id=$1 AND to_date IS NULL',
        [personId],
      ),
    ).toHaveLength(0);
    expect(
      await db.query(
        "SELECT id FROM audit_log WHERE resource_id=$1 AND action='membership.corrected'",
        [personId],
      ),
    ).toHaveLength(1);
  });

  it('isolates can() to each selected group and keeps multiple primary memberships forbidden', async () => {
    const roles = await listAvailableRoles(db, identity);
    const access = new AccessService(db, new AuditService(db));
    for (const [kind, group] of [
      ['member', group20],
      ['assistant', group27],
      ['mentor', hierarchyGroupId(33)],
    ] as const) {
      const role = roles.find((row) => row.id === roleId(kind, group))!;
      const actor = actorFromRole(identity, role);
      for (const resourceGroup of [group20, group27, hierarchyGroupId(33)]) {
        expect(
          await access.level(actor, 'read', {
            type: 'study_path',
            groupIds: [resourceGroup],
          }),
        ).toBe(resourceGroup === group ? 'detail' : 'none');
      }
    }
    await expect(
      db.query(
        "INSERT INTO membership(person_id,group_id,role) VALUES($1,$2,'member')",
        [personId, group27],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "INSERT INTO membership(person_id,group_id,role) VALUES($1,$2,'assistant')",
        [hierarchyPersonId(1), group27],
      ),
    ).rejects.toThrow('assistant_requires_primary_membership');
    await expect(
      db.transaction(async (manager) => {
        await manager.query(
          "UPDATE membership SET valid_to=now() WHERE person_id=$1 AND role='member' AND valid_to IS NULL",
          [personId],
        );
      }),
    ).rejects.toThrow('exactly_one_active_member_required');
  });
});
