import 'dotenv/config';
import { DataSource, EntityManager } from 'typeorm';
import { normalizePersian, requiredConsentItems } from '@safanoor/shared';
import { initialConsentItems } from './libs/config/defaults';
import database from './libs/database/data-source';
import { one, rows } from './libs/database/database.types';
import { CryptoService } from './libs/security/crypto.service';
import { PasswordProvider } from './modules/auth/password.provider';
import { DEMO_PASSWORD, demoNationalId, rebuildSeedHierarchy } from './seed';

/** Reserved UUID namespace for the real-org hierarchy seed (local testing only). */
export const hierarchyPersonId = (n: number): string =>
  `40000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const hierarchyGroupId = (n: number): string =>
  `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const hierarchyUserId = (n: number): string =>
  `60000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const HIERARCHY_PASSWORD = DEMO_PASSWORD;

const FA = '۰۱۲۳۴۵۶۷۸۹';
export function safaName(n: number): string {
  return `صفا ${String(n).replace(/\d/g, (d) => FA[Number(d)])}`;
}

export function hierarchyPhone(n: number): string {
  return `+98912${String(n).padStart(7, '0')}`;
}

type RoleRow = {
  n: number;
  first: string;
  last: string;
  /** Group where they are a member when they have no assistant role. */
  niroo?: number;
  /** Group for member+assistant dual membership. */
  komak?: number;
  /** Mentor-owned group candidate (first listed person wins ownership). */
  morabi?: number;
  /** If set, person is a supervisor (no member membership). */
  nazer?: number;
  age: number;
};

/**
 * Real-org roster for local testing.
 * Names are family-then-given except n=1 (given then family), matching the source sheet.
 * Columns map to نیرو / کمک مربی / مربی / ناظر group numbers.
 */
export const HIERARCHY_ROSTER: RoleRow[] = [
  { n: 1, first: 'مهدی', last: 'رضوانیان', niroo: 7, komak: 15, morabi: 20, nazer: 27, age: 36 },
  { n: 2, first: 'محمدحسین', last: 'امینی', niroo: 20, komak: 27, morabi: 34, age: 28 },
  { n: 3, first: 'مصطفی', last: 'بهبهانی', niroo: 20, komak: 27, age: 24 },
  { n: 4, first: 'مبین', last: 'ترابی', niroo: 20, komak: 27, age: 23 },
  { n: 5, first: 'محمد', last: 'ترابی', niroo: 20, komak: 27, age: 25 },
  { n: 6, first: 'مصطفی', last: 'حسن‌زاده', niroo: 20, age: 20 },
  { n: 7, first: 'مهدی', last: 'حسنی', niroo: 20, komak: 27, age: 24 },
  { n: 8, first: 'طاها', last: 'خالقی', niroo: 20, komak: 27, age: 22 },
  { n: 9, first: 'امید', last: 'دهباشی', niroo: 20, age: 21 },
  { n: 10, first: 'احمد', last: 'دهقانی', niroo: 20, age: 20 },
  { n: 11, first: 'محمد', last: 'رضایی', niroo: 20, komak: 27, age: 23 },
  { n: 12, first: 'محمدجواد', last: 'رضوانیان', niroo: 20, komak: 27, morabi: 33, age: 27 },
  { n: 13, first: 'سیدسجاد', last: 'زهتاب', niroo: 20, komak: 27, age: 24 },
  { n: 14, first: 'عباس', last: 'زینالی', niroo: 20, komak: 27, age: 25 },
  { n: 15, first: 'محمدحسین', last: 'ستاره', niroo: 20, age: 19 },
  { n: 16, first: 'مهدی', last: 'سیف‌الهی', niroo: 20, age: 20 },
  { n: 17, first: 'محمدعلی', last: 'شایان', niroo: 20, komak: 27, morabi: 34, age: 29 },
  { n: 18, first: 'محمدامین', last: 'شفیعی', niroo: 20, age: 21 },
  { n: 19, first: 'علی', last: 'شهیدی', niroo: 20, komak: 27, age: 24 },
  { n: 20, first: 'محمدصادق', last: 'ظهیری', niroo: 20, komak: 27, age: 23 },
  { n: 21, first: 'امین', last: 'عزیزی', niroo: 20, komak: 27, age: 22 },
  { n: 22, first: 'فواد', last: 'عطایی‌پور', niroo: 20, komak: 27, age: 25 },
  { n: 23, first: 'احمد', last: 'عنابستانی', niroo: 20, age: 20 },
  { n: 24, first: 'امیرمحمد', last: 'فریفته', niroo: 20, komak: 27, age: 23 },
  { n: 25, first: 'سجاد', last: 'قانعی', niroo: 20, komak: 27, morabi: 34, age: 28 },
  { n: 26, first: 'مهدیار', last: 'قمری', niroo: 20, komak: 27, age: 22 },
  { n: 27, first: 'امیرحسین', last: 'کاظمی', niroo: 20, age: 19 },
  { n: 28, first: 'حسین', last: 'کرشیار', niroo: 20, komak: 27, age: 24 },
  { n: 29, first: 'محمدحسین', last: 'کرمیانی', niroo: 20, komak: 27, age: 23 },
  { n: 30, first: 'عرفان', last: 'کریمی', niroo: 20, komak: 27, morabi: 33, age: 27 },
  { n: 31, first: 'محمدمهدی', last: 'متین', niroo: 20, komak: 27, morabi: 33, age: 26 },
  { n: 32, first: 'مهدی', last: 'محبوبی', niroo: 20, komak: 27, age: 24 },
  { n: 33, first: 'محمد', last: 'محمدی', niroo: 20, komak: 27, age: 22 },
  { n: 34, first: 'سیدعلیرضا', last: 'موسوی', niroo: 20, age: 20 },
  { n: 35, first: 'ایمان', last: 'نیکوخوی', niroo: 20, age: 21 },
  { n: 36, first: 'مرتضی', last: 'نیکونژاد', niroo: 20, komak: 27, age: 25 },
  { n: 37, first: 'محمد', last: 'گودرزی', niroo: 14, komak: 20, morabi: 27, nazer: 34, age: 40 },
  { n: 38, first: 'حمید', last: 'جعفری', niroo: 14, komak: 20, morabi: 27, age: 32 },
  { n: 39, first: 'سعید', last: 'طامه', niroo: 14, komak: 20, morabi: 27, age: 31 },
];

function orgLevelOf(row: RoleRow): string {
  if (row.nazer) return 'supervisor';
  if (row.morabi) return 'mentor';
  if (row.komak) return 'assistant';
  return 'member';
}

function memberGroupOf(row: RoleRow): number | undefined {
  if (row.nazer) return undefined;
  if (row.komak) return row.komak;
  return row.niroo;
}

function groupOwners(roster: RoleRow[]): Map<number, number> {
  const owners = new Map<number, number>();
  for (const row of roster) {
    if (row.morabi && !owners.has(row.morabi)) owners.set(row.morabi, row.n);
  }
  return owners;
}

export function hierarchyAccounts(): {
  n: number;
  name: string;
  phone: string;
  level: string;
  owns?: number;
  memberOf?: number;
  assistantOf?: number;
}[] {
  const owners = groupOwners(HIERARCHY_ROSTER);
  return HIERARCHY_ROSTER.map((row) => ({
    n: row.n,
    name: `${row.first} ${row.last}`,
    phone: hierarchyPhone(row.n),
    level: orgLevelOf(row),
    owns: [...owners.entries()].find(([, owner]) => owner === row.n)?.[0],
    memberOf: memberGroupOf(row),
    assistantOf: row.nazer ? undefined : row.komak,
  }));
}

async function ensureConsentVersion(
  manager: EntityManager,
  publishedBy: string,
): Promise<string> {
  const existing = await one<{ id: string }>(
    manager,
    'SELECT id FROM consent_form_version ORDER BY version DESC LIMIT 1',
  );
  if (existing) return existing.id;
  const created = await one<{ id: string }>(
    manager,
    "INSERT INTO consent_form_version(version,title,items,published_by) VALUES(1,'با آگاهی، کنار هم',$1,$2) RETURNING id",
    [JSON.stringify(initialConsentItems), publishedBy],
  );
  if (!created) throw new Error('Consent version seed failed');
  return created.id;
}

async function ensureConsent(
  manager: EntityManager,
  personId: string,
  signerPersonId: string,
  versionId: string,
): Promise<void> {
  await rows(
    manager,
    'INSERT INTO consent_record(person_id,signer_id,version_id,accepted_items) SELECT $1,u.id,$2,$3 FROM app_user u WHERE u.person_id=$4 AND NOT EXISTS(SELECT 1 FROM consent_record WHERE person_id=$1 AND version_id=$2)',
    [
      personId,
      versionId,
      [...requiredConsentItems, 'public_photos', 'public_audio'],
      signerPersonId,
    ],
  );
}

export async function seedHierarchy(db: DataSource): Promise<{
  people: number;
  groups: number;
  accounts: ReturnType<typeof hierarchyAccounts>;
}> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Hierarchy seed is disabled in production');
  const crypto = new CryptoService();
  const password = await new PasswordProvider().hash(HIERARCHY_PASSWORD);
  const owners = groupOwners(HIERARCHY_ROSTER);
  const personIds = HIERARCHY_ROSTER.map((row) => hierarchyPersonId(row.n));

  await db.transaction(async (manager) => {
    await rows(manager, "SELECT set_config('app.worker','on',true)");
    await rows(manager, 'SELECT pg_advisory_xact_lock(739203)');

    for (const row of HIERARCHY_ROSTER) {
      const id = hierarchyPersonId(row.n);
      const nationalId = demoNationalId(900 + row.n);
      const birth = `${new Date().getUTCFullYear() - row.age}-03-15`;
      const level = orgLevelOf(row);
      await rows(
        manager,
        `INSERT INTO person(id,first_name,last_name,father_name,birth_date,national_id_enc,national_id_hash,phone,org_level,external,search_name,consent_required)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,false)
         ON CONFLICT(id) DO UPDATE SET
           first_name=EXCLUDED.first_name,
           last_name=EXCLUDED.last_name,
           father_name=EXCLUDED.father_name,
           birth_date=EXCLUDED.birth_date,
           phone=EXCLUDED.phone,
           org_level=EXCLUDED.org_level,
           search_name=EXCLUDED.search_name,
           consent_required=false,
           updated_at=now()`,
        [
          id,
          row.first,
          row.last,
          'محمد',
          birth,
          crypto.encrypt(nationalId, 'national-id'),
          crypto.nationalIdHash(nationalId),
          hierarchyPhone(row.n),
          level,
          normalizePersian(`${row.first} ${row.last}`),
        ],
      );
      await rows(
        manager,
        `INSERT INTO app_user(id,person_id,login,password_hash,is_admin,is_parent)
         VALUES($1,$2,$3,$4,false,false)
         ON CONFLICT(person_id) DO UPDATE SET login=EXCLUDED.login`,
        [hierarchyUserId(row.n), id, hierarchyPhone(row.n), password],
      );
    }

    for (const [groupNum, ownerN] of owners) {
      await rows(
        manager,
        `INSERT INTO organization_group(id,name,owner_person_id)
         VALUES($1,$2,$3)
         ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, owner_person_id=EXCLUDED.owner_person_id, updated_at=now()`,
        [hierarchyGroupId(groupNum), safaName(groupNum), hierarchyPersonId(ownerN)],
      );
    }

    await rows(
      manager,
      'UPDATE membership SET valid_to=now() WHERE person_id=ANY($1::uuid[]) AND valid_to IS NULL',
      [personIds],
    );

    for (const row of HIERARCHY_ROSTER) {
      const memberGroup = memberGroupOf(row);
      if (memberGroup === undefined) continue;
      if (!owners.has(memberGroup)) {
        throw new Error(
          `Member group صفا ${memberGroup} has no owner from مربی column (person n=${row.n})`,
        );
      }
      await rows(
        manager,
        "INSERT INTO membership(person_id,group_id,role) VALUES($1,$2,'member')",
        [hierarchyPersonId(row.n), hierarchyGroupId(memberGroup)],
      );
      if (row.komak) {
        await rows(
          manager,
          "INSERT INTO membership(person_id,group_id,role) VALUES($1,$2,'assistant')",
          [hierarchyPersonId(row.n), hierarchyGroupId(row.komak)],
        );
      }
    }

    await rebuildSeedHierarchy(manager);

    const versionId = await ensureConsentVersion(
      manager,
      hierarchyPersonId(1),
    );
    for (const row of HIERARCHY_ROSTER) {
      await ensureConsent(
        manager,
        hierarchyPersonId(row.n),
        hierarchyPersonId(row.n),
        versionId,
      );
    }
  });

  return {
    people: HIERARCHY_ROSTER.length,
    groups: owners.size,
    accounts: hierarchyAccounts(),
  };
}

async function main(): Promise<void> {
  await database.initialize();
  try {
    const result = await seedHierarchy(database);
    console.log(
      `🌱 Hierarchy seed completed: ${result.people} people, ${result.groups} groups.`,
    );
    console.log(`Password (all): ${HIERARCHY_PASSWORD}`);
    console.log('Sample logins:');
    for (const account of result.accounts.filter((a) =>
      ['supervisor', 'mentor'].includes(a.level) || a.n <= 6,
    )) {
      const bits = [
        account.phone,
        account.name,
        account.level,
        account.owns ? `owns صفا ${account.owns}` : undefined,
        account.memberOf ? `member صفا ${account.memberOf}` : undefined,
        account.assistantOf ? `assistant صفا ${account.assistantOf}` : undefined,
      ].filter(Boolean);
      console.log(`  ${bits.join(' | ')}`);
    }
    console.log(
      `… ${result.accounts.length} accounts total; see docs/REAL_HIERARCHY_SEED.md`,
    );
  } finally {
    await database.destroy();
  }
}

if (require.main === module)
  void main().catch((error: unknown) => {
    console.error('❌ Hierarchy seed failed.', error);
    process.exitCode = 1;
  });
