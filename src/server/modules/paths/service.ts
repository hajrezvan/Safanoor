import { and, asc, desc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { grades } from "@/db/schema/academic";
import { students, users } from "@/db/schema";
import { growthPaths, pathEnrollments, pathObjectives } from "@/db/schema/paths";
import { createId, nowIso } from "@/lib/id";
import { GROWTH_PATH_STATUS, PATH_ENROLLMENT_STATUS } from "@/lib/enums";

export const createPathSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  gradeId: z.string().min(1),
  ordering: z.coerce.number().int().default(0),
  status: z.enum(["draft", "active", "archived"]).default("active"),
});

export const updatePathSchema = createPathSchema.extend({
  id: z.string().min(1),
});

export const createPathObjectiveSchema = z.object({
  pathId: z.string().min(1),
  title: z.string().min(2),
  description: z.string().optional(),
  ordering: z.coerce.number().int().default(0),
});

export const updatePathObjectiveSchema = createPathObjectiveSchema.extend({
  id: z.string().min(1),
});

export type PathListItem = {
  id: string;
  title: string;
  description: string | null;
  gradeId: string;
  gradeTitleFa: string;
  status: string;
  ordering: number;
  createdAt: string;
  objectiveCount: number;
  activeEnrollmentCount: number;
};

export type PathStudentRow = {
  enrollmentId: string;
  studentId: string;
  fullName: string | null;
  status: string;
  startedAt: string;
};

function pathBaseQuery() {
  const objectiveCount = sql<number>`(
    select count(*) from ${pathObjectives} where ${pathObjectives.pathId} = ${growthPaths.id}
  )`;
  const activeEnrollmentCount = sql<number>`(
    select count(*) from ${pathEnrollments}
    where ${pathEnrollments.pathId} = ${growthPaths.id}
      and ${pathEnrollments.status} = ${PATH_ENROLLMENT_STATUS.ACTIVE}
  )`;

  return db
    .select({
      id: growthPaths.id,
      title: growthPaths.title,
      description: growthPaths.description,
      gradeId: growthPaths.gradeId,
      gradeTitleFa: grades.titleFa,
      status: growthPaths.status,
      ordering: growthPaths.ordering,
      createdAt: growthPaths.createdAt,
      objectiveCount,
      activeEnrollmentCount,
    })
    .from(growthPaths)
    .innerJoin(grades, eq(growthPaths.gradeId, grades.id));
}

function decoratePath(row: Omit<PathListItem, "objectiveCount" | "activeEnrollmentCount"> & {
  objectiveCount: number | null;
  activeEnrollmentCount: number | null;
}): PathListItem {
  return {
    ...row,
    objectiveCount: Number(row.objectiveCount ?? 0),
    activeEnrollmentCount: Number(row.activeEnrollmentCount ?? 0),
  };
}

export type PathListFilters = {
  search?: string;
  gradeId?: string;
  status?: string;
};

export function listPaths(opts?: PathListFilters): PathListItem[] {
  const conditions = [];
  if (opts?.gradeId) conditions.push(eq(growthPaths.gradeId, opts.gradeId));
  if (opts?.status) conditions.push(eq(growthPaths.status, opts.status));
  if (opts?.search) conditions.push(like(growthPaths.title, `%${opts.search}%`));

  return pathBaseQuery()
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(growthPaths.ordering), desc(growthPaths.createdAt))
    .all()
    .map(decoratePath);
}

export function getPathById(id: string): PathListItem | undefined {
  const row = pathBaseQuery().where(eq(growthPaths.id, id)).get();
  return row ? decoratePath(row) : undefined;
}

function insertPath(input: z.infer<typeof createPathSchema>) {
  const id = createId("path");
  const now = nowIso();
  db.insert(growthPaths)
    .values({
      id,
      title: input.title,
      description: input.description ?? null,
      gradeId: input.gradeId,
      status: input.status,
      ordering: input.ordering,
      createdAt: now,
    })
    .run();
  return getPathById(id)!;
}

export function createPath(input: z.infer<typeof createPathSchema>) {
  return insertPath(input);
}

export const createGrowthPath = createPath;

export function updatePath(input: z.infer<typeof updatePathSchema>) {
  const existing = db.select().from(growthPaths).where(eq(growthPaths.id, input.id)).get();
  if (!existing) throw new Error("مسیر یافت نشد.");

  db.update(growthPaths)
    .set({
      title: input.title,
      description: input.description ?? null,
      gradeId: input.gradeId,
      status: input.status,
      ordering: input.ordering,
    })
    .where(eq(growthPaths.id, input.id))
    .run();

  return getPathById(input.id);
}

export function deletePath(id: string) {
  const existing = db.select().from(growthPaths).where(eq(growthPaths.id, id)).get();
  if (!existing) throw new Error("مسیر یافت نشد.");

  const active = db
    .select()
    .from(pathEnrollments)
    .where(
      and(eq(pathEnrollments.pathId, id), eq(pathEnrollments.status, PATH_ENROLLMENT_STATUS.ACTIVE)),
    )
    .get();
  if (active) throw new Error("مسیر با دانش‌آموز فعال قابل حذف نیست.");

  db.delete(growthPaths).where(eq(growthPaths.id, id)).run();
}

