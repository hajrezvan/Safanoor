import { and, asc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { db } from "@/db/client";
import {
  chatConversations,
  grades,
  groups,
  growthProfiles,
  mentorAssignments,
  roles,
  students,
  users,
} from "@/db/schema";
import { createId, nowIso } from "@/lib/id";
import {
  ASSIGNMENT_ROLE,
  CHAT_CONVERSATION_STATUS,
  ROLE_KEYS,
  STUDENT_STATUS,
  type AssignmentRole,
  type RoleKey,
} from "@/lib/enums";
import { recordAudit } from "@/server/modules/audit/service";

const mentorAssignment = alias(mentorAssignments, "mentor_assignment");
const assistantAssignment = alias(mentorAssignments, "assistant_assignment");
const mentorUser = alias(users, "mentor_user");
const assistantUser = alias(users, "assistant_user");

export const createStudentSchema = z.object({
  userId: z.string().min(1, "انتخاب کاربر دانش‌آموز الزامی است."),
  gradeId: z.string().min(1, "انتخاب پایه الزامی است."),
  groupId: z.string().optional().or(z.literal("")),
  status: z
    .enum([STUDENT_STATUS.ACTIVE, STUDENT_STATUS.INACTIVE, STUDENT_STATUS.GRADUATED])
    .default(STUDENT_STATUS.ACTIVE),
  mentorUserId: z.string().optional().or(z.literal("")),
  assistantUserId: z.string().optional().or(z.literal("")),
});

export const updateStudentSchema = z.object({
  id: z.string().min(1),
  gradeId: z.string().min(1, "انتخاب پایه الزامی است."),
  groupId: z.string().optional().or(z.literal("")),
  status: z.enum([
    STUDENT_STATUS.ACTIVE,
    STUDENT_STATUS.INACTIVE,
    STUDENT_STATUS.GRADUATED,
  ]),
  mentorUserId: z.string().optional().or(z.literal("")),
  assistantUserId: z.string().optional().or(z.literal("")),
});

import { parseSiblingsJson, type SiblingInfo } from "@/lib/siblings";

export type { SiblingInfo };
export { parseSiblingsJson };

export const growthProfileSchema = z.object({
  studentId: z.string().min(1),
  interests: z.string().optional().or(z.literal("")),
  skills: z.string().optional().or(z.literal("")),
  academicStatus: z.string().optional().or(z.literal("")),
  overallNote: z.string().optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")),
  nationalId: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  avatarPath: z.string().optional().or(z.literal("")),
  siblingsJson: z.string().optional().or(z.literal("")),
  fatherName: z.string().optional().or(z.literal("")),
  fatherJob: z.string().optional().or(z.literal("")),
  fatherBirthDate: z.string().optional().or(z.literal("")),
  motherJob: z.string().optional().or(z.literal("")),
  fatherAlive: z.enum(["true", "false", ""]).optional(),
  motherAlive: z.enum(["true", "false", ""]).optional(),
  parentsLiveTogether: z.enum(["true", "false", ""]).optional(),
});

export const studentSelfProfileSchema = z.object({
  studentId: z.string().min(1),
  birthDate: z.string().optional().or(z.literal("")),
  nationalId: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  avatarPath: z.string().optional().or(z.literal("")),
  siblingsJson: z.string().optional().or(z.literal("")),
  interests: z.string().optional().or(z.literal("")),
  skills: z.string().optional().or(z.literal("")),
});

function boolFromForm(v: string | undefined | null): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export const assignStaffSchema = z.object({
  studentId: z.string().min(1),
  staffUserId: z.string().optional().or(z.literal("")),
  assignmentRole: z.enum([ASSIGNMENT_ROLE.MENTOR, ASSIGNMENT_ROLE.ASSISTANT_MENTOR]),
});

export type StudentListItem = {
  id: string;
  userId: string | null;
  fullName: string;
  username: string | null;
  status: string;
  gradeId: string | null;
  gradeTitleFa: string | null;
  gradeOrdering: number | null;
  groupId: string | null;
  groupTitle: string | null;
  mentorUserId: string | null;
  mentorName: string | null;
  assistantUserId: string | null;
  assistantName: string | null;
  createdAt: string;
};

export type StudentFilters = {
  search?: string;
  gradeId?: string;
  groupId?: string;
  mentorUserId?: string;
  assistantUserId?: string;
  status?: string;
  /** محدودسازی نتیجه به مجموعه‌ای مشخص از دانش‌آموزان (scoping نقش‌ها) */
  studentIds?: string[];
};

const activeMentorJoin = and(
  eq(mentorAssignment.studentId, students.id),
  eq(mentorAssignment.assignmentRole, ASSIGNMENT_ROLE.MENTOR),
  eq(mentorAssignment.isActive, true),
);

const activeAssistantJoin = and(
  eq(assistantAssignment.studentId, students.id),
  eq(assistantAssignment.assignmentRole, ASSIGNMENT_ROLE.ASSISTANT_MENTOR),
  eq(assistantAssignment.isActive, true),
);

function baseStudentQuery() {
  return db
    .select({
      id: students.id,
      userId: students.userId,
      fullName: users.fullName,
      username: users.username,
      status: students.status,
      gradeId: students.gradeId,
      gradeTitleFa: grades.titleFa,
      gradeOrdering: grades.ordering,
      groupId: students.groupId,
      groupTitle: groups.title,
      mentorUserId: mentorAssignment.staffUserId,
      mentorName: mentorUser.fullName,
      assistantUserId: assistantAssignment.staffUserId,
      assistantName: assistantUser.fullName,
      createdAt: students.createdAt,
    })
    .from(students)
    .leftJoin(users, eq(students.userId, users.id))
    .leftJoin(grades, eq(students.gradeId, grades.id))
    .leftJoin(groups, eq(students.groupId, groups.id))
    .leftJoin(mentorAssignment, activeMentorJoin)
    .leftJoin(mentorUser, eq(mentorAssignment.staffUserId, mentorUser.id))
    .leftJoin(assistantAssignment, activeAssistantJoin)
    .leftJoin(assistantUser, eq(assistantAssignment.staffUserId, assistantUser.id));
}

function buildStudentConditions(filters: StudentFilters) {
  const conditions = [];

  if (filters.status) conditions.push(eq(students.status, filters.status));
  if (filters.gradeId) conditions.push(eq(students.gradeId, filters.gradeId));
  if (filters.groupId) conditions.push(eq(students.groupId, filters.groupId));
  if (filters.mentorUserId) {
    conditions.push(eq(mentorAssignment.staffUserId, filters.mentorUserId));
  }
  if (filters.assistantUserId) {
    conditions.push(eq(assistantAssignment.staffUserId, filters.assistantUserId));
  }
  if (filters.search) {
    const q = `%${filters.search}%`;
    conditions.push(or(like(users.fullName, q), like(users.username, q)));
  }
  if (filters.studentIds) {
    conditions.push(
      filters.studentIds.length > 0 ? inArray(students.id, filters.studentIds) : sql`1 = 0`,
    );
  }

  return conditions.length ? and(...conditions) : undefined;
}

export function listStudents(filters: StudentFilters = {}): StudentListItem[] {
  return baseStudentQuery()
    .where(buildStudentConditions(filters))
    .orderBy(asc(grades.ordering), asc(users.fullName))
    .all() as StudentListItem[];
}

export function getStudentById(id: string): StudentListItem | undefined {
  return baseStudentQuery().where(eq(students.id, id)).get() as StudentListItem | undefined;
}

export function getStudentByUserId(userId: string): StudentListItem | undefined {
  return baseStudentQuery().where(eq(students.userId, userId)).get() as
    | StudentListItem
    | undefined;
}

/** کاربران با نقش دانش‌آموز که هنوز رکورد Student ندارند — برای فرم ایجاد */
export function listUnlinkedStudentUsers() {
  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      username: users.username,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(students, eq(students.userId, users.id))
    .where(and(eq(roles.key, ROLE_KEYS.STUDENT), isNull(students.id)))
    .orderBy(asc(users.fullName))
    .all();
}

export function listStaffUsers(roleKey: RoleKey) {
  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      username: users.username,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(roles.key, roleKey), eq(users.isActive, true)))
    .orderBy(asc(users.fullName))
    .all();
}

