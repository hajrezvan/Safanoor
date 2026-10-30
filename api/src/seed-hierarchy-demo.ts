import 'dotenv/config';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { DataSource, EntityManager } from 'typeorm';
import { normalizePersian } from '@safanoor/shared';
import database from './libs/database/data-source';
import { one, rows } from './libs/database/database.types';
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

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86400000);
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
  await rows(
    manager,
    `UPDATE follow_up_assignment SET to_date=now()
     WHERE group_id=$1 AND to_date IS NULL`,
    [groupId],
  );
  let n = 0;
  for (const [index, member] of members.entries()) {
    const assistant = assistants[index % assistants.length]!;
    if (assistant.id === member.id) continue;
    await rows(
      manager,
      `INSERT INTO follow_up_assignment(id,member_person_id,assistant_person_id,group_id,from_date)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING`,
      [
        hierarchyDemoId(100 + n),
        member.id,
        assistant.id,
        groupId,
        daysAgo(30 + (n % 10)),
      ],
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
  await rows(
    manager,
    `UPDATE follow_up_assignment SET to_date=now()
     WHERE group_id=$1 AND to_date IS NULL`,
    [g20],
  );
  for (const [index, member] of m20.entries()) {
    const assistant = a20[index % Math.max(a20.length, 1)];
    if (!assistant || assistant.id === member.id) continue;
    await rows(
      manager,
      `INSERT INTO follow_up_assignment(id,member_person_id,assistant_person_id,group_id,from_date)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
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

  // Permit image reuses album file seeded later if present; create placeholder file now
  const permitFileId = hierarchyDemoId(420);
  // LocalStorageAdapter only accepts UUID storage keys.
  const permitKey = hierarchyDemoId(4210);
  const storageRoot = resolve(process.env.LOCAL_STORAGE_PATH ?? '.storage');
  mkdirSync(storageRoot, { recursive: true });
  const permitPath = join(storageRoot, permitKey);
  const sample = join(__dirname, '../seed-assets/album/06-logo.png');
  if (existsSync(sample)) copyFileSync(sample, permitPath);
  else writeFileSync(permitPath, Buffer.from('demo-permit'));
  const permitSize = readFileSync(permitPath).length || 1;
  await rows(
    manager,
    `INSERT INTO file_record(id,kind,storage_key,size,mime_type,created_by)
     VALUES($1,'camp_permit',$2,$3,'image/png',$4)
     ON CONFLICT(id) DO UPDATE SET storage_key=EXCLUDED.storage_key, size=EXCLUDED.size`,
    [permitFileId, permitKey, permitSize, mentorId],
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
  const storageRoot = resolve(process.env.LOCAL_STORAGE_PATH ?? '.storage');
  mkdirSync(storageRoot, { recursive: true });
  writeFileSync(join(storageRoot, storageKey), opts.body);
  await rows(
    manager,
    `INSERT INTO file_record(id,kind,storage_key,size,mime_type,created_by)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(id) DO UPDATE SET storage_key=EXCLUDED.storage_key, size=EXCLUDED.size, mime_type=EXCLUDED.mime_type`,
    [
      fileId,
      opts.kind,
      storageKey,
      opts.body.length,
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
  const storageRoot = resolve(process.env.LOCAL_STORAGE_PATH ?? '.storage');
  mkdirSync(storageRoot, { recursive: true });

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
    // Must be a UUID — LocalStorageAdapter rejects non-UUID keys.
    const storageKey = hierarchyDemoId(7600 + i);
    copyFileSync(full, join(storageRoot, storageKey));
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
      [fileId, storageKey, buf.length, mime, mentorId],
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

async function seedAuditSamples(manager: EntityManager): Promise<void> {
  const mentorId = hierarchyPersonId(37);
  for (let i = 0; i < 8; i += 1) {
    await rows(
      manager,
      `INSERT INTO audit_log(id,actor_id,action,resource_type,resource_id,at,meta)
       VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
      [
        hierarchyDemoId(850 + i),
        mentorId,
        ['photo.uploaded', 'person.verified', 'access.read', 'camp.updated'][
          i % 4
        ],
        ['photo', 'person', 'consultation', 'camp'][i % 4],
        hierarchyDemoId(700 + (i % 5)),
        daysAgo(i),
        JSON.stringify({ source: 'hierarchy-demo' }),
      ],
    );
  }
}

export async function seedHierarchyDemo(db: DataSource): Promise<{
  photos: number;
  consultations: number;
  meetings: number;
  camps: number;
  threads: number;
  followUps: number;
  studyPaths: number;
  classes: number;
}> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Hierarchy demo seed is disabled in production');

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
    const studyPaths = await seedStudyPaths(manager);
    const classes = await seedLmsClasses(manager);
    const threads = await seedCommunications(manager);
    const photos = await seedAlbum(manager, locations);
    await seedInvitesAndNotifications(manager);
    await seedAuditSamples(manager);

    return {
      photos,
      consultations,
      meetings,
      camps,
      threads,
      followUps,
      studyPaths,
      classes,
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
  } finally {
    await database.destroy();
  }
}

if (require.main === module)
  void main().catch((error: unknown) => {
    console.error('❌ Hierarchy demo seed failed.', error);
    process.exitCode = 1;
  });
