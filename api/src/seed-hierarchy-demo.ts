import 'dotenv/config';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { DataSource, EntityManager } from 'typeorm';
import { normalizePersian } from '@safanoor/shared';
import database from './libs/database/data-source';
import { one, rows } from './libs/database/database.types';
import { CryptoService } from './libs/security/crypto.service';
import {
  EncryptedStorageAdapter,
  LocalStorageAdapter,
  S3StorageAdapter,
  StorageAdapter,
} from './modules/files/storage';
import {
  hierarchyGroupId,
  hierarchyPersonId,
  HIERARCHY_ROSTER,
  seedHierarchy,
} from './seed-hierarchy';

/** Stable UUID namespace for hierarchy presentation fixtures (local only). */
export const hierarchyDemoId = (n: number): string =>
  `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** App storage: encrypted S3 when STORAGE_DRIVER=s3 (local MinIO/S3Proxy), else local disk. */
let demoStorage: StorageAdapter | null = null;
let s3ObjectsWritten = 0;

function getDemoStorage(): StorageAdapter {
  if (demoStorage) return demoStorage;
  if (process.env.STORAGE_DRIVER === 's3') {
    demoStorage = new EncryptedStorageAdapter(new S3StorageAdapter());
  } else {
    demoStorage = new LocalStorageAdapter();
  }
  return demoStorage;
}

async function putDemoObject(
  key: string,
  body: Buffer,
  mime: string,
): Promise<void> {
  await getDemoStorage().put(key, body, mime);
  if (process.env.STORAGE_DRIVER === 's3') s3ObjectsWritten += 1;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86400000);
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86400000);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function upsertLocation(
  manager: EntityManager,
  id: string,
  label: string,
  createdBy: string,
): Promise<string> {
  const normalized = normalizePersian(label);
  const existing = await one<{ id: string }>(
    manager,
    'SELECT id FROM location_option WHERE label_normalized=$1',
    [normalized],
  );
  if (existing) return existing.id;
  await rows(
    manager,
    `INSERT INTO location_option(id,label,label_normalized,active,created_by)
     VALUES($1,$2,$3,true,$4)`,
    [id, label, normalized, createdBy],
  );
  return id;
}

async function seedLocations(
  manager: EntityManager,
  mentorId: string,
): Promise<string[]> {
  const places = [
    'مسجد جامع صفا',
    'سالن اجتماعات',
    'حیاط مسجد',
    'کتابخانهٔ گروه',
    'اردوگاه شمال',
  ];
  const ids: string[] = [];
  for (const [i, label] of places.entries()) {
    ids.push(await upsertLocation(manager, hierarchyDemoId(10 + i), label, mentorId));
  }
  return ids;
}

async function seedFollowUps(manager: EntityManager): Promise<number> {
  // Assistants of صفا ۲۷ follow a rotating subset of group members.
  const groupId = hierarchyGroupId(27);
  const assistants = await rows<{ id: string }>(
    manager,
    `SELECT m.person_id AS id FROM membership m
     WHERE m.group_id=$1 AND m.role='assistant' AND m.valid_to IS NULL
     ORDER BY m.person_id`,
    [groupId],
  );
  const members = await rows<{ id: string }>(
    manager,
    `SELECT m.person_id AS id FROM membership m
     JOIN person p ON p.id=m.person_id
     WHERE m.group_id=$1 AND m.role='member' AND m.valid_to IS NULL
       AND p.org_level IN ('member','assistant')
     ORDER BY m.person_id`,
    [groupId],
  );
  if (!assistants.length || !members.length) return 0;
  let n = 0;
  for (const [index, member] of members.entries()) {
    const assistant = assistants[index % assistants.length]!;
    if (assistant.id === member.id) continue;
    const id = hierarchyDemoId(100 + n);
    await rows(
      manager,
      `INSERT INTO follow_up_assignment(id,member_person_id,assistant_person_id,group_id,from_date,to_date)
       VALUES($1,$2,$3,$4,$5,NULL)
       ON CONFLICT(id) DO UPDATE SET
         member_person_id=EXCLUDED.member_person_id,
         assistant_person_id=EXCLUDED.assistant_person_id,
         to_date=NULL`,
      [id, member.id, assistant.id, groupId, daysAgo(30 + (n % 10))],
    );
    n += 1;
  }
  // صفا ۲۰: assistants follow pure members
  const g20 = hierarchyGroupId(20);
  const a20 = await rows<{ id: string }>(
    manager,
    `SELECT person_id AS id FROM membership
     WHERE group_id=$1 AND role='assistant' AND valid_to IS NULL ORDER BY person_id`,
    [g20],
  );
  const m20 = await rows<{ id: string }>(
    manager,
    `SELECT m.person_id AS id FROM membership m
     JOIN person p ON p.id=m.person_id
     WHERE m.group_id=$1 AND m.role='member' AND m.valid_to IS NULL AND p.org_level='member'
     ORDER BY m.person_id`,
    [g20],
  );
  // Presentation focus first: مصطفی بهبهانی follows up to 8 صفا ۲۰ members
  // (unique partial index: one active follow-up per member).
  const behbahani = hierarchyPersonId(3);
  const behbahaniFocus = new Set<string>();
  for (const [index, member] of m20.slice(0, 8).entries()) {
    if (member.id === behbahani) continue;
    behbahaniFocus.add(member.id);
    await rows(
      manager,
      `UPDATE follow_up_assignment SET to_date=COALESCE(to_date,now())
       WHERE member_person_id=$1 AND to_date IS NULL AND id<>$2`,
      [member.id, hierarchyDemoId(190 + index)],
    );
    await rows(
      manager,
      `INSERT INTO follow_up_assignment(id,member_person_id,assistant_person_id,group_id,from_date,to_date)
       VALUES($1,$2,$3,$4,$5,NULL)
       ON CONFLICT(id) DO UPDATE SET
         member_person_id=EXCLUDED.member_person_id,
         assistant_person_id=EXCLUDED.assistant_person_id,
         to_date=NULL`,
      [
        hierarchyDemoId(190 + index),
        member.id,
        behbahani,
        g20,
        daysAgo(7),
      ],
    );
    n += 1;
  }

  for (const [index, member] of m20.entries()) {
    if (behbahaniFocus.has(member.id)) continue;
    const assistant = a20[index % Math.max(a20.length, 1)];
    if (!assistant || assistant.id === member.id) continue;
    await rows(
      manager,
      `UPDATE follow_up_assignment SET to_date=COALESCE(to_date,now())
       WHERE member_person_id=$1 AND to_date IS NULL AND id<>$2`,
      [member.id, hierarchyDemoId(180 + index)],
    );
    await rows(
      manager,
      `INSERT INTO follow_up_assignment(id,member_person_id,assistant_person_id,group_id,from_date,to_date)
       VALUES($1,$2,$3,$4,$5,NULL)
       ON CONFLICT(id) DO UPDATE SET
         member_person_id=EXCLUDED.member_person_id,
         assistant_person_id=EXCLUDED.assistant_person_id,
         to_date=NULL`,
      [
        hierarchyDemoId(180 + index),
        member.id,
        assistant.id,
        g20,
        daysAgo(14),
      ],
    );
    n += 1;
  }
  return n;
}

async function seedGroupRoles(manager: EntityManager): Promise<void> {
  // Finance officers for owned groups
  const pairs: [number, number][] = [
    [27, 3], // بهبهانی
    [20, 38], // جعفری
    [34, 17], // شایان
    [33, 30], // کریمی
  ];
  for (const [groupNum, personN] of pairs) {
    await rows(
      manager,
      `INSERT INTO group_role(group_id,person_id,role)
       SELECT $1,$2,'finance_officer'
       WHERE NOT EXISTS (
         SELECT 1 FROM group_role
         WHERE group_id=$1 AND role='finance_officer' AND valid_to IS NULL
       )`,
      [hierarchyGroupId(groupNum), hierarchyPersonId(personN)],
    );
  }
}

async function seedConsultations(manager: EntityManager): Promise<number> {
  const groupId = hierarchyGroupId(27);
  const mentorId = hierarchyPersonId(37);
  const assistantId = hierarchyPersonId(3);
  const members = [
    hierarchyPersonId(6), // may not be in 27 - skip if not member
    hierarchyPersonId(9),
    hierarchyPersonId(10),
    hierarchyPersonId(15),
    hierarchyPersonId(4),
    hierarchyPersonId(5),
    hierarchyPersonId(8),
    hierarchyPersonId(11),
  ];
  const inGroup = await rows<{ id: string }>(
    manager,
    `SELECT person_id AS id FROM membership
     WHERE group_id=$1 AND role='member' AND valid_to IS NULL AND person_id=ANY($2::uuid[])`,
    [groupId, members],
  );
  const targets =
    inGroup.length > 0
      ? inGroup.map((r) => r.id)
      : (
          await rows<{ id: string }>(
            manager,
            `SELECT person_id AS id FROM membership
             WHERE group_id=$1 AND role='member' AND valid_to IS NULL
             ORDER BY person_id LIMIT 8`,
            [groupId],
          )
        ).map((r) => r.id);

  const summaries = [
    'دربارهٔ نظم مطالعه و برنامهٔ هفتگی صحبت شد؛ توافق شد هر شب ۳۰ دقیقه مرور کند.',
    'پیگیری وضعیت مدرسه و ارتباط با خانواده؛ خلاصه برای خود نیرو قابل مشاهده است.',
    'گفت‌وگوی تلفنی دربارهٔ حضور در برنامه‌های گروهی و اردوی پیش‌رو.',
    'مرور مسئولیت‌های کمک‌مربی و هماهنگی پیگیری نیروها.',
    'جمع‌بندی انگیزه و هدف‌گذاری ماه آینده در مسیر مطالعاتی.',
  ];
  let count = 0;
  for (const [i, personId] of targets.entries()) {
    const id = hierarchyDemoId(200 + i);
    const authorId = i % 2 === 0 ? mentorId : assistantId;
    await rows(
      manager,
      `INSERT INTO consultation(id,group_id,author_id,held_at,kind,duration_minutes,place,shared_summary)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(id) DO UPDATE SET shared_summary=EXCLUDED.shared_summary, updated_at=now()`,
      [
        id,
        groupId,
        authorId,
        daysAgo(2 + i * 3),
        i % 3 === 0 ? 'phone' : 'in_person',
        20 + (i % 4) * 15,
        i % 3 === 0 ? null : 'مسجد جامع صفا',
        summaries[i % summaries.length],
      ],
    );
    await rows(
      manager,
      `INSERT INTO consultation_member(consultation_id,person_id) VALUES($1,$2)
       ON CONFLICT DO NOTHING`,
      [id, personId],
    );
    if (i % 2 === 0) {
      await rows(
        manager,
        `INSERT INTO consultation_private_note(id,consultation_id,author_id,body)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(consultation_id) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`,
        [
          hierarchyDemoId(250 + i),
          id,
          authorId,
          'یادداشت خصوصی آزمایشی — فقط نویسنده و مربی گروه می‌بینند.',
        ],
      );
    }
    count += 1;
  }
  return count;
}

async function seedMeetings(manager: EntityManager): Promise<number> {
  const groupId = hierarchyGroupId(27);
  const mentorId = hierarchyPersonId(37);
  const attendees = await rows<{ id: string }>(
    manager,
    `SELECT person_id AS id FROM membership
     WHERE group_id=$1 AND valid_to IS NULL
     ORDER BY person_id LIMIT 12`,
    [groupId],
  );
  const specs = [
    {
      id: hierarchyDemoId(300),
      title: 'جلسهٔ هماهنگی هفتگی صفا ۲۷',
      kind: 'workgroup',
      status: 'approved',
      days: 5,
      resolutionId: hierarchyDemoId(320),
    },
    {
      id: hierarchyDemoId(301),
      title: 'بررسی اردوی نیم‌سال',
      kind: 'public',
      status: 'recorded',
      days: 12,
      resolutionId: hierarchyDemoId(321),
    },
    {
      id: hierarchyDemoId(302),
      title: 'مرور مسیر مطالعاتی',
      kind: 'workgroup',
      status: 'draft',
      days: 1,
      resolutionId: hierarchyDemoId(322),
    },
  ];
  for (const spec of specs) {
    await rows(
      manager,
      `INSERT INTO meeting(id,group_id,held_at,kind,title,place,status,created_by,agenda,summary)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, status=EXCLUDED.status`,
      [
        spec.id,
        groupId,
        daysAgo(spec.days),
        spec.kind,
        spec.title,
        'سالن اجتماعات',
        spec.status,
        mentorId,
        '۱) گزارش هفته\n۲) برنامه‌های پیش‌رو\n۳) مصوبات',
        spec.status === 'draft'
          ? ''
          : 'جلسه با مرور وضعیت گروه و تعیین مسئولیت‌ها جمع‌بندی شد.',
      ],
    );
    for (const person of [mentorId, ...attendees.map((a) => a.id)].slice(0, 10)) {
      await rows(
        manager,
        `INSERT INTO meeting_attendee(meeting_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
        [spec.id, person],
      );
    }
    if (spec.status !== 'draft') {
      await rows(
        manager,
        `INSERT INTO resolution(id,meeting_id,body,assignee_id,due_date,sort_order)
         VALUES($1,$2,$3,$4,$5,0)
         ON CONFLICT(id) DO UPDATE SET body=EXCLUDED.body`,
        [
          spec.resolutionId,
          spec.id,
          'تهیهٔ فهرست نیروهای نیازمند پیگیری تا پایان هفته',
          hierarchyPersonId(3),
          isoDate(daysFromNow(7)),
        ],
      );
    }
  }
  return specs.length;
}

