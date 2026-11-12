import 'dotenv/config';
import { DataSource } from 'typeorm';
import { normalizePersian } from '@safanoor/shared';
import database from './libs/database/data-source';
import { CryptoService } from './libs/security/crypto.service';
import { hierarchyGroupId, hierarchyPersonId } from './seed-hierarchy';
import { rebuildSeedHierarchy } from './seed';

export const eveningId = (n: number): string =>
  `81000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const names = [
  'علی امینی',
  'امیرحسین نوری',
  'مهدی صادقی',
  'حسین موسوی',
  'محمد پارسا',
  'رضا کریمی',
  'سجاد بهرامی',
  'امیر صالحی',
  'یوسف نادری',
  'طاها احمدی',
  'حسن رضایی',
  'آرمان مهدوی',
];
const summaries = [
  'نمونهٔ نمایشی: برنامهٔ مطالعهٔ هفتگی مرور شد. توافق کردیم روزانه بیست دقیقه مطالعه و در جلسهٔ بعد نتیجه را مرور کنیم.',
  'نمونهٔ نمایشی: دربارهٔ تقسیم زمان دانشگاه و فعالیت‌های گروه صحبت کردیم؛ یک برنامهٔ سبک و قابل اجرا برای هفتهٔ آینده تنظیم شد.',
  'نمونهٔ نمایشی: مسئولیت آماده‌سازی کتاب‌ها برای نشست آینده پذیرفته شد؛ هماهنگی نهایی تا روز قبل از برنامه انجام می‌شود.',
  'نمونهٔ نمایشی: پیشرفت مسیر مطالعاتی مرور شد و برای ادامهٔ کتاب، دو نوبت مطالعهٔ کوتاه در هفته پیشنهاد شد.',
  'نمونهٔ نمایشی: دربارهٔ مشارکت در فعالیت‌های گروه گفت‌وگو کردیم و قرار شد در برنامهٔ بعد مسئولیت پذیرایی را تجربه کند.',
  'نمونهٔ نمایشی: جمع‌بندی ماه گذشته و هدف‌گذاری ماه آینده انجام شد؛ پیگیری کوتاه تلفنی در هفتهٔ آینده داریم.',
];
export async function seedEveningDemo(db: DataSource) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Presentation seed is disabled in production');
  const mj = hierarchyPersonId(12);
  if (
    !(
      await db.query<{ exists: number }[]>('SELECT 1 FROM person WHERE id=$1', [
        mj,
      ])
    ).length
  )
    throw new Error('Run the existing hierarchy seed first');
  const crypto = new CryptoService();
  await db.transaction(async (m) => {
    await m.query("SELECT set_config('app.worker','on',true)");
    await m.query('SELECT pg_advisory_xact_lock(739205)');
    for (const [i, name] of names.entries()) {
      const group = hierarchyGroupId(i < 6 ? 27 : 33),
        person = eveningId(i + 1);
      const [first, ...last] = name.split(' ');
      await m.query(
        `INSERT INTO person(id,first_name,last_name,father_name,birth_date,phone,search_name,org_level,consent_required,verified_at,verified_by)
        VALUES($1,$2,$3,'نمونه','2005-05-15',$4,$5,'member',false,CASE WHEN $6 THEN now() ELSE NULL END,$7)
        ON CONFLICT(id) DO NOTHING`,
        [
          person,
          first,
          `${last.join(' ')} (نمایشی)`,
          `+98990099${String(i + 1).padStart(4, '0')}`,
          normalizePersian(`${name} نمایشی`),
          i % 3 !== 0,
          mj,
        ],
      );
      await m.query(
        `INSERT INTO membership(id,person_id,group_id,role) VALUES($1,$2,$3,'member') ON CONFLICT(id) DO NOTHING`,
        [eveningId(100 + i), person, group],
      );
      if (i < 6)
        await m.query(
          `INSERT INTO follow_up_assignment(id,member_person_id,assistant_person_id,group_id) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`,
          [eveningId(200 + i), person, mj, group],
        );
      for (let j = 0; j < 2; j++) {
        const id = eveningId(300 + i * 2 + j);
        await m.query(
          `INSERT INTO consultation(id,group_id,author_id,held_at,kind,duration_minutes,place,shared_summary)
          VALUES($1,$2,$3,now()-($4::int*interval '1 day'),$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`,
          [
            id,
            group,
            mj,
            2 + i * 3 + j * 10,
            j ? 'phone' : 'in_person',
            20 + (i % 3) * 10,
            j ? null : 'کتابخانهٔ مسجد',
            summaries[(i + j) % summaries.length],
          ],
        );
        await m.query(
          'INSERT INTO consultation_member(consultation_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [id, person],
        );
      }
      const thread = eveningId(400 + i);
      await m.query(
        "INSERT INTO chat_thread(id,group_id,kind) VALUES($1,$2,'direct') ON CONFLICT(id) DO NOTHING",
        [thread, group],
      );
      for (const participant of [mj, person])
        await m.query(
          'INSERT INTO chat_thread_participant(thread_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [thread, participant],
        );
      const bodies = [
        'گفت‌وگوی نمایشی برای ارائه: سلام، برنامهٔ مطالعهٔ این هفته چطور پیش رفت؟',
        'سلام، دو فصل را خواندم و چند نکته برای جلسه یادداشت کردم.',
        'خیلی خوب؛ برای جلسهٔ آینده کدام بخش را دوست داری با هم مرور کنیم؟',
        'بخش برنامه‌ریزی روزانه برایم کاربردی بود؛ می‌توانم نکته‌ها را آماده کنم.',
        'بله، پنج دقیقه از جلسه برای ارائهٔ تو در نظر می‌گیریم. اگر کمکی خواستی همین‌جا بگو.',
      ];
      for (const [j, body] of bodies.entries())
        await m.query(
          `INSERT INTO chat_message(id,thread_id,author_id,body,created_at) VALUES($1,$2,$3,$4,now()-($5::int*interval '1 minute')) ON CONFLICT(id) DO NOTHING`,
          [
            eveningId(500 + i * 5 + j),
            thread,
            j % 2 ? person : mj,
            body,
            (i + 1) * 70 + (5 - j) * 10,
          ],
        );
      for (let j = 0; j < 2; j++)
        await m.query(
          `INSERT INTO follow_up_item(id,group_id,member_id,created_by,kind,title,due_at,completed_at)
        VALUES($1,$2,$3,$4,$5,$6,now()+($7::int*interval '1 day'),CASE WHEN $8 THEN now()-interval '1 day' ELSE NULL END) ON CONFLICT(id) DO NOTHING`,
          [
            eveningId(700 + i * 2 + j),
            group,
            person,
            mj,
            j ? 'task' : 'followup',
            j
              ? 'آماده‌سازی نکته‌های کتاب برای نشست (نمایشی)'
              : 'مرور برنامهٔ مطالعه و هماهنگی جلسه (نمایشی)',
            (i % 4) - 1,
            i % 4 === 3,
          ],
        );
      await m.query(
        `INSERT INTO person_emergency(person_id,contact_enc) VALUES($1,$2) ON CONFLICT(person_id) DO NOTHING`,
        [
          person,
          crypto.encrypt(
            'اطلاعات نمایشی؛ شمارهٔ تماس اضطراری واقعی ثبت نشده است.',
            'emergency-contact',
          ),
        ],
      );
    }
    for (const groupNo of [27, 33]) {
      const group = hierarchyGroupId(groupNo);
      for (let j = 0; j < 4; j++) {
        const session = eveningId(800 + (groupNo === 33 ? 10 : 0) + j);
        await m.query(
          `INSERT INTO group_session(id,group_id,title,starts_at,created_by) VALUES($1,$2,$3,now()-($4::int*interval '1 day'),$5) ON CONFLICT(id) DO NOTHING`,
          [
            session,
            group,
            'نشست هفتگی و مطالعه (نمایشی)',
            j * 7 + 1,
            groupNo === 27 ? hierarchyPersonId(37) : mj,
          ],
        );
        for (let k = 0; k < 6; k++)
          await m.query(
            `INSERT INTO session_attendance(session_id,person_id,present,marked_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
            [
              session,
              eveningId((groupNo === 27 ? 0 : 6) + k + 1),
              (j + k) % 4 !== 0,
              mj,
            ],
          );
      }
    }
    // Attach a real scheduled duty to MJ's assistant role, without changing existing camps.
    const camp = eveningId(900),
      group = hierarchyGroupId(27),
      mentor = hierarchyPersonId(37);
    await m.query(
      `INSERT INTO camp(id,group_id,organizer_person_id,title,place,starts_on,ends_on,status,created_by)
      VALUES($1,$2,$3,'اردوی همراهی صفا ۲۷ (نمایشی)','اردوگاه نمونه',CURRENT_DATE+7,CURRENT_DATE+8,'draft',$3) ON CONFLICT(id) DO NOTHING`,
      [camp, group, mentor],
    );
    await m.query(
      `INSERT INTO camp_schedule_item(id,camp_id,day,start_time,end_time,title,responsible_person_id)
      VALUES($1,$2,CURRENT_DATE+7,'09:00','10:00','هماهنگی ورود و بررسی فهرست نیروها (نمایشی)',$3) ON CONFLICT(id) DO NOTHING`,
      [eveningId(901), camp, mj],
    );
    for (let k = 1; k <= 6; k++)
      await m.query(
        `INSERT INTO camp_participant(camp_id,person_id,group_id,status) VALUES($1,$2,$3,'invited') ON CONFLICT DO NOTHING`,
        [camp, eveningId(k), group],
      );
    await rebuildSeedHierarchy(m);
    await m.query(
      `INSERT INTO seed_scenario(name,metadata,confidential_enc) VALUES('evening-mj-demo',$1,$2) ON CONFLICT(name) DO NOTHING`,
      [
        JSON.stringify({
          synthetic: true,
          members: 12,
          consultations: 24,
          threads: 12,
          messages: 60,
        }),
        crypto.encrypt('presentation fixtures', 'seed-fixture'),
      ],
    );
  });
  return { members: 12, consultations: 24, threads: 12, messages: 60 };
}
if (require.main === module)
  void (async () => {
    await database.initialize();
    try {
      console.log(await seedEveningDemo(database));
    } finally {
      await database.destroy();
    }
  })().catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  });
