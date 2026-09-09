import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { knowledgeItems, type KnowledgeItem } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_ITEM_STATUS,
} from "@/lib/enums";

const statusEnum = z.enum([
  KNOWLEDGE_ITEM_STATUS.DRAFT,
  KNOWLEDGE_ITEM_STATUS.PUBLISHED,
  KNOWLEDGE_ITEM_STATUS.ARCHIVED,
]);

const optionalText = z.string().optional().or(z.literal(""));

export const createKnowledgeItemSchema = z.object({
  title: z.string().min(2, "عنوان حداقل ۲ کاراکتر باشد."),
  category: z.string().min(2, "دسته الزامی است."),
  questionScenario: z.string().min(5, "سناریو/سؤال حداقل ۵ کاراکتر باشد."),
  recommendedApproach: z.string().min(5, "رویکرد پیشنهادی حداقل ۵ کاراکتر باشد."),
  cautions: optionalText,
  tags: optionalText,
  status: statusEnum.optional(),
});

export const updateKnowledgeItemSchema = createKnowledgeItemSchema.extend({
  id: z.string().min(1),
});

export type KnowledgeListFilters = {
  search?: string;
  category?: string;
  status?: string;
  tag?: string;
};

export type KnowledgeListItem = KnowledgeItem;

function normalizeTags(raw?: string | null) {
  if (!raw) return null;
  const parts = raw
    .split(/[,،]/)
    .map((t) => t.trim())
    .filter(Boolean);
  return parts.length ? parts.join("، ") : null;
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, "\\$&");
}

export function listKnowledgeItems(filters: KnowledgeListFilters = {}): KnowledgeListItem[] {
  const conditions = [];

  if (filters.category) {
    conditions.push(eq(knowledgeItems.category, filters.category));
  }
  if (filters.status) {
    conditions.push(eq(knowledgeItems.status, filters.status));
  }
  if (filters.tag) {
    conditions.push(like(knowledgeItems.tags, `%${escapeLike(filters.tag)}%`));
  }
  if (filters.search?.trim()) {
    const q = `%${escapeLike(filters.search.trim())}%`;
    conditions.push(
      or(
        like(knowledgeItems.title, q),
        like(knowledgeItems.category, q),
        like(knowledgeItems.questionScenario, q),
        like(knowledgeItems.recommendedApproach, q),
        like(knowledgeItems.cautions, q),
        like(knowledgeItems.tags, q),
      )!,
    );
  }

  return db
    .select()
    .from(knowledgeItems)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(knowledgeItems.category), desc(knowledgeItems.updatedAt))
    .all();
}

export function getKnowledgeItemById(id: string): KnowledgeListItem | undefined {
  return db.select().from(knowledgeItems).where(eq(knowledgeItems.id, id)).get();
}

export function listKnowledgeCategories(): string[] {
  const rows = db
    .selectDistinct({ category: knowledgeItems.category })
    .from(knowledgeItems)
    .orderBy(asc(knowledgeItems.category))
    .all();
  return rows.map((r) => r.category);
}

export function listKnowledgeTags(): string[] {
  const rows = db
    .select({ tags: knowledgeItems.tags })
    .from(knowledgeItems)
    .where(sql`${knowledgeItems.tags} is not null and ${knowledgeItems.tags} != ''`)
    .all();

  const set = new Set<string>();
  for (const row of rows) {
    for (const tag of (row.tags ?? "").split(/[,،]/)) {
      const trimmed = tag.trim();
      if (trimmed) set.add(trimmed);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "fa"));
}