async function seedCampsAndFinance(manager: EntityManager): Promise<number> {
  const groupId = hierarchyGroupId(27);
  const mentorId = hierarchyPersonId(37);
  const campId = hierarchyDemoId(400);
  const camp2Id = hierarchyDemoId(401);
  const starts = isoDate(daysFromNow(10));
  const ends = isoDate(daysFromNow(13));

  await rows(
    manager,
    `INSERT INTO camp(
       id,group_id,organizer_person_id,title,place,purpose,cost_amount,duration_text,
       starts_on,ends_on,schedule_text,status,price_per_person,created_by
     ) VALUES(
       $1,$2,$3,'اردوی آزمایشی شمال','اردوگاه شمال','آشنایی و تقویت روحیهٔ گروهی',
       45000000,'۳ شب و ۴ روز',$4,$5,'برنامهٔ روزانه بعد از استقرار اعلام می‌شود',
       'registration',2500000,$3
     )
     ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status, title=EXCLUDED.title`,
    [campId, groupId, mentorId, starts, ends],
  );

  await rows(
    manager,
    `INSERT INTO camp(
       id,group_id,organizer_person_id,title,place,purpose,cost_amount,duration_text,
       starts_on,ends_on,status,price_per_person,created_by
     ) VALUES(
       $1,$2,$3,'اردوی یک‌روزهٔ محلی','حیاط مسجد','برنامهٔ سبک هفتگی',
       5000000,'۱ روز',$4,$4,'running',300000,$3
     )
     ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status`,
    [camp2Id, groupId, mentorId, isoDate(daysAgo(1))],
  );

  const participants = await rows<{ id: string }>(
    manager,
    `SELECT person_id AS id FROM membership
     WHERE group_id=$1 AND role='member' AND valid_to IS NULL
     ORDER BY person_id LIMIT 15`,
    [groupId],
  );
  for (const person of participants) {
    await rows(
      manager,
      `INSERT INTO camp_participant(camp_id,person_id,group_id,status)
       VALUES($1,$2,$3,'confirmed') ON CONFLICT DO NOTHING`,
      [campId, person.id, groupId],
    );
    await rows(
      manager,
      `INSERT INTO camp_participant(camp_id,person_id,group_id,status)
       VALUES($1,$2,$3,'accepted') ON CONFLICT DO NOTHING`,
      [camp2Id, person.id, groupId],
    );
  }

  await rows(
    manager,
    `INSERT INTO camp_notice(camp_id,meeting_time,meeting_place,items_to_bring)
     VALUES($1,$2,'درب مسجد','کوله، بطری آب، لباس اضافه، کارت شناسایی')
     ON CONFLICT(camp_id) DO UPDATE SET items_to_bring=EXCLUDED.items_to_bring`,
    [campId, daysFromNow(10)],
  );

  await rows(
    manager,
    `INSERT INTO camp_schedule_item(id,camp_id,day,start_time,end_time,title,sort_order)
     VALUES
       ($1,$3,$4,'08:00','09:00','صبحانه و آماده‌سازی',0),
       ($2,$3,$4,'09:30','12:00','برنامهٔ گروهی',1)
     ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title`,
    [hierarchyDemoId(410), hierarchyDemoId(411), campId, starts],
  );

  // Permit image — store via app adapter (encrypted S3 in local demo).
  const permitFileId = hierarchyDemoId(420);
  const permitKey = hierarchyDemoId(4210);
  const sample = join(__dirname, '../seed-assets/album/06-logo.png');
  const permitBody = existsSync(sample)
    ? readFileSync(sample)
    : Buffer.from('demo-permit-png-placeholder');
  await putDemoObject(permitKey, permitBody, 'image/png');
  await rows(
    manager,
    `INSERT INTO file_record(id,kind,storage_key,size,mime_type,created_by)
     VALUES($1,'camp_permit',$2,$3,'image/png',$4)
     ON CONFLICT(id) DO UPDATE SET storage_key=EXCLUDED.storage_key, size=EXCLUDED.size`,
    [permitFileId, permitKey, permitBody.length || 1, mentorId],
  );
  await rows(
    manager,
    `INSERT INTO camp_permit(id,camp_id,image_file_id,uploaded_by,status)
     VALUES($1,$2,$3,$4,'obtained')
     ON CONFLICT(camp_id) DO UPDATE SET status='obtained'`,
    [hierarchyDemoId(421), campId, permitFileId, mentorId],
  );

  const eventId = hierarchyDemoId(430);
  await rows(
    manager,
    `INSERT INTO program_event(
       id,group_id,kind,title,camp_id,held_at,place,notes,created_by,total_amount,member_payment_amount
     ) VALUES(
       $1,$2,'camp','هزینهٔ اردوی شمال',$3,$4,'اردوگاه شمال','دادهٔ آزمایشی',$5,45000000,2500000
     )
     ON CONFLICT(id) DO UPDATE SET total_amount=EXCLUDED.total_amount`,
    [eventId, groupId, campId, daysFromNow(10), mentorId],
  );
  const customEventId = hierarchyDemoId(431);
  await rows(
    manager,
    `INSERT INTO program_event(
       id,group_id,kind,title,held_at,place,notes,created_by,total_amount,member_payment_amount
     ) VALUES(
       $1,$2,'custom','پذیرایی جلسهٔ ماهانه',$3,'سالن اجتماعات','چای و شیرینی',$4,1800000,0
     )
     ON CONFLICT(id) DO UPDATE SET total_amount=EXCLUDED.total_amount`,
    [customEventId, groupId, daysAgo(3), mentorId],
  );

  const costs: [string, string, number, boolean][] = [
    [hierarchyDemoId(440), 'ایاب و ذهاب', 12000000, false],
    [hierarchyDemoId(441), 'اقامت', 18000000, false],
    [hierarchyDemoId(442), 'پذیرایی', 8000000, true],
    [hierarchyDemoId(443), 'لوازم برنامه', 7000000, false],
  ];
  for (const [id, title, amount, perPerson] of costs) {
    await rows(
      manager,
      `INSERT INTO cost_item(id,owner_type,owner_id,title,amount,per_person,created_by)
       VALUES($1,'program_event',$2,$3,$4,$5,$6)
       ON CONFLICT(id) DO UPDATE SET amount=EXCLUDED.amount, title=EXCLUDED.title`,
      [id, eventId, title, amount, perPerson, mentorId],
    );
  }
  await rows(
    manager,
    `INSERT INTO cost_item(id,owner_type,owner_id,title,amount,per_person,created_by)
     VALUES($1,'program_event',$2,'شیرینی و چای',1800000,false,$3)
     ON CONFLICT(id) DO UPDATE SET amount=EXCLUDED.amount`,
    [hierarchyDemoId(444), customEventId, mentorId],
  );

  return 2;
}

function demoPdf(title: string): Buffer {
  const safe = title.replace(/[()\\]/g, ' ').slice(0, 40);
  const stream = `BT /F1 12 Tf 40 750 Td (${safe}) Tj ET`;
  const body = [
    '%PDF-1.4',
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>endobj',
    `4 0 obj<< /Length ${stream.length} >>stream`,
    stream,
    'endstream',
    'endobj',
    'trailer<< /Root 1 0 R >>',
    '%%EOF',
  ].join('\n');
  return Buffer.from(body, 'utf8');
}

function demoSilentWav(): Buffer {
  const samples = 1600;
  const buf = Buffer.alloc(44 + samples);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(8000, 24);
  buf.writeUInt32LE(8000, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples, 40);
  buf.fill(128, 44);
  return buf;
}

async function seedFileFromBuffer(
  manager: EntityManager,
  opts: {
    id: number;
    storageN: number;
    kind: string;
    mime: string;
    body: Buffer;
    createdBy: string;
  },
): Promise<string> {
  const fileId = hierarchyDemoId(opts.id);
  const storageKey = hierarchyDemoId(opts.storageN);
  await putDemoObject(storageKey, opts.body, opts.mime);
  await rows(
    manager,
    `INSERT INTO file_record(id,kind,storage_key,size,mime_type,created_by)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(id) DO UPDATE SET storage_key=EXCLUDED.storage_key, size=EXCLUDED.size, mime_type=EXCLUDED.mime_type`,
    [
      fileId,
      opts.kind,
      storageKey,
      Math.max(opts.body.length, 1),
      opts.mime,
      opts.createdBy,
    ],
  );
  return fileId;
}

async function seedFileFromAlbumAsset(
  manager: EntityManager,
  opts: {
    id: number;
    storageN: number;
    assetName: string;
    kind: string;
    createdBy: string;
  },
): Promise<string> {
  const full = join(resolve(__dirname, '../seed-assets/album'), opts.assetName);
  const body = readFileSync(full);
  const mime = MIME[extname(opts.assetName).toLowerCase()] ?? 'image/jpeg';
  return seedFileFromBuffer(manager, {
    id: opts.id,
    storageN: opts.storageN,
    kind: opts.kind,
    mime,
    body,
    createdBy: opts.createdBy,
  });
}

