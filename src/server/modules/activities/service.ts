import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  activities,
  activityAssignments,
  grades,
  progressRecords,
  students,
  users,
} from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import {
  ACTIVITY_ASSIGNMENT_STATUS,
  ACTIVITY_STATUS,
  ACTIVITY_TYPE,
  PROGRESS_RELATED_TYPE,
  PROGRESS_STATUS,
  type ActivityAssignmentStatus,
  type RoleKey,
} from "@/lib/enums";
import { getStudentIdsForStaff } from "@/server/modules/students/service";

const activityTypeEnum = z.enum([
  ACTIVITY_TYPE.PROGRAMMING,
  ACTIVITY_TYPE.WRITING,
  ACTIVITY_TYPE.PHOTOGRAPHY,
  ACTIVITY_TYPE.SPORTS,
  ACTIVITY_TYPE.GROUP_PROJECT,
  ACTIVITY_TYPE.MEDIA,
  ACTIVITY_TYPE.STUDY,
  ACTIVITY_TYPE.PERSONAL_PRACTICE,
]);

const activityStatusEnum = z.enum([
  ACTIVITY_STATUS.DRAFT,
  ACTIVITY_STATUS.PUBLISHED,
  ACTIVITY_STATUS.ARCHIVED,
]);

export const createActivitySchema = z.object({
  title: z.string().min(2, "عنوان فعالیت حداقل ۲ کاراکتر باشد."),
  description: z.string().optional().or(z.literal("")),
  type: activityTypeEnum,
  gradeId: z.string().optional().or(z.literal("")),
  instructions: z.string().optional().or(z.literal("")),
  expectedOutput: z.string().optional().or(z.literal("")),
  status: activityStatusEnum.optional(),
});

export const updateActivitySchema = createActivitySchema.extend({
  id: z.string().min(1),
});

export const assignActivitySchema = z.object({
  activityId: z.string().min(1),
  studentId: z.string().min(1),
  dueDate: z.string().optional().or(z.literal("")),
});

export const submitProgressSchema = z.object({
  assignmentId: z.string().min(1),
  reportText: z.string().min(2, "گزارش انجام کار الزامی است."),
  evidenceUrl: z.string().optional().or(z.literal("")),
  evidenceFilePath: z.string().optional().or(z.literal("")),
  markDone: z.coerce.boolean().optional(),
});

export const mentorFeedbackSchema = z.object({
  assignmentId: z.string().min(1),
  feedback: z.string().min(2, "بازخورد مربی الزامی است."),
});

export type ActivityListItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  gradeId: string | null;
  gradeTitleFa: string | null;
  instructions: string | null;
  expectedOutput: string | null;
  status: string;
  assignmentCount: number;
  createdAt: string;
};

export type ActivityAssignmentItem = {
  id: string;
  activityId: string;
  activityTitle: string;
  activityType: string;
  activityDescription: string | null;
  instructions: string | null;
  expectedOutput: string | null;
  studentId: string;
  studentName: string | null;
  status: string;
  dueDate: string | null;
  result: string | null;
  feedback: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidenceUrl: string | null;
  evidenceFilePath: string | null;
  progressPercent: number | null;
  progressStatus: string | null;
  mentorFeedback: string | null;
  reviewedAt: string | null;
};

