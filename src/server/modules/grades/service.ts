import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { grades } from "@/db/schema";
import { createId, nowIso } from "@/lib/id";

export const GRADE_KEYS = {
  SEVENTH: "grade_7",
  EIGHTH: "grade_8",
  NINTH: "grade_9",
  TENTH: "grade_10",
  ELEVENTH: "grade_11",
  TWELFTH: "grade_12",
} as const;

export type GradeKey = (typeof GRADE_KEYS)[keyof typeof GRADE_KEYS];

/** پایه‌های تحصیلی متوسطه اول و دوم — مرجع seed */
export const GRADE_SEED: { key: GradeKey; titleFa: string; ordering: number }[] = [
  { key: GRADE_KEYS.SEVENTH, titleFa: "هفتم", ordering: 7 },
  { key: GRADE_KEYS.EIGHTH, titleFa: "هشتم", ordering: 8 },
  { key: GRADE_KEYS.NINTH, titleFa: "نهم", ordering: 9 },
  { key: GRADE_KEYS.TENTH, titleFa: "دهم", ordering: 10 },
  { key: GRADE_KEYS.ELEVENTH, titleFa: "یازدهم", ordering: 11 },
  { key: GRADE_KEYS.TWELFTH, titleFa: "دوازدهم", ordering: 12 },
];

export const createGradeSchema = z.object({
  key: z.string().min(2, "کلید پایه الزامی است."),
  titleFa: z.string().min(2, "عنوان پایه الزامی است."),
  ordering: z.coerce.number().int().min(1, "ترتیب باید عدد مثبت باشد."),
});

export function listGrades() {
  return db.select().from(grades).orderBy(asc(grades.ordering)).all();
}

export function getGradeById(id: string) {
  return db.select().from(grades).where(eq(grades.id, id)).get();
}

export function getGradeByKey(key: string) {
  return db.select().from(grades).where(eq(grades.key, key)).get();
}

export function createGrade(input: z.infer<typeof createGradeSchema>) {
  const existing = getGradeByKey(input.key);
  if (existing) throw new Error("این پایه قبلاً ثبت شده است.");

  const id = createId("grd");
  db.insert(grades)
    .values({
      id,
      key: input.key,
      titleFa: input.titleFa,
      ordering: input.ordering,
      createdAt: nowIso(),
    })
    .run();
  return getGradeById(id);
}

/** ایجاد پایه‌های هفتم تا دوازدهم؛ idempotent است و پایه‌های موجود را دست نمی‌زند. */
export function seedGrades() {
  const now = nowIso();
  let created = 0;

  for (const grade of GRADE_SEED) {
    const existing = getGradeByKey(grade.key);
    if (existing) continue;
    db.insert(grades)
      .values({
        id: createId("grd"),
        key: grade.key,
        titleFa: grade.titleFa,
        ordering: grade.ordering,
        createdAt: now,
      })
      .run();
    created += 1;
  }

  return { created, total: listGrades().length };
}

/** اگر هیچ پایه‌ای وجود نداشته باشد seed می‌کند و لیست را برمی‌گرداند. */
export function ensureGradesSeeded() {
  const existing = listGrades();
  if (existing.length > 0) return existing;
  seedGrades();
  return listGrades();
}
