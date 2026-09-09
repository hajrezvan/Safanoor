import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import {
  actions,
  books,
  chatConversations,
  chatMessages,
  courses,
  goals,
  groups,
  growthPaths,
  individualPlans,
  mentoringSessions,
  mentorNotes,
  permissions,
  readingPlans,
  referrals,
  rolePermissions,
  roles,
  students,
  users,
  activities,
  activityAssignments,
} from "@/db/schema";
import { hashPassword } from "@/server/auth/password";
import {
  ROLE_KEYS,
  ROLE_TITLES_FA,
  STUDENT_STATUS,
  type RoleKey,
  ACTION_STATUS,
  ACTION_TYPE,
  ANNOUNCEMENT_AUDIENCE,
  ANNOUNCEMENT_STATUS,
  BOOK_DIFFICULTY,
  COURSE_STATUS,
  EXAM_RELATED_TYPE,
  GOAL_STATUS,
  GROWTH_PATH_STATUS,
  LESSON_CONTENT_TYPE,
  NOTE_VISIBILITY,
  PLAN_STATUS,
  PRIORITY,
  READING_PLAN_STATUS,
  REFERRAL_STATUS,
  SESSION_CONFIDENTIALITY,
  CHAT_CONVERSATION_STATUS,
  ACTIVITY_STATUS,
  ACTIVITY_TYPE,
} from "@/lib/enums";
import { createId, nowIso } from "@/lib/id";
import {
  PERMISSIONS,
  getDefaultPermissionsForRole,
} from "@/server/authz/policy";
import { GRADE_KEYS, getGradeByKey, seedGrades } from "@/server/modules/grades/service";
import { createGroup } from "@/server/modules/groups/service";
import {
  createStudent,
  upsertGrowthProfile,
} from "@/server/modules/students/service";
import {
  createGrowthPath,
  createPathObjective,
  setActiveEnrollment,
} from "@/server/modules/paths/service";
import {
  createCourse,
  createLesson,
  createChapter,
  upsertLessonContent,
} from "@/server/modules/courses/service";
import { createBook, createBookChapter, createReadingPlan, listBookChapters } from "@/server/modules/books/service";
import { createAnnouncement } from "@/server/modules/announcements/service";
import { createExam, deleteExam, ensureExamBankQuestion, listExamsForRelated, submitExamAnswer, updateExamMcq } from "@/server/modules/exams/service";
import { announcements } from "@/db/schema";
import {
  createAction,
  createGoal,
  createIndividualPlan,
  seedGoalCategories,
  transitionAction,
} from "@/server/modules/plans/service";
import { getOrCreateActiveConversation, sendMessage } from "@/server/modules/chat/service";
import { createSession } from "@/server/modules/sessions/service";
import { createNote } from "@/server/modules/notes/service";
import { createReferral, updateReferralStatus } from "@/server/modules/referrals/service";
import {
  assignActivityToStudent,
  createActivity,
  provideMentorFeedback,
  submitActivityProgress,
} from "@/server/modules/activities/service";
import { seedKnowledgeItems } from "@/server/modules/knowledge/service";

async function ensureRolesAndPermissions() {
  const now = nowIso();

  for (const key of Object.values(ROLE_KEYS)) {
    const existing = db.select().from(roles).where(eq(roles.key, key)).get();
    if (!existing) {
      db.insert(roles)
        .values({
          id: createId("role"),
          key,
          titleFa: ROLE_TITLES_FA[key],
          createdAt: now,
        })
        .run();
    }
  }

  for (const [key, descriptionFa] of Object.entries({
    [PERMISSIONS.USERS_MANAGE]: "مدیریت کاربران",
    [PERMISSIONS.STUDENTS_MANAGE]: "مدیریت دانش‌آموزان",
    [PERMISSIONS.STUDENTS_VIEW_SCOPED]: "مشاهده دانش‌آموزان در محدوده",
    [PERMISSIONS.FORCES_MANAGE]: "مدیریت نیروها",
    [PERMISSIONS.PLANS_MANAGE]: "مدیریت اهداف، برنامه فردی و اقدامات",
    [PERMISSIONS.SESSIONS_MANAGE]: "ثبت و مدیریت جلسات مربی‌گری",
    [PERMISSIONS.NOTES_MANAGE]: "ثبت یادداشت مربی",
    [PERMISSIONS.CHAT_USE]: "استفاده از چت پشتیبانی",
    [PERMISSIONS.REFERRALS_MANAGE]: "مدیریت ارجاعات",
    [PERMISSIONS.PATHS_MANAGE]: "مدیریت مسیرهای تربیتی",
    [PERMISSIONS.COURSES_MANAGE]: "مدیریت دوره‌ها",
    [PERMISSIONS.CLASSES_MANAGE]: "مدیریت کلاس‌ها",
    [PERMISSIONS.LIBRARY_MANAGE]: "مدیریت کتابخانه",
    [PERMISSIONS.ANNOUNCEMENTS_MANAGE]: "مدیریت اطلاعیه‌ها",
    [PERMISSIONS.EXAMS_REVIEW]: "بازبینی آزمون‌ها",
    [PERMISSIONS.ACTIVITIES_MANAGE]: "مدیریت فعالیت‌ها",
    [PERMISSIONS.KNOWLEDGE_MANAGE]: "مدیریت بانک دانش",
    [PERMISSIONS.AI_USE]: "استفاده از مربی‌یار هوشمند",
  })) {
    const existing = db.select().from(permissions).where(eq(permissions.key, key)).get();
    if (!existing) {
      db.insert(permissions)
        .values({
          id: createId("perm"),
          key,
          descriptionFa,
          createdAt: now,
        })
        .run();
    }
  }

  const allRoles = db.select().from(roles).all();
  const allPerms = db.select().from(permissions).all();
  const permByKey = Object.fromEntries(allPerms.map((p) => [p.key, p]));

  for (const role of allRoles) {
    const wanted = getDefaultPermissionsForRole(role.key as RoleKey);
    for (const permKey of wanted) {
      const perm = permByKey[permKey];
      if (!perm) continue;
      const existing = db
        .select()
        .from(rolePermissions)
        .where(
          and(eq(rolePermissions.roleId, role.id), eq(rolePermissions.permissionId, perm.id)),
        )
        .get();
      if (!existing) {
        db.insert(rolePermissions)
          .values({
            id: createId("rp"),
            roleId: role.id,
            permissionId: perm.id,
          })
          .run();
      }
    }
  }
}