async function seedStudyPaths(manager: EntityManager): Promise<number> {
  const groupId = hierarchyGroupId(27);
  const mentorId = hierarchyPersonId(37);
  /** Library only — سیر مطالعاتی (کلاس‌ها are separate LMS items). */
  const paths: {
    id: number;
    title: string;
    description: string;
    coverAsset: string;
    books: readonly {
      title: string;
      author: string;
      coverAsset: string;
      withPdf: boolean;
    }[];
    itemBase: number;
  }[] = [
    {
      id: 500,
      title: 'سیر سیرهٔ معصومین',
      description: 'مسیر مطالعاتی آشنایی با سیره؛ برای نیروهای صفا ۲۷',
      coverAsset: '09-course.webp',
      itemBase: 510,
      books: [
        {
          title: 'انسان ۲۵۰ ساله',
          author: 'سیدعلی خامنه‌ای',
          coverAsset: '01-activity.jpeg',
          withPdf: true,
        },
        {
          title: 'داستان راستان',
          author: 'مرتضی مطهری',
          coverAsset: '02-gathering.jpeg',
          withPdf: true,
        },
        {
          title: 'کلمهٔ طیبه',
          author: '',
          coverAsset: '03-program.jpeg',
          withPdf: false,
        },
        {
          title: 'آیین زندگی',
          author: '',
          coverAsset: '04-team.jpeg',
          withPdf: false,
        },
      ],
    },
    {
      id: 530,
      title: 'سیر مهارت ارتباطی',
      description: 'کارگاه‌های کوتاه گفت‌وگو و پیگیری',
      coverAsset: '10-course.webp',
      itemBase: 531,
      books: [
        {
          title: 'هنر گفت‌وگو',
          author: '',
          coverAsset: '07-studio.png',
          withPdf: true,
        },
        {
          title: 'شنیدن فعال',
          author: '',
          coverAsset: '08-podcast.png',
          withPdf: false,
        },
        {
          title: 'بازخورد سازنده',
          author: '',
          coverAsset: '11-brand.png',
          withPdf: false,
        },
      ],
    },
    {
      id: 540,
      title: 'سیر آمادگی اردو',
      description: 'پیش‌نیازهای رفتاری و ایمنی قبل از اردو',
      coverAsset: '05-background.jpg',
      itemBase: 541,
      books: [
        {
          title: 'آمادگی فردی',
          author: '',
          coverAsset: '06-logo.png',
          withPdf: true,
        },
        {
          title: 'کار تیمی در طبیعت',
          author: '',
          coverAsset: '12-export.png',
          withPdf: false,
        },
      ],
    },
  ];
  let fileN = 800;
  for (const [pathIndex, path] of paths.entries()) {
    const pathId = hierarchyDemoId(path.id);
    const coverFileId = await seedFileFromAlbumAsset(manager, {
      id: fileN++,
      storageN: 7700 + pathIndex,
      assetName: path.coverAsset,
      kind: 'study_path_cover',
      createdBy: mentorId,
    });
    await rows(
      manager,
      `INSERT INTO study_path(id,group_id,title,description,cover_file_id,created_by)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, cover_file_id=EXCLUDED.cover_file_id`,
      [pathId, groupId, path.title, path.description, coverFileId, mentorId],
    );
    for (const [i, book] of path.books.entries()) {
      const coverId = await seedFileFromAlbumAsset(manager, {
        id: fileN++,
        storageN: 7800 + path.itemBase + i,
        assetName: book.coverAsset,
        kind: 'study_path_cover',
        createdBy: mentorId,
      });
      let pdfId: string | null = null;
      if (book.withPdf) {
        pdfId = await seedFileFromBuffer(manager, {
          id: fileN++,
          storageN: 7900 + path.itemBase + i,
          kind: 'study_path_pdf',
          mime: 'application/pdf',
          body: demoPdf(book.title),
          createdBy: mentorId,
        });
      }
      await rows(
        manager,
        `INSERT INTO study_path_item(id,path_id,position,book_title,book_author,notes,cover_file_id,pdf_file_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT(id) DO UPDATE SET book_title=EXCLUDED.book_title,
           cover_file_id=EXCLUDED.cover_file_id, pdf_file_id=EXCLUDED.pdf_file_id`,
        [
          hierarchyDemoId(path.itemBase + i),
          pathId,
          i,
          book.title,
          book.author || null,
          'گام مطالعاتی آزمایشی',
          coverId,
          pdfId,
        ],
      );
    }
  }
  const path20 = hierarchyDemoId(520);
  const cover20 = await seedFileFromAlbumAsset(manager, {
    id: fileN++,
    storageN: 7750,
    assetName: '03-program.jpeg',
    kind: 'study_path_cover',
    createdBy: hierarchyPersonId(1),
  });
  await rows(
    manager,
    `INSERT INTO study_path(id,group_id,title,description,cover_file_id,created_by)
     VALUES($1,$2,'سیر عمومی صفا ۲۰','برای نیروهای گروه بیست',$3,$4)
     ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, cover_file_id=EXCLUDED.cover_file_id`,
    [path20, hierarchyGroupId(20), cover20, hierarchyPersonId(1)],
  );
  const item20Cover = await seedFileFromAlbumAsset(manager, {
    id: fileN++,
    storageN: 7751,
    assetName: '01-activity.jpeg',
    kind: 'study_path_cover',
    createdBy: hierarchyPersonId(1),
  });
  await rows(
    manager,
    `INSERT INTO study_path_item(id,path_id,position,book_title,notes,cover_file_id)
     VALUES($1,$2,0,'نهج‌البلاغه (گزیده)','شروع با خطبه‌های کوتاه',$3)
     ON CONFLICT(id) DO UPDATE SET cover_file_id=EXCLUDED.cover_file_id`,
    [hierarchyDemoId(521), path20, item20Cover],
  );
  return paths.length + 1;
}

async function seedLmsClasses(manager: EntityManager): Promise<number> {
  const groupId = hierarchyGroupId(27);
  const mentorId = hierarchyPersonId(37);
  const audio = demoSilentWav();

  const siraCourseId = hierarchyDemoId(850);
  const eventCourseId = hierarchyDemoId(851);
  await rows(
    manager,
    `INSERT INTO course(id,title) VALUES($1,'سیره در عمل')
     ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title`,
    [siraCourseId],
  );
  await rows(
    manager,
    `INSERT INTO course(id,title) VALUES($1,'آمادگی اردو')
     ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title`,
    [eventCourseId],
  );

  type SessionSeed = {
    recordingN: number;
    itemN: number;
    fileBase: number;
    storageBase: number;
    courseId: string | null;
    sortOrder: number;
    title: string;
    speaker: string;
    summary: string;
    coverAsset: string;
    daysAgo: number;
  };

  const sessions: SessionSeed[] = [
    {
      recordingN: 860,
      itemN: 870,
      fileBase: 880,
      storageBase: 8000,
      courseId: siraCourseId,
      sortOrder: 0,
      title: 'سیره در عمل — جلسهٔ اول',
      speaker: 'محمد گودرزی',
      summary:
        'آغاز مسیر سیره؛ تعریف مفاهیم پایه و پیوند با زندگی روزمرهٔ نیروها.',
      coverAsset: '01-activity.jpeg',
      daysAgo: 21,
    },
    {
      recordingN: 861,
      itemN: 871,
      fileBase: 883,
      storageBase: 8020,
      courseId: siraCourseId,
      sortOrder: 1,
      title: 'سیره در عمل — جلسهٔ دوم',
      speaker: 'محمد گودرزی',
      summary: 'روایت‌های کوتاه و تمرین بازگو کردن برای جمع؛ بازخورد گروهی.',
      coverAsset: '03-program.jpeg',
      daysAgo: 10,
    },
    {
      recordingN: 862,
      itemN: 872,
      fileBase: 886,
      storageBase: 8040,
      courseId: siraCourseId,
      sortOrder: 2,
      title: 'سیره در عمل — جلسهٔ سوم',
      speaker: 'محمد گودرزی',
      summary:
        'روایت کوتاه از سیره و پیوند آن با رفتار روزانه؛ پرسش‌وپاسخ پایانی ضبط شده است.',
      coverAsset: '09-course.webp',
      daysAgo: 3,
    },
    {
      recordingN: 863,
      itemN: 873,
      fileBase: 889,
      storageBase: 8060,
      courseId: eventCourseId,
      sortOrder: 0,
      title: 'آمادگی اردو — ایمنی فردی',
      speaker: 'کمک‌مربی صفا ۲۷',
      summary:
        'چک‌لیست وسایل، نکات گرمازدگی و هماهنگی با مسئول اردو؛ یک جلسهٔ رویدادی.',
      coverAsset: '04-team.jpeg',
      daysAgo: 7,
    },
    {
      recordingN: 864,
      itemN: 874,
      fileBase: 892,
      storageBase: 8080,
      courseId: null,
      sortOrder: 0,
      title: 'گفت‌وگوی مؤثر در گروه',
      speaker: 'محمد گودرزی',
      summary:
        'جلسهٔ مستقل دربارهٔ شنیدن فعال و بازخورد محترمانه؛ بدون سری چندجلسه‌ای.',
      coverAsset: '07-studio.png',
      daysAgo: 14,
    },
  ];

  for (const cls of sessions) {
    const recordingId = hierarchyDemoId(cls.recordingN);
    const itemId = hierarchyDemoId(cls.itemN);
    const coverFileId = await seedFileFromAlbumAsset(manager, {
      id: cls.fileBase,
      storageN: cls.storageBase,
      assetName: cls.coverAsset,
      kind: 'lms_cover',
      createdBy: mentorId,
    });
    const audioFileId = await seedFileFromBuffer(manager, {
      id: cls.fileBase + 1,
      storageN: cls.storageBase + 1,
      kind: 'lms_audio',
      mime: 'audio/wav',
      body: audio,
      createdBy: mentorId,
    });
    await rows(
      manager,
      `INSERT INTO class_recording(id,group_id,title,speaker,summary,audio_file_id,cover_file_id,held_at,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, speaker=EXCLUDED.speaker, summary=EXCLUDED.summary,
         audio_file_id=EXCLUDED.audio_file_id, cover_file_id=EXCLUDED.cover_file_id, held_at=EXCLUDED.held_at`,
      [
        recordingId,
        groupId,
        cls.title,
        cls.speaker,
        cls.summary,
        audioFileId,
        coverFileId,
        daysAgo(cls.daysAgo),
        mentorId,
      ],
    );
    await rows(
      manager,
      `INSERT INTO lms_item(id,recording_id,course_id,sort_order,published_at,published_by)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(id) DO UPDATE SET published_at=EXCLUDED.published_at,
         course_id=EXCLUDED.course_id, sort_order=EXCLUDED.sort_order`,
      [
        itemId,
        recordingId,
        cls.courseId,
        cls.sortOrder,
        daysAgo(cls.daysAgo),
        mentorId,
      ],
    );
  }
  return sessions.length;
}

