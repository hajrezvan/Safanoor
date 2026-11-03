// Only local presentation data. Does not alter identity, consent or passwords.
const { Client } = require('pg');
const fs = require('node:fs/promises');
const path = require('node:path');
require('ts-node/register');
const {
  S3StorageAdapter,
  EncryptedStorageAdapter,
} = require('../src/modules/files/storage');
const id = (n) => `81000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const person = '40000000-0000-4000-8000-000000000006';
const group = '50000000-0000-4000-8000-000000000020';
const mentor = '40000000-0000-4000-8000-000000000001';
const readingPath = '70000000-0000-4000-8000-000000000520';
const firstBook = '70000000-0000-4000-8000-000000000521';
const date = (n) => new Date(Date.now() + n * 86400000);
const db = new Client({ connectionString: process.env.DATABASE_URL });
const q = (sql, args = []) => db.query(sql, args);
async function main() {
  if (process.env.NODE_ENV !== 'development')
    throw new Error('Development only.');
  await db.connect();
  try {
    const {
      rows: [target],
    } = await q(
      `SELECT p.first_name,p.last_name FROM person p JOIN membership m ON m.person_id=p.id WHERE p.id=$1 AND m.group_id=$2 AND m.role='member' AND m.valid_to IS NULL`,
      [person, group],
    );
    if (target?.first_name !== 'مصطفی' || target.last_name !== 'حسن‌زاده')
      throw new Error('Expected demo member not found.');
    await q('BEGIN');
    try {
      await q('SELECT pg_advisory_xact_lock(739206)');
      await q(
        `INSERT INTO course(id,title) VALUES($1,'مهارت‌های زندگی و همراهی — آزمایشی') ON CONFLICT DO NOTHING`,
        [id(1)],
      );
      const classes = [
        [
          'شناخت هدف و برنامهٔ هفتگی',
          'جلسهٔ نمایشی: یک برنامهٔ ساده برای مطالعه و کار گروهی بنویس.',
          -12,
        ],
        [
          'شنیدن فعال و گفت‌وگوی محترمانه',
          'تمرین نمونه: پیش از پاسخ، حرف دوستت را با زبان خودت بازگو کن.',
          -7,
        ],
        [
          'مسئولیت‌پذیری در گروه',
          'جمع‌بندی آزمایشی: یک مسئولیت کوچک انتخاب کن و برای انجام آن زمان مشخص بگذار.',
          -2,
        ],
        [
          'آمادگی برای اردوی یک‌روزه',
          'چک‌لیست نمایشی: بطری آب، کفش مناسب، کلاه و دفتر یادداشت.',
          -4,
        ],
        [
          'چطور کتاب‌خوانی را به عادت تبدیل کنیم؟',
          'محتوای آزمایشی: پانزده دقیقه مطالعه در روز، ثبت یک نکته و گفت‌وگو با گروه.',
          -1,
        ],
      ];
      for (const [i, [title, summary, day]] of classes.entries()) {
        await q(
          `INSERT INTO class_recording(id,group_id,title,speaker,summary,held_at,created_by) VALUES($1,$2,$3,'مربی گروه — نمونهٔ نمایشی',$4,$5,$6) ON CONFLICT DO NOTHING`,
          [id(10 + i), group, title, summary, date(day), mentor],
        );
        await q(
          `INSERT INTO lms_item(id,recording_id,course_id,sort_order,published_at,published_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [id(20 + i), id(10 + i), i < 3 ? id(1) : null, i, date(day), mentor],
        );
      }
      const {
        rows: [{ n }],
      } = await q(
        'SELECT COALESCE(MAX(position),0) AS n FROM study_path_item WHERE path_id=$1',
        [readingPath],
      );
      const books = [
        [
          'داستان‌های کوتاه برای فکر کردن',
          'گام آزمایشی: بعد از هر داستان، یک برداشت کوتاه بنویس.',
        ],
        ['گفت‌وگو و دوستی', 'گام آزمایشی: یک تمرین را با دوستت انجام بده.'],
        [
          'یادداشت‌های یک همراه',
          'گام آزمایشی: نکته‌های هفته را در دفترت ثبت کن.',
        ],
      ];
      for (const [i, [title, notes]] of books.entries())
        await q(
          `INSERT INTO study_path_item(id,path_id,position,book_title,notes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING`,
          [id(30 + i), readingPath, n + i + 1, title, notes],
        );
      for (const [book, status] of [
        [firstBook, 'completed'],
        [id(30), 'reading'],
      ])
        await q(
          `INSERT INTO study_path_reading(item_id,person_id,status) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
          [book, person, status],
        );
      const summaries = [
        'خلاصهٔ آزمایشی: دربارهٔ تعادل درس و فعالیت گروهی صحبت کردیم. قرار شد سه شب در هفته پانزده دقیقه مطالعه داشته باشی و آخر هفته یک نکته را با مربی در میان بگذاری.',
        'خلاصهٔ آزمایشی پیگیری: برنامهٔ مطالعه را مرور کردیم؛ برای هفتهٔ آینده یک مسئولیت کوچک در جلسهٔ گروه انتخاب می‌کنی. این متن نمونه است و سابقهٔ واقعی مشاوره نیست.',
      ];
      for (const [i, summary] of summaries.entries()) {
        await q(
          `INSERT INTO consultation(id,group_id,author_id,held_at,kind,duration_minutes,place,shared_summary) VALUES($1,$2,$3,$4,'in_person',25,'کتابخانهٔ گروه',$5) ON CONFLICT DO NOTHING`,
          [id(40 + i), group, mentor, date(-10 + i * 7), summary],
        );
        await q(
          'INSERT INTO consultation_member(consultation_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [id(40 + i), person],
        );
      }
      for (const [i, title] of [
        'دورهمی برنامه‌ریزی کتاب‌خوانی — آزمایشی',
        'هماهنگی اردوی گروه — آزمایشی',
      ].entries()) {
        await q(
          `INSERT INTO meeting(id,group_id,held_at,kind,title,place,status,created_by,agenda,summary) VALUES($1,$2,$3,'public',$4,'مسجد جامع صفا','approved',$5,'مرور برنامهٔ هفته و تقسیم مسئولیت‌های کوچک','صورت‌جلسهٔ آزمایشی: هر نفر یک پیشنهاد برای فعالیت بعدی می‌آورد؛ هماهنگی نهایی با مربی است.') ON CONFLICT DO NOTHING`,
          [id(50 + i), group, date(-8 + i * 5), title, mentor],
        );
        for (const attendee of [person, mentor])
          await q(
            'INSERT INTO meeting_attendee(meeting_id,person_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
            [id(50 + i), attendee],
          );
        await q(
          `INSERT INTO resolution(id,meeting_id,body,assignee_id,due_date) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          [
            id(60 + i),
            id(50 + i),
            i
              ? 'آماده‌کردن فهرست وسایل شخصی — نمونه'
              : 'معرفی یک کتاب کوتاه به گروه — نمونه',
            person,
            date(3 + i)
              .toISOString()
              .slice(0, 10),
          ],
        );
      }
      for (const [i, title] of [
        'اردوی پاییزی صفا — آزمایشی',
        'بازدید فرهنگی گروه — آزمایشی',
      ].entries()) {
        const day = date(i ? -20 : 5)
          .toISOString()
          .slice(0, 10);
        await q(
          `INSERT INTO camp(id,group_id,organizer_person_id,title,place,purpose,cost_amount,duration_text,starts_on,ends_on,status,price_per_person,created_by) VALUES($1,$2,$3,$4,'اردوگاه نمونه','دادهٔ آزمایشی؛ برنامهٔ واقعی نیست.',1800000,'یک روز',$5,$5,$6,150000,$3) ON CONFLICT DO NOTHING`,
          [id(70 + i), group, mentor, title, day, i ? 'settled' : 'draft'],
        );
        await q(
          `INSERT INTO camp_participant(camp_id,person_id,group_id,status) VALUES($1,$2,$3,'confirmed') ON CONFLICT DO NOTHING`,
          [id(70 + i), person, group],
        );
        await q(
          `INSERT INTO camp_notice(camp_id,meeting_time,meeting_place,items_to_bring) VALUES($1,$2,'حیاط مسجد — اطلاعیهٔ آزمایشی','بطری آب، کفش مناسب، دفتر یادداشت؛ این اردو صرفاً دادهٔ نمایشی است.') ON CONFLICT DO NOTHING`,
          [id(70 + i), date(i ? -20 : 5)],
        );
      }
      for (const [i, type] of [
        'demo.guide',
        'demo.profile',
        'demo.privacy',
      ].entries()) {
        await q(
          `INSERT INTO notification(id,recipient_id,type,payload,created_at,dedupe_key) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [
            id(80 + i),
            person,
            type,
            JSON.stringify({ synthetic: true, source: 'mustafa-demo' }),
            date(-i),
            `mustafa-demo:${type}`,
          ],
        );
        await q(
          'INSERT INTO notification_delivery(notification_id) VALUES($1) ON CONFLICT DO NOTHING',
          [id(80 + i)],
        );
      }
      await q(
        `INSERT INTO audit_log(actor_id,action,resource_type,resource_id,meta) VALUES($1,'demo.mustafa_seeded','person',$2,'{"synthetic":true,"source":"mustafa-demo"}')`,
        [mentor, person],
      );
      await q('COMMIT');
    } catch (error) {
      await q('ROLLBACK');
      throw error;
    }
    console.log(
      'Demo ready: 5 class sessions, 4 books with personal progress, 2 consultations, 2 meetings, 2 camps, 3 notifications.',
    );
    if (process.argv.includes('--upload-assets')) {
      if (process.env.STORAGE_DRIVER !== 's3')
        throw new Error('S3 must be enabled.');
      const raw = new S3StorageAdapter();
      const storage = new EncryptedStorageAdapter(raw);
      try {
        for (let i = 0; i < 3; i++) {
          const body = await fs.readFile(
            path.resolve(
              __dirname,
              `../seed-assets/mustafa/learning-${i + 1}.png`,
            ),
          );
          await storage.put(id(200 + i), body, 'image/png');
          if (!(await storage.get(id(200 + i))).equals(body))
            throw new Error('S3 readback mismatch.');
          await q(
            `INSERT INTO file_record(id,kind,storage_key,size,mime_type,created_by) VALUES($1,'demo_illustration',$2,$3,'image/png',$4) ON CONFLICT(id) DO NOTHING`,
            [id(100 + i), id(200 + i), body.length, mentor],
          );
        }
        for (let i = 0; i < 5; i++)
          await q('UPDATE class_recording SET cover_file_id=$2 WHERE id=$1', [
            id(10 + i),
            id(100 + (i % 3)),
          ]);
        for (const [i, book] of [firstBook, id(30), id(31), id(32)].entries())
          await q('UPDATE study_path_item SET cover_file_id=$2 WHERE id=$1', [
            book,
            id(100 + (i % 3)),
          ]);
        await q('UPDATE study_path SET cover_file_id=$2 WHERE id=$1', [
          readingPath,
          id(100),
        ]);
        console.log(
          'Three S3 images uploaded, readback verified and linked to class/book covers.',
        );
        const base = 'http://localhost:3001/api/v1';
        const login = async (phone) => {
          const response = await fetch(base + '/auth/login', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-client-type': 'native',
            },
            body: JSON.stringify({
              login: phone,
              password: 'SafanoorDemo#1405',
            }),
          });
          if (!response.ok)
            throw new Error('Local demo login failed: ' + response.status);
          const session = await response.json();
          return {
            authorization: 'Bearer ' + session.accessToken,
            'x-client-type': 'native',
          };
        };
        const mentorHeaders = await login('+989120000001');
        const memberHeaders = await login('+989120000006');
        for (let i = 0; i < 3; i++) {
          const body = await fs.readFile(
            path.resolve(
              __dirname,
              `../seed-assets/mustafa/learning-${i + 1}.png`,
            ),
          );
          const marker = `mustafa-demo:image-${i + 1}:synthetic`;
          const existing = await q(
            'SELECT id FROM photo WHERE host_group_id=$1 AND event_note=$2',
            [group, marker],
          );
          let photoId = existing.rows[0]?.id;
          if (!photoId) {
            const form = new FormData();
            form.append('groupId', group);
            form.append('albumTitle', 'مطالعه و همراهی — تصاویر آزمایشی');
            form.append(
              'title',
              [
                'مطالعهٔ گروهی — تصویر ساختگی',
                'آمادگی اردو — تصویر ساختگی',
                'کتاب‌خوانی — تصویر ساختگی',
              ][i],
            );
            form.append('eventNote', marker);
            form.append('taggedPersonIds', JSON.stringify([person]));
            form.append(
              'file',
              new Blob([body], { type: 'image/png' }),
              `sample-${i + 1}.png`,
            );
            const response = await fetch(
              base + '/album/photos?groupId=' + encodeURIComponent(group),
              {
                method: 'POST',
                headers: mentorHeaders,
                body: form,
              },
            );
            if (!response.ok)
              throw new Error('Album API upload failed: ' + response.status);
            photoId = (await response.json()).id;
          }
          const contentUrl = base + '/album/photos/' + photoId + '/content';
          const content = await fetch(contentUrl, { headers: memberHeaders });
          if (
            !content.ok ||
            !Buffer.from(await content.arrayBuffer()).equals(body)
          )
            throw new Error('Member photo readback failed.');
          const anonymous = await fetch(contentUrl);
          if (anonymous.status !== 401)
            throw new Error('Photo accessible without login.');
        }
        console.log(
          'Album API: three uploads and member image readbacks verified; anonymous access denied.',
        );
      } finally {
        raw.destroy();
      }
    }
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error('Demo failed:', error.name, error.message);
  process.exitCode = 1;
});
