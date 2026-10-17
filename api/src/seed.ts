import { initialConsentItems } from './libs/config/defaults';
import 'dotenv/config';
import { DataSource, EntityManager } from 'typeorm';
import { normalizePersian, requiredConsentItems } from '@safanoor/shared';
import database from './libs/database/data-source';
import { CryptoService } from './libs/security/crypto.service';
import { one, rows } from './libs/database/database.types';
import { PasswordProvider } from './modules/auth/password.provider';

export const demoId = (number: number): string =>
  `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export const demoGroupId = (number: number): string =>
  `20000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export const DEMO_PASSWORD = 'SafanoorDemo#1405';
export function demoNationalId(number: number): string {
  const base = String(800000000 + number).padStart(9, '0');
  const remainder =
    [...base].reduce(
      (sum, digit, index) => sum + Number(digit) * (10 - index),
      0,
    ) % 11;
  return base + String(remainder < 2 ? remainder : 11 - remainder);
}
export async function rebuildSeedHierarchy(
  manager: EntityManager,
): Promise<void> {
  await rows(manager, 'DELETE FROM person_ancestors');
  await rows(
    manager,
    `INSERT INTO person_ancestors WITH RECURSIVE c(person_id,ancestor_id,depth,path) AS (SELECT m.person_id,g.owner_person_id,1,ARRAY[m.person_id,g.owner_person_id] FROM membership m JOIN organization_group g ON g.id=m.group_id WHERE m.role='member' AND m.valid_to IS NULL UNION ALL SELECT c.person_id,g.owner_person_id,c.depth+1,c.path||g.owner_person_id FROM c JOIN membership m ON m.person_id=c.ancestor_id AND m.role='member' AND m.valid_to IS NULL JOIN organization_group g ON g.id=m.group_id WHERE NOT g.owner_person_id=ANY(c.path)) SELECT person_id,ancestor_id,min(depth) FROM c GROUP BY person_id,ancestor_id`,
  );
}
export async function seed(db: DataSource): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo seed is disabled in production');
  const crypto = new CryptoService();
  const password = await new PasswordProvider().hash(DEMO_PASSWORD);
  await db.transaction(async (manager) => {
    await rows(manager, "SELECT set_config('app.worker','on',true)");
    await rows(manager, 'SELECT pg_advisory_xact_lock(739201)');
    const people: {
      n: number;
      first: string;
      last: string;
      level: string;
      age: number;
      external?: boolean;
      parent?: boolean;
      admin?: boolean;
    }[] = [
      { n: 1, first: 'محمد', last: 'رضایی', level: 'supervisor', age: 52 },
      { n: 2, first: 'حسین', last: 'مهدوی', level: 'head_mentor', age: 38 },
      { n: 3, first: 'علی', last: 'کریمی', level: 'mentor', age: 30 },
      { n: 4, first: 'مهدی', last: 'نوری', level: 'mentor', age: 29 },
      { n: 5, first: 'امیرحسین', last: 'صدری', level: 'assistant', age: 22 },
      { n: 6, first: 'محمدطاها', last: 'کاظمی', level: 'assistant', age: 21 },
      { n: 7, first: 'رضا', last: 'حیدری', level: 'assistant', age: 23 },
      {
        n: 31,
        first: 'فاطمه',
        last: 'آرمانی',
        level: 'member',
        age: 44,
        external: true,
        parent: true,
      },
      {
        n: 32,
        first: 'زهرا',
        last: 'امین',
        level: 'member',
        age: 42,
        external: true,
        parent: true,
      },
      {
        n: 40,
        first: 'مدیر',
        last: 'سامانه',
        level: 'member',
        age: 35,
        external: true,
        admin: true,
      },
    ];
    const names = [
      'یاسین',
      'پارسا',
      'آراد',
      'محمد',
      'علی‌رضا',
      'امیرعلی',
      'حسام',
      'کیان',
      'طاها',
      'سجاد',
      'مصطفی',
      'ابوالفضل',
    ];
    for (let i = 0; i < 12; i++)
      people.push({
        n: 11 + i,
        first: names[i],
        last: ['احمدی', 'امیری', 'صادقی', 'موسوی'][i % 4],
        level: 'member',
        age: i % 3 === 2 ? 20 : 14 + (i % 3),
      });
    for (const item of people) {
      const id = demoId(item.n);
      const nationalId = demoNationalId(item.n);
      const birth = `${new Date().getUTCFullYear() - item.age}-02-01`;
      await rows(
        manager,
        `INSERT INTO person(id,first_name,last_name,father_name,birth_date,national_id_enc,national_id_hash,phone,org_level,external,search_name,consent_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO NOTHING`,
        [
          id,
          item.first,
          item.last,
          item.external ? null : 'احمد',
          item.external ? null : birth,
          item.external ? null : crypto.encrypt(nationalId, 'national-id'),
          item.external ? null : crypto.nationalIdHash(nationalId),
          `+98910${String(item.n).padStart(7, '0')}`,
          item.level,
          item.external ?? false,
          normalizePersian(`${item.first} ${item.last}`),
          item.n === 15,
        ],
      );
      await rows(
        manager,
        'INSERT INTO app_user(id,person_id,login,password_hash,is_admin,is_parent) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(person_id) DO NOTHING',
        [
          `30000000-0000-4000-8000-${String(item.n).padStart(12, '0')}`,
          id,
          `+98910${String(item.n).padStart(7, '0')}`,
          password,
          item.admin ?? false,
          item.parent ?? false,
        ],
      );
    }
    for (const [n, name, owner] of [
      [1, 'حلقهٔ ناظران', 1],
      [2, 'همراهان', 2],
      [3, 'رویش', 3],
      [4, 'باران', 4],
    ] as const)
      await rows(
        manager,
        'INSERT INTO organization_group(id,name,owner_person_id) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',
        [demoGroupId(n), name, demoId(owner)],
      );
    const memberships = [
      [2, 1],
      [3, 2],
      [4, 2],
      [5, 3],
      [6, 3],
      [7, 4],
      ...Array.from({ length: 12 }, (_, i) => [11 + i, i < 6 ? 3 : 4]),
    ];
    for (const [person, group] of memberships)
      await rows(
        manager,
        "INSERT INTO membership(person_id,group_id,role) SELECT $1,$2,'member' WHERE NOT EXISTS(SELECT 1 FROM membership WHERE person_id=$1 AND role='member' AND valid_to IS NULL)",
        [demoId(person), demoGroupId(group)],
      );
    for (const [person, group] of [
      [5, 3],
      [6, 3],
      [7, 4],
    ])
      await rows(
        manager,
        "INSERT INTO membership(person_id,group_id,role) VALUES($1,$2,'assistant') ON CONFLICT DO NOTHING",
        [demoId(person), demoGroupId(group)],
      );
    for (let i = 0; i < 12; i++)
      await rows(
        manager,
        'INSERT INTO follow_up_assignment(member_person_id,assistant_person_id,group_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [
          demoId(11 + i),
          demoId(i < 3 ? 5 : i < 6 ? 6 : 7),
          demoGroupId(i < 6 ? 3 : 4),
        ],
      );
    await rows(
      manager,
      "INSERT INTO group_role(group_id,person_id,role) VALUES($1,$2,'finance_officer') ON CONFLICT DO NOTHING",
      [demoGroupId(3), demoId(5)],
    );
    await rebuildSeedHierarchy(manager);
    const items = initialConsentItems;
    const version = await one<{ id: string }>(
      manager,
      "INSERT INTO consent_form_version(version,title,items,published_by) VALUES(1,'با آگاهی، کنار هم',$1,$2) ON CONFLICT(version) DO UPDATE SET title=consent_form_version.title RETURNING id",
      [JSON.stringify(items), demoId(40)],
    );
    if (!version) throw new Error('Consent seed failed');
    for (const item of people) {
      const minor = !item.external && item.age < 18;
      const parentNumber = item.n < 14 ? 31 : 32;
      if (minor)
        await rows(
          manager,
          'INSERT INTO parent_link(parent_user_id,child_person_id,confirmed_by) SELECT id,$2,$3 FROM app_user WHERE person_id=$1 ON CONFLICT(parent_user_id,child_person_id) DO NOTHING',
          [demoId(parentNumber), demoId(item.n), demoId(item.n < 17 ? 3 : 4)],
        );
      if (item.n === 15) continue;
      const signer = minor ? demoId(parentNumber) : demoId(item.n);
      await rows(
        manager,
        'INSERT INTO consent_record(person_id,signer_id,version_id,accepted_items) SELECT $1,u.id,$2,$3 FROM app_user u WHERE u.person_id=$4 AND NOT EXISTS(SELECT 1 FROM consent_record WHERE person_id=$1 AND version_id=$2)',
        [
          demoId(item.n),
          version.id,
          item.n % 2 === 0
            ? [...requiredConsentItems, 'public_photos', 'public_audio']
            : [...requiredConsentItems],
          signer,
        ],
      );
    }
    for (const [type, days, action] of [
      ['meeting_audio', 30, 'delete'],
      ['temporary_upload', 3, 'delete'],
      ['permit_photo', 365, 'delete'],
      ['audit_log', 730, 'delete'],
      ['notification', 90, 'delete'],
      ['left_person', 395, 'anonymize'],
    ] as const)
      await rows(
        manager,
        'INSERT INTO retention_policy(data_type,keep_days,action) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [type, days, action],
      );
    for (const [type, n, owner, role] of [
      ['person_file', 51, 3, 'mentor'],
      ['confidential_note', 52, 5, 'assistant'],
      ['consultation_summary', 53, 11, 'mentor'],
      ['consultation_private_note', 54, 5, 'assistant'],
    ] as const)
      await rows(
        manager,
        'INSERT INTO resource_registry(resource_type,resource_id,member_person_id,owner_person_id,owner_role,group_ids) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
        [type, demoId(n), demoId(11), demoId(owner), role, [demoGroupId(3)]],
      );
    const fixture = {
      jointCamp: {
        groups: [demoGroupId(3), demoGroupId(4)],
        participants: 12,
        status: 'draft',
      },
      privateBlocks: [
        {
          personId: demoId(11),
          weekday: 6,
          start: '16:00',
          end: '18:00',
          label: 'برنامهٔ شخصی',
        },
      ],
      consultations: [
        {
          memberId: demoId(11),
          sharedSummary: 'هدف هفته مشخص شد.',
          privateNote: 'یادداشت مصنوعی و محرمانهٔ آزمون',
        },
      ],
      fund: { groupId: demoGroupId(3), balance: 200000 },
      ledger: [
        {
          amount: 200000,
          from: 'mentor_personal',
          to: 'fund',
          category: 'contribution',
        },
      ],
    };
    await rows(
      manager,
      'INSERT INTO seed_scenario(name,metadata,confidential_enc) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [
        'phase-one-policy-fixtures',
        JSON.stringify({ synthetic: true, groups: 2, participants: 12 }),
        crypto.encrypt(JSON.stringify(fixture), 'seed-fixture'),
      ],
    );
    for (const item of people) {
      const notification = await one<{ id: string }>(
        manager,
        "INSERT INTO notification(recipient_id,type,dedupe_key) VALUES($1,'welcome',$2) ON CONFLICT DO NOTHING RETURNING id",
        [demoId(item.n), `welcome:${demoId(item.n)}`],
      );
      if (notification)
        await rows(
          manager,
          'INSERT INTO notification_delivery(notification_id) VALUES($1) ON CONFLICT DO NOTHING',
          [notification.id],
        );
    }
  });
}
async function main(): Promise<void> {
  await database.initialize();
  try {
    await seed(database);
    console.log(
      '🌱 Demo seed completed. Credentials are documented for local development only.',
    );
  } finally {
    await database.destroy();
  }
}
if (require.main === module)
  void main().catch(() => {
    console.error(
      '❌ Demo seed failed. Check migrations and local environment.',
    );
    process.exitCode = 1;
  });