async function seedCommunications(manager: EntityManager): Promise<number> {
  const groupId = hierarchyGroupId(27);
  const mentorId = hierarchyPersonId(37);
  let groupThread = await one<{ id: string }>(
    manager,
    "SELECT id FROM chat_thread WHERE group_id=$1 AND kind='group'",
    [groupId],
  );
  if (!groupThread) {
    groupThread = await one<{ id: string }>(
      manager,
      `INSERT INTO chat_thread(id,group_id,kind) VALUES($1,$2,'group') RETURNING id`,
      [hierarchyDemoId(600), groupId],
    );
  }
  if (!groupThread) throw new Error('Failed to create group chat thread');

  await rows(
    manager,
    `INSERT INTO chat_thread_participant(thread_id,person_id)
     SELECT $1, g.owner_person_id FROM organization_group g WHERE g.id=$2
     ON CONFLICT DO NOTHING`,
    [groupThread.id, groupId],
  );
  await rows(
    manager,
    `INSERT INTO chat_thread_participant(thread_id,person_id)
     SELECT $1, m.person_id FROM membership m
     WHERE m.group_id=$2 AND m.valid_to IS NULL
     ON CONFLICT DO NOTHING`,
    [groupThread.id, groupId],
  );

  const messages = [
    [mentorId, 'سلام دوستان؛ برنامهٔ هفته را در همینجا هماهنگ می‌کنیم.'],
    [hierarchyPersonId(3), 'سلام؛ لیست حضور جلسهٔ چهارشنبه آماده است.'],
    [hierarchyPersonId(4), 'برای اردو چه وسایلی لازم است؟'],
    [mentorId, 'در اطلاعیهٔ اردو نوشتم؛ کوله، بطری آب و کارت شناسایی.'],
    [hierarchyPersonId(5), 'پس فردا بعد از نماز حاضر می‌شوم.'],
  ] as const;

  for (const [i, [author, body]] of messages.entries()) {
    await rows(
      manager,
      `INSERT INTO chat_message(id,thread_id,author_id,body,created_at)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(id) DO UPDATE SET body=EXCLUDED.body`,
      [
        hierarchyDemoId(610 + i),
        groupThread.id,
        author,
        body,
        new Date(Date.now() - (messages.length - i) * 3600000),
      ],
    );
  }

  // Direct threads via follow-ups
  const followUps = await rows<{
    assistantId: string;
    memberId: string;
  }>(
    manager,
    `SELECT assistant_person_id AS "assistantId", member_person_id AS "memberId"
     FROM follow_up_assignment
     WHERE group_id=$1 AND to_date IS NULL
     ORDER BY id LIMIT 5`,
    [groupId],
  );
  let directCount = 0;
  for (const [i, pair] of followUps.entries()) {
    const id = hierarchyDemoId(650 + i);
    await rows(
      manager,
      `INSERT INTO chat_thread(id,group_id,kind) VALUES($1,$2,'direct')
       ON CONFLICT(id) DO NOTHING`,
      [id, groupId],
    );
    await rows(
      manager,
      `INSERT INTO chat_thread_participant(thread_id,person_id) VALUES($1,$2),($1,$3)
       ON CONFLICT DO NOTHING`,
      [id, pair.assistantId, pair.memberId],
    );
    await rows(
      manager,
      `INSERT INTO chat_message(id,thread_id,author_id,body,created_at)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING`,
      [
        hierarchyDemoId(670 + i),
        id,
        pair.assistantId,
        'سلام؛ برای پیگیری این هفته هماهنگ باشیم.',
        daysAgo(i + 1),
      ],
    );
    await rows(
      manager,
      `INSERT INTO chat_message(id,thread_id,author_id,body,created_at)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING`,
      [
        hierarchyDemoId(680 + i),
        id,
        pair.memberId,
        'چشم؛ عصر پیام می‌دهم.',
        daysAgo(i),
      ],
    );
    directCount += 1;
  }
  return 1 + directCount;
}

async function seedAlbum(
  manager: EntityManager,
  locationIds: string[],
): Promise<number> {
  const groupId = hierarchyGroupId(27);
  const mentorId = hierarchyPersonId(37);
  const assetsDir = resolve(__dirname, '../seed-assets/album');
  if (!existsSync(assetsDir)) {
    throw new Error(`Missing album assets at ${assetsDir}`);
  }

  const files = readdirSync(assetsDir)
    .filter((name) => MIME[extname(name).toLowerCase()])
    .sort();

  const taggable = await rows<{ id: string }>(
    manager,
    `SELECT person_id AS id FROM membership
     WHERE group_id=$1 AND role='member' AND valid_to IS NULL
     ORDER BY person_id LIMIT 20`,
    [groupId],
  );

  // Group photos into program/event albums (newest albums first via created_at).
  const albums: { title: string; captions: string[]; dayOffset: number }[] = [
    {
      title: 'اردوی مشهد',
      captions: ['حرم', 'صبحانه گروهی', 'بازدید', 'عکس دسته‌جمعی'],
      dayOffset: 2,
    },
    {
      title: 'جلسهٔ اولیا',
      captions: ['شروع جلسه', 'گفت‌وگوی والدین', 'پایان برنامه'],
      dayOffset: 12,
    },
    {
      title: 'دورهمی نیروها',
      captions: ['فضای برنامه', 'تیم صفا', 'خروجی برنامه'],
      dayOffset: 25,
    },
    {
      title: 'کلاس و مطالعه',
      captions: ['کلاس', 'استودیو'],
      dayOffset: 40,
    },
  ];
  const albumSlots = albums.flatMap((album) =>
    album.captions.map((caption, captionIndex) => ({
      albumTitle: album.title,
      caption,
      // Within an album, stagger slightly; across albums use dayOffset so sort is newest→oldest.
      createdOffset: album.dayOffset + captionIndex * 0.01,
    })),
  );

  let count = 0;
  for (const [i, name] of files.entries()) {
    const full = join(assetsDir, name);
    const buf = readFileSync(full);
    const ext = extname(name).toLowerCase();
    const mime = MIME[ext] ?? 'image/jpeg';
    const photoId = hierarchyDemoId(700 + i);
    const fileId = hierarchyDemoId(750 + i);
    // Must be a UUID — storage adapters reject non-UUID keys.
    const storageKey = hierarchyDemoId(7600 + i);
    await putDemoObject(storageKey, buf, mime);
    const slot = albumSlots[i] ?? {
      albumTitle: 'سایر برنامه‌ها',
      caption: `تصویر ${i + 1}`,
      createdOffset: 60 + i,
    };
    const createdAt = daysAgo(Math.floor(slot.createdOffset));

    await rows(
      manager,
      `INSERT INTO file_record(id,kind,storage_key,size,mime_type,created_by)
       VALUES($1,'album_photo',$2,$3,$4,$5)
       ON CONFLICT(id) DO UPDATE SET storage_key=EXCLUDED.storage_key, size=EXCLUDED.size, mime_type=EXCLUDED.mime_type`,
      [fileId, storageKey, Math.max(buf.length, 1), mime, mentorId],
    );
    await rows(
      manager,
      `INSERT INTO photo(id,host_group_id,file_id,uploaded_by,album_title,title,event_note,taken_at,location_option_id,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT(id) DO UPDATE SET
         album_title=EXCLUDED.album_title,
         title=EXCLUDED.title,
         event_note=EXCLUDED.event_note,
         file_id=EXCLUDED.file_id,
         created_at=EXCLUDED.created_at`,
      [
        photoId,
        groupId,
        fileId,
        mentorId,
        slot.albumTitle,
        slot.caption,
        `عکس‌های ${slot.albumTitle}`,
        createdAt,
        locationIds[i % locationIds.length] ?? null,
        createdAt,
      ],
    );
    await rows(
      manager,
      `INSERT INTO photo_group(photo_id,group_id,hidden_by_group) VALUES($1,$2,false)
       ON CONFLICT DO NOTHING`,
      [photoId, groupId],
    );
    // Also attach a couple to group 20 for multi-group feel
    if (i < 3) {
      await rows(
        manager,
        `INSERT INTO photo_group(photo_id,group_id,hidden_by_group) VALUES($1,$2,false)
         ON CONFLICT DO NOTHING`,
        [photoId, hierarchyGroupId(20)],
      );
    }
    const tags = taggable.slice(i % 5, (i % 5) + 3);
    for (const person of tags) {
      await rows(
        manager,
        `INSERT INTO photo_tag(photo_id,person_id,tagged_by) VALUES($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [photoId, person.id, mentorId],
      );
    }
    count += 1;
  }
  return count;
}

async function seedInvitesAndNotifications(
  manager: EntityManager,
): Promise<void> {
  const mentorId = hierarchyPersonId(37);
  const groupId = hierarchyGroupId(27);
  // Pending invite to someone not already assistant of 27 — use a member of 20
  const candidate = hierarchyPersonId(18); // شفیعی member of 20
  await rows(
    manager,
    `INSERT INTO assistant_invite(id,group_id,mentor_person_id,invitee_person_id,status)
     SELECT $1,$2,$3,$4,'pending'
     WHERE NOT EXISTS (
       SELECT 1 FROM assistant_invite
       WHERE group_id=$2 AND invitee_person_id=$4 AND status='pending'
     )
     AND NOT EXISTS (
       SELECT 1 FROM membership
       WHERE person_id=$4 AND group_id=$2 AND role='assistant' AND valid_to IS NULL
     )`,
    [hierarchyDemoId(800), groupId, mentorId, candidate],
  );

  const people = HIERARCHY_ROSTER.map((r) => hierarchyPersonId(r.n));
  for (const [i, personId] of people.entries()) {
    const types = [
      'demo.profile',
      'demo.guide',
      i % 2 === 0 ? 'assistant.invite' : 'demo.privacy',
    ];
    for (const [j, type] of types.entries()) {
      const id = hierarchyDemoId(900 + i * 3 + j);
      await rows(
        manager,
        `INSERT INTO notification(id,recipient_id,type,payload,created_at,read_at,dedupe_key)
         VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [
          id,
          personId,
          type,
          JSON.stringify({ synthetic: true, source: 'hierarchy-demo' }),
          daysAgo(j),
          j === 2 ? daysAgo(0) : null,
          `hierarchy-demo:${personId}:${type}`,
        ],
      );
      await rows(
        manager,
        `INSERT INTO notification_delivery(notification_id,status,delivered_at)
         SELECT id,'delivered',created_at FROM notification WHERE id=$1
         ON CONFLICT DO NOTHING`,
        [id],
      );
    }
  }

  // Verify a chunk of people under mentor 27
  await rows(
    manager,
    `UPDATE person SET verified_at=COALESCE(verified_at,now()), verified_by=COALESCE(verified_by,$2)
     WHERE id IN (
       SELECT m.person_id FROM membership m
       WHERE m.group_id=$1 AND m.role='member' AND m.valid_to IS NULL
       ORDER BY m.person_id LIMIT 12
     )`,
    [groupId, mentorId],
  );
}

/**
 * Presentation audit feed for the five demo personas.
 * Metadata only — no private notes, medical data, or national IDs in meta.
 * Uses the same action / resource_type naming as AuditService.record callers.
 */
