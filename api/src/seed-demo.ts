import 'dotenv/config';
import { DataSource } from 'typeorm';
import database from './libs/database/data-source';
import { one, rows } from './libs/database/database.types';
import { CryptoService } from './libs/security/crypto.service';
import { demoId, seed } from './seed';
import { demoAccountNumbers, DemoPerson } from './demo/fixtures';
import { seedDemoProfiles, seedDemoNotifications } from './demo/people';
import { seedDemoImports } from './demo/imports';
import { seedDemoGrants } from './demo/grants';

export async function seedDemo(db: DataSource): Promise<{ accounts: number }> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo data is disabled in production');
  const existing = await one<{ count: string }>(
    db,
    'SELECT count(*) FROM person WHERE id=ANY($1::uuid[])',
    [demoAccountNumbers.map(demoId)],
  );
  if (existing?.count === '0') {
    const total = await one<{ count: string }>(
      db,
      'SELECT count(*) FROM person',
    );
    if (total?.count !== '0')
      throw new Error(
        'Refusing to add demo identities to an existing organization',
      );
    await seed(db);
  } else if (Number(existing?.count) !== demoAccountNumbers.length) {
    throw new Error('The foundation demo identities are incomplete');
  }
  const crypto = new CryptoService();
  return db.transaction(async (manager) => {
    await rows(manager, "SELECT set_config('app.worker','on',true)");
    await rows(manager, 'SELECT pg_advisory_xact_lock(739201)');
    const people = await rows<DemoPerson>(
      manager,
      `SELECT p.id,right(p.id::text,12)::int AS number,p.first_name AS "firstName",p.last_name AS "lastName",
       p.father_name AS "fatherName",to_char(p.birth_date,'YYYY-MM-DD') AS "birthDate",p.phone,p.org_level AS level,
       p.external,u.is_parent AS "isParent",u.is_admin AS "isAdmin",g.owner_person_id AS "mentorId"
       FROM person p JOIN app_user u ON u.person_id=p.id LEFT JOIN membership m ON m.person_id=p.id
       AND m.role='member' AND m.valid_to IS NULL LEFT JOIN organization_group g ON g.id=m.group_id
       WHERE p.id=ANY($1::uuid[]) AND p.status='active' ORDER BY p.id`,
      [demoAccountNumbers.map(demoId)],
    );
    await seedDemoProfiles(manager, people);
    await seedDemoNotifications(manager, people);
    await seedDemoImports(manager, people, crypto);
    await seedDemoGrants(manager);
    return { accounts: people.length };
  });
}

async function main(): Promise<void> {
  await database.initialize();
  try {
    const result = await seedDemo(database);
    console.log(
      `🌱 Presentation data is ready for ${result.accounts} demo accounts.`,
    );
  } finally {
    await database.destroy();
  }
}
if (require.main === module)
  void main().catch(() => {
    console.error(
      '❌ Demo data failed. Check the development database and migrations.',
    );
    process.exitCode = 1;
  });
