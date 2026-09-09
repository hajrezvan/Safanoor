/**
 * Docker entrypoint seed — idempotent.
 * Creates full demo accounts (admin, mentors, assistants, students) plus
 * grades/groups and a minimal relational sample so the UI is evaluable.
 * For the richest local demo, prefer `npm run db:seed` on the host.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import argon2 from "argon2";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const databasePath = process.env.DATABASE_PATH ?? path.join(root, "data", "app.db");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const now = new Date().toISOString();
const id = (prefix) => `${prefix}_${randomUUID()}`;

const ROLE_KEYS = {
  admin: "admin",
  mentor: "mentor",
  assistant_mentor: "assistant_mentor",
  student: "student",
};

const ROLE_TITLES = {
  admin: "مدیر",
  mentor: "مربی",
  assistant_mentor: "کمک‌مربی",
  student: "دانش‌آموز",
};

const PERMS = [
  ["users.manage", "مدیریت کاربران"],
  ["students.manage", "مدیریت دانش‌آموزان"],
  ["students.view_scoped", "مشاهده دانش‌آموزان در محدوده"],
  ["plans.manage", "مدیریت اهداف، برنامه فردی و اقدامات"],
  ["sessions.manage", "ثبت و مدیریت جلسات مربی‌گری"],
  ["notes.manage", "ثبت یادداشت مربی"],
  ["chat.use", "استفاده از چت پشتیبانی"],
  ["referrals.manage", "مدیریت ارجاعات"],
  ["paths.manage", "مدیریت مسیرهای تربیتی"],
  ["courses.manage", "مدیریت دوره‌ها"],
  ["activities.manage", "مدیریت فعالیت‌ها"],
  ["knowledge.manage", "مدیریت بانک دانش"],
  ["ai.use", "استفاده از مربی‌یار هوشمند"],
];

const ROLE_PERMS = {
  admin: PERMS.map(([k]) => k),
  mentor: [
    "students.view_scoped",
    "plans.manage",
    "sessions.manage",
    "notes.manage",
    "chat.use",
    "referrals.manage",
    "knowledge.manage",
    "ai.use",
  ],
  assistant_mentor: [
    "students.view_scoped",
    "plans.manage",
    "sessions.manage",
    "notes.manage",
    "chat.use",
    "referrals.manage",
  ],
  student: ["chat.use"],
};

for (const [key, title] of Object.entries(ROLE_TITLES)) {
  const existing = db.prepare("SELECT id FROM roles WHERE key = ?").get(key);
  if (!existing) {
    db.prepare("INSERT INTO roles (id, key, title_fa, created_at) VALUES (?, ?, ?, ?)").run(
      id("role"),
      key,
      title,
      now,
    );
  }
}

for (const [key, description] of PERMS) {
  const existing = db.prepare("SELECT id FROM permissions WHERE key = ?").get(key);
  if (!existing) {
    db.prepare(
      "INSERT INTO permissions (id, key, description_fa, created_at) VALUES (?, ?, ?, ?)",
    ).run(id("perm"), key, description, now);
  }
}

const roleRows = db.prepare("SELECT id, key FROM roles").all();
const permRows = db.prepare("SELECT id, key FROM permissions").all();
const permByKey = Object.fromEntries(permRows.map((p) => [p.key, p.id]));

for (const role of roleRows) {
  const wanted = ROLE_PERMS[role.key] ?? [];
  for (const permKey of wanted) {
    const permId = permByKey[permKey];
    if (!permId) continue;
    const existing = db
      .prepare("SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?")
      .get(role.id, permId);
    if (!existing) {
      db.prepare(
        "INSERT INTO role_permissions (id, role_id, permission_id) VALUES (?, ?, ?)",
      ).run(id("rp"), role.id, permId);
    }
  }
}

async function ensureUser(username, fullName, roleKey, password, email = null, avatarPath = null) {
  const existing = db.prepare("SELECT id, avatar_path FROM users WHERE username = ?").get(username);
  if (existing) {
    if (avatarPath != null && existing.avatar_path !== avatarPath) {
      db.prepare("UPDATE users SET avatar_path = ?, updated_at = ? WHERE id = ?").run(
        avatarPath,
        now,
        existing.id,
      );
    }
    return existing.id;
  }
  const role = db.prepare("SELECT id FROM roles WHERE key = ?").get(roleKey);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const userId = id("usr");
  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, full_name, avatar_path, role_id, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(userId, username, email, passwordHash, fullName, avatarPath, role.id, now, now);
  return userId;
}

const adminId = await ensureUser(
  "admin",
  "مدیر سامانه",
  ROLE_KEYS.admin,
  "Admin@1234",
  "admin@safanoor.local",
);
void adminId;

const MENTOR_SEED = [
  ["استاد رضایی", "/avatars/mentor-rezaei.svg"],
  ["استاد کریمی", "/avatars/mentor-karimi.svg"],
  ["استاد حسینی", "/avatars/mentor-hoseini.svg"],
];
const mentorIds = [];
for (const [i, [name, avatarPath]] of MENTOR_SEED.entries()) {
  mentorIds.push(
    await ensureUser(`mentor${i + 1}`, name, ROLE_KEYS.mentor, "Mentor@1234", null, avatarPath),
  );
}

const ASSISTANT_SEED = [
  ["پشتیبان احمدی", "/avatars/assistant-ahmadi.svg"],
  ["پشتیبان نوری", "/avatars/assistant-nouri.svg"],
  ["پشتیبان موسوی", "/avatars/assistant-mousavi.svg"],
  ["پشتیبان جعفری", "/avatars/assistant-jafari.svg"],
  ["پشتیبان صادقی", "/avatars/assistant-sadeghi.svg"],
  ["پشتیبان اکبری", "/avatars/assistant-akbari.svg"],
];
const assistantIds = [];
for (const [i, [name, avatarPath]] of ASSISTANT_SEED.entries()) {
  assistantIds.push(
    await ensureUser(
      `assistant${i + 1}`,
      name,
      ROLE_KEYS.assistant_mentor,
      "Assist@1234",
      null,
      avatarPath,
    ),
  );
}

const GRADE_SEED = [
  ["grade_7", "هفتم", 7],
  ["grade_8", "هشتم", 8],
  ["grade_9", "نهم", 9],
  ["grade_10", "دهم", 10],
  ["grade_11", "یازدهم", 11],
  ["grade_12", "دوازدهم", 12],
];

const gradeIds = {};
for (const [key, title, ordering] of GRADE_SEED) {
  let row = db.prepare("SELECT id FROM grades WHERE key = ?").get(key);
  if (!row) {
    const gid = id("grd");
    db.prepare(
      "INSERT INTO grades (id, key, title_fa, ordering, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(gid, key, title, ordering, now);
    gradeIds[key] = gid;
  } else {
    gradeIds[key] = row.id;
  }
}

const groupTitles = {
  grade_7: "حلقه شهید فهمیده",
  grade_8: "حلقه شهید باکری",
  grade_9: "حلقه شهید همت",
  grade_10: "حلقه شهید بابایی",
  grade_11: "حلقه شهید چمران",
  grade_12: "حلقه شهید کاظمی",
};
const groupIds = {};
for (const [gradeKey, title] of Object.entries(groupTitles)) {
  const gradeId = gradeIds[gradeKey];
  let row = db.prepare("SELECT id FROM groups WHERE grade_id = ? AND title = ?").get(gradeId, title);
  if (!row) {
    const gid = id("grp");
    db.prepare(
      "INSERT INTO groups (id, grade_id, title, status, created_at) VALUES (?, ?, ?, 'active', ?)",
    ).run(gid, gradeId, title, now);
    groupIds[gradeKey] = gid;
  } else {
    groupIds[gradeKey] = row.id;
  }
}

const studentNames = [
  ["student1", "علی محمدی", "grade_8"],
  ["student2", "محمدحسین کاظمی", "grade_7"],
  ["student3", "امیرعباس صادقی", "grade_7"],
  ["student4", "سیدرضا موسوی", "grade_8"],
  ["student5", "مهدی نوروزی", "grade_9"],
  ["student6", "سیدحسین طباطبایی", "grade_9"],
  ["student7", "ابوالفضل کریمی", "grade_10"],
  ["student8", "یوسف حیدری", "grade_11"],
  ["student9", "محمدطاها اسدی", "grade_12"],
  ["student10", "پارسا احمدی", "grade_7"],
  ["student11", "آرین جعفری", "grade_7"],
  ["student12", "کیان رضایی", "grade_8"],
  ["student13", "سامان مرادی", "grade_8"],
  ["student14", "رضا قاسمی", "grade_9"],
  ["student15", "حسین اکبری", "grade_9"],
  ["student16", "امیرعلی نوری", "grade_10"],
  ["student17", "محمدپارسا شریفی", "grade_10"],
  ["student18", "عرفان جعفریان", "grade_10"],
  ["student19", "سبحان کاظمی‌زاده", "grade_11"],
  ["student20", "نیما فرهادی", "grade_11"],
  ["student21", "آرش سلیمانی", "grade_11"],
  ["student22", "دانیال موسویان", "grade_12"],
  ["student23", "ماهان رحیمی", "grade_12"],
  ["student24", "پویا حسن‌زاده", "grade_7"],
  ["student25", "ایلیا قربانی", "grade_8"],
  ["student26", "رادین کمالی", "grade_9"],
  ["student27", "سینا باقری", "grade_9"],
  ["student28", "آیدین طاهری", "grade_10"],
  ["student29", "بنیامین زارعی", "grade_11"],
  ["student30", "محمدامین جلالی", "grade_12"],
];

for (const [index, [username, fullName, gradeKey]] of studentNames.entries()) {
  const userId = await ensureUser(username, fullName, ROLE_KEYS.student, "Student@1234");
  let student = db.prepare("SELECT id FROM students WHERE user_id = ?").get(userId);
  if (!student) {
    const studentId = id("std");
    db.prepare(
      `INSERT INTO students (id, user_id, grade_id, group_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    ).run(studentId, userId, gradeIds[gradeKey], groupIds[gradeKey], now, now);
    db.prepare(
      `INSERT INTO growth_profiles (id, student_id, interests, skills, academic_status, overall_note, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id("gpf"),
      studentId,
      "مطالعه، ورزش، فعالیت گروهی",
      "همکاری و پیگیری",
      "وضعیت تحصیلی متعادل",
      "پرونده نمونه seed",
      now,
    );

    const mentorId = mentorIds[index % mentorIds.length];
    const assistantId = assistantIds[index % assistantIds.length];
    db.prepare(
      `INSERT INTO mentor_assignments (id, student_id, staff_user_id, assignment_role, is_active, started_at, ended_at)
       VALUES (?, ?, ?, 'mentor', 1, ?, NULL)`,
    ).run(id("mas"), studentId, mentorId, now);
    db.prepare(
      `INSERT INTO mentor_assignments (id, student_id, staff_user_id, assignment_role, is_active, started_at, ended_at)
       VALUES (?, ?, ?, 'assistant_mentor', 1, ?, NULL)`,
    ).run(id("mas"), studentId, assistantId, now);
  }
}

/** نمونه رابطه‌ای برای جریان E2E داخل کانتینر (مسیر، دوره، هدف، اقدام، چت، جلسه، ارجاع، فعالیت). */
function seedRelationalDemo() {
  const student1User = db.prepare("SELECT id FROM users WHERE username = 'student1'").get();
  const student1 = student1User
    ? db.prepare("SELECT * FROM students WHERE user_id = ?").get(student1User.id)
    : null;
  if (!student1) return;

  const mentor1 = db.prepare("SELECT id FROM users WHERE username = 'mentor1'").get();
  const assistant1 = db.prepare("SELECT id FROM users WHERE username = 'assistant1'").get();
  if (!mentor1 || !assistant1) return;

  const grade8 = gradeIds.grade_8;

  let path = db.prepare("SELECT id FROM growth_paths WHERE title = ?").get("مسیر رشد پایه هشتم");
  if (!path) {
    const pathId = id("path");
    db.prepare(
      `INSERT INTO growth_paths (id, title, description, grade_id, status, ordering, created_at)
       VALUES (?, ?, ?, ?, 'active', 1, ?)`,
    ).run(
      pathId,
      "مسیر رشد پایه هشتم",
      "تمرکز بر نظم شخصی، مطالعه و مشارکت گروهی",
      grade8,
      now,
    );
    db.prepare(
      `INSERT INTO path_objectives (id, path_id, title, ordering) VALUES (?, ?, ?, 1)`,
    ).run(id("pobj"), pathId, "انس هفتگی با مطالعه هدفمند");
    path = { id: pathId };
  }

  const enrollment = db
    .prepare("SELECT id FROM path_enrollments WHERE student_id = ? AND status = 'active'")
    .get(student1.id);
  if (!enrollment) {
    db.prepare(
      `INSERT INTO path_enrollments (id, student_id, path_id, status, started_at, ended_at)
       VALUES (?, ?, ?, 'active', ?, NULL)`,
    ).run(id("penr"), student1.id, path.id, now);
  }

  let course = db.prepare("SELECT id FROM courses WHERE title = ?").get("مبانی برنامه‌نویسی با پایتون");
  if (!course) {
    const courseId = id("crs");
    db.prepare(
      `INSERT INTO courses (id, title, description, status, ordering, created_at)
       VALUES (?, ?, ?, 'published', 1, ?)`,
    ).run(courseId, "مبانی برنامه‌نویسی با پایتون", "آشنایی با تفکر الگوریتمی برای نوجوانان", now);
    const lessonId = id("les");
    db.prepare(
      `INSERT INTO lessons (id, course_id, title, description, ordering, content_type)
       VALUES (?, ?, ?, ?, 1, 'TEXT')`,
    ).run(lessonId, courseId, "متغیر و ورودی", "اولین برنامه ساده");
    db.prepare(
      `INSERT INTO lesson_contents (id, lesson_id, body, file_path, url)
       VALUES (?, ?, ?, NULL, NULL)`,
    ).run(id("lcnt"), lessonId, "در این درس با مفهوم متغیر آشنا می‌شوید.");
    course = { id: courseId };
  }

  let book = db.prepare("SELECT id FROM books WHERE title = ?").get("قصه‌های خوب برای بچه‌های خوب");
  if (!book) {
    const bookId = id("bok");
    db.prepare(
      `INSERT INTO books (id, title, author, description, difficulty, created_at)
       VALUES (?, ?, ?, ?, 'easy', ?)`,
    ).run(
      bookId,
      "قصه‌های خوب برای بچه‌های خوب",
      "آذریزدی",
      "مجموعه داستان‌های اخلاقی کوتاه",
      now,
    );
    book = { id: bookId };
  }
  if (
    !db
      .prepare("SELECT id FROM reading_plans WHERE student_id = ? AND book_id = ?")
      .get(student1.id, book.id)
  ) {
    db.prepare(
      `INSERT INTO reading_plans (id, student_id, book_id, start_date, deadline, status, progress, mentor_note, created_at)
       VALUES (?, ?, ?, ?, ?, 'in_progress', 25, ?, ?)`,
    ).run(
      id("rpl"),
      student1.id,
      book.id,
      now,
      new Date(Date.now() + 30 * 86400000).toISOString(),
      "هر هفته یک داستان و خلاصه آن",
      now,
    );
  }

  let category = db.prepare("SELECT id FROM goal_categories WHERE key = ?").get("fardi");
  if (!category) {
    const catId = id("gcat");
    db.prepare(
      `INSERT INTO goal_categories (id, key, title_fa, created_at) VALUES (?, ?, ?, ?)`,
    ).run(catId, "fardi", "فردی", now);
    category = { id: catId };
  }

  let goal = db
    .prepare("SELECT id FROM goals WHERE student_id = ? AND title = ?")
    .get(student1.id, "تقویت نظم شخصی");
  if (!goal) {
    const goalId = id("goal");
    db.prepare(
      `INSERT INTO goals (id, student_id, title, description, category_id, priority, start_date, target_date, status, mentor_note, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'high', ?, ?, 'active', ?, ?, ?, ?)`,
    ).run(
      goalId,
      student1.id,
      "تقویت نظم شخصی",
      "اجرای برنامه روزانه در پنج روز هفته",
      category.id,
      now,
      new Date(Date.now() + 60 * 86400000).toISOString(),
      "مرور هفتگی با مربی",
      mentor1.id,
      now,
      now,
    );
    goal = { id: goalId };
  }

  let plan = db
    .prepare("SELECT id FROM individual_plans WHERE student_id = ? AND title = ?")
    .get(student1.id, "برنامه رشد پاییز");
  if (!plan) {
    const planId = id("ipl");
    db.prepare(
      `INSERT INTO individual_plans (id, student_id, title, description, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
    ).run(
      planId,
      student1.id,
      "برنامه رشد پاییز",
      "تمرکز بر نظم، مطالعه و مشارکت گروهی",
      mentor1.id,
      now,
      now,
    );
    plan = { id: planId };
  }

  const actionDefs = [
    ["ثبت گزارش برنامه هفتگی", "TODO", "2025-01-07T00:00:00.000Z"],
    ["مرور درس پایتون", "IN_PROGRESS", new Date(Date.now() + 3 * 86400000).toISOString()],
    ["خلاصه کتاب هفته", "DONE", new Date(Date.now() - 2 * 86400000).toISOString()],
  ];
  for (const [title, status, deadline] of actionDefs) {
    if (
      db.prepare("SELECT id FROM actions WHERE student_id = ? AND title = ?").get(student1.id, title)
    ) {
      continue;
    }
    db.prepare(
      `INSERT INTO actions (id, student_id, plan_id, goal_id, title, description, type, assignee_user_id, start_date, deadline, status, priority, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'task', ?, ?, ?, ?, 'medium', ?, ?, ?)`,
    ).run(
      id("act"),
      student1.id,
      plan.id,
      goal.id,
      title,
      "اقدام نمونه seed داکر",
      student1.user_id,
      now,
      deadline,
      status,
      mentor1.id,
      now,
      now,
    );
  }

  let conv = db
    .prepare(
      `SELECT id FROM chat_conversations WHERE student_user_id = ? AND staff_user_id = ? AND status = 'active'`,
    )
    .get(student1.user_id, assistant1.id);
  if (!conv) {
    const convId = id("chat");
    db.prepare(
      `INSERT INTO chat_conversations (id, student_user_id, staff_user_id, status, created_at, archived_at)
       VALUES (?, ?, ?, 'active', ?, NULL)`,
    ).run(convId, student1.user_id, assistant1.id, now);
    db.prepare(
      `INSERT INTO chat_messages (id, conversation_id, sender_user_id, content, created_at, read_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    ).run(id("msg"), convId, student1.user_id, "سلام، امروز در برنامه‌ریزی کمی عقب افتادم.", now);
    db.prepare(
      `INSERT INTO chat_messages (id, conversation_id, sender_user_id, content, created_at, read_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      id("msg"),
      convId,
      assistant1.id,
      "اشکالی ندارد؛ تا فردا شب لیست کارها را بفرست.",
      now,
      now,
    );
  }

  if (
    !db
      .prepare("SELECT id FROM mentoring_sessions WHERE student_id = ? AND type = ?")
      .get(student1.id, "حضوری")
  ) {
    db.prepare(
      `INSERT INTO mentoring_sessions (id, student_id, staff_user_id, date, type, duration_minutes, topics, raw_notes, summary, observations, follow_up_date, referral_required, confidentiality, created_at)
       VALUES (?, ?, ?, ?, 'حضوری', 45, ?, ?, ?, ?, ?, 0, 'NORMAL', ?)`,
    ).run(
      id("sess"),
      student1.id,
      assistant1.id,
      now,
      "نظم شخصی و برنامه هفتگی",
      "دانش‌آموز درباره تأخیر در گزارش صحبت کرد.",
      "نیاز به پیگیری گزارش هفتگی",
      "انگیزه خوب؛ نیاز به یادآوری ملایم",
      new Date(Date.now() + 7 * 86400000).toISOString(),
      now,
    );
  }

  if (
    !db
      .prepare("SELECT id FROM referrals WHERE student_id = ? AND subject = ?")
      .get(student1.id, "نیاز به مشاوره اضطراب آزمون")
  ) {
    db.prepare(
      `INSERT INTO referrals (id, student_id, created_by, assigned_to, subject, description, priority, status, response, resolved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'high', 'OPEN', NULL, NULL, ?, ?)`,
    ).run(
      id("ref"),
      student1.id,
      assistant1.id,
      mentor1.id,
      "نیاز به مشاوره اضطراب آزمون",
      "قبل از آزمون‌های نوبت اول علائم اضطراب دیده می‌شود.",
      now,
      now,
    );
  }

  let activity = db.prepare("SELECT id FROM activities WHERE title = ?").get("پروژه عکاسی محله");
  if (!activity) {
    const actId = id("actv");
    db.prepare(
      `INSERT INTO activities (id, title, description, type, grade_id, instructions, expected_output, status, created_at)
       VALUES (?, ?, ?, 'photography', ?, ?, ?, 'active', ?)`,
    ).run(
      actId,
      "پروژه عکاسی محله",
      "ثبت پنج قاب از فضای عمومی محله",
      grade8,
      "با رعایت حریم خصوصی عکس بگیرید.",
      "آلبوم پنج‌عکسی با توضیح کوتاه",
      now,
    );
    activity = { id: actId };
  }
  if (
    !db
      .prepare("SELECT id FROM activity_assignments WHERE activity_id = ? AND student_id = ?")
      .get(activity.id, student1.id)
  ) {
    db.prepare(
      `INSERT INTO activity_assignments (id, activity_id, student_id, status, due_date, result, feedback, submitted_at, created_at, updated_at)
       VALUES (?, ?, ?, 'assigned', ?, NULL, NULL, NULL, ?, ?)`,
    ).run(
      id("aasg"),
      activity.id,
      student1.id,
      new Date(Date.now() + 14 * 86400000).toISOString(),
      now,
      now,
    );
  }

  db.prepare(
    `INSERT INTO audit_events (id, actor_user_id, entity_type, entity_id, action, before_json, after_json, metadata_json, created_at)
     VALUES (?, ?, 'student', ?, 'seed.demo', NULL, NULL, ?, ?)`,
  ).run(
    id("aud"),
    mentor1.id,
    student1.id,
    JSON.stringify({ source: "docker-seed" }),
    now,
  );
}

const kbCount = db.prepare("SELECT COUNT(*) AS c FROM knowledge_items").get().c;
if (kbCount === 0) {
  const items = [
    [
      "برخورد با بی‌انگیزگی نوجوان",
      "انگیزه",
      "دانش‌آموز تکالیف را به تعویق می‌اندازد.",
      "هدف کوچک هفتگی تعریف شود و پیشرفت تشویق شود.",
      "از سرزنش مستقیم پرهیز شود.",
      "انگیزه،پیگیری",
    ],
    [
      "مدیریت تعارض در گروه",
      "گروه",
      "دو نفر در حلقه بر سر نقش‌ها اختلاف دارند.",
      "جلسه کوتاه میانجی‌گری با قواعد گفتگو برگزار شود.",
      "طرف‌داری آشکار نکنید.",
      "تعارض،گروه",
    ],
    [
      "اضطراب آزمون",
      "سلامت‌روان",
      "قبل از آزمون علائم اضطراب دیده می‌شود.",
      "برنامه مرور خرد و تنفس کوتاه آموزش داده شود؛ در موارد شدید ارجاع انسانی.",
      "تشخیص روان‌شناختی ندهید.",
      "اضطراب،آزمون",
    ],
  ];
  for (const [title, category, scenario, approach, cautions, tags] of items) {
    db.prepare(
      `INSERT INTO knowledge_items (id, title, category, question_scenario, recommended_approach, cautions, tags, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)`,
    ).run(id("kb"), title, category, scenario, approach, cautions, tags, now, now);
  }
}

seedRelationalDemo();

db.close();
console.log(
  "Docker seed completed: admin / mentor1..3 / assistant1..6 / student1..30 + E2E sample (path/course/goal/action/chat/session/referral/activity).",
);