async function seedAuditSamples(manager: EntityManager): Promise<number> {
  const mehdi = hierarchyPersonId(1); // مهدی رضوانیان
  const goodarzi = hierarchyPersonId(37); // محمد گودرزی
  const mj = hierarchyPersonId(12); // محمدجواد رضوانیان
  const behbahani = hierarchyPersonId(3); // مصطفی بهبهانی
  const seif = hierarchyPersonId(16); // مهدی سیف‌الهی

  const samples: {
    n: number;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    at: Date;
    meta?: Record<string, string | number | boolean | null>;
  }[] = [
    // Front-of-feed variety (last ~2h) so /admin/audit page 1 feels alive.
    {
      n: 0,
      actorId: seif,
      action: 'auth.login',
      resourceType: 'person',
      resourceId: seif,
      at: minutesAgo(4),
    },
    {
      n: 1,
      actorId: goodarzi,
      action: 'consultation.created',
      resourceType: 'consultation',
      resourceId: hierarchyDemoId(200),
      at: minutesAgo(7),
      meta: { kind: 'followup', memberCount: 1 },
    },
    {
      n: 2,
      actorId: behbahani,
      action: 'attendance.marked',
      resourceType: 'attendance',
      resourceId: hierarchyDemoId(1861),
      at: minutesAgo(11),
      meta: { count: 8 },
    },
    {
      n: 3,
      actorId: seif,
      action: 'rsvp.submitted',
      resourceType: 'rsvp',
      resourceId: hierarchyDemoId(1860),
      at: minutesAgo(14),
      meta: { status: 'yes' },
    },
    {
      n: 4,
      actorId: goodarzi,
      action: 'finance.handover_confirmed',
      resourceType: 'ledger_entry',
      resourceId: hierarchyDemoId(1862),
      at: minutesAgo(18),
      meta: { status: 'confirmed' },
    },
    {
      n: 5,
      actorId: behbahani,
      action: 'finance.handover_recorded',
      resourceType: 'ledger_entry',
      resourceId: hierarchyDemoId(1862),
      at: minutesAgo(22),
      meta: { status: 'in_transit' },
    },
    {
      n: 6,
      actorId: goodarzi,
      action: 'lms.published',
      resourceType: 'lms_item',
      resourceId: hierarchyDemoId(510),
      at: minutesAgo(26),
    },
    {
      n: 7,
      actorId: behbahani,
      action: 'photo.tags_updated',
      resourceType: 'photo',
      resourceId: hierarchyDemoId(701),
      at: minutesAgo(30),
      meta: { count: 3 },
    },
    {
      n: 8,
      actorId: goodarzi,
      action: 'message.sent',
      resourceType: 'message',
      resourceId: hierarchyDemoId(610),
      at: minutesAgo(33),
    },
    {
      n: 9,
      actorId: seif,
      action: 'message.sent',
      resourceType: 'message',
      resourceId: hierarchyDemoId(612),
      at: minutesAgo(36),
    },
    {
      n: 10,
      actorId: mehdi,
      action: 'consultation.created',
      resourceType: 'consultation',
      resourceId: hierarchyDemoId(1300),
      at: minutesAgo(40),
      meta: { kind: 'general', memberCount: 1 },
    },
    {
      n: 11,
      actorId: goodarzi,
      action: 'camp.participant_invited',
      resourceType: 'camp',
      resourceId: hierarchyDemoId(400),
      at: minutesAgo(45),
      meta: { count: 12 },
    },
    {
      n: 12,
      actorId: seif,
      action: 'camp.invite_accepted',
      resourceType: 'camp',
      resourceId: hierarchyDemoId(400),
      at: minutesAgo(48),
    },
    {
      n: 13,
      actorId: mj,
      action: 'auth.role_switched',
      resourceType: 'session',
      resourceId: null,
      at: minutesAgo(52),
      meta: { status: 'technical_manager' },
    },
    {
      n: 14,
      actorId: mj,
      action: 'storage.local',
      resourceType: 'admin',
      resourceId: null,
      at: minutesAgo(55),
      meta: { status: 'ok' },
    },
    {
      n: 15,
      actorId: goodarzi,
      action: 'grant.created',
      resourceType: 'person_file',
      resourceId: hierarchyDemoId(1101),
      at: minutesAgo(60),
    },
    {
      n: 16,
      actorId: mehdi,
      action: 'access.read',
      resourceType: 'person_file',
      resourceId: hierarchyDemoId(1100),
      at: minutesAgo(65),
      meta: { level: 'detail', reasonCode: 'referral' },
    },
    {
      n: 17,
      actorId: behbahani,
      action: 'consultation.updated',
      resourceType: 'consultation',
      resourceId: hierarchyDemoId(201),
      at: minutesAgo(70),
    },
    {
      n: 18,
      actorId: goodarzi,
      action: 'camp.updated',
      resourceType: 'camp',
      resourceId: hierarchyDemoId(401),
      at: minutesAgo(75),
    },
    {
      n: 19,
      actorId: behbahani,
      action: 'photo.uploaded',
      resourceType: 'photo',
      resourceId: hierarchyDemoId(702),
      at: minutesAgo(80),
    },
    {
      n: 20,
      actorId: mehdi,
      action: 'meeting.updated',
      resourceType: 'meeting',
      resourceId: hierarchyDemoId(1330),
      at: minutesAgo(85),
    },
    {
      n: 21,
      actorId: mj,
      action: 'cost_item.created',
      resourceType: 'program_event',
      resourceId: hierarchyDemoId(1470),
      at: minutesAgo(90),
      meta: { amount: 2500000 },
    },
    {
      n: 22,
      actorId: goodarzi,
      action: 'import.committed',
      resourceType: 'import',
      resourceId: hierarchyDemoId(1200 + 37 * 10),
      at: minutesAgo(95),
      meta: { count: 1 },
    },
    {
      n: 23,
      actorId: behbahani,
      action: 'auth.login',
      resourceType: 'person',
      resourceId: behbahani,
      at: minutesAgo(100),
    },
    {
      n: 24,
      actorId: mehdi,
      action: 'auth.login',
      resourceType: 'person',
      resourceId: mehdi,
      at: minutesAgo(105),
    },
    {
      n: 25,
      actorId: mj,
      action: 'auth.login',
      resourceType: 'person',
      resourceId: mj,
      at: minutesAgo(110),
    },
    {
      n: 26,
      actorId: goodarzi,
      action: 'auth.login',
      resourceType: 'person',
      resourceId: goodarzi,
      at: minutesAgo(115),
    },
    {
      n: 27,
      actorId: seif,
      action: 'message.sent',
      resourceType: 'message',
      resourceId: hierarchyDemoId(611),
      at: minutesAgo(120),
    },
    // Older depth for pagination
    {
      n: 28,
      actorId: mehdi,
      action: 'lms.published',
      resourceType: 'lms_item',
      resourceId: hierarchyDemoId(1510),
      at: daysAgo(1),
    },
    {
      n: 29,
      actorId: goodarzi,
      action: 'meeting.created',
      resourceType: 'meeting',
      resourceId: hierarchyDemoId(300),
      at: daysAgo(2),
      meta: { kind: 'workgroup' },
    },
    {
      n: 30,
      actorId: goodarzi,
      action: 'camp.permit_uploaded',
      resourceType: 'camp',
      resourceId: hierarchyDemoId(400),
      at: daysAgo(3),
    },
    {
      n: 31,
      actorId: goodarzi,
      action: 'person.verified',
      resourceType: 'person',
      resourceId: hierarchyPersonId(6),
      at: daysAgo(1),
    },
    {
      n: 32,
      actorId: mehdi,
      action: 'grant.created',
      resourceType: 'consultation_summary',
      resourceId: hierarchyDemoId(1300),
      at: daysAgo(2),
    },
    {
      n: 33,
      actorId: goodarzi,
      action: 'assistant_invite.created',
      resourceType: 'assistant_invite',
      resourceId: hierarchyDemoId(800),
      at: daysAgo(4),
    },
    {
      n: 34,
      actorId: mj,
      action: 'retention.updated',
      resourceType: 'admin',
      resourceId: null,
      at: daysAgo(5),
      meta: { count: 30 },
    },
    {
      n: 35,
      actorId: goodarzi,
      action: 'program_event.created',
      resourceType: 'program_event',
      resourceId: hierarchyDemoId(430),
      at: daysAgo(5),
      meta: { kind: 'camp' },
    },
    {
      n: 36,
      actorId: goodarzi,
      action: 'camp.created',
      resourceType: 'camp',
      resourceId: hierarchyDemoId(400),
      at: daysAgo(6),
    },
    {
      n: 37,
      actorId: behbahani,
      action: 'assignment.changed',
      resourceType: 'person',
      resourceId: seif,
      at: daysAgo(7),
    },
    {
      n: 38,
      actorId: seif,
      action: 'consent.recorded',
      resourceType: 'consent',
      resourceId: seif,
      at: daysAgo(8),
      meta: { version: 1 },
    },
    {
      n: 39,
      actorId: seif,
      action: 'auth.logout',
      resourceType: 'person',
      resourceId: seif,
      at: daysAgo(2),
    },
    {
      n: 40,
      actorId: goodarzi,
      action: 'study_path.item_added',
      resourceType: 'study_path',
      resourceId: hierarchyDemoId(520),
      at: daysAgo(3),
    },
    {
      n: 41,
      actorId: mj,
      action: 'account.provisioned',
      resourceType: 'person',
      resourceId: hierarchyPersonId(9),
      at: daysAgo(11),
    },
    {
      n: 42,
      actorId: goodarzi,
      action: 'group.finance_officer_assigned',
      resourceType: 'group',
      resourceId: hierarchyGroupId(27),
      at: daysAgo(12),
    },
    {
      n: 43,
      actorId: mj,
      action: 'qualification.changed',
      resourceType: 'person',
      resourceId: behbahani,
      at: daysAgo(14),
    },
    {
      n: 44,
      actorId: goodarzi,
      action: 'photo.uploaded',
      resourceType: 'photo',
      resourceId: hierarchyDemoId(700),
      at: daysAgo(1),
    },
  ];

  // Id band 1950+ (append-only audit_log — re-seed cannot rewrite earlier bands).
  let n = 0;
  for (const sample of samples) {
    const meta = {
      source: 'hierarchy-demo',
      ...(sample.meta ?? {}),
    };
    const inserted = await rows<{ id: string }>(
      manager,
      `INSERT INTO audit_log(id,actor_id,action,resource_type,resource_id,at,meta)
       VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING RETURNING id`,
      [
        hierarchyDemoId(1950 + sample.n),
        sample.actorId,
        sample.action,
        sample.resourceType,
        sample.resourceId,
        sample.at,
        JSON.stringify(meta),
      ],
    );
    if (inserted.length) n += 1;
  }
  return n;
}

/** Joint feel: participants from صفا ۲۰ join the north camp of صفا ۲۷. */
async function seedJointCampParticipants(
  manager: EntityManager,
): Promise<number> {
  const campId = hierarchyDemoId(400);
  const g20 = hierarchyGroupId(20);
  const members = await rows<{ id: string }>(
    manager,
    `SELECT m.person_id AS id FROM membership m
     JOIN person p ON p.id=m.person_id
     WHERE m.group_id=$1 AND m.role='member' AND m.valid_to IS NULL
       AND p.org_level='member'
     ORDER BY m.person_id LIMIT 8`,
    [g20],
  );
  let n = 0;
  for (const person of members) {
    await rows(
      manager,
      `INSERT INTO camp_participant(camp_id,person_id,group_id,status)
       VALUES($1,$2,$3,'confirmed') ON CONFLICT DO NOTHING`,
      [campId, person.id, g20],
    );
    n += 1;
  }
  // Ensure target member مهدی سیف‌الهی is on both camps when in صفا ۲۰
  const seif = hierarchyPersonId(16);
  await rows(
    manager,
    `INSERT INTO camp_participant(camp_id,person_id,group_id,status)
     VALUES($1,$2,$3,'confirmed') ON CONFLICT DO NOTHING`,
    [campId, seif, g20],
  );
  await rows(
    manager,
    `INSERT INTO camp_participant(camp_id,person_id,group_id,status)
     VALUES($1,$2,$3,'accepted') ON CONFLICT DO NOTHING`,
    [hierarchyDemoId(401), seif, g20],
  );
  return n;
}

async function seedStudyReadings(manager: EntityManager): Promise<number> {
  const readers = [
    hierarchyPersonId(16), // سیف‌الهی
    hierarchyPersonId(6),
    hierarchyPersonId(3),
    hierarchyPersonId(12),
  ];
  const items = [
    hierarchyDemoId(510),
    hierarchyDemoId(511),
    hierarchyDemoId(521),
    hierarchyDemoId(531),
  ];
  let n = 0;
  for (const [i, personId] of readers.entries()) {
    for (const [j, itemId] of items.entries()) {
      const status =
        j === 0 ? 'completed' : j === 1 ? 'reading' : 'completed';
      if (j > 1 && i % 2 === 1) continue;
      await rows(
        manager,
        `INSERT INTO study_path_reading(item_id,person_id,status)
         VALUES($1,$2,$3)
         ON CONFLICT(person_id,item_id) DO UPDATE SET status=EXCLUDED.status, updated_at=now()`,
        [itemId, personId, j === 1 && i === 0 ? 'reading' : status],
      );
      n += 1;
    }
  }
  return n;
}