function assertUserHasRole(userId: string, roleKey: RoleKey, message: string) {
  const row = db
    .select({ key: roles.key })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .get();
  if (!row || row.key !== roleKey) throw new Error(message);
}

export function createStudent(
  input: z.infer<typeof createStudentSchema>,
  actorUserId?: string,
) {
  assertUserHasRole(input.userId, ROLE_KEYS.STUDENT, "کاربر انتخاب‌شده دانش‌آموز نیست.");

  const existing = db.select().from(students).where(eq(students.userId, input.userId)).get();
  if (existing) throw new Error("برای این کاربر قبلاً پرونده دانش‌آموزی ساخته شده است.");

  const now = nowIso();
  const id = createId("std");

  db.insert(students)
    .values({
      id,
      userId: input.userId,
      gradeId: input.gradeId,
      groupId: input.groupId || null,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  upsertGrowthProfile({ studentId: id });

  if (input.mentorUserId) {
    setStaffAssignment(
      {
        studentId: id,
        staffUserId: input.mentorUserId,
        assignmentRole: ASSIGNMENT_ROLE.MENTOR,
      },
      actorUserId,
    );
  }
  if (input.assistantUserId) {
    setStaffAssignment(
      {
        studentId: id,
        staffUserId: input.assistantUserId,
        assignmentRole: ASSIGNMENT_ROLE.ASSISTANT_MENTOR,
      },
      actorUserId,
    );
  }

  const created = getStudentById(id);
  if (actorUserId && created) {
    recordAudit({
      actorUserId,
      entityType: "student",
      entityId: id,
      action: "create",
      after: {
        gradeId: created.gradeId,
        groupId: created.groupId,
        status: created.status,
        mentorUserId: input.mentorUserId || null,
        assistantUserId: input.assistantUserId || null,
      },
      metadata: { studentId: id },
    });
  }
  return created;
}

export function updateStudent(
  input: z.infer<typeof updateStudentSchema>,
  actorUserId?: string,
) {
  const existing = db.select().from(students).where(eq(students.id, input.id)).get();
  if (!existing) throw new Error("دانش‌آموز یافت نشد.");

  db.update(students)
    .set({
      gradeId: input.gradeId,
      groupId: input.groupId || null,
      status: input.status,
      updatedAt: nowIso(),
    })
    .where(eq(students.id, input.id))
    .run();

  setStaffAssignment(
    {
      studentId: input.id,
      staffUserId: input.mentorUserId || "",
      assignmentRole: ASSIGNMENT_ROLE.MENTOR,
    },
    actorUserId,
  );
  setStaffAssignment(
    {
      studentId: input.id,
      staffUserId: input.assistantUserId || "",
      assignmentRole: ASSIGNMENT_ROLE.ASSISTANT_MENTOR,
    },
    actorUserId,
  );

  const updated = getStudentById(input.id);
  if (actorUserId && updated) {
    recordAudit({
      actorUserId,
      entityType: "student",
      entityId: input.id,
      action: "update",
      before: {
        gradeId: existing.gradeId,
        groupId: existing.groupId,
        status: existing.status,
      },
      after: {
        gradeId: updated.gradeId,
        groupId: updated.groupId,
        status: updated.status,
        mentorUserId: input.mentorUserId || null,
        assistantUserId: input.assistantUserId || null,
      },
      metadata: { studentId: input.id },
    });
  }
  return updated;
}

export function setStudentStatus(id: string, status: string) {
  db.update(students).set({ status, updatedAt: nowIso() }).where(eq(students.id, id)).run();
}

/* ---------------------------------- پرونده رشد --------------------------------- */

export function getGrowthProfile(studentId: string) {
  return db
    .select()
    .from(growthProfiles)
    .where(eq(growthProfiles.studentId, studentId))
    .get();
}

export function upsertGrowthProfile(input: z.infer<typeof growthProfileSchema>) {
  const now = nowIso();
  const existing = getGrowthProfile(input.studentId);
  const patch = {
    interests: input.interests !== undefined ? input.interests || null : undefined,
    skills: input.skills !== undefined ? input.skills || null : undefined,
    academicStatus:
      input.academicStatus !== undefined ? input.academicStatus || null : undefined,
    overallNote: input.overallNote !== undefined ? input.overallNote || null : undefined,
    birthDate: input.birthDate !== undefined ? input.birthDate || null : undefined,
    nationalId: input.nationalId !== undefined ? input.nationalId || null : undefined,
    address: input.address !== undefined ? input.address || null : undefined,
    phone: input.phone !== undefined ? input.phone || null : undefined,
    avatarPath: input.avatarPath !== undefined ? input.avatarPath || null : undefined,
    siblingsJson: input.siblingsJson !== undefined ? input.siblingsJson || null : undefined,
    fatherName: input.fatherName !== undefined ? input.fatherName || null : undefined,
    fatherJob: input.fatherJob !== undefined ? input.fatherJob || null : undefined,
    fatherBirthDate:
      input.fatherBirthDate !== undefined ? input.fatherBirthDate || null : undefined,
    motherJob: input.motherJob !== undefined ? input.motherJob || null : undefined,
    fatherAlive:
      input.fatherAlive !== undefined ? boolFromForm(input.fatherAlive) : undefined,
    motherAlive:
      input.motherAlive !== undefined ? boolFromForm(input.motherAlive) : undefined,
    parentsLiveTogether:
      input.parentsLiveTogether !== undefined
        ? boolFromForm(input.parentsLiveTogether)
        : undefined,
    updatedAt: now,
  };

  const cleaned = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;

  if (existing) {
    db.update(growthProfiles)
      .set(cleaned)
      .where(eq(growthProfiles.studentId, input.studentId))
      .run();
  } else {
    db.insert(growthProfiles)
      .values({
        id: createId("gpf"),
        studentId: input.studentId,
        interests: null,
        skills: null,
        academicStatus: null,
        overallNote: null,
        birthDate: null,
        nationalId: null,
        address: null,
        phone: null,
        avatarPath: null,
        siblingsJson: null,
        fatherName: null,
        fatherJob: null,
        fatherBirthDate: null,
        motherJob: null,
        fatherAlive: null,
        motherAlive: null,
        parentsLiveTogether: null,
        updatedAt: now,
        ...cleaned,
      })
      .run();
  }

  return getGrowthProfile(input.studentId);
}

/** به‌روزرسانی فقط فیلدهای مجاز دانش‌آموز — اطلاعات والدین دست نمی‌خورد. */
export function updateStudentSelfProfile(input: z.infer<typeof studentSelfProfileSchema>) {
  return upsertGrowthProfile({
    studentId: input.studentId,
    birthDate: input.birthDate,
    nationalId: input.nationalId,
    address: input.address,
    phone: input.phone,
    avatarPath: input.avatarPath,
    siblingsJson: input.siblingsJson,
    interests: input.interests,
    skills: input.skills,
  });
}

/* -------------------------------- تخصیص مربی‌ها -------------------------------- */

/**
 * یک مربی فعال و یک کمک‌مربی فعال برای هر دانش‌آموز (OPEN_QUESTIONS).
 * تخصیص قبلی آرشیو می‌شود و رکورد جدید ثبت می‌گردد. staffUserId خالی یعنی فقط آرشیو.
 */
export function setStaffAssignment(
  input: z.infer<typeof assignStaffSchema>,
  actorUserId?: string,
) {
  const now = nowIso();
  const current = getActiveAssignment(input.studentId, input.assignmentRole);

  if (current && current.staffUserId === input.staffUserId) return current;

  if (input.staffUserId) {
    const expectedRole: RoleKey =
      input.assignmentRole === ASSIGNMENT_ROLE.MENTOR
        ? ROLE_KEYS.MENTOR
        : ROLE_KEYS.ASSISTANT_MENTOR;
    assertUserHasRole(
      input.staffUserId,
      expectedRole,
      "نقش کاربر انتخاب‌شده با نوع تخصیص هم‌خوانی ندارد.",
    );
  }

  if (current) {
    db.update(mentorAssignments)
      .set({ isActive: false, endedAt: now })
      .where(eq(mentorAssignments.id, current.id))
      .run();
  }

  // آرشیو مکالمات فعال با کمک‌مربی قبلی هنگام تغییر تخصیص (مکالمه مربی حفظ می‌شود)
  if (input.assignmentRole === ASSIGNMENT_ROLE.ASSISTANT_MENTOR && current) {
    const student = db.select().from(students).where(eq(students.id, input.studentId)).get();
    if (student?.userId) {
      db.update(chatConversations)
        .set({ status: CHAT_CONVERSATION_STATUS.ARCHIVED, archivedAt: now })
        .where(
          and(
            eq(chatConversations.studentUserId, student.userId),
            eq(chatConversations.staffUserId, current.staffUserId),
            eq(chatConversations.status, CHAT_CONVERSATION_STATUS.ACTIVE),
          ),
        )
        .run();
    }
  }

  if (!input.staffUserId) {
    if (actorUserId && current) {
      recordAudit({
        actorUserId,
        entityType: "mentor_assignment",
        entityId: current.id,
        action: "clear",
        before: {
          staffUserId: current.staffUserId,
          assignmentRole: current.assignmentRole,
        },
        metadata: { studentId: input.studentId, assignmentRole: input.assignmentRole },
      });
    }
    return undefined;
  }

  const id = createId("mas");
  db.insert(mentorAssignments)
    .values({
      id,
      studentId: input.studentId,
      staffUserId: input.staffUserId,
      assignmentRole: input.assignmentRole,
      isActive: true,
      startedAt: now,
      endedAt: null,
    })
    .run();

  const created = db.select().from(mentorAssignments).where(eq(mentorAssignments.id, id)).get();
  if (actorUserId && created) {
    recordAudit({
      actorUserId,
      entityType: "mentor_assignment",
      entityId: id,
      action: "assign",
      before: current
        ? { staffUserId: current.staffUserId, assignmentRole: current.assignmentRole }
        : undefined,
      after: {
        staffUserId: created.staffUserId,
        assignmentRole: created.assignmentRole,
      },
      metadata: { studentId: input.studentId, assignmentRole: input.assignmentRole },
    });
  }
  return created;
}

export function getActiveAssignment(studentId: string, assignmentRole: AssignmentRole) {
  return db
    .select()
    .from(mentorAssignments)
    .where(
      and(
        eq(mentorAssignments.studentId, studentId),
        eq(mentorAssignments.assignmentRole, assignmentRole),
        eq(mentorAssignments.isActive, true),
      ),
    )
    .get();
}

export function listAssignmentHistory(studentId: string) {
  return db
    .select({
      id: mentorAssignments.id,
      assignmentRole: mentorAssignments.assignmentRole,
      isActive: mentorAssignments.isActive,
      startedAt: mentorAssignments.startedAt,
      endedAt: mentorAssignments.endedAt,
      staffUserId: mentorAssignments.staffUserId,
      staffName: users.fullName,
    })
    .from(mentorAssignments)
    .innerJoin(users, eq(mentorAssignments.staffUserId, users.id))
    .where(eq(mentorAssignments.studentId, studentId))
    .orderBy(asc(mentorAssignments.startedAt))
    .all();
}

/* ---------------------------------- Scoping ---------------------------------- */

const ROLE_TO_ASSIGNMENT: Partial<Record<RoleKey, AssignmentRole>> = {
  [ROLE_KEYS.MENTOR]: ASSIGNMENT_ROLE.MENTOR,
  [ROLE_KEYS.ASSISTANT_MENTOR]: ASSIGNMENT_ROLE.ASSISTANT_MENTOR,
};

/**
 * شناسه دانش‌آموزانی که این کاربر ستادی به آن‌ها تخصیص فعال دارد.
 * Admin از این مسیر عبور نمی‌کند و دسترسی کامل دارد.
 */
export function getStudentIdsForStaff(userId: string, role: RoleKey): string[] {
  const assignmentRole = ROLE_TO_ASSIGNMENT[role];
  if (!assignmentRole) return [];

  return db
    .select({ studentId: mentorAssignments.studentId })
    .from(mentorAssignments)
    .where(
      and(
        eq(mentorAssignments.staffUserId, userId),
        eq(mentorAssignments.assignmentRole, assignmentRole),
        eq(mentorAssignments.isActive, true),
      ),
    )
    .all()
    .map((row) => row.studentId);
}

export function canStaffAccessStudent(userId: string, role: RoleKey, studentId: string) {
  if (role === ROLE_KEYS.ADMIN) return true;
  return getStudentIdsForStaff(userId, role).includes(studentId);
}

/** لیست دانش‌آموزان در محدوده نقش کاربر */
export function listStudentsForStaff(
  userId: string,
  role: RoleKey,
  filters: StudentFilters = {},
) {
  if (role === ROLE_KEYS.ADMIN) return listStudents(filters);
  return listStudents({ ...filters, studentIds: getStudentIdsForStaff(userId, role) });
}

export function countStudentsByStatus() {
  return db
    .select({ status: students.status, count: sql<number>`count(*)` })
    .from(students)
    .groupBy(students.status)
    .all();
}