export function createPathObjective(input: z.infer<typeof createPathObjectiveSchema>) {
  const id = createId("pobj");
  db.insert(pathObjectives)
    .values({
      id,
      pathId: input.pathId,
      title: input.title,
      description: input.description ?? null,
      ordering: input.ordering,
    })
    .run();
  return db.select().from(pathObjectives).where(eq(pathObjectives.id, id)).get()!;
}

export function addPathObjective(pathId: string, title: string, description?: string) {
  const max =
    db.select().from(pathObjectives).where(eq(pathObjectives.pathId, pathId)).all().length;
  return createPathObjective({ pathId, title, description, ordering: max + 1 });
}

export function updatePathObjective(input: z.infer<typeof updatePathObjectiveSchema>) {
  const existing = db.select().from(pathObjectives).where(eq(pathObjectives.id, input.id)).get();
  if (!existing) throw new Error("هدف مسیر یافت نشد.");

  db.update(pathObjectives)
    .set({
      title: input.title,
      description: input.description ?? null,
      ordering: input.ordering,
    })
    .where(eq(pathObjectives.id, input.id))
    .run();

  return db.select().from(pathObjectives).where(eq(pathObjectives.id, input.id)).get();
}

export function deletePathObjective(id: string) {
  const existing = db.select().from(pathObjectives).where(eq(pathObjectives.id, id)).get();
  if (!existing) throw new Error("هدف مسیر یافت نشد.");
  db.delete(pathObjectives).where(eq(pathObjectives.id, id)).run();
  return existing.pathId;
}

export function listPathObjectives(pathId: string) {
  return db
    .select()
    .from(pathObjectives)
    .where(eq(pathObjectives.pathId, pathId))
    .orderBy(asc(pathObjectives.ordering))
    .all();
}

export const listObjectives = listPathObjectives;

export function listPathStudents(pathId: string): PathStudentRow[] {
  return db
    .select({
      enrollmentId: pathEnrollments.id,
      studentId: pathEnrollments.studentId,
      fullName: users.fullName,
      status: pathEnrollments.status,
      startedAt: pathEnrollments.startedAt,
    })
    .from(pathEnrollments)
    .innerJoin(students, eq(pathEnrollments.studentId, students.id))
    .leftJoin(users, eq(students.userId, users.id))
    .where(eq(pathEnrollments.pathId, pathId))
    .orderBy(desc(pathEnrollments.startedAt))
    .all();
}

export function setActiveEnrollment(studentId: string, pathId: string) {
  const now = nowIso();
  db.update(pathEnrollments)
    .set({ status: PATH_ENROLLMENT_STATUS.ARCHIVED, endedAt: now })
    .where(
      and(
        eq(pathEnrollments.studentId, studentId),
        eq(pathEnrollments.status, PATH_ENROLLMENT_STATUS.ACTIVE),
      ),
    )
    .run();

  const existing = db
    .select()
    .from(pathEnrollments)
    .where(and(eq(pathEnrollments.studentId, studentId), eq(pathEnrollments.pathId, pathId)))
    .get();

  if (existing) {
    db.update(pathEnrollments)
      .set({ status: PATH_ENROLLMENT_STATUS.ACTIVE, startedAt: now, endedAt: null })
      .where(eq(pathEnrollments.id, existing.id))
      .run();
    return existing.id;
  }

  const id = createId("penr");
  db.insert(pathEnrollments)
    .values({
      id,
      studentId,
      pathId,
      status: PATH_ENROLLMENT_STATUS.ACTIVE,
      startedAt: now,
      endedAt: null,
    })
    .run();
  return id;
}

export function getActiveEnrollment(studentId: string) {
  return db
    .select({
      enrollmentId: pathEnrollments.id,
      pathId: growthPaths.id,
      title: growthPaths.title,
      description: growthPaths.description,
      status: pathEnrollments.status,
      startedAt: pathEnrollments.startedAt,
    })
    .from(pathEnrollments)
    .innerJoin(growthPaths, eq(pathEnrollments.pathId, growthPaths.id))
    .where(
      and(
        eq(pathEnrollments.studentId, studentId),
        eq(pathEnrollments.status, PATH_ENROLLMENT_STATUS.ACTIVE),
      ),
    )
    .get();
}

export function ensureDemoPaths() {
  if (db.select().from(growthPaths).all().length > 0) return;
  const allGrades = db.select().from(grades).orderBy(asc(grades.ordering)).all();
  for (const g of allGrades) {
    const path = createPath({
      title: `مسیر تربیتی پایه ${g.titleFa}`,
      description: `مسیر عمومی مجموعه برای پایه ${g.titleFa} با تمرکز معرفتی، مهارتی و مطالعاتی.`,
      gradeId: g.id,
      ordering: g.ordering,
      status: GROWTH_PATH_STATUS.ACTIVE,
    });
    addPathObjective(path.id, "تقویت انس با قرآن و مفاهیم معرفتی");
    addPathObjective(path.id, "پیشرفت تحصیلی منظم و مسئولیت‌پذیری");
    addPathObjective(path.id, "تمرین یک مهارت خدمت‌محور (نویسندگی، خوشنویسی یا هنر)");
  }
}