async function seedGrants(manager: EntityManager): Promise<number> {
  const mentor27 = hierarchyPersonId(37);
  const mentor33 = hierarchyPersonId(12);
  const supervisor = hierarchyPersonId(1);
  const member = hierarchyPersonId(16);
  const g20 = hierarchyGroupId(20);
  const g27 = hierarchyGroupId(27);

  const specs: {
    n: number;
    memberId: string;
    ownerId: string;
    granteeId: string;
    groupId: string;
    revoked: boolean;
    reason: string;
  }[] = [
    {
      n: 0,
      memberId: member,
      ownerId: supervisor,
      granteeId: supervisor,
      groupId: g20,
      revoked: false,
      reason: 'ارجاع آزمایشی پروندهٔ نیرو به ناظر برای بررسی',
    },
    {
      n: 1,
      memberId: hierarchyPersonId(6),
      ownerId: mentor27,
      granteeId: supervisor,
      groupId: g27,
      revoked: false,
      reason: 'ارجاع نمایشی به ناظر صفا',
    },
    {
      n: 2,
      memberId: hierarchyPersonId(9),
      ownerId: mentor27,
      granteeId: supervisor,
      groupId: g27,
      revoked: true,
      reason: 'ارجاع آزمایشی لغوشده',
    },
  ];

  let n = 0;
  for (const spec of specs) {
    const resourceId = hierarchyDemoId(1100 + spec.n);
    const grantId = hierarchyDemoId(1110 + spec.n);
    await rows(
      manager,
      `INSERT INTO resource_registry(resource_type,resource_id,member_person_id,owner_person_id,owner_role,group_ids)
       VALUES('person_file',$1,$2,$3,'mentor',$4) ON CONFLICT DO NOTHING`,
      [resourceId, spec.memberId, spec.ownerId, [spec.groupId]],
    );
    await rows(
      manager,
      `INSERT INTO access_grant(id,resource_type,resource_id,member_person_id,grantee_person_id,
       granted_by,granted_at,revoked_at,reason)
       VALUES($1,'person_file',$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(id) DO NOTHING`,
      [
        grantId,
        resourceId,
        spec.memberId,
        spec.granteeId,
        spec.ownerId,
        daysAgo(5 + spec.n),
        spec.revoked ? daysAgo(1) : null,
        spec.reason,
      ],
    );
    await rows(
      manager,
      `INSERT INTO audit_log(id,actor_id,action,resource_type,resource_id,at,meta)
       VALUES($1,$2,'grant.created','person_file',$3,$4,$5) ON CONFLICT(id) DO NOTHING`,
      [
        hierarchyDemoId(1120 + spec.n),
        spec.ownerId,
        resourceId,
        daysAgo(5 + spec.n),
        JSON.stringify({ source: 'hierarchy-demo' }),
      ],
    );
    n += 1;
  }

  // Lightweight emergency access sample for mentor of صفا ۲۷
  await rows(
    manager,
    `INSERT INTO emergency_access_log(id,person_id,accessed_by,reason_code,accessed_at)
     VALUES($1,$2,$3,'camp_day',$4) ON CONFLICT(id) DO NOTHING`,
    [hierarchyDemoId(1130), hierarchyPersonId(4), mentor27, daysAgo(2)],
  );
  void mentor33;
  return n;
}

async function seedImportJobs(manager: EntityManager): Promise<number> {
  const crypto = new CryptoService();
  const owners: { personN: number; groupN: number }[] = [
    { personN: 37, groupN: 27 },
    { personN: 1, groupN: 20 },
    { personN: 12, groupN: 33 },
  ];
  let n = 0;
  for (const owner of owners) {
    for (const [stage, status] of [
      [0, 'completed'],
      [1, 'ready'],
      [2, 'invalid'],
    ] as const) {
      const id = hierarchyDemoId(1200 + owner.personN * 10 + stage);
      const groupId = hierarchyGroupId(owner.groupN);
      const createdBy = hierarchyPersonId(owner.personN);
      const source = [
        'firstName,lastName,fatherName,birthDate,nationalId,phone,group',
        `نمونه,آزمایشی,محمد,1385/01/15,00${String(9000000 + owner.personN * 10 + stage).padStart(8, '0')},+9891999${String(owner.personN).padStart(4, '0')},${groupId}`,
      ].join('\n');
      const fileHash = createHash('sha256')
        .update(`hierarchy-demo:${id}:${source}`)
        .digest('hex');
      const errorCount = status === 'invalid' ? 1 : 0;
      const nationalId = `00${String(9000000 + owner.personN * 10 + stage).padStart(8, '0')}`;
      const inserted = await rows<{ id: string }>(
        manager,
        `INSERT INTO import_job(id,created_by,group_id,file_hash,source_enc,format,status,row_count,valid_count,
         error_count,created_at,updated_at,confirmed_at,completed_at)
         VALUES($1,$2,$3,$4,$5,'csv',$6,1,$7,$8,$9,$9,$10,$10)
         ON CONFLICT(id) DO NOTHING RETURNING id`,
        [
          id,
          createdBy,
          groupId,
          fileHash,
          status === 'completed'
            ? null
            : crypto.encrypt(
                Buffer.from(source).toString('base64'),
                'import-source',
              ),
          status,
          1 - errorCount,
          errorCount,
          daysAgo(10 + stage),
          status === 'completed' ? daysAgo(9 + stage) : null,
        ],
      );
      if (!inserted.length) continue;
      await rows(
        manager,
        `INSERT INTO import_row(job_id,row_number,data_enc,errors,person_id)
         VALUES($1,1,$2,$3,NULL) ON CONFLICT DO NOTHING`,
        [
          id,
          crypto.encrypt(
            JSON.stringify({
              firstName: 'نمونه',
              lastName: 'آزمایشی',
              fatherName: 'محمد',
              birthDate: '2006-04-04',
              nationalId,
              phone: `+9891999${String(owner.personN).padStart(4, '0')}`,
              group: groupId,
            }),
            'import-row',
          ),
          JSON.stringify(
            status === 'invalid' ? ['کد ملی معتبر نیست.'] : [],
          ),
        ],
      );
      n += 1;
    }
  }
  return n;
}

