import 'dotenv/config';
import database from './libs/database/data-source';
import { rows } from './libs/database/database.types';
import {
  hierarchyPersonId,
  seedHierarchy,
} from './seed-hierarchy';
import {
  seedHierarchyDemo,
  type HierarchyDemoResult,
} from './seed-hierarchy-demo';

/**
 * Rich presentation seed for the five hierarchy personas.
 * Idempotent; refuses NODE_ENV=production.
 *
 * Ensures hierarchy people exist, fills every UI-facing domain table that
 * currently exists in the schema, and stores file bytes through the same
 * encrypted S3 adapter the API uses (STORAGE_DRIVER=s3 → :9000).
 *
 * Run: npm --prefix api run seed:demo-session
 * Prereq: Postgres + MinIO/S3Proxy (`node scripts/ensure-minio.mjs`).
 */

const SESSION_LOGINS = [
  {
    n: 1,
    name: 'مهدی رضوانیان',
    login: '+989120000001',
    role: 'ناظر / مالک صفا ۲۰',
  },
  {
    n: 37,
    name: 'محمد گودرزی',
    login: '+989120000037',
    role: 'مربی صفا ۲۷',
  },
  {
    n: 12,
    name: 'محمدجواد رضوانیان',
    login: '+989120000012',
    role: 'مربی صفا ۳۳ (+ admin اختیاری)',
  },
  {
    n: 3,
    name: 'مصطفی بهبهانی',
    login: '+989120000003',
    role: 'کمک‌مربی صفا ۲۷',
  },
  {
    n: 16,
    name: 'مهدی سیف‌الهی',
    login: '+989120000016',
    role: 'نیرو صفا ۲۰',
  },
] as const;

export async function seedDemoSession(
  grantAdminToMj = true,
): Promise<HierarchyDemoResult & { adminGranted: boolean }> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo session seed is disabled in production');

  await seedHierarchy(database);
  const result = await seedHierarchyDemo(database);

  let adminGranted = false;
  if (grantAdminToMj) {
    await rows(
      database,
      `UPDATE app_user SET is_admin=true
       WHERE person_id=$1 AND is_admin=false`,
      [hierarchyPersonId(12)],
    );
    adminGranted = true;
  }

  return { ...result, adminGranted };
}

async function main(): Promise<void> {
  await database.initialize();
  try {
    const result = await seedDemoSession(true);
    console.log('🌱 Demo session seed ready for presentation.');
    console.log('');
    console.log('Accounts (password 12345678):');
    for (const row of SESSION_LOGINS) {
      console.log(`  • ${row.name} — ${row.login} — ${row.role}`);
    }
    if (result.adminGranted)
      console.log('  • محمدجواد رضوانیان also has is_admin=true for /admin.');
    console.log('');
    console.log('Filled:');
    console.log(
      `  photos=${result.photos} consultations=${result.consultations} meetings=${result.meetings}`,
    );
    console.log(
      `  camps=${result.camps} threads=${result.threads} followUps=${result.followUps}`,
    );
    console.log(
      `  studyPaths=${result.studyPaths} classes=${result.classes} readings=${result.readings}`,
    );
    console.log(
      `  grants=${result.grants} imports=${result.imports} jointParticipants=${result.jointParticipants}`,
    );
    console.log(
      `  avatars=${result.avatars} campDetails=${result.campDetails} photoTags=${result.photoTags} finance33=${result.finance33}`,
    );
    console.log(`  schema: ${result.schemaNote}`);
    console.log(
      `  storage=${result.storageDriver} objectsWritten=${result.s3Objects}`,
    );
  } finally {
    await database.destroy();
  }
}

if (require.main === module)
  void main().catch((error: unknown) => {
    console.error('❌ Demo session seed failed.', error);
    process.exitCode = 1;
  });