function baseActivityQuery() {
  return db
    .select({
      id: activities.id,
      title: activities.title,
      description: activities.description,
      type: activities.type,
      gradeId: activities.gradeId,
      gradeTitleFa: grades.titleFa,
      instructions: activities.instructions,
      expectedOutput: activities.expectedOutput,
      status: activities.status,
      assignmentCount: sql<number>`(select count(*) from ${activityAssignments} where ${activityAssignments.activityId} = ${activities.id})`,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .leftJoin(grades, eq(activities.gradeId, grades.id));
}

export function listActivities(
  filters: { search?: string; type?: string; status?: string; gradeId?: string } = {},
): ActivityListItem[] {
  const conditions = [];
  if (filters.type) conditions.push(eq(activities.type, filters.type));
  if (filters.status) conditions.push(eq(activities.status, filters.status));
  if (filters.gradeId) conditions.push(eq(activities.gradeId, filters.gradeId));
  if (filters.search) conditions.push(like(activities.title, `%${filters.search}%`));

  return baseActivityQuery()
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(activities.title))
    .all()
    .map((row) => ({
      ...row,
      assignmentCount: Number(row.assignmentCount ?? 0),
    })) as ActivityListItem[];
}

export function getActivityById(id: string): ActivityListItem | undefined {
  const row = baseActivityQuery().where(eq(activities.id, id)).get();
  return row
    ? ({ ...row, assignmentCount: Number(row.assignmentCount ?? 0) } as ActivityListItem)
    : undefined;
}

export function createActivity(input: z.infer<typeof createActivitySchema>) {
  const id = createId("act");
  db.insert(activities)
    .values({
      id,
      title: input.title,
      description: input.description || null,
      type: input.type,
      gradeId: input.gradeId || null,
      instructions: input.instructions || null,
      expectedOutput: input.expectedOutput || null,
      status: input.status ?? ACTIVITY_STATUS.DRAFT,
      createdAt: nowIso(),
    })
    .run();

  return getActivityById(id);
}

export function updateActivity(input: z.infer<typeof updateActivitySchema>) {
  const existing = db.select().from(activities).where(eq(activities.id, input.id)).get();
  if (!existing) throw new Error("فعالیت یافت نشد.");

  db.update(activities)
    .set({
      title: input.title,
      description: input.description || null,
      type: input.type,
      gradeId: input.gradeId || null,
      instructions: input.instructions || null,
      expectedOutput: input.expectedOutput || null,
      status: input.status ?? existing.status,
    })
    .where(eq(activities.id, input.id))
    .run();

  return getActivityById(input.id);
}

export function deleteActivity(id: string) {
  const inUse = db
    .select()
    .from(activityAssignments)
    .where(eq(activityAssignments.activityId, id))
    .get();
  if (inUse) throw new Error("این فعالیت محول شده و حذف نمی‌شود؛ ابتدا آرشیو کنید.");
  db.delete(activities).where(eq(activities.id, id)).run();
}

function progressForAssignment(assignmentId: string) {
  return db
    .select()
    .from(progressRecords)
    .where(
      and(
        eq(progressRecords.relatedType, PROGRESS_RELATED_TYPE.ACTIVITY_ASSIGNMENT),
        eq(progressRecords.relatedId, assignmentId),
      ),
    )
    .orderBy(desc(progressRecords.createdAt))
    .get();
}

function assignmentQuery() {
  return db
    .select({
      id: activityAssignments.id,
      activityId: activityAssignments.activityId,
      activityTitle: activities.title,
      activityType: activities.type,
      activityDescription: activities.description,
      instructions: activities.instructions,
      expectedOutput: activities.expectedOutput,
      studentId: activityAssignments.studentId,
      studentName: users.fullName,
      status: activityAssignments.status,
      dueDate: activityAssignments.dueDate,
      result: activityAssignments.result,
      feedback: activityAssignments.feedback,
      submittedAt: activityAssignments.submittedAt,
      createdAt: activityAssignments.createdAt,
      updatedAt: activityAssignments.updatedAt,
    })
    .from(activityAssignments)
    .innerJoin(activities, eq(activityAssignments.activityId, activities.id))
    .innerJoin(students, eq(activityAssignments.studentId, students.id))
    .leftJoin(users, eq(students.userId, users.id));
}

function withProgress(row: Omit<ActivityAssignmentItem, "evidenceUrl" | "evidenceFilePath" | "progressPercent" | "progressStatus" | "mentorFeedback" | "reviewedAt">): ActivityAssignmentItem {
  const progress = progressForAssignment(row.id);
  const derivedStatus =
    row.status !== ACTIVITY_ASSIGNMENT_STATUS.REVIEWED &&
    row.status !== ACTIVITY_ASSIGNMENT_STATUS.SUBMITTED &&
    row.dueDate &&
    new Date(row.dueDate).getTime() < Date.now()
      ? ACTIVITY_ASSIGNMENT_STATUS.OVERDUE
      : row.status;

  return {
    ...row,
    status: derivedStatus,
    evidenceUrl: progress?.evidenceUrl ?? null,
    evidenceFilePath: progress?.evidenceFilePath ?? null,
    progressPercent: progress?.progressPercent ?? null,
    progressStatus: progress?.status ?? null,
    mentorFeedback: progress?.mentorFeedback ?? row.feedback,
    reviewedAt: progress?.reviewedAt ?? null,
  };
}

export function getAssignmentById(id: string): ActivityAssignmentItem | undefined {
  const row = assignmentQuery().where(eq(activityAssignments.id, id)).get();
  return row ? withProgress(row) : undefined;
}

export function listAssignmentsForStudent(studentId: string): ActivityAssignmentItem[] {
  return assignmentQuery()
    .where(eq(activityAssignments.studentId, studentId))
    .orderBy(desc(activityAssignments.createdAt))
    .all()
    .map(withProgress);
}

export function listAssignmentsForStaffScope(
  staffUserId: string,
  role: RoleKey,
): ActivityAssignmentItem[] {
  const studentIds = getStudentIdsForStaff(staffUserId, role);
  if (studentIds.length === 0) return [];

  return assignmentQuery()
    .where(inArray(activityAssignments.studentId, studentIds))
    .orderBy(desc(activityAssignments.createdAt))
    .all()
    .map(withProgress);
}

export function listAssignmentsForActivity(activityId: string): ActivityAssignmentItem[] {
  return assignmentQuery()
    .where(eq(activityAssignments.activityId, activityId))
    .orderBy(desc(activityAssignments.createdAt))
    .all()
    .map(withProgress);
}

export function assignActivityToStudent(input: z.infer<typeof assignActivitySchema>) {
  const activity = db.select().from(activities).where(eq(activities.id, input.activityId)).get();
  if (!activity) throw new Error("فعالیت یافت نشد.");
  if (activity.status === ACTIVITY_STATUS.ARCHIVED) {
    throw new Error("فعالیت آرشیو شده قابل محول‌کردن نیست.");
  }

  const student = db.select().from(students).where(eq(students.id, input.studentId)).get();
  if (!student) throw new Error("دانش‌آموز یافت نشد.");

  const duplicate = db
    .select()
    .from(activityAssignments)
    .where(
      and(
        eq(activityAssignments.activityId, input.activityId),
        eq(activityAssignments.studentId, input.studentId),
      ),
    )
    .get();
  if (duplicate) throw new Error("این فعالیت قبلاً به دانش‌آموز محول شده است.");

  const now = nowIso();
  const id = createId("aas");
  db.insert(activityAssignments)
    .values({
      id,
      activityId: input.activityId,
      studentId: input.studentId,
      status: ACTIVITY_ASSIGNMENT_STATUS.ASSIGNED,
      dueDate: input.dueDate || null,
      result: null,
      feedback: null,
      submittedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getAssignmentById(id);
}

/**
 * دانش‌آموز گزارش انجام و شواهد را ثبت می‌کند.
 * وضعیت و متن گزارش در activity_assignments و شواهد در progress_records نگه داشته می‌شود.
 */
export function submitActivityProgress(
  input: z.infer<typeof submitProgressSchema>,
  actorUserId: string,
) {
  const assignment = db
    .select()
    .from(activityAssignments)
    .where(eq(activityAssignments.id, input.assignmentId))
    .get();
  if (!assignment) throw new Error("محول‌سازی یافت نشد.");
  if (assignment.status === ACTIVITY_ASSIGNMENT_STATUS.REVIEWED) {
    throw new Error("این فعالیت بازبینی شده و قابل ارسال مجدد نیست.");
  }

  const now = nowIso();
  const done = input.markDone !== false;
  const nextStatus = done
    ? ACTIVITY_ASSIGNMENT_STATUS.SUBMITTED
    : ACTIVITY_ASSIGNMENT_STATUS.IN_PROGRESS;
  const progressPercent = done ? 100 : 50;

  db.update(activityAssignments)
    .set({
      status: nextStatus,
      result: input.reportText,
      submittedAt: done ? now : assignment.submittedAt,
      updatedAt: now,
    })
    .where(eq(activityAssignments.id, input.assignmentId))
    .run();

  const existingProgress = progressForAssignment(input.assignmentId);
  if (existingProgress) {
    db.update(progressRecords)
      .set({
        status: done ? PROGRESS_STATUS.SUBMITTED : PROGRESS_STATUS.RECORDED,
        progressPercent,
        reportText: input.reportText,
        evidenceUrl: input.evidenceUrl || existingProgress.evidenceUrl,
        evidenceFilePath: input.evidenceFilePath || existingProgress.evidenceFilePath,
        recordedAt: now,
      })
      .where(eq(progressRecords.id, existingProgress.id))
      .run();
  } else {
    db.insert(progressRecords)
      .values({
        id: createId("prg"),
        studentId: assignment.studentId,
        relatedType: PROGRESS_RELATED_TYPE.ACTIVITY_ASSIGNMENT,
        relatedId: input.assignmentId,
        status: done ? PROGRESS_STATUS.SUBMITTED : PROGRESS_STATUS.RECORDED,
        progressPercent,
        reportText: input.reportText,
        evidenceUrl: input.evidenceUrl || null,
        evidenceFilePath: input.evidenceFilePath || null,
        mentorFeedback: null,
        recordedAt: now,
        reviewedAt: null,
        createdBy: actorUserId,
        createdAt: now,
      })
      .run();
  }

  return getAssignmentById(input.assignmentId);
}

/** بازخورد مربی/کمک‌مربی؛ هم روی assignment و هم progress_record نوشته می‌شود. */
export function provideMentorFeedback(
  input: z.infer<typeof mentorFeedbackSchema>,
  actorUserId: string,
) {
  const assignment = db
    .select()
    .from(activityAssignments)
    .where(eq(activityAssignments.id, input.assignmentId))
    .get();
  if (!assignment) throw new Error("محول‌سازی یافت نشد.");

  const now = nowIso();
  db.update(activityAssignments)
    .set({
      status: ACTIVITY_ASSIGNMENT_STATUS.REVIEWED,
      feedback: input.feedback,
      updatedAt: now,
    })
    .where(eq(activityAssignments.id, input.assignmentId))
    .run();

  const existingProgress = progressForAssignment(input.assignmentId);
  if (existingProgress) {
    db.update(progressRecords)
      .set({
        status: PROGRESS_STATUS.REVIEWED,
        mentorFeedback: input.feedback,
        reviewedAt: now,
        progressPercent: Math.max(existingProgress.progressPercent, 100),
      })
      .where(eq(progressRecords.id, existingProgress.id))
      .run();
  } else {
    db.insert(progressRecords)
      .values({
        id: createId("prg"),
        studentId: assignment.studentId,
        relatedType: PROGRESS_RELATED_TYPE.ACTIVITY_ASSIGNMENT,
        relatedId: input.assignmentId,
        status: PROGRESS_STATUS.REVIEWED,
        progressPercent: 100,
        reportText: assignment.result,
        evidenceUrl: null,
        evidenceFilePath: null,
        mentorFeedback: input.feedback,
        recordedAt: assignment.submittedAt ?? now,
        reviewedAt: now,
        createdBy: actorUserId,
        createdAt: now,
      })
      .run();
  }

  return getAssignmentById(input.assignmentId);
}

export function updateAssignmentStatus(
  assignmentId: string,
  status: ActivityAssignmentStatus,
) {
  const existing = db
    .select()
    .from(activityAssignments)
    .where(eq(activityAssignments.id, assignmentId))
    .get();
  if (!existing) throw new Error("محول‌سازی یافت نشد.");

  db.update(activityAssignments)
    .set({ status, updatedAt: nowIso() })
    .where(eq(activityAssignments.id, assignmentId))
    .run();

  return getAssignmentById(assignmentId);
}

export function unassignActivity(assignmentId: string) {
  const existing = db
    .select()
    .from(activityAssignments)
    .where(eq(activityAssignments.id, assignmentId))
    .get();
  if (!existing) throw new Error("محول‌سازی یافت نشد.");
  if (existing.status === ACTIVITY_ASSIGNMENT_STATUS.SUBMITTED ||
      existing.status === ACTIVITY_ASSIGNMENT_STATUS.REVIEWED) {
    throw new Error("پس از ارسال یا بازبینی، محول‌سازی حذف نمی‌شود.");
  }

  db.delete(progressRecords)
    .where(
      and(
        eq(progressRecords.relatedType, PROGRESS_RELATED_TYPE.ACTIVITY_ASSIGNMENT),
        eq(progressRecords.relatedId, assignmentId),
      ),
    )
    .run();
  db.delete(activityAssignments).where(eq(activityAssignments.id, assignmentId)).run();
}