/** Extra activity for صفا ۲۰ (ناظر) and صفا ۳۳ (مربی) so those homes feel live. */
async function seedSisterGroups(manager: EntityManager): Promise<{
  consultations: number;
  meetings: number;
  camps: number;
  threads: number;
}> {
  const g20 = hierarchyGroupId(20);
  const g33 = hierarchyGroupId(33);
  const owner20 = hierarchyPersonId(1);
  const owner33 = hierarchyPersonId(12);
  const seif = hierarchyPersonId(16);
  const behbahani = hierarchyPersonId(3);

  // Consultations in صفا ۲۰ including سیف‌الهی
  const c20 = [
    {
      id: hierarchyDemoId(1300),
      member: seif,
      author: owner20,
      summary:
        'پیگیری وضعیت تحصیلی و حضور در برنامه‌های صفا ۲۰؛ خلاصه قابل‌مشاهده برای نیرو.',
    },
    {
      id: hierarchyDemoId(1301),
      member: hierarchyPersonId(6),
      author: behbahani,
      summary: 'گفت‌وگوی کوتاه دربارهٔ مطالعهٔ هفتگی و آمادگی اردو.',
    },
    {
      id: hierarchyDemoId(1302),
      member: seif,
      author: behbahani,
      summary: 'مرور مسئولیت‌های شخصی و هماهنگی با کمک‌مربی.',
    },
  ];
  for (const [i, c] of c20.entries()) {
    await rows(
      manager,
      `INSERT INTO consultation(id,group_id,author_id,held_at,kind,duration_minutes,place,shared_summary)
       VALUES($1,$2,$3,$4,'in_person',$5,'مسجد جامع صفا',$6)
       ON CONFLICT(id) DO UPDATE SET shared_summary=EXCLUDED.shared_summary`,
      [c.id, g20, c.author, daysAgo(1 + i * 4), 25 + i * 5, c.summary],
    );
    await rows(
      manager,
      `INSERT INTO consultation_member(consultation_id,person_id) VALUES($1,$2)
       ON CONFLICT DO NOTHING`,
      [c.id, c.member],
    );
    if (i === 0) {
      await rows(
        manager,
        `INSERT INTO consultation_private_note(id,consultation_id,author_id,body)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(consultation_id) DO UPDATE SET body=EXCLUDED.body`,
        [
          hierarchyDemoId(1310),
          c.id,
          c.author,
          'یادداشت خصوصی ناظر/مربی — نمایشی؛ برای سلسله‌مراتب بالاتر دیده نمی‌شود.',
        ],
      );
    }
  }

  // صفا ۳۳ consultations
  await rows(
    manager,
    `INSERT INTO consultation(id,group_id,author_id,held_at,kind,duration_minutes,shared_summary)
     VALUES($1,$2,$3,$4,'phone',20,$5)
     ON CONFLICT(id) DO UPDATE SET shared_summary=EXCLUDED.shared_summary`,
    [
      hierarchyDemoId(1320),
      g33,
      owner33,
      daysAgo(3),
      'هماهنگی برنامهٔ ماهانهٔ صفا ۳۳؛ خلاصه برای عضو قابل مشاهده است.',
    ],
  );
  const m33 = await one<{ id: string }>(
    manager,
    `SELECT person_id AS id FROM membership
     WHERE group_id=$1 AND role='member' AND valid_to IS NULL
     ORDER BY person_id LIMIT 1`,
    [g33],
  );
  if (m33) {
    await rows(
      manager,
      `INSERT INTO consultation_member(consultation_id,person_id) VALUES($1,$2)
       ON CONFLICT DO NOTHING`,
      [hierarchyDemoId(1320), m33.id],
    );
  }

  // Meetings
  for (const [i, [gid, owner, title]] of [
    [g20, owner20, 'هماهنگی هفتگی صفا ۲۰'],
    [g33, owner33, 'برنامهٔ ماهانهٔ صفا ۳۳'],
  ].entries()) {
    const mid = hierarchyDemoId(1330 + i);
    await rows(
      manager,
      `INSERT INTO meeting(id,group_id,held_at,kind,title,place,status,created_by,agenda,summary)
       VALUES($1,$2,$3,'workgroup',$4,'سالن اجتماعات','approved',$5,$6,$7)
       ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary`,
      [
        mid,
        gid,
        daysAgo(2 + i),
        title,
        owner,
        '۱) گزارش\n۲) برنامه‌ها',
        'صورت‌جلسهٔ آزمایشی برای داشبورد ارائه.',
      ],
    );
    await rows(
      manager,
      `INSERT INTO meeting_attendee(meeting_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [mid, owner],
    );
    if (gid === g20) {
      await rows(
        manager,
        `INSERT INTO meeting_attendee(meeting_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
        [mid, seif],
      );
    }
  }

  // Camp for صفا ۲۰ + finance event
  const camp20 = hierarchyDemoId(1340);
  await rows(
    manager,
    `INSERT INTO camp(
       id,group_id,organizer_person_id,title,place,purpose,cost_amount,duration_text,
       starts_on,ends_on,status,price_per_person,created_by
     ) VALUES(
       $1,$2,$3,'اردوی یک‌روزهٔ صفا ۲۰','حیاط مسجد','برنامهٔ سبک نمایشی',
       3500000,'۱ روز',$4,$4,'registration',200000,$3
     )
     ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status, title=EXCLUDED.title`,
    [camp20, g20, owner20, isoDate(daysFromNow(7))],
  );
  await rows(
    manager,
    `INSERT INTO camp_participant(camp_id,person_id,group_id,status)
     VALUES($1,$2,$3,'confirmed') ON CONFLICT DO NOTHING`,
    [camp20, seif, g20],
  );
  await rows(
    manager,
    `INSERT INTO camp_notice(camp_id,meeting_time,meeting_place,items_to_bring)
     VALUES($1,$2,'درب مسجد','کفش مناسب، بطری آب')
     ON CONFLICT(camp_id) DO UPDATE SET items_to_bring=EXCLUDED.items_to_bring`,
    [camp20, daysFromNow(7)],
  );
  await rows(
    manager,
    `INSERT INTO program_event(
       id,group_id,kind,title,camp_id,held_at,place,notes,created_by,total_amount,member_payment_amount
     ) VALUES(
       $1,$2,'camp','هزینهٔ اردوی صفا ۲۰',$3,$4,'حیاط مسجد','نمایشی',$5,3500000,200000
     )
     ON CONFLICT(id) DO UPDATE SET total_amount=EXCLUDED.total_amount`,
    [hierarchyDemoId(1341), g20, camp20, daysFromNow(7), owner20],
  );
  await rows(
    manager,
    `INSERT INTO cost_item(id,owner_type,owner_id,title,amount,per_person,created_by)
     VALUES($1,'program_event',$2,'پذیرایی',1500000,false,$3)
     ON CONFLICT(id) DO UPDATE SET amount=EXCLUDED.amount`,
    [hierarchyDemoId(1342), hierarchyDemoId(1341), owner20],
  );

  const camp33 = hierarchyDemoId(1350);
  await rows(
    manager,
    `INSERT INTO camp(
       id,group_id,organizer_person_id,title,place,purpose,cost_amount,duration_text,
       starts_on,ends_on,status,price_per_person,created_by
     ) VALUES(
       $1,$2,$3,'اردوی مطالعاتی صفا ۳۳','کتابخانه','مرور مسیر مطالعاتی',
       8000000,'۲ روز',$4,$5,'permit_ok',400000,$3
     )
     ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status`,
    [
      camp33,
      g33,
      owner33,
      isoDate(daysFromNow(20)),
      isoDate(daysFromNow(21)),
    ],
  );

  // Chat for صفا ۲۰
  let thread20 = await one<{ id: string }>(
    manager,
    "SELECT id FROM chat_thread WHERE group_id=$1 AND kind='group'",
    [g20],
  );
  if (!thread20) {
    thread20 = await one<{ id: string }>(
      manager,
      `INSERT INTO chat_thread(id,group_id,kind) VALUES($1,$2,'group') RETURNING id`,
      [hierarchyDemoId(1360), g20],
    );
  }
  if (thread20) {
    await rows(
      manager,
      `INSERT INTO chat_thread_participant(thread_id,person_id)
       SELECT $1, m.person_id FROM membership m
       WHERE m.group_id=$2 AND m.valid_to IS NULL
       ON CONFLICT DO NOTHING`,
      [thread20.id, g20],
    );
    await rows(
      manager,
      `INSERT INTO chat_thread_participant(thread_id,person_id)
       SELECT $1, g.owner_person_id FROM organization_group g WHERE g.id=$2
       ON CONFLICT DO NOTHING`,
      [thread20.id, g20],
    );
    const msgs = [
      [owner20, 'سلام به گروه بیست؛ اطلاعیهٔ اردو را ببینید.'],
      [seif, 'سلام؛ حضور دارم.'],
      [behbahani, 'لیست پیگیری‌ها به‌روز شد.'],
    ] as const;
    for (const [i, [author, body]] of msgs.entries()) {
      await rows(
        manager,
        `INSERT INTO chat_message(id,thread_id,author_id,body,created_at)
         VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET body=EXCLUDED.body`,
        [
          hierarchyDemoId(1370 + i),
          thread20.id,
          author,
          body,
          new Date(Date.now() - (3 - i) * 7200000),
        ],
      );
    }
  }

  // Role-relevant notifications for the five presentation accounts
  const five = [
    hierarchyPersonId(1),
    hierarchyPersonId(37),
    hierarchyPersonId(12),
    hierarchyPersonId(3),
    hierarchyPersonId(16),
  ];
  for (const [i, personId] of five.entries()) {
    for (const [j, type] of [
      'camp.invitation',
      'schedule.reminder',
      'demo.session',
    ].entries()) {
      await rows(
        manager,
        `INSERT INTO notification(id,recipient_id,type,payload,created_at,read_at,dedupe_key)
         VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
        [
          hierarchyDemoId(1400 + i * 3 + j),
          personId,
          type,
          JSON.stringify({
            synthetic: true,
            source: 'demo-session',
            person: i,
          }),
          daysAgo(j),
          j === 2 ? daysAgo(0) : null,
          `demo-session:${personId}:${type}`,
        ],
      );
      await rows(
        manager,
        `INSERT INTO notification_delivery(notification_id,status,delivered_at)
         SELECT id,'delivered',created_at FROM notification WHERE id=$1
         ON CONFLICT DO NOTHING`,
        [hierarchyDemoId(1400 + i * 3 + j)],
      );
    }
  }

  return {
    consultations: c20.length + 1,
    meetings: 2,
    camps: 2,
    threads: thread20 ? 1 : 0,
  };
}

/**
 * Fill remaining UI-facing rows that exist in the live schema.
 * Note: busy_block / rsvp / wallet / ledger / project / task tables are NOT
 * migrated yet — finance UI uses program_event+cost_item; schedule UI is camps
 * + camp_schedule_item + meetings only.
 */
async function seedUiFacingGaps(manager: EntityManager): Promise<{
  campDetails: number;
  avatars: number;
  photoTags: number;
  classes20: number;
  finance33: number;
  resolutions: number;
  scenario: number;
}> {
  const five = [
    hierarchyPersonId(1),
    hierarchyPersonId(37),
    hierarchyPersonId(12),
    hierarchyPersonId(3),
    hierarchyPersonId(16),
  ];
  const g20 = hierarchyGroupId(20);
  const g33 = hierarchyGroupId(33);
  const owner20 = hierarchyPersonId(1);
  const owner33 = hierarchyPersonId(12);
  const seif = hierarchyPersonId(16);
  const mentor27 = hierarchyPersonId(37);

  let campDetails = 0;

  // --- Camp notices / schedules / permits / participants for thin camps ---
  const campLocal = hierarchyDemoId(401);
  await rows(
    manager,
    `INSERT INTO camp_notice(camp_id,meeting_time,meeting_place,items_to_bring)
     VALUES($1,$2,'حیاط مسجد','لباس راحت، بطری آب')
     ON CONFLICT(camp_id) DO UPDATE SET items_to_bring=EXCLUDED.items_to_bring`,
    [campLocal, daysAgo(1)],
  );
  await rows(
    manager,
    `INSERT INTO camp_schedule_item(id,camp_id,day,start_time,end_time,title,sort_order)
     VALUES
       ($1,$3,$4,'09:00','10:30','افتتاحیه و معارفه',0),
       ($2,$3,$4,'11:00','13:00','برنامهٔ گروهی',1)
     ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title`,
    [
      hierarchyDemoId(1450),
      hierarchyDemoId(1451),
      campLocal,
      isoDate(daysAgo(1)),
    ],
  );
  campDetails += 3;

  const camp20 = hierarchyDemoId(1340);
  await rows(
    manager,
    `INSERT INTO camp_schedule_item(id,camp_id,day,start_time,end_time,title,sort_order)
     VALUES($1,$2,$3,'08:30','12:00','برنامهٔ صبح صفا ۲۰',0)
     ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title`,
    [hierarchyDemoId(1452), camp20, isoDate(daysFromNow(7))],
  );
  // More صفا ۲۰ participants so camp screens aren't a single row
  const more20 = await rows<{ id: string }>(
    manager,
    `SELECT m.person_id AS id FROM membership m
     JOIN person p ON p.id=m.person_id
     WHERE m.group_id=$1 AND m.role='member' AND m.valid_to IS NULL
       AND p.org_level='member'
     ORDER BY m.person_id LIMIT 6`,
    [g20],
  );
  for (const person of more20) {
    await rows(
      manager,
      `INSERT INTO camp_participant(camp_id,person_id,group_id,status)
       VALUES($1,$2,$3,'confirmed') ON CONFLICT DO NOTHING`,
      [camp20, person.id, g20],
    );
  }
  campDetails += 1 + more20.length;

  const camp33 = hierarchyDemoId(1350);
  await rows(
    manager,
    `INSERT INTO camp_notice(camp_id,meeting_time,meeting_place,items_to_bring)
     VALUES($1,$2,'کتابخانهٔ گروه','دفتر، خودکار، کتاب مسیر مطالعاتی')
     ON CONFLICT(camp_id) DO UPDATE SET items_to_bring=EXCLUDED.items_to_bring`,
    [camp33, daysFromNow(20)],
  );
  await rows(
    manager,
    `INSERT INTO camp_schedule_item(id,camp_id,day,start_time,end_time,title,sort_order)
     VALUES
       ($1,$3,$4,'09:00','11:00','جلسهٔ مطالعه',0),
       ($2,$3,$5,'09:00','12:00','جمع‌بندی و ارائه',1)
     ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title`,
    [
      hierarchyDemoId(1453),
      hierarchyDemoId(1454),
      camp33,
      isoDate(daysFromNow(20)),
      isoDate(daysFromNow(21)),
    ],
  );
  const members33 = await rows<{ id: string }>(
    manager,
    `SELECT person_id AS id FROM membership
     WHERE group_id=$1 AND role='member' AND valid_to IS NULL
     ORDER BY person_id LIMIT 10`,
    [g33],
  );
  for (const person of members33) {
    await rows(
      manager,
      `INSERT INTO camp_participant(camp_id,person_id,group_id,status)
       VALUES($1,$2,$3,'confirmed') ON CONFLICT DO NOTHING`,
      [camp33, person.id, g33],
    );
  }
  // Permit image for صفا ۳۳
  const permit33File = await seedFileFromAlbumAsset(manager, {
    id: 1460,
    storageN: 8460,
    assetName: '06-logo.png',
    kind: 'camp_permit',
    createdBy: owner33,
  });
  await rows(
    manager,
    `INSERT INTO camp_permit(id,camp_id,image_file_id,uploaded_by,status)
     VALUES($1,$2,$3,$4,'obtained')
     ON CONFLICT(camp_id) DO UPDATE SET status='obtained', image_file_id=EXCLUDED.image_file_id`,
    [hierarchyDemoId(1461), camp33, permit33File, owner33],
  );
  campDetails += 3 + members33.length;

  // --- Finance for صفا ۳۳ (mentor MJ dashboard /finance) ---
  await rows(
    manager,
    `INSERT INTO program_event(
       id,group_id,kind,title,camp_id,held_at,place,notes,created_by,total_amount,member_payment_amount
     ) VALUES(
       $1,$2,'camp','هزینهٔ اردوی مطالعاتی صفا ۳۳',$3,$4,'کتابخانه','نمایشی',$5,8000000,400000
     )
     ON CONFLICT(id) DO UPDATE SET total_amount=EXCLUDED.total_amount`,
    [hierarchyDemoId(1470), g33, camp33, daysFromNow(20), owner33],
  );
  await rows(
    manager,
    `INSERT INTO cost_item(id,owner_type,owner_id,title,amount,per_person,created_by)
     VALUES
       ($1,'program_event',$3,'فضا و پذیرایی',3000000,false,$4),
       ($2,'program_event',$3,'جزوه و کتاب',5000000,true,$4)
     ON CONFLICT(id) DO UPDATE SET amount=EXCLUDED.amount`,
    [
      hierarchyDemoId(1471),
      hierarchyDemoId(1472),
      hierarchyDemoId(1470),
      owner33,
    ],
  );
  await rows(
    manager,
    `INSERT INTO program_event(
       id,group_id,kind,title,held_at,place,notes,created_by,total_amount,member_payment_amount
     ) VALUES(
       $1,$2,'custom','خرید لوازم جلسه',$3,'سالن','چای و کاغذ',$4,950000,0
     )
     ON CONFLICT(id) DO UPDATE SET total_amount=EXCLUDED.total_amount`,
    [hierarchyDemoId(1473), g33, daysAgo(4), owner33],
  );
  await rows(
    manager,
    `INSERT INTO cost_item(id,owner_type,owner_id,title,amount,per_person,created_by)
     VALUES($1,'program_event',$2,'لوازم مصرفی',950000,false,$3)
     ON CONFLICT(id) DO UPDATE SET amount=EXCLUDED.amount`,
    [hierarchyDemoId(1474), hierarchyDemoId(1473), owner33],
  );
  const finance33 = 2;

  // --- Avatars for the five presentation people ---
  const avatarAssets = [
    '01-activity.jpeg',
    '02-gathering.jpeg',
    '04-team.jpeg',
    '07-studio.png',
    '03-program.jpeg',
  ];
  let avatars = 0;
  for (const [i, personId] of five.entries()) {
    const fileId = await seedFileFromAlbumAsset(manager, {
      id: 1480 + i,
      storageN: 8480 + i,
      assetName: avatarAssets[i]!,
      kind: 'avatar',
      createdBy: personId,
    });
    await rows(
      manager,
      `UPDATE person SET avatar_file_id=$2, updated_at=now()
       WHERE id=$1 AND (avatar_file_id IS NULL OR avatar_file_id<>$2)`,
      [personId, fileId],
    );
    avatars += 1;
  }

  // --- Tag the five (esp. سیف‌الهی) on album photos ---
  const photos = await rows<{ id: string }>(
    manager,
    `SELECT id FROM photo WHERE host_group_id=ANY($1::uuid[])
     ORDER BY created_at DESC LIMIT 8`,
    [[hierarchyGroupId(27), g20]],
  );
  let photoTags = 0;
  for (const [i, photo] of photos.entries()) {
    const personId = five[i % five.length]!;
    await rows(
      manager,
      `INSERT INTO photo_tag(photo_id,person_id,tagged_by) VALUES($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [photo.id, personId, mentor27],
    );
    // Prefer seif on first few photos for member «my photos»
    if (i < 4) {
      await rows(
        manager,
        `INSERT INTO photo_tag(photo_id,person_id,tagged_by) VALUES($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [photo.id, seif, mentor27],
      );
      photoTags += 1;
    }
    photoTags += 1;
  }

  // --- LMS / classes for صفا ۲۰ (member + supervisor group) ---
  const audio = demoSilentWav();
  const course20 = hierarchyDemoId(1490);
  await rows(
    manager,
    `INSERT INTO course(id,title) VALUES($1,'همراهی هفتگی صفا ۲۰')
     ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title`,
    [course20],
  );
  const sessions20 = [
    {
      n: 0,
      title: 'شروع مسیر همراهی',
      summary: 'جلسهٔ آزمایشی برای نیروهای صفا ۲۰.',
      asset: '09-course.webp',
      days: 8,
    },
    {
      n: 1,
      title: 'برنامهٔ شخصی و حضور',
      summary: 'مرور حضور در برنامه‌ها و هماهنگی با کمک‌مربی.',
      asset: '10-course.webp',
      days: 3,
    },
  ];
  for (const cls of sessions20) {
    const cover = await seedFileFromAlbumAsset(manager, {
      id: 1491 + cls.n * 3,
      storageN: 8491 + cls.n * 3,
      assetName: cls.asset,
      kind: 'lms_cover',
      createdBy: owner20,
    });
    const audioFile = await seedFileFromBuffer(manager, {
      id: 1492 + cls.n * 3,
      storageN: 8492 + cls.n * 3,
      kind: 'lms_audio',
      mime: 'audio/wav',
      body: audio,
      createdBy: owner20,
    });
    const recordingId = hierarchyDemoId(1500 + cls.n);
    await rows(
      manager,
      `INSERT INTO class_recording(id,group_id,title,speaker,summary,audio_file_id,cover_file_id,held_at,created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary,
         audio_file_id=EXCLUDED.audio_file_id, cover_file_id=EXCLUDED.cover_file_id`,
      [
        recordingId,
        g20,
        cls.title,
        'مهدی رضوانیان',
        cls.summary,
        audioFile,
        cover,
        daysAgo(cls.days),
        owner20,
      ],
    );
    await rows(
      manager,
      `INSERT INTO lms_item(id,recording_id,course_id,sort_order,published_at,published_by)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(id) DO UPDATE SET published_at=EXCLUDED.published_at`,
      [
        hierarchyDemoId(1510 + cls.n),
        recordingId,
        course20,
        cls.n,
        daysAgo(cls.days),
        owner20,
      ],
    );
  }
  const classes20 = sessions20.length;

  // --- Resolutions visible to member / assistant ---
  await rows(
    manager,
    `INSERT INTO resolution(id,meeting_id,body,assignee_id,due_date,sort_order)
     VALUES($1,$2,$3,$4,$5,1)
     ON CONFLICT(id) DO UPDATE SET body=EXCLUDED.body, assignee_id=EXCLUDED.assignee_id`,
    [
      hierarchyDemoId(1520),
      hierarchyDemoId(1330),
      'مرور برنامهٔ مطالعه و اعلام آمادگی اردو — نمونه',
      seif,
      isoDate(daysFromNow(5)),
    ],
  );
  await rows(
    manager,
    `INSERT INTO resolution(id,meeting_id,body,assignee_id,due_date,sort_order)
     VALUES($1,$2,$3,$4,$5,0)
     ON CONFLICT(id) DO UPDATE SET body=EXCLUDED.body`,
    [
      hierarchyDemoId(1521),
      hierarchyDemoId(1331),
      'هماهنگی لیست شرکت‌کنندگان اردوی مطالعاتی',
      owner33,
      isoDate(daysFromNow(10)),
    ],
  );
  const resolutions = 2;

  // --- seed_scenario marker (worker RLS; keeps table non-empty for ops/admin) ---
  const crypto = new CryptoService();
  await rows(
    manager,
    `INSERT INTO seed_scenario(name,metadata,confidential_enc)
     VALUES($1,$2,$3) ON CONFLICT(name) DO NOTHING`,
    [
      'hierarchy-demo-session',
      JSON.stringify({
        synthetic: true,
        source: 'seed-demo-session',
        people: five,
        note: 'No busy_block/wallet/project tables in schema yet',
      }),
      crypto.encrypt(
        JSON.stringify({ purpose: 'presentation-fixtures' }),
        'seed-fixture',
      ),
    ],
  );
  const scenario = 1;

  // parent_link stays empty: hierarchy roster has no under-18 people.
  void g33;

  return {
    campDetails,
    avatars,
    photoTags,
    classes20,
    finance33,
    resolutions,
    scenario,
  };
}

export type HierarchyDemoResult = {
  photos: number;
  consultations: number;
  meetings: number;
  camps: number;
  threads: number;
  followUps: number;
  studyPaths: number;
  classes: number;
  readings: number;
  grants: number;
  imports: number;
  jointParticipants: number;
  avatars: number;
  campDetails: number;
  photoTags: number;
  finance33: number;
  s3Objects: number;
  storageDriver: string;
  schemaNote: string;
};

export async function seedHierarchyDemo(
  db: DataSource,
): Promise<HierarchyDemoResult> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Hierarchy demo seed is disabled in production');

  s3ObjectsWritten = 0;
  demoStorage = null;

  const existing = await one<{ count: string }>(
    db,
    'SELECT count(*) FROM person WHERE id=$1',
    [hierarchyPersonId(37)],
  );
  if (existing?.count === '0') {
    await seedHierarchy(db);
  }

  return db.transaction(async (manager) => {
    await rows(manager, "SELECT set_config('app.worker','on',true)");
    await rows(manager, 'SELECT pg_advisory_xact_lock(739204)');

    const mentorId = hierarchyPersonId(37);
    const locations = await seedLocations(manager, mentorId);
    await seedGroupRoles(manager);
    const followUps = await seedFollowUps(manager);
    const consultations = await seedConsultations(manager);
    const meetings = await seedMeetings(manager);
    const camps = await seedCampsAndFinance(manager);
    const jointParticipants = await seedJointCampParticipants(manager);
    const studyPaths = await seedStudyPaths(manager);
    const classes = await seedLmsClasses(manager);
    const readings = await seedStudyReadings(manager);
    const threads = await seedCommunications(manager);
    const photos = await seedAlbum(manager, locations);
    await seedInvitesAndNotifications(manager);
    await seedAuditSamples(manager);
    const grants = await seedGrants(manager);
    const imports = await seedImportJobs(manager);
    const sister = await seedSisterGroups(manager);
    const gaps = await seedUiFacingGaps(manager);

    return {
      photos,
      consultations: consultations + sister.consultations,
      meetings: meetings + sister.meetings,
      camps: camps + sister.camps,
      threads: threads + sister.threads,
      followUps,
      studyPaths,
      classes: classes + gaps.classes20,
      readings,
      grants,
      imports,
      jointParticipants,
      avatars: gaps.avatars,
      campDetails: gaps.campDetails,
      photoTags: gaps.photoTags,
      finance33: gaps.finance33,
      s3Objects: s3ObjectsWritten,
      storageDriver: process.env.STORAGE_DRIVER ?? 'local',
      schemaNote:
        'No busy_block/rsvp/wallet/ledger/project tables in migrations; finance=program_event+cost_item, schedule=camp_schedule_item+meetings',
    };
  });
}

async function main(): Promise<void> {
  await database.initialize();
  try {
    const result = await seedHierarchyDemo(database);
    console.log('🌱 Hierarchy demo data ready:');
    console.log(`  photos: ${result.photos}`);
    console.log(`  consultations: ${result.consultations}`);
    console.log(`  meetings: ${result.meetings}`);
    console.log(`  camps: ${result.camps}`);
    console.log(`  chat threads: ${result.threads}`);
    console.log(`  follow-ups: ${result.followUps}`);
    console.log(`  study paths: ${result.studyPaths}`);
    console.log(`  classes: ${result.classes}`);
    console.log(`  readings: ${result.readings}`);
    console.log(`  grants: ${result.grants}`);
    console.log(`  import jobs: ${result.imports}`);
    console.log(`  joint camp participants: ${result.jointParticipants}`);
    console.log(`  avatars: ${result.avatars}`);
    console.log(`  camp detail rows: ${result.campDetails}`);
    console.log(`  photo tags added: ${result.photoTags}`);
    console.log(`  finance destinations (صفا ۳۳): ${result.finance33}`);
    console.log(`  schema: ${result.schemaNote}`);
    console.log(
      `  storage: ${result.storageDriver} (${result.s3Objects} objects written this run)`,
    );
  } finally {
    await database.destroy();
  }
}

if (require.main === module)
  void main().catch((error: unknown) => {
    console.error('❌ Hierarchy demo seed failed.', error);
    process.exitCode = 1;
  });