async function ensureUser(opts: {
  username: string;
  fullName: string;
  roleKey: RoleKey;
  password: string;
  email?: string;
  avatarPath?: string | null;
}) {
  const existing = db.select().from(users).where(eq(users.username, opts.username)).get();
  if (existing) {
    if (opts.avatarPath !== undefined && existing.avatarPath !== opts.avatarPath) {
      db.update(users)
        .set({ avatarPath: opts.avatarPath, updatedAt: nowIso() })
        .where(eq(users.id, existing.id))
        .run();
      return db.select().from(users).where(eq(users.id, existing.id)).get()!;
    }
    return existing;
  }

  const role = db.select().from(roles).where(eq(roles.key, opts.roleKey)).get();
  if (!role) throw new Error(`role ${opts.roleKey} missing`);

  const now = nowIso();
  const id = createId("usr");
  const passwordHash = await hashPassword(opts.password);
  db.insert(users)
    .values({
      id,
      username: opts.username,
      email: opts.email ?? null,
      passwordHash,
      fullName: opts.fullName,
      avatarPath: opts.avatarPath ?? null,
      roleId: role.id,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return db.select().from(users).where(eq(users.id, id)).get()!;
}

const GROUP_SEED: { gradeKey: string; title: string }[] = [
  { gradeKey: GRADE_KEYS.SEVENTH, title: "حلقه شهید فهمیده" },
  { gradeKey: GRADE_KEYS.SEVENTH, title: "حلقه نوجوانان کوشا" },
  { gradeKey: GRADE_KEYS.EIGHTH, title: "حلقه شهید باکری" },
  { gradeKey: GRADE_KEYS.EIGHTH, title: "حلقه اندیشه" },
  { gradeKey: GRADE_KEYS.NINTH, title: "حلقه شهید همت" },
  { gradeKey: GRADE_KEYS.TENTH, title: "حلقه شهید بابایی" },
  { gradeKey: GRADE_KEYS.ELEVENTH, title: "حلقه شهید چمران" },
  { gradeKey: GRADE_KEYS.TWELFTH, title: "حلقه شهید کاظمی" },
];

const STUDENT_ROSTER: {
  username: string;
  fullName: string;
  gradeKey: string;
  interests: string;
  skills: string;
  academicStatus: string;
  overallNote: string;
  mentorIndex: number;
  assistantIndex: number;
}[] = [
  {
    username: "student1",
    fullName: "علی محمدی",
    gradeKey: GRADE_KEYS.EIGHTH,
    interests: "خوشنویسی، فوتبال، کتاب‌های تاریخی",
    skills: "کار تیمی، پیگیری وظایف",
    academicStatus: "وضعیت درسی مناسب؛ در زبان انگلیسی نیاز به تقویت دارد.",
    overallNote: "با انگیزه و منظم؛ در برنامه‌ریزی شخصی نیاز به همراهی مربی دارد.",
    mentorIndex: 0,
    assistantIndex: 0,
  },
  {
    username: "student2",
    fullName: "محمدحسین کاظمی",
    gradeKey: GRADE_KEYS.SEVENTH,
    interests: "رباتیک، شنا، داستان‌های تاریخی",
    skills: "کار گروهی، پرسشگری دقیق",
    academicStatus: "معدل خوب؛ در ریاضی نیاز به تمرین بیشتر دارد.",
    overallNote: "پرانرژی و کنجکاو؛ با کار عملی بهتر یاد می‌گیرد.",
    mentorIndex: 0,
    assistantIndex: 0,
  },
  {
    username: "student3",
    fullName: "امیرعباس صادقی",
    gradeKey: GRADE_KEYS.SEVENTH,
    interests: "خوشنویسی، فوتبال",
    skills: "نظم شخصی، پیگیری تکالیف",
    academicStatus: "وضعیت تحصیلی متعادل در همه دروس.",
    overallNote: "کم‌حرف اما در جمع صمیمی؛ نیازمند تشویق برای مشارکت کلامی.",
    mentorIndex: 0,
    assistantIndex: 1,
  },
  {
    username: "student4",
    fullName: "سیدرضا موسوی",
    gradeKey: GRADE_KEYS.EIGHTH,
    interests: "نجوم، برنامه‌نویسی مقدماتی",
    skills: "تمرکز طولانی، حل مسئله",
    academicStatus: "در علوم تجربی برجسته است.",
    overallNote: "علاقه‌مند به مطالعه آزاد؛ برنامه مطالعاتی هدفمند لازم دارد.",
    mentorIndex: 0,
    assistantIndex: 1,
  },
  {
    username: "student5",
    fullName: "مهدی نوروزی",
    gradeKey: GRADE_KEYS.NINTH,
    interests: "کوهنوردی، تواشیح",
    skills: "مسئولیت‌پذیری، سخنرانی",
    academicStatus: "معدل بالا؛ در انتخاب رشته نیاز به مشاوره دارد.",
    overallNote: "ظرفیت مسئولیت‌های گروهی را دارد.",
    mentorIndex: 1,
    assistantIndex: 2,
  },
  {
    username: "student6",
    fullName: "سیدحسین طباطبایی",
    gradeKey: GRADE_KEYS.NINTH,
    interests: "مطالعه سیره، تیراندازی",
    skills: "یادداشت‌برداری، مباحثه",
    academicStatus: "در دروس حفظی قوی؛ ریاضی متوسط.",
    overallNote: "اهل مطالعه منظم؛ پیگیری هفتگی نتیجه خوبی داده است.",
    mentorIndex: 1,
    assistantIndex: 2,
  },
  {
    username: "student7",
    fullName: "ابوالفضل کریمی",
    gradeKey: GRADE_KEYS.TENTH,
    interests: "طراحی گرافیک، والیبال",
    skills: "خلاقیت بصری، کار با نرم‌افزار",
    academicStatus: "وضعیت تحصیلی رو به بهبود پس از جلسات پیگیری.",
    overallNote: "با مسئولیت‌های هنری گروه انگیزه بیشتری می‌گیرد.",
    mentorIndex: 1,
    assistantIndex: 3,
  },
  {
    username: "student8",
    fullName: "یوسف حیدری",
    gradeKey: GRADE_KEYS.ELEVENTH,
    interests: "مناظره، اقتصاد",
    skills: "استدلال، مطالعه تحلیلی",
    academicStatus: "معدل خوب با تمرکز بر دروس انسانی.",
    overallNote: "نیازمند تعادل میان فعالیت‌های جانبی و درس.",
    mentorIndex: 2,
    assistantIndex: 4,
  },
  {
    username: "student9",
    fullName: "محمدطاها اسدی",
    gradeKey: GRADE_KEYS.TWELFTH,
    interests: "پزشکی، دوچرخه‌سواری",
    skills: "برنامه‌ریزی، پشتکار",
    academicStatus: "در آستانه کنکور؛ برنامه مطالعاتی فشرده دارد.",
    overallNote: "استرس آزمون دارد؛ جلسات آرام‌سازی توصیه شده است.",
    mentorIndex: 2,
    assistantIndex: 5,
  },
  {
    username: "student10",
    fullName: "پارسا احمدی",
    gradeKey: GRADE_KEYS.SEVENTH,
    interests: "سازه‌های ماکارونی، فوتسال",
    skills: "دقت دست، همکاری",
    academicStatus: "در ریاضی و فیزیک متوسط رو به بالا.",
    overallNote: "در کار گروهی پیش‌قدم است.",
    mentorIndex: 0,
    assistantIndex: 0,
  },
  {
    username: "student11",
    fullName: "آرین جعفری",
    gradeKey: GRADE_KEYS.SEVENTH,
    interests: "گلایدر کاغذی، مطالعه علمی",
    skills: "کنجکاوی، آزمایشگری",
    academicStatus: "علاقه‌مند به علوم؛ انشا نیاز به تمرین دارد.",
    overallNote: "با پروژه‌های عملی انگیزه می‌گیرد.",
    mentorIndex: 0,
    assistantIndex: 1,
  },
  {
    username: "student12",
    fullName: "کیان رضایی",
    gradeKey: GRADE_KEYS.EIGHTH,
    interests: "برنامه‌نویسی پایتون، شطرنج",
    skills: "تفکر منطقی، تمرکز",
    academicStatus: "معدل عالی در ریاضی و علوم.",
    overallNote: "گاهی بیش از حد درگیر رایانه می‌شود؛ تعادل لازم است.",
    mentorIndex: 0,
    assistantIndex: 1,
  },
  {
    username: "student13",
    fullName: "سامان مرادی",
    gradeKey: GRADE_KEYS.EIGHTH,
    interests: "عکاسی، طبیعت‌گردی",
    skills: "دیده تیزبین، گزارش‌نویسی",
    academicStatus: "وضعیت متعادل؛ در زبان قوی‌تر است.",
    overallNote: "پروژه‌های تصویری به رشد اعتمادبه‌نفسش کمک کرده.",
    mentorIndex: 1,
    assistantIndex: 2,
  },
  {
    username: "student14",
    fullName: "رضا قاسمی",
    gradeKey: GRADE_KEYS.NINTH,
    interests: "نویسندگی، روزنامه‌نگاری مدرسه",
    skills: "نگارش روان، گوش دادن فعال",
    academicStatus: "در ادبیات برجسته است.",
    overallNote: "می‌تواند سردبیر نشریه گروهی شود.",
    mentorIndex: 1,
    assistantIndex: 2,
  },
  {
    username: "student15",
    fullName: "حسین اکبری",
    gradeKey: GRADE_KEYS.NINTH,
    interests: "ورزش صبحگاهی، مطالعه کتاب معرفتی",
    skills: "انضباط، حضور منظم",
    academicStatus: "معدل خوب؛ پیگیری تکالیف پایدار است.",
    overallNote: "الگوی نظم برای هم‌گروهی‌هاست.",
    mentorIndex: 1,
    assistantIndex: 3,
  },
  {
    username: "student16",
    fullName: "امیرعلی نوری",
    gradeKey: GRADE_KEYS.TENTH,
    interests: "گرافیک رایانه‌ای، خوشنویسی",
    skills: "زیبایی‌شناسی، صبر در تمرین",
    academicStatus: "هنر قوی؛ دروس پایه نیازمند مرور.",
    overallNote: "ترکیب هنر و درس را مدیریت کند.",
    mentorIndex: 1,
    assistantIndex: 3,
  },
  {
    username: "student17",
    fullName: "محمدپارسا شریفی",
    gradeKey: GRADE_KEYS.TENTH,
    interests: "رباتیک، الکترونیک",
    skills: "کار تیمی فنی، مستندسازی",
    academicStatus: "فیزیک و ریاضی قوی.",
    overallNote: "پروژه رباتیک را تا نمایشگاه پیش ببرد.",
    mentorIndex: 2,
    assistantIndex: 4,
  },
  {
    username: "student18",
    fullName: "عرفان جعفریان",
    gradeKey: GRADE_KEYS.TENTH,
    interests: "مناظره، مطالعه سیاسی اجتماعی",
    skills: "بیان، استدلال محترمانه",
    academicStatus: "دروس انسانی عالی.",
    overallNote: "نیازمند تمرین گوش‌دادن به نظر مخالف.",
    mentorIndex: 2,
    assistantIndex: 4,
  },
  {
    username: "student19",
    fullName: "سبحان کاظمی‌زاده",
    gradeKey: GRADE_KEYS.ELEVENTH,
    interests: "کنکور تجربی، کوهنوردی",
    skills: "برنامه‌ریزی درسی، استقامت",
    academicStatus: "آمادگی کنکور در جریان است.",
    overallNote: "استرس را با ورزش متعادل کند.",
    mentorIndex: 2,
    assistantIndex: 5,
  },
  {
    username: "student20",
    fullName: "نیما فرهادی",
    gradeKey: GRADE_KEYS.ELEVENTH,
    interests: "اقتصاد، بازار سرمایه آشنایی",
    skills: "تحلیل ساده، مطالعه خبر",
    academicStatus: "ریاضی مالی نیاز به تقویت دارد.",
    overallNote: "اهداف شغلی را شفاف‌تر کند.",
    mentorIndex: 2,
    assistantIndex: 5,
  },
  {
    username: "student21",
    fullName: "آرش سلیمانی",
    gradeKey: GRADE_KEYS.ELEVENTH,
    interests: "فیلم‌سازی کوتاه، نویسندگی فیلمنامه",
    skills: "قصه‌گویی، کار گروهی رسانه‌ای",
    academicStatus: "ادبیات قوی؛ فیزیک متوسط.",
    overallNote: "پروژه فیلم کوتاه نیم‌سال را تکمیل کند.",
    mentorIndex: 1,
    assistantIndex: 3,
  },
  {
    username: "student22",
    fullName: "دانیال موسویان",
    gradeKey: GRADE_KEYS.TWELFTH,
    interests: "پزشکی، داوطلبی هلال‌احمر",
    skills: "همدلی، نظم مطالعاتی",
    academicStatus: "آماده کنکور تجربی.",
    overallNote: "خواب کافی را جدی بگیرد.",
    mentorIndex: 2,
    assistantIndex: 5,
  },
  {
    username: "student23",
    fullName: "ماهان رحیمی",
    gradeKey: GRADE_KEYS.TWELFTH,
    interests: "مهندسی، سازه و معماری",
    skills: "طراحی، دقت اندازه‌گیری",
    academicStatus: "ریاضی و فیزیک قوی.",
    overallNote: "پروژه سازه ماکارونی را مستند کند.",
    mentorIndex: 2,
    assistantIndex: 4,
  },
  {
    username: "student24",
    fullName: "پویا حسن‌زاده",
    gradeKey: GRADE_KEYS.SEVENTH,
    interests: "ورزش شنا، مطالعه داستان کوتاه",
    skills: "انرژی بالا، دوستی‌جویی",
    academicStatus: "نیازمند تمرکز بیشتر در کلاس.",
    overallNote: "با تکالیف کوتاه و مشخص بهتر پیش می‌رود.",
    mentorIndex: 0,
    assistantIndex: 0,
  },
  {
    username: "student25",
    fullName: "ایلیا قربانی",
    gradeKey: GRADE_KEYS.EIGHTH,
    interests: "خوشنویسی نستعلیق، موسیقی سنتی",
    skills: "دقت، تمرین مداوم",
    academicStatus: "هنر عالی؛ ریاضی نیاز به همراهی دارد.",
    overallNote: "نمایشگاه خط را هدف ماهانه قرار دهد.",
    mentorIndex: 0,
    assistantIndex: 1,
  },
  {
    username: "student26",
    fullName: "رادین کمالی",
    gradeKey: GRADE_KEYS.NINTH,
    interests: "برنامه‌نویسی وب، بازی‌سازی ساده",
    skills: "یادگیری سریع فناوری",
    academicStatus: "علوم رایانه قوی.",
    overallNote: "زمان صفحه نمایش را مدیریت کند.",
    mentorIndex: 1,
    assistantIndex: 2,
  },
  {
    username: "student27",
    fullName: "سینا باقری",
    gradeKey: GRADE_KEYS.NINTH,
    interests: "عکاسی پرتره، ویرایش تصویر",
    skills: "ترکیب‌بندی، نقد سازنده",
    academicStatus: "هنر و ادبیات خوب.",
    overallNote: "پروژه عکاسی محله را تکمیل کند.",
    mentorIndex: 1,
    assistantIndex: 3,
  },
  {
    username: "student28",
    fullName: "آیدین طاهری",
    gradeKey: GRADE_KEYS.TENTH,
    interests: "گلایدر، هوافضا مقدماتی",
    skills: "ساخت دستی، اندازه‌گیری",
    academicStatus: "فیزیک علاقه ویژه دارد.",
    overallNote: "مسابقه گلایدر مدرسه هدف خوبی است.",
    mentorIndex: 2,
    assistantIndex: 4,
  },
  {
    username: "student29",
    fullName: "بنیامین زارعی",
    gradeKey: GRADE_KEYS.ELEVENTH,
    interests: "نویسندگی داستان، نقد ادبی",
    skills: "تخیل، ویرایش متن",
    academicStatus: "ادبیات ممتاز.",
    overallNote: "مجموعه داستان کوتاه را تا پایان ترم آماده کند.",
    mentorIndex: 2,
    assistantIndex: 5,
  },
  {
    username: "student30",
    fullName: "محمدامین جلالی",
    gradeKey: GRADE_KEYS.TWELFTH,
    interests: "معارف، داوطلبی مسجد محله",
    skills: "سخنرانی کوتاه، خدمت گروهی",
    academicStatus: "آماده کنکور انسانی.",
    overallNote: "تعادل کنکور و فعالیت‌های فرهنگی را حفظ کند.",
    mentorIndex: 2,
    assistantIndex: 5,
  },
];

function ensureGroup(gradeKey: string, title: string) {
  const grade = getGradeByKey(gradeKey);
  if (!grade) throw new Error(`grade ${gradeKey} missing`);

  const existing = db
    .select()
    .from(groups)
    .where(and(eq(groups.gradeId, grade.id), eq(groups.title, title)))
    .get();
  if (existing) return existing;

  createGroup({ gradeId: grade.id, title, status: "active" });
  return db
    .select()
    .from(groups)
    .where(and(eq(groups.gradeId, grade.id), eq(groups.title, title)))
    .get()!;
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

async function seedStaff() {
  const mentors = [
    await ensureUser({
      username: "mentor1",
      fullName: "استاد رضایی",
      roleKey: ROLE_KEYS.MENTOR,
      password: "Mentor@1234",
      avatarPath: "/avatars/mentor-rezaei.svg",
    }),
    await ensureUser({
      username: "mentor2",
      fullName: "استاد کریمی",
      roleKey: ROLE_KEYS.MENTOR,
      password: "Mentor@1234",
      avatarPath: "/avatars/mentor-karimi.svg",
    }),
    await ensureUser({
      username: "mentor3",
      fullName: "استاد حسینی",
      roleKey: ROLE_KEYS.MENTOR,
      password: "Mentor@1234",
      avatarPath: "/avatars/mentor-hoseini.svg",
    }),
  ];

  const assistants = [
    await ensureUser({
      username: "assistant1",
      fullName: "پشتیبان احمدی",
      roleKey: ROLE_KEYS.ASSISTANT_MENTOR,
      password: "Assist@1234",
      avatarPath: "/avatars/assistant-ahmadi.svg",
    }),
    await ensureUser({
      username: "assistant2",
      fullName: "پشتیبان نوری",
      roleKey: ROLE_KEYS.ASSISTANT_MENTOR,
      password: "Assist@1234",
      avatarPath: "/avatars/assistant-nouri.svg",
    }),
    await ensureUser({
      username: "assistant3",
      fullName: "پشتیبان موسوی",
      roleKey: ROLE_KEYS.ASSISTANT_MENTOR,
      password: "Assist@1234",
      avatarPath: "/avatars/assistant-mousavi.svg",
    }),
    await ensureUser({
      username: "assistant4",
      fullName: "پشتیبان جعفری",
      roleKey: ROLE_KEYS.ASSISTANT_MENTOR,
      password: "Assist@1234",
      avatarPath: "/avatars/assistant-jafari.svg",
    }),
    await ensureUser({
      username: "assistant5",
      fullName: "پشتیبان صادقی",
      roleKey: ROLE_KEYS.ASSISTANT_MENTOR,
      password: "Assist@1234",
      avatarPath: "/avatars/assistant-sadeghi.svg",
    }),
    await ensureUser({
      username: "assistant6",
      fullName: "پشتیبان اکبری",
      roleKey: ROLE_KEYS.ASSISTANT_MENTOR,
      password: "Assist@1234",
      avatarPath: "/avatars/assistant-akbari.svg",
    }),
  ];

  return { mentors, assistants };
}

async function seedStudentRecords(
  mentors: { id: string }[],
  assistants: { id: string }[],
) {
  seedGrades();

  const groupsByGrade = new Map<string, string[]>();
  for (const group of GROUP_SEED) {
    const created = ensureGroup(group.gradeKey, group.title);
    const list = groupsByGrade.get(group.gradeKey) ?? [];
    list.push(created.id);
    groupsByGrade.set(group.gradeKey, list);
  }

  for (const entry of STUDENT_ROSTER) {
    const user = await ensureUser({
      username: entry.username,
      fullName: entry.fullName,
      roleKey: ROLE_KEYS.STUDENT,
      password: "Student@1234",
    });

    const existingStudent = db
      .select()
      .from(students)
      .where(eq(students.userId, user.id))
      .get();
    if (existingStudent) continue;

    const grade = getGradeByKey(entry.gradeKey);
    if (!grade) continue;

    const gradeGroups = groupsByGrade.get(entry.gradeKey) ?? [];
    const groupId = gradeGroups[0] ?? "";

    const student = createStudent({
      userId: user.id,
      gradeId: grade.id,
      groupId,
      status: STUDENT_STATUS.ACTIVE,
      mentorUserId: mentors[entry.mentorIndex]?.id,
      assistantUserId: assistants[entry.assistantIndex]?.id,
    });

    if (student) {
      upsertGrowthProfile({
        studentId: student.id,
        interests: entry.interests,
        skills: entry.skills,
        academicStatus: entry.academicStatus,
        overallNote: entry.overallNote,
        ...(entry.username === "student1"
          ? {
              birthDate: "2011-05-12",
              nationalId: "0012345678",
              address: "تهران، نظام‌آباد، خیابان مدنی",
              phone: "09121234567",
              fatherName: "حسن محمدی",
              fatherJob: "کارمند اداری",
              fatherBirthDate: "1978-03-21",
              motherJob: "خانه‌دار",
              fatherAlive: "true" as const,
              motherAlive: "true" as const,
              parentsLiveTogether: "true" as const,
              siblingsJson: JSON.stringify([
                { relation: "brother", relative: "older", ageDiffYears: 3 },
                { relation: "sister", relative: "younger", ageDiffYears: 2 },
              ]),
            }
          : {}),
      });
    }
  }
}

function seedLearningCatalog(mentorUserId: string) {
  const grade8 = getGradeByKey(GRADE_KEYS.EIGHTH);
  const grade9 = getGradeByKey(GRADE_KEYS.NINTH);
  const grade10 = getGradeByKey(GRADE_KEYS.TENTH);
  if (!grade8 || !grade9 || !grade10) return;

  const pathDefs = [
    {
      title: "مسیر اخلاق و خودسازی",
      description: "تقویت اخلاق اسلامی، نظم شخصی و مسئولیت در جمع ایمانی",
      gradeId: grade8.id,
      objective: "برنامه هفتگی نماز، دعا و یک کار خیر کوچک",
    },
    {
      title: "مسیر انس با قرآن و دعا",
      description: "تلاوت کوتاه روزانه، فهم ساده آیات و انس با صحیفه سجادیه",
      gradeId: grade9.id,
      objective: "تلاوت روزانه با خلاصه یک نکته اخلاقی",
    },
    {
      title: "مسیر سیره و ولایت اهل‌بیت",
      description: "آشنایی با سیره پیامبر و اهل‌بیت و آمادگی مناسبت‌های شیعی",
      gradeId: grade10.id,
      objective: "نوشتن یک درس عملی از سیره اهل‌بیت",
    },
  ];

  for (const def of pathDefs) {
    let path = db.select().from(growthPaths).where(eq(growthPaths.title, def.title)).get();
    if (!path) {
      path = createGrowthPath({
        title: def.title,
        description: def.description,
        gradeId: def.gradeId,
        status: GROWTH_PATH_STATUS.ACTIVE,
        ordering: 1,
      });
      createPathObjective({ pathId: path.id, title: def.objective, ordering: 1 });
    }
  }

  const courseDefs = [
    {
      title: "آشنایی با نماز",
      description: "آموزش گام‌به‌گام اهمیت، آداب و حضور قلب در نماز برای نوجوان",
      lesson: "چرا نماز ستون دین است؟",
      body: "یک موقعیت واقعی بنویس که نماز به تو کمک کرد آرام‌تر و منظم‌تر باشی.",
      coverPath: "/covers/course-namaz.svg",
    },
    {
      title: "سیره پیامبر و اهل‌بیت",
      description: "داستان‌های کوتاه و آموزنده از زندگی پیامبر اکرم و اهل‌بیت علیهم‌السلام",
      lesson: "مهربانی پیامبر با نوجوانان",
      body: "یک رفتار از سیره اهل‌بیت را انتخاب کن و بگو امروز چگونه می‌توانی آن را تمرین کنی.",
      coverPath: "/covers/course-seerah.svg",
    },
    {
      title: "آمادگی محرم",
      description: "آشنایی نرم با پیام عاشورا، عزاداری آگاهانه و اخلاق حسینی",
      lesson: "پیام آزادگی در کربلا",
      body: "سه ویژگی از امام حسین علیه‌السلام بنویس که می‌خواهی در رفتار روزمره‌ات نزدیک‌تر شوی.",
      coverPath: "/covers/course-muharram.svg",
    },
  ];

  for (const def of courseDefs) {
    let course = db.select().from(courses).where(eq(courses.title, def.title)).get();
    if (!course) {
      course = createCourse({
        title: def.title,
        description: def.description,
        coverPath: def.coverPath,
        status: COURSE_STATUS.PUBLISHED,
        ordering: 1,
      });
      const lesson = createLesson({
        courseId: course.id,
        title: def.lesson,
        ordering: 1,
        contentType: "TEXT",
      });
      upsertLessonContent({ lessonId: lesson.id, body: def.body });
    } else if (!course.coverPath || course.coverPath === "/covers/course-default.svg") {
      db.update(courses)
        .set({ coverPath: def.coverPath })
        .where(eq(courses.id, course.id))
        .run();
    }
  }

  const bookDefs = [
    {
      title: "داستان‌های اهل‌بیت",
      author: "مجموعه تربیتی صفا نور",
      description: "داستان‌های کوتاه و سن‌مناسب از زندگی اهل‌بیت علیهم‌السلام برای نوجوان",
      difficulty: BOOK_DIFFICULTY.BEGINNER,
      minutes: 240,
      coverPath: "/covers/book-ahlulbayt.svg",
      chapters: ["مهربانی امام مجتبی", "صبر و ایستادگی زینب کبری"],
    },
    {
      title: "گزیده نهج‌البلاغه برای نوجوان",
      author: "بر اساس نهج‌البلاغه امیرالمؤمنین",
      description: "گزیده‌ای ساده از حکمت‌ها و نامه‌های نهج‌البلاغه با توضیح کوتاه اخلاقی",
      difficulty: BOOK_DIFFICULTY.INTERMEDIATE,
      minutes: 300,
      coverPath: "/covers/book-nahj.svg",
      chapters: ["حکمت‌های کوتاه", "نامه‌ای درباره تقوا"],
    },
    {
      title: "اخلاق اسلامی",
      author: "مجموعه تربیتی صفا نور",
      description: "آشنایی با راستگویی، ادب، امانت و روابط نیکو بر پایه آموزه‌های اسلامی",
      difficulty: BOOK_DIFFICULTY.INTERMEDIATE,
      minutes: 360,
      coverPath: "/covers/book-akhlaq.svg",
      chapters: ["ادب گفتار", "حقوق دوستی در اسلام"],
    },
    {
      title: "اصول دین به زبان ساده",
      author: "مجموعه تربیتی صفا نور",
      description: "تبیین ساده توحید، عدل، نبوت، امامت و معاد برای نوجوان شیعه",
      difficulty: BOOK_DIFFICULTY.BEGINNER,
      minutes: 180,
      coverPath: "/covers/book-osul.svg",
      chapters: ["توحید و عدل", "نبوت و امامت"],
    },
    {
      title: "مفاتیح‌الجنان",
      author: "شیخ عباس قمی",
      description: "گزیده دعاها و زیارات مناسب نوجوان برای انس روزانه با دعا",
      difficulty: BOOK_DIFFICULTY.BEGINNER,
      minutes: 420,
      coverPath: "/covers/book-mafatih.svg",
      chapters: ["دعاهای روزانه", "زیارت کوتاه عاشورا"],
    },
  ];

  for (const def of bookDefs) {
    let book = db.select().from(books).where(eq(books.title, def.title)).get();
    if (!book) {
      book = createBook({
        title: def.title,
        author: def.author,
        description: def.description,
        coverPath: def.coverPath,
        difficulty: def.difficulty,
        estimatedMinutes: def.minutes,
      });
    } else if (!book.coverPath) {
      db.update(books)
        .set({ coverPath: def.coverPath })
        .where(eq(books.id, book.id))
        .run();
      book = db.select().from(books).where(eq(books.id, book.id)).get()!;
    }

    if (book && listBookChapters(book.id).length === 0) {
      def.chapters.forEach((title, i) => {
        createBookChapter({ bookId: book!.id, title, ordering: i + 1 });
      });
    }
  }

  void mentorUserId;
}

function seedRedesignExtras(mentorUserId: string) {
  const admin = db.select().from(users).where(eq(users.username, "admin")).get();
  const authorId = admin?.id ?? mentorUserId;

  const annCount = db.select().from(announcements).all().length;
  if (annCount === 0) {
    createAnnouncement({
      title: "شروع ترم جدید صفا نور",
      body: "سلام دوستان! ترم جدید با برنامه‌های معارفی، انس با نماز و مطالعه اهل‌بیت از هفته آینده آغاز می‌شود. کلاس‌ها و کتابخانه را در سامانه دنبال کنید.",
      authorUserId: authorId,
      audience: ANNOUNCEMENT_AUDIENCE.ALL_STUDENTS,
      status: ANNOUNCEMENT_STATUS.PUBLISHED,
    });
    createAnnouncement({
      title: "یادآوری انس هفتگی با دعا و مطالعه",
      body: "هر روز حداقل یک صفحه از کتاب معارفی یا چند دقیقه دعا بخوانید و پیشرفت را در کتابخانه ثبت کنید. آمادگی معنوی محرم را از همین هفته شروع کنید.",
      authorUserId: authorId,
      audience: ANNOUNCEMENT_AUDIENCE.ALL_STUDENTS,
      status: ANNOUNCEMENT_STATUS.PUBLISHED,
    });
  }

  let mediaCourse = db
    .select()
    .from(courses)
    .where(eq(courses.title, "یادگیری چندرسانه‌ای معارف"))
    .get();

  const mediaCoverPath = "/covers/course-media.svg";

  if (!mediaCourse) {
    const created = createCourse({
      title: "یادگیری چندرسانه‌ای معارف",
      description: "آشنایی با صوت، PDF و ویدیو در مسیر یادگیری معارف و سیره",
      coverPath: mediaCoverPath,
      status: COURSE_STATUS.PUBLISHED,
      ordering: 10,
    });
    mediaCourse = db.select().from(courses).where(eq(courses.id, created.id)).get()!;
    const chapter = createChapter({
      courseId: mediaCourse.id,
      title: "فصل اول: انواع محتوای معارفی",
      ordering: 1,
    });

    const aparatLesson = createLesson({
      courseId: mediaCourse.id,
      chapterId: chapter.id,
      title: "ویدیو کوتاه درباره آداب نماز",
      ordering: 1,
      contentType: LESSON_CONTENT_TYPE.APARAT,
    });
    upsertLessonContent({
      lessonId: aparatLesson.id,
      url: "https://www.aparat.com/v/s4x35n5",
      body: "نمونه ویدیوی آموزشی معارفی",
    });

    const pdfLesson = createLesson({
      courseId: mediaCourse.id,
      chapterId: chapter.id,
      title: "جزوه PDF اخلاق حسینی",
      ordering: 2,
      contentType: LESSON_CONTENT_TYPE.PDF,
    });
    upsertLessonContent({
      lessonId: pdfLesson.id,
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      body: "نمونه جزوه PDF معارفی",
    });

    const audioLesson = createLesson({
      courseId: mediaCourse.id,
      chapterId: chapter.id,
      title: "پادکست کوتاه سیره اهل‌بیت",
      ordering: 3,
      contentType: LESSON_CONTENT_TYPE.AUDIO,
    });
    upsertLessonContent({
      lessonId: audioLesson.id,
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      body: "نمونه فایل صوتی معارفی",
    });
  } else if (!mediaCourse.coverPath || mediaCourse.coverPath === "/covers/course-default.svg") {
    db.update(courses)
      .set({ coverPath: mediaCoverPath })
      .where(eq(courses.id, mediaCourse.id))
      .run();
  }

  // Backfill missing covers for any leftover sample courses
  for (const row of db.select({ id: courses.id, coverPath: courses.coverPath }).from(courses).all()) {
    if (!row.coverPath) {
      db.update(courses)
        .set({ coverPath: "/covers/course-default.svg" })
        .where(eq(courses.id, row.id))
        .run();
    }
  }

  /** آزمون‌های چندگزینه‌ای کتابخانه — بانک سوال + قرعه‌کشی تصادفی در هر تلاش */
  const bookExamBank: Array<{
    bookTitle: string;
    chapterTitle: string;
    examTitle: string;
    questions: Array<{
      prompt: string;
      options: Array<{ key: string; text: string }>;
      correctOptionKey: string;
    }>;
  }> = [
    {
      bookTitle: "مفاتیح‌الجنان",
      chapterTitle: "دعاهای روزانه",
      examTitle: "آزمون دعاهای روزانه",
      questions: [
        {
          prompt: "بهترین زمان برای خواندن دعای عهد چیست؟",
          options: [
            { key: "A", text: "صبح‌ها پس از نماز صبح" },
            { key: "B", text: "فقط شب‌های جمعه" },
            { key: "C", text: "تنها در ماه رمضان" },
            { key: "D", text: "فقط در سفر" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "هدف اصلی انس روزانه با دعا چیست؟",
          options: [
            { key: "A", text: "نزدیکی دل به خداوند و آرامش معنوی" },
            { key: "B", text: "فقط حفظ کردن متن طولانی" },
            { key: "C", text: "رقابت با دوستان" },
            { key: "D", text: "جایگزینی کامل نماز واجب" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "کدام رفتار با آداب دعا سازگارتر است؟",
          options: [
            { key: "A", text: "حضور قلب و ادب در برابر خداوند" },
            { key: "B", text: "عجله و بی‌توجهی به معنا" },
            { key: "C", text: "خواندن دعا فقط برای خودنمایی" },
            { key: "D", text: "ترک دعا هنگام شادی" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "انس با دعاهای کوتاه روزانه بیشتر به چه کمکی می‌کند؟",
          options: [
            { key: "A", text: "تقویت یاد خدا در طول روز" },
            { key: "B", text: "جایگزینی کامل مطالعه درسی" },
            { key: "C", text: "بی‌نیازی از مشورت با بزرگ‌ترها" },
            { key: "D", text: "حذف کامل برنامه خواب منظم" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "اگر معنایی از دعا را نفهمیدیم، کار درست‌تر چیست؟",
          options: [
            { key: "A", text: "پرسیدن و تلاش برای فهم معنا" },
            { key: "B", text: "رها کردن کامل دعا" },
            { key: "C", text: "تمسخر متن دعا" },
            { key: "D", text: "تغییر خودسرانه کلمات مقدس" },
          ],
          correctOptionKey: "A",
        },
      ],
    },
    {
      bookTitle: "مفاتیح‌الجنان",
      chapterTitle: "زیارت کوتاه عاشورا",
      examTitle: "آزمون زیارت عاشورا",
      questions: [
        {
          prompt: "زیارت عاشورا بیشتر ما را به چه موضوعی دعوت می‌کند؟",
          options: [
            { key: "A", text: "محبت اهل‌بیت و بیزاری از ظلم" },
            { key: "B", text: "فراموشی تاریخ اسلام" },
            { key: "C", text: "تنها خواندن شعر" },
            { key: "D", text: "ترک ارتباط با جامعه" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "پیام اخلاقی برجسته قیام امام حسین(ع) چیست؟",
          options: [
            { key: "A", text: "ایستادگی در برابر ستم و حفظ کرامت انسانی" },
            { key: "B", text: "برتری‌جویی قومی" },
            { key: "C", text: "ترک کمک به نیازمندان" },
            { key: "D", text: "بی‌تفاوتی نسبت به حق و باطل" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "خواندن زیارت عاشورا بهتر است با چه نیتی همراه باشد؟",
          options: [
            { key: "A", text: "تجديد عهد با حق و دوری از ظلم" },
            { key: "B", text: "فقط تکمیل یک عادت ظاهری" },
            { key: "C", text: "رقابت در تعداد صفحات" },
            { key: "D", text: "جایگزینی کامل نمازهای واجب" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "کدام رفتار با روح زیارت عاشورا ناسازگار است؟",
          options: [
            { key: "A", text: "همراهی با ظلم یا بی‌تفاوتی نسبت به آن" },
            { key: "B", text: "همدردی با مظلوم" },
            { key: "C", text: "محبت به اهل‌بیت" },
            { key: "D", text: "طلب آمرزش و اصلاح خود" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "انس کوتاه اما پیوسته با زیارت عاشورا چه اثری دارد؟",
          options: [
            { key: "A", text: "زنده نگه داشتن یاد عاشورا در زندگی روزمره" },
            { key: "B", text: "جایگزینی کامل مسئولیت‌های خانوادگی" },
            { key: "C", text: "بی‌نیازی از یادگیری تاریخ" },
            { key: "D", text: "ترک دوستی‌های سالم" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "پس از خواندن زیارت، کدام اقدام عملی مناسب‌تر است؟",
          options: [
            { key: "A", text: "تلاش برای رفتار عادلانه‌تر و مهربان‌تر" },
            { key: "B", text: "تمسخر دیگران به بهانه دینداری" },
            { key: "C", text: "فراموش کردن کامل محتوا" },
            { key: "D", text: "قطع ارتباط با خانواده" },
          ],
          correctOptionKey: "A",
        },
      ],
    },
    {
      bookTitle: "داستان‌های اهل‌بیت",
      chapterTitle: "مهربانی امام مجتبی",
      examTitle: "آزمون مهربانی امام مجتبی",
      questions: [
        {
          prompt: "پیام اصلی داستان مهربانی امام مجتبی چیست؟",
          options: [
            { key: "A", text: "مهربانی و بخشش حتی با مخالف" },
            { key: "B", text: "یادگیری ریاضی" },
            { key: "C", text: "سفر تفریحی به شهرهای دور" },
            { key: "D", text: "ساخت ابزارهای فلزی" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "کدام رفتار به سیره امام مجتبی نزدیک‌تر است؟",
          options: [
            { key: "A", text: "پاسخ نرم و بخشش در برابر تندی" },
            { key: "B", text: "توهین متقابل" },
            { key: "C", text: "بی‌توجهی کامل به نیازمندان" },
            { key: "D", text: "قطع رابطه با همه اطرافیان" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "مهربانی در داستان‌های اهل‌بیت بیشتر چه چیزی را آموزش می‌دهد؟",
          options: [
            { key: "A", text: "کرامت انسان و اخلاق نیکو" },
            { key: "B", text: "رقابت برای قدرت" },
            { key: "C", text: "نادیده گرفتن حق دیگران" },
            { key: "D", text: "ترک مسئولیت‌پذیری" },
          ],
          correctOptionKey: "A",
        },
      ],
    },
    {
      bookTitle: "اخلاق اسلامی",
      chapterTitle: "ادب گفتار",
      examTitle: "آزمون ادب گفتار",
      questions: [
        {
          prompt: "کدام رفتار با ادب گفتار اسلامی سازگارتر است؟",
          options: [
            { key: "A", text: "سخن راست، نرم و بدون توهین" },
            { key: "B", text: "تحقیر دیگران برای خنده" },
            { key: "C", text: "دروغ مصلحتی همیشگی" },
            { key: "D", text: "بلند حرف زدن در هر مکان" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "اگر از کسی ناراحت شدیم، ادب گفتار چه پیشنهادی دارد؟",
          options: [
            { key: "A", text: "آرام حرف زدن و پرهیز از دشنام" },
            { key: "B", text: "پخش شایعه درباره او" },
            { key: "C", text: "تحقیر علنی" },
            { key: "D", text: "قطع کامل گفت‌وگوی سازنده" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "کدام مورد نمونه‌ای از بی‌ادبی در گفتار است؟",
          options: [
            { key: "A", text: "مسخره کردن لهجه یا ظاهر دیگران" },
            { key: "B", text: "تشکر از کمک دیگران" },
            { key: "C", text: "عذرخواهی پس از اشتباه" },
            { key: "D", text: "گوش دادن فعال" },
          ],
          correctOptionKey: "A",
        },
      ],
    },
    {
      bookTitle: "اصول دین به زبان ساده",
      chapterTitle: "توحید و عدل",
      examTitle: "آزمون توحید و عدل",
      questions: [
        {
          prompt: "توحید به زبان ساده یعنی چه؟",
          options: [
            { key: "A", text: "یگانه دانستن خداوند در آفرینش و پرستش" },
            { key: "B", text: "پرستش چند خدا" },
            { key: "C", text: "فقط احترام به طبیعت" },
            { key: "D", text: "بی‌نیازی از عبادت" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "عدل الهی بیشتر به چه معناست؟",
          options: [
            { key: "A", text: "خداوند به کسی ستم نمی‌کند و حق هر کس را می‌دهد" },
            { key: "B", text: "همه کارها بی‌نتیجه‌اند" },
            { key: "C", text: "نیکی و بدی یکسان‌اند" },
            { key: "D", text: "مسئولیت انسان بی‌معناست" },
          ],
          correctOptionKey: "A",
        },
        {
          prompt: "باور به توحید در رفتار روزمره چه اثری دارد؟",
          options: [
            { key: "A", text: "اتکا به خدا و دوری از شرک عملی" },
            { key: "B", text: "ترک تلاش و مسئولیت" },
            { key: "C", text: "بی‌احترامی به دیگران" },
            { key: "D", text: "انکار نعمت‌ها" },
          ],
          correctOptionKey: "A",
        },
      ],
    },
  ];

  for (const entry of bookExamBank) {
    const book = db.select().from(books).where(eq(books.title, entry.bookTitle)).get();
    if (!book) continue;
    const chapter = listBookChapters(book.id).find((c) => c.title === entry.chapterTitle);
    if (!chapter) continue;

    const chapterExams = listExamsForRelated(EXAM_RELATED_TYPE.BOOK_CHAPTER, chapter.id);
    let quiz = chapterExams.find((e) => e.title === entry.examTitle) ?? chapterExams[0];

    const firstQ = entry.questions[0]!;
    if (!quiz) {
      quiz = createExam({
        relatedType: EXAM_RELATED_TYPE.BOOK_CHAPTER,
        relatedId: chapter.id,
        title: entry.examTitle,
        createdBy: authorId,
        ...firstQ,
      });
    } else {
      if (quiz.title !== entry.examTitle) {
        updateExamMcq(quiz.id, { title: entry.examTitle, ...firstQ });
      } else if (quiz.options.length === 0 || !quiz.correctOptionKey) {
        updateExamMcq(quiz.id, firstQ);
      }
    }

    for (const q of entry.questions) {
      ensureExamBankQuestion(quiz.id, q);
    }

    // consolidate leftover single-question exams into the chapter quiz bank
    for (const extra of chapterExams) {
      if (extra.id === quiz.id) continue;
      if (extra.options.length >= 2 && extra.correctOptionKey) {
        ensureExamBankQuestion(quiz.id, {
          prompt: extra.prompt,
          options: extra.options,
          correctOptionKey: extra.correctOptionKey,
        });
      }
      try {
        deleteExam(extra.id);
      } catch {
        /* ignore if already removed */
      }
    }
  }

  // یک نمونهٔ ازپیش‌تصحیح‌شده فقط روی کتاب داستان‌ها تا UI نتیجه دیده شود؛
  // آزمون‌های مفاتیح عمداً بدون پاسخ دانش‌آموز می‌مانند تا جریان زمان‌دار را تست کنید.
  const demoBook = db.select().from(books).where(eq(books.title, "داستان‌های اهل‌بیت")).get();
  const demoChapter = demoBook
    ? listBookChapters(demoBook.id).find((c) => c.title === "مهربانی امام مجتبی")
    : undefined;
  const demoExam = demoChapter
    ? listExamsForRelated(EXAM_RELATED_TYPE.BOOK_CHAPTER, demoChapter.id)[0]
    : undefined;
  const firstStudent = db.select().from(students).all()[0];
  if (firstStudent && demoExam) {
    try {
      submitExamAnswer({
        examId: demoExam.id,
        studentId: firstStudent.id,
        selectedOption: "A",
      });
    } catch {
      /* already submitted */
    }
  }
}

function seedPlansForStudents(mentorUserId: string) {
  const categories = seedGoalCategories();
  const categoryId = categories[0]?.id;
  if (!categoryId) return;

  const path = db
    .select()
    .from(growthPaths)
    .where(eq(growthPaths.title, "مسیر اخلاق و خودسازی"))
    .get();

  const libraryBookTitles = [
    "داستان‌های اهل‌بیت",
    "گزیده نهج‌البلاغه برای نوجوان",
    "اخلاق اسلامی",
    "اصول دین به زبان ساده",
    "مفاتیح‌الجنان",
  ] as const;
  const libraryBooks = libraryBookTitles
    .map((title) => db.select().from(books).where(eq(books.title, title)).get())
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  /** Demo progress per book for student1 (and offset by student index for variety). */
  const bookProgressBase = [10, 25, 50, 75, 100] as const;

  const allStudents = db.select().from(students).all();
  for (const [index, student] of allStudents.entries()) {
    if (!student.userId) continue;

    if (path && index < 12) {
      try {
        setActiveEnrollment(student.id, path.id);
      } catch {
        /* already enrolled */
      }
    }

    if (index < 10) {
      for (const [bookIndex, book] of libraryBooks.entries()) {
        const existingPlan = db
          .select()
          .from(readingPlans)
          .where(and(eq(readingPlans.studentId, student.id), eq(readingPlans.bookId, book.id)))
          .get();
        if (existingPlan) continue;

        const base = bookProgressBase[bookIndex] ?? 20;
        const progress =
          bookIndex === 0
            ? 10 + (index % 5) * 10
            : Math.min(100, base + (index % 3) * 5);
        try {
          createReadingPlan({
            studentId: student.id,
            bookId: book.id,
            startDate: nowIso(),
            deadline: daysFromNow(30 + bookIndex * 7),
            status:
              progress >= 100
                ? READING_PLAN_STATUS.COMPLETED
                : READING_PLAN_STATUS.IN_PROGRESS,
            progress,
            mentorNote: "هر هفته یک فصل معارفی و یک نکته اخلاقی کوتاه",
          });
        } catch {
          /* exists */
        }
      }
    }

    const goalTitle = index % 2 === 0 ? "تقویت انس با نماز" : "تقویت مطالعه معارفی روزانه";
    let goal = db
      .select()
      .from(goals)
      .where(and(eq(goals.studentId, student.id), eq(goals.title, goalTitle)))
      .get();
    if (!goal) {
      goal = createGoal({
        studentId: student.id,
        title: goalTitle,
        description: "هدف رشد ایمانی و اخلاقی متناسب با پرونده",
        categoryId,
        priority: index % 3 === 0 ? PRIORITY.HIGH : PRIORITY.MEDIUM,
        startDate: nowIso(),
        targetDate: daysFromNow(60),
        status: GOAL_STATUS.ACTIVE,
        mentorNote: "مرور هفتگی با مربی درباره عمل و مطالعه",
        createdBy: mentorUserId,
      })!;
    }

    const planTitle = "برنامه رشد پاییز";
    let plan = db
      .select()
      .from(individualPlans)
      .where(and(eq(individualPlans.studentId, student.id), eq(individualPlans.title, planTitle)))
      .get();
    if (!plan) {
      plan = createIndividualPlan({
        studentId: student.id,
        title: planTitle,
        description: "تمرکز بر نماز، مطالعه معارفی و مشارکت در جمع ایمانی",
        status: PLAN_STATUS.ACTIVE,
        createdBy: mentorUserId,
      })!;
    }

    const actionSeeds: {
      title: string;
      status: (typeof ACTION_STATUS)[keyof typeof ACTION_STATUS];
      start: string;
      deadline: string;
      result?: string;
    }[] = [
      {
        title: "ثبت گزارش نماز و دعا هفتگی",
        status: ACTION_STATUS.TODO,
        start: daysAgo(3),
        deadline: daysFromNow(4),
      },
      {
        title: "مطالعه یک فصل کتاب معارفی",
        status: ACTION_STATUS.IN_PROGRESS,
        start: daysAgo(5),
        deadline: daysFromNow(2),
      },
      {
        title: "ارسال خلاصه جلسه هیئت یا گروه",
        status: ACTION_STATUS.TODO,
        start: daysAgo(14),
        deadline: daysAgo(2),
      },
      {
        title: "سه جلسه حضور در نماز جماعت",
        status: ACTION_STATUS.DONE,
        start: daysAgo(20),
        deadline: daysAgo(10),
        result: "سه جلسه نماز جماعت با حضور قلب نسبی انجام شد.",
      },
    ];

    for (const seed of actionSeeds) {
      if (
        db
          .select()
          .from(actions)
          .where(and(eq(actions.studentId, student.id), eq(actions.title, seed.title)))
          .get()
      ) {
        continue;
      }
      const created = createAction({
        studentId: student.id,
        planId: plan.id,
        goalId: goal.id,
        title: seed.title,
        description: "اقدام نمونه برای پیگیری تربیتی",
        type: ACTION_TYPE.TASK,
        assigneeUserId: student.userId,
        startDate: seed.start,
        deadline: seed.deadline,
        status: seed.status === ACTION_STATUS.DONE ? ACTION_STATUS.TODO : seed.status,
        priority: PRIORITY.HIGH,
        createdBy: mentorUserId,
      });
      if (created && seed.status === ACTION_STATUS.DONE) {
        transitionAction({
          id: created.id,
          status: ACTION_STATUS.DONE,
          result: seed.result ?? "انجام شد.",
        });
      }
    }
  }
}

function seedMentoringSupport(mentors: { id: string }[], assistants: { id: string }[]) {
  const allStudents = db.select().from(students).all().slice(0, 12);

  for (const [index, student] of allStudents.entries()) {
    if (!student.userId) continue;
    const assistant = assistants[index % assistants.length]!;
    const mentor = mentors[index % mentors.length]!;

    if (
      !db
        .select()
        .from(chatConversations)
        .where(
          and(
            eq(chatConversations.studentUserId, student.userId),
            eq(chatConversations.staffUserId, assistant.id),
            eq(chatConversations.status, CHAT_CONVERSATION_STATUS.ACTIVE),
          ),
        )
        .get()
    ) {
      const conv = getOrCreateActiveConversation(student.userId, assistant.id);
      if (!db.select().from(chatMessages).where(eq(chatMessages.conversationId, conv.id)).get()) {
        sendMessage(conv.id, student.userId, "سلام، امروز در برنامه نماز و مطالعه‌ام کمی عقب افتادم.");
        sendMessage(
          conv.id,
          assistant.id,
          "سلام. سه کار کوتاه بنویس: نماز، یک صفحه مطالعه معارفی، و یک کار خیر کوچک؛ تا فردا گزارش بده.",
        );
        sendMessage(conv.id, student.userId, "حتماً، امشب لیست را می‌فرستم ان‌شاءالله.");
      }
    }

    if (
      !db
        .select()
        .from(mentoringSessions)
        .where(and(eq(mentoringSessions.studentId, student.id), eq(mentoringSessions.type, "حضوری")))
        .get()
    ) {
      createSession({
        studentId: student.id,
        staffUserId: assistant.id,
        date: daysAgo(index % 7),
        type: "حضوری",
        durationMinutes: 40,
        topics: "انس با نماز، مطالعه معارفی، گزارش هفتگی",
        summary: "دانش‌آموز انگیزه دارد ولی در پیگیری روزانه عبادت و مطالعه نیاز به یادآوری دارد.",
        rawNotes: "درباره اولویت نماز اول وقت، تلاوت کوتاه و یک نکته اخلاقی از اهل‌بیت صحبت شد.",
        observations: "حضور فعال و پاسخ‌گو",
        followUpDate: daysFromNow(7).slice(0, 10),
        referralRequired: index % 4 === 0,
        confidentiality: SESSION_CONFIDENTIALITY.NORMAL,
      });
    }

    const noteContent = `یادداشت پیگیری شماره ${index + 1}: پیشرفت در نظم عبادی و مطالعه معارفی مشاهده شد.`;
    if (
      !db
        .select()
        .from(mentorNotes)
        .where(and(eq(mentorNotes.studentId, student.id), eq(mentorNotes.content, noteContent)))
        .get()
    ) {
      createNote({
        authorUserId: index % 2 === 0 ? assistant.id : mentor.id,
        studentId: student.id,
        content: noteContent,
        visibility:
          index % 3 === 0
            ? NOTE_VISIBILITY.MENTOR_ONLY
            : index % 3 === 1
              ? NOTE_VISIBILITY.PRIVATE_STAFF
              : NOTE_VISIBILITY.STUDENT_VISIBLE,
        tags: "پیگیری",
      });
    }

    const openSubject = "نیاز به هماهنگی برنامه معارفی";
    if (
      !db
        .select()
        .from(referrals)
        .where(and(eq(referrals.studentId, student.id), eq(referrals.subject, openSubject)))
        .get()
    ) {
      createReferral({
        studentId: student.id,
        createdBy: assistant.id,
        assignedTo: mentor.id,
        subject: openSubject,
        description: "برنامه مطالعه معارفی با مسیر اخلاق و خودسازی هم‌راستا نیست.",
        priority: PRIORITY.MEDIUM,
        status: REFERRAL_STATUS.OPEN,
      });
    }

    if (index % 3 === 0) {
      const resolvedSubject = "پیگیری اضطراب آزمون";
      if (
        !db
          .select()
          .from(referrals)
          .where(and(eq(referrals.studentId, student.id), eq(referrals.subject, resolvedSubject)))
          .get()
      ) {
        const resolved = createReferral({
          studentId: student.id,
          createdBy: assistant.id,
          assignedTo: mentor.id,
          subject: resolvedSubject,
          description: "قبل از آزمون ماهانه بی‌خوابی گزارش شده است.",
          priority: PRIORITY.HIGH,
          status: REFERRAL_STATUS.OPEN,
        });
        updateReferralStatus(
          {
            id: resolved.id,
            status: REFERRAL_STATUS.RESOLVED,
            response: "جلسه آرام‌سازی برگزار و برنامه خواب اصلاح شد.",
          },
          mentor.id,
          ROLE_KEYS.MENTOR,
        );
      }
    }
  }
}

function seedActivitiesCatalog(mentorUserId: string) {
  const grade8 = getGradeByKey(GRADE_KEYS.EIGHTH);
  const activityDefs = [
    {
      title: "عکاسی از فضای مسجد محله",
      description: "ثبت سه قاب محترمانه از فضای مسجد یا هیئت بدون چهره افراد، با توضیح کوتاه معنوی.",
      type: ACTIVITY_TYPE.PHOTOGRAPHY,
      instructions: "سه قاب از معماری، نور یا فضای جمعی بگیرید؛ احترام به مکان عبادت را رعایت کنید.",
      expectedOutput: "سه عکس + توضیح کوتاه فارسی",
    },
    {
      title: "نوشتن خاطره یک روز معنوی",
      description: "تمرین نوشتن درباره یک روز با نماز، دعا یا خدمت کوچک.",
      type: ACTIVITY_TYPE.WRITING,
      instructions: "حداقل یک صفحه بنویسید.",
      expectedOutput: "متن خاطره (حداقل ۱۵۰ کلمه)",
    },
    {
      title: "سه جلسه تمرین ورزشی هفتگی",
      description: "ثبت حضور در فعالیت بدنی منظم برای سلامتی بدن امانت الهی.",
      type: ACTIVITY_TYPE.SPORTS,
      instructions: "سه جلسه در هفته ورزش کنید و گزارش دهید.",
      expectedOutput: "گزارش سه جلسه",
    },
    {
      title: "خدمت گروهی پاکسازی مسجد",
      description: "همکاری در یک خدمت ساده گروهی برای نگهداشت فضای عبادت.",
      type: ACTIVITY_TYPE.GROUP_PROJECT,
      instructions: "با هماهنگی مربی در یک خدمت کوتاه شرکت کنید و عکس/گزارش مستند بگیرید.",
      expectedOutput: "عکس خدمت + گزارش کوتاه",
    },
    {
      title: "تمرین خوشنویسی آیه کوتاه",
      description: "تمرین خط با سرمشق یک آیه یا ذکر کوتاه.",
      type: ACTIVITY_TYPE.PERSONAL_PRACTICE,
      instructions: "پنج سطر سرمشق را تمرین و عکس بگیرید.",
      expectedOutput: "عکس تمرین",
    },
  ] as const;

  for (const def of activityDefs) {
    if (db.select().from(activities).where(eq(activities.title, def.title)).get()) continue;
    createActivity({
      title: def.title,
      description: def.description,
      type: def.type,
      gradeId: grade8?.id,
      instructions: def.instructions,
      expectedOutput: def.expectedOutput,
      status: ACTIVITY_STATUS.PUBLISHED,
    });
  }

  const photo = db
    .select()
    .from(activities)
    .where(eq(activities.title, "عکاسی از فضای مسجد محله"))
    .get();
  const writing = db
    .select()
    .from(activities)
    .where(eq(activities.title, "نوشتن خاطره یک روز معنوی"))
    .get();
  const firstStudents = db.select().from(students).all().slice(0, 8);

  for (const [index, student] of firstStudents.entries()) {
    if (!student.userId || !photo) continue;
    const existing = db
      .select()
      .from(activityAssignments)
      .where(
        and(eq(activityAssignments.activityId, photo.id), eq(activityAssignments.studentId, student.id)),
      )
      .get();
    if (existing) continue;

    const assigned = assignActivityToStudent({
      activityId: photo.id,
      studentId: student.id,
      dueDate: daysFromNow(14).slice(0, 10),
    })!;

    if (index % 2 === 0) {
      submitActivityProgress(
        {
          assignmentId: assigned.id,
          reportText: "سه عکس از شبستان، محراب و حیاط مسجد گرفتم و حس آرامش آنجا را نوشتم.",
          evidenceUrl: "https://example.com/safanoor-photo-sample",
          evidenceFilePath: "",
          markDone: true,
        },
        student.userId,
      );
      provideMentorFeedback(
        {
          assignmentId: assigned.id,
          feedback: "عکس‌ها محترمانه و ترکیب خوبی دارند؛ در توضیح بعدی به حس معنوی‌ات هم اشاره کن.",
        },
        mentorUserId,
      );
    }

    if (writing && index < 4) {
      const writingAssign = db
        .select()
        .from(activityAssignments)
        .where(
          and(
            eq(activityAssignments.activityId, writing.id),
            eq(activityAssignments.studentId, student.id),
          ),
        )
        .get();
      if (!writingAssign) {
        assignActivityToStudent({
          activityId: writing.id,
          studentId: student.id,
          dueDate: daysFromNow(7).slice(0, 10),
        });
      }
    }
  }
}

async function main() {
  await ensureRolesAndPermissions();
  await ensureUser({
    username: "admin",
    fullName: "مدیر سامانه",
    roleKey: ROLE_KEYS.ADMIN,
    password: "Admin@1234",
    email: "admin@safanoor.local",
  });

  const { mentors, assistants } = await seedStaff();
  await seedStudentRecords(mentors, assistants);
  seedLearningCatalog(mentors[0]!.id);
  seedRedesignExtras(mentors[0]!.id);
  seedPlansForStudents(mentors[0]!.id);
  seedMentoringSupport(mentors, assistants);
  seedActivitiesCatalog(mentors[0]!.id);
  seedKnowledgeItems();

  console.log(
    [
      "Seed completed:",
      "admin / mentor1..3 / assistant1..6 / student1..30",
      "+ groups, paths, courses, books, goals, plans, actions (incl. overdue),",
      "sessions, chat, referrals, activities, knowledge.",
    ].join(" "),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