export function createKnowledgeItem(input: z.infer<typeof createKnowledgeItemSchema>) {
  const id = createId("knw");
  const now = nowIso();
  db.insert(knowledgeItems)
    .values({
      id,
      title: input.title.trim(),
      category: input.category.trim(),
      questionScenario: input.questionScenario.trim(),
      recommendedApproach: input.recommendedApproach.trim(),
      cautions: input.cautions?.trim() || null,
      tags: normalizeTags(input.tags),
      status: input.status ?? KNOWLEDGE_ITEM_STATUS.DRAFT,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return getKnowledgeItemById(id)!;
}

export function updateKnowledgeItem(input: z.infer<typeof updateKnowledgeItemSchema>) {
  const existing = getKnowledgeItemById(input.id);
  if (!existing) throw new Error("آیتم بانک دانش یافت نشد.");

  db.update(knowledgeItems)
    .set({
      title: input.title.trim(),
      category: input.category.trim(),
      questionScenario: input.questionScenario.trim(),
      recommendedApproach: input.recommendedApproach.trim(),
      cautions: input.cautions?.trim() || null,
      tags: normalizeTags(input.tags),
      status: input.status ?? existing.status,
      updatedAt: nowIso(),
    })
    .where(eq(knowledgeItems.id, input.id))
    .run();

  return getKnowledgeItemById(input.id)!;
}

export function deleteKnowledgeItem(id: string) {
  const existing = getKnowledgeItemById(id);
  if (!existing) throw new Error("آیتم بانک دانش یافت نشد.");
  db.delete(knowledgeItems).where(eq(knowledgeItems.id, id)).run();
}

/** سناریوهای فارسی مربی‌گری نوجوان — idempotent بر اساس عنوان. */
export const KNOWLEDGE_SEED: Array<{
  title: string;
  category: string;
  questionScenario: string;
  recommendedApproach: string;
  cautions: string;
  tags: string;
  status: (typeof KNOWLEDGE_ITEM_STATUS)[keyof typeof KNOWLEDGE_ITEM_STATUS];
}> = [
  {
    title: "افت انگیزه بعد از نمره ضعیف",
    category: KNOWLEDGE_CATEGORIES.MOTIVATION,
    questionScenario:
      "دانش‌آموز بعد از یک آزمون ضعیف می‌گوید «دیگه فایده نداره، من درس‌خون نیستم» و از انجام تکالیف طفره می‌رود.",
    recommendedApproach:
      "ابتدا احساسش را بازتاب بده و بپذیر. سپس با او یک هدف کوچک و قابل‌اندازه‌گیری برای هفته بعد تعریف کن (مثلاً مرور ۲۰ دقیقه‌ای دو شب در هفته). موفقیت کوچک را جشن بگیر و از مقایسه با دیگران پرهیز کن.",
    cautions:
      "او را سرزنش نکن و نگو «تنبلی کردی». وعده نتیجه فوری نده. اگر نشانه‌های ناامیدی پایدار دیدی، با مربی ارشد یا خانواده هماهنگ کن.",
    tags: "انگیزه، نمره، خودگویی منفی",
    status: KNOWLEDGE_ITEM_STATUS.PUBLISHED,
  },
  {
    title: "تنش با والدین بر سر گوشی",
    category: KNOWLEDGE_CATEGORIES.FAMILY,
    questionScenario:
      "نوجوان می‌گوید والدینش بی‌دلیل گوشی را محدود کرده‌اند و در خانه دعوا بالا گرفته؛ از مربی می‌خواهد «طرف او» باشد.",
    recommendedApproach:
      "نقش میانجی بی‌طرف بگیر. از او بخواه نیاز پشت درخواست گوشی را بگوید (ارتباط، تفریح، درس). سپس گزینه‌های توافق خانوادگی مثل زمان‌بندی مشترک را تمرین کنید. در صورت امکان جلسه سه‌نفره کوتاه پیشنهاد بده.",
    cautions:
      "علیه والدین موضع نگیر. رازهای حساس خانواده را بدون رضایت بازگو نکن. اگر خشونت خانگی مطرح شد، فوراً ارجاع بده.",
    tags: "خانواده، گوشی، تعارض",
    status: KNOWLEDGE_ITEM_STATUS.PUBLISHED,
  },
  {
    title: "برنامه روزانه شلوغ و نیمه‌کاره",
    category: KNOWLEDGE_CATEGORIES.TIME,
    questionScenario:
      "دانش‌آموز لیست کارهای زیادی دارد اما هیچ‌کدام را کامل نمی‌کند و شب‌ها احساس گناه می‌کند.",
    recommendedApproach:
      "با او فهرست را به سه اولویت واقعی کاهش دهید. تکنیک بلوک زمانی کوتاه (۲۵ دقیقه) و یک «زمان بازیابی» بعدازظهر را تمرین کنید. پایان هر روز فقط دو سؤال مرور: چه چیزی انجام شد؟ فردا چه چیزی اول است؟",
    cautions:
      "برنامه آرمانی و شلوغ ننویس. کمال‌گرایی را تقویت نکن. اگر بیش‌فعالی یا مشکلات جدی تمرکز مشهود است، تشخیص نگذار و ارجاع بده.",
    tags: "زمان، اولویت، برنامه‌ریزی",
    status: KNOWLEDGE_ITEM_STATUS.PUBLISHED,
  },
  {
    title: "اضطراب شب قبل از امتحان",
    category: KNOWLEDGE_CATEGORIES.EXAM_ANXIETY,
    questionScenario:
      "نوجوان شب امتحان خواب ندارد، مدام جزوه را ورق می‌زند و می‌گوید «حتماً خراب می‌کنم».",
    recommendedApproach:
      "نفس عمیق و توقف مرور جدید را پیشنهاد بده. یک مرور سبک از نکات کلیدی و سپس روتین آرام‌سازی (دوش، نور کم، بدون صفحه نمایش) را تنظیم کنید. برای جلسه بعد، برنامه مرور چندروزه بنویسید تا فشار شب آخر کم شود.",
    cautions:
      "دارو یا تکنیک درمانی تخصصی پیشنهاد نکن. اگر حملات وحشت یا بی‌خوابی مزمن گزارش شد، ارجاع تخصصی بده.",
    tags: "اضطراب، امتحان، خواب",
    status: KNOWLEDGE_ITEM_STATUS.PUBLISHED,
  },
  {
    title: "طرد شدن از گروه دوستان",
    category: KNOWLEDGE_CATEGORIES.PEERS,
    questionScenario:
      "دانش‌آموز می‌گوید دوستانش او را در گروه کلاسی نادیده می‌گیرند و در زنگ تفریح تنها می‌ماند.",
    recommendedApproach:
      "احساس طرد را جدی بگیر. از او بخواه موقعیت‌های مشخص را تعریف کند (نه قضاوت کلی). مهارت‌های شروع گفتگو و یافتن یک هم‌نشین جایگزین را تمرین کنید. با معلم/کمک‌مربی برای فرصت‌های مشارکتی کوتاه هماهنگ شو.",
    cautions:
      "او را به انتقام یا شایعه‌پراکنی تشویق نکن. اگر قلدری مداوم یا تهدید است، بدون تأخیر ارجاع و گزارش ثبت کن.",
    tags: "دوستی، طرد، مهارت اجتماعی",
    status: KNOWLEDGE_ITEM_STATUS.PUBLISHED,
  },
  {
    title: "مقایسه ظاهر با فضای مجازی",
    category: KNOWLEDGE_CATEGORIES.DIGITAL,
    questionScenario:
      "نوجوان بعد از دیدن استوری‌ها می‌گوید «من زشتم / هیچ‌کس منو دوست نداره» و خلقش پایین آمده.",
    recommendedApproach:
      "بین واقعیت و تصویر ویرایش‌شده تمایز بگذار. با او یک «رژیم مصرف محتوا» کوتاه طراحی کن (مثلاً نیم‌ساعت کمتر در شب). روی نقاط قوت غیرظاهری‌اش تمرکز کن و یک فعالیت واقعی هفتگی (ورزش، هنر، خدمت) جایگزین اسکرول پیشنهاد بده.",
    cautions:
      "ظاهر را مسخره نکن و تضمین زیبایی نده. اگر نشانه‌های افسردگی یا خودآسیبی دیدید، فوراً ارجاع بده و موضوع را ساده نگیر.",
    tags: "فضای مجازی، خودباوری، مقایسه",
    status: KNOWLEDGE_ITEM_STATUS.PUBLISHED,
  },
  {
    title: "فراموش کردن مسئولیت‌های گروهی",
    category: KNOWLEDGE_CATEGORIES.RESPONSIBILITY,
    questionScenario:
      "دانش‌آموز در پروژه گروهی سهمش را دیر تحویل می‌دهد و هم‌گروهی‌ها شاکی‌اند؛ خودش می‌گوید «یادم رفت».",
    recommendedApproach:
      "بدون شرم‌سار کردن، پیامد طبیعی را شفاف کن. با او یک چک‌لیست قابل‌مشاهده و یادآور مشترک (در چت گروهی یا دفترچه) بساز. یک جبران کوچک و مشخص برای گروه تعریف کنید تا اعتماد بازسازی شود.",
    cautions:
      "او را در جمع تحقیر نکن. اگر الگوی مداوم بی‌مسئولیتی با مشکلات خانوادگی/توجه همراه است، فقط تنبیه نکن و ریشه را با جلسه جداگانه بررسی کن.",
    tags: "مسئولیت، گروه، پیگیری",
    status: KNOWLEDGE_ITEM_STATUS.PUBLISHED,
  },
  {
    title: "شک به مسیر تحصیلی و آینده",
    category: KNOWLEDGE_CATEGORIES.SELF_ESTEEM,
    questionScenario:
      "دانش‌آموز پایه نهم می‌گوید نمی‌داند رشته‌اش چیست و احساس می‌کند از بقیه عقب افتاده.",
    recommendedApproach:
      "فشار انتخاب فوری را کم کن. علایق، مهارت‌ها و تجربه‌های موفق کوچکش را روی کاغذ بیاورید. دو مسیر آزمایشی کوتاه (بازدید، گفتگو با یک دانش‌آموز بزرگ‌تر، یک کار عملی) پیشنهاد بده و نتیجه را در جلسه بعد مرور کنید.",
    cautions:
      "یک رشته را به او تحمیل نکن. آینده را ترسناک جلوه نده. اگر اضطراب شدید تصمیم‌گیری دارد، با خانواده و مشاور هماهنگ شو.",
    tags: "هویت، آینده، انتخاب رشته",
    status: KNOWLEDGE_ITEM_STATUS.PUBLISHED,
  },
];

export function seedKnowledgeItems() {
  let created = 0;
  for (const item of KNOWLEDGE_SEED) {
    const existing = db
      .select()
      .from(knowledgeItems)
      .where(eq(knowledgeItems.title, item.title))
      .get();
    if (existing) continue;
    createKnowledgeItem(item);
    created += 1;
  }
  return { created, total: listKnowledgeItems().length };
}
