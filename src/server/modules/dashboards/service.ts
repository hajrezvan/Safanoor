/**
 * تجمیع داده‌های داشبوردهای عملیاتی — صفحات نازک بمانند و از N+1 پرهیز شود.
 */
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEvents, grades, students, users } from "@/db/schema";
import { todayIsoDate } from "@/lib/date";
import {
  ACTIVITY_ASSIGNMENT_STATUS,
  COURSE_STATUS,
  READING_PLAN_STATUS,
  ROLE_KEYS,
} from "@/lib/enums";
import {
  listAssignmentsForStaffScope,
  listAssignmentsForStudent,
} from "@/server/modules/activities/service";
import { listReadingPlansForStudent } from "@/server/modules/books/service";
import { countUnreadForUser } from "@/server/modules/chat/service";
import { listCourses } from "@/server/modules/courses/service";
import { getAssistantFollowUpDashboard } from "@/server/modules/followups/service";
import {
  listActions,
  listOverdueActions,
  summarizeActions,
  summarizeGoals,
  type ActionListItem,
} from "@/server/modules/plans/service";
import { listOpenReferralsForMentor, listReferrals } from "@/server/modules/referrals/service";
import { listSessions, type MentoringSessionListItem } from "@/server/modules/sessions/service";
import {
  getStudentByUserId,
  getStudentIdsForStaff,
  listStudentsForStaff,
  type StudentListItem,
} from "@/server/modules/students/service";
import { countUsersByRole } from "@/server/modules/users/service";

function datePart(value: string | null | undefined) {
  return value?.slice(0, 10) ?? null;
}

function addDaysIso(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekEndIso(today = todayIsoDate()) {
  return addDaysIso(today, 6);
}

function isInWeek(deadline: string | null | undefined, today: string, weekEnd: string) {
  const d = datePart(deadline);
  return Boolean(d && d >= today && d <= weekEnd);
}

function filterSessionsInRange(
  sessions: MentoringSessionListItem[],
  from: string,
  to: string,
) {
  return sessions.filter((s) => {
    const d = datePart(s.date);
    return Boolean(d && d >= from && d <= to);
  });
}

/* --------------------------------- Student -------------------------------- */

export type StudentDashboard = {
  student: StudentListItem | null;
  todayActions: ActionListItem[];
  weekActions: ActionListItem[];
  overdueActions: ActionListItem[];
  courses: { id: string; title: string; description: string | null }[];
  books: {
    id: string;
    bookTitle: string;
    progress: number;
    status: string;
    deadline: string | null;
  }[];
  activities: {
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
  }[];
  deadlines: {
    kind: "action" | "activity" | "book";
    id: string;
    title: string;
    deadline: string;
    href: string;
  }[];
  progress: {
    actionsOpen: number;
    actionsDone: number;
    actionsOverdue: number;
    goalsActive: number;
    goalsCompleted: number;
    booksInProgress: number;
    activitiesOpen: number;
  };
  unreadChatCount: number;
};

export function getStudentDashboard(userId: string): StudentDashboard {
  const student = getStudentByUserId(userId) ?? null;
  const today = todayIsoDate();
  const weekEnd = weekEndIso(today);
  const unreadChatCount = countUnreadForUser(userId);

  if (!student) {
    return {
      student: null,
      todayActions: [],
      weekActions: [],
      overdueActions: [],
      courses: [],
      books: [],
      activities: [],
      deadlines: [],
      progress: {
        actionsOpen: 0,
        actionsDone: 0,
        actionsOverdue: 0,
        goalsActive: 0,
        goalsCompleted: 0,
        booksInProgress: 0,
        activitiesOpen: 0,
      },
      unreadChatCount,
    };
  }

  const openActions = listActions({
    assigneeUserId: userId,
    studentId: student.id,
    openOnly: true,
  });
  const allActionsSummary = summarizeActions({
    assigneeUserId: userId,
    studentId: student.id,
  });
  const goals = summarizeGoals(student.id);

  const todayActions = openActions.filter((a) => datePart(a.deadline) === today);
  const weekActions = openActions.filter((a) => isInWeek(a.deadline, today, weekEnd));
  const overdueActions = openActions.filter((a) => a.isOverdue);

  const courses = listCourses()
    .filter((c) => c.status === COURSE_STATUS.PUBLISHED)
    .map((c) => ({ id: c.id, title: c.title, description: c.description }));

  const readingPlans = listReadingPlansForStudent(student.id).filter(
    (p) => p.status !== READING_PLAN_STATUS.COMPLETED,
  );
  const books = readingPlans.map((p) => ({
    id: p.id,
    bookTitle: p.bookTitle,
    progress: p.progress,
    status: p.status,
    deadline: p.deadline,
  }));

  const openActivityStatuses = new Set<string>([
    ACTIVITY_ASSIGNMENT_STATUS.ASSIGNED,
    ACTIVITY_ASSIGNMENT_STATUS.IN_PROGRESS,
    ACTIVITY_ASSIGNMENT_STATUS.OVERDUE,
    ACTIVITY_ASSIGNMENT_STATUS.SUBMITTED,
  ]);
  const activities = listAssignmentsForStudent(student.id)
    .filter((a) => openActivityStatuses.has(a.status))
    .map((a) => ({
      id: a.id,
      title: a.activityTitle,
      status: a.status,
      dueDate: a.dueDate,
    }));

  const deadlines: StudentDashboard["deadlines"] = [];
  for (const a of openActions) {
    const d = datePart(a.deadline);
    if (d) {
      deadlines.push({
        kind: "action",
        id: a.id,
        title: a.title,
        deadline: d,
        href: "/student/actions",
      });
    }
  }
  for (const a of activities) {
    const d = datePart(a.dueDate);
    if (d) {
      deadlines.push({
        kind: "activity",
        id: a.id,
        title: a.title,
        deadline: d,
        href: "/student/activities",
      });
    }
  }
  for (const b of books) {
    const d = datePart(b.deadline);
    if (d) {
      deadlines.push({
        kind: "book",
        id: b.id,
        title: b.bookTitle,
        deadline: d,
        href: "/student/books",
      });
    }
  }
  deadlines.sort((a, b) => a.deadline.localeCompare(b.deadline));

  return {
    student,
    todayActions,
    weekActions,
    overdueActions,
    courses,
    books,
    activities,
    deadlines: deadlines.slice(0, 8),
    progress: {
      actionsOpen: allActionsSummary.todo + allActionsSummary.inProgress,
      actionsDone: allActionsSummary.done,
      actionsOverdue: allActionsSummary.overdue,
      goalsActive: goals.active,
      goalsCompleted: goals.completed,
      booksInProgress: books.length,
      activitiesOpen: activities.length,
    },
    unreadChatCount,
  };
}

/* -------------------------------- Assistant ------------------------------- */

export type AssistantDashboard = {
  followUp: ReturnType<typeof getAssistantFollowUpDashboard>;
  studentCount: number;
  needingFollowUpCount: number;
  todaySessions: MentoringSessionListItem[];
  weekSessions: MentoringSessionListItem[];
  recentSubmissions: {
    id: string;
    title: string;
    studentName: string | null;
    submittedAt: string | null;
    studentId: string;
  }[];
};

export function getAssistantDashboard(userId: string): AssistantDashboard {
  const followUp = getAssistantFollowUpDashboard(userId);
  const scopedStudents = listStudentsForStaff(userId, ROLE_KEYS.ASSISTANT_MENTOR);
  const studentIds = scopedStudents.map((s) => s.id);
  const today = todayIsoDate();
  const weekEnd = weekEndIso(today);

  const sessions = listSessions({ staffUserId: userId, studentIds });
  const todaySessions = filterSessionsInRange(sessions, today, today);
  const weekSessions = filterSessionsInRange(sessions, today, weekEnd);

  const needingFollowUpCount =
    followUp.summary.overdueCount +
    followUp.summary.quietStudentCount +
    followUp.summary.pendingReviewCount +
    followUp.unreadChats.length;

  const recentSubmissions = listAssignmentsForStaffScope(userId, ROLE_KEYS.ASSISTANT_MENTOR)
    .filter((a) => a.status === ACTIVITY_ASSIGNMENT_STATUS.SUBMITTED)
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      title: a.activityTitle,
      studentName: a.studentName,
      submittedAt: a.submittedAt,
      studentId: a.studentId,
    }));

  return {
    followUp,
    studentCount: scopedStudents.length,
    needingFollowUpCount,
    todaySessions,
    weekSessions,
    recentSubmissions,
  };
}

/* --------------------------------- Mentor --------------------------------- */

export type MentorDashboard = {
  students: StudentListItem[];
  assistants: { userId: string; name: string; studentCount: number }[];
  needingAttention: {
    studentId: string;
    studentName: string | null;
    reasons: string[];
  }[];
  openReferrals: ReturnType<typeof listOpenReferralsForMentor>;
  overdueActions: ActionListItem[];
  recentSessions: MentoringSessionListItem[];
};

export function getMentorDashboard(userId: string): MentorDashboard {
  const studentIds = getStudentIdsForStaff(userId, ROLE_KEYS.MENTOR);
  const scopedStudents = listStudentsForStaff(userId, ROLE_KEYS.MENTOR);
  const openReferrals = listOpenReferralsForMentor(userId).filter((r) =>
    studentIds.includes(r.studentId),
  );
  const overdueActions = listOverdueActions(studentIds);
  const recentSessions = listSessions({ studentIds }).slice(0, 6);

  const assistantMap = new Map<string, { userId: string; name: string; studentCount: number }>();
  for (const s of scopedStudents) {
    if (!s.assistantUserId) continue;
    const existing = assistantMap.get(s.assistantUserId);
    if (existing) {
      existing.studentCount += 1;
    } else {
      assistantMap.set(s.assistantUserId, {
        userId: s.assistantUserId,
        name: s.assistantName ?? "کمک‌مربی",
        studentCount: 1,
      });
    }
  }

  const overdueByStudent = new Map<string, number>();
  for (const a of overdueActions) {
    overdueByStudent.set(a.studentId, (overdueByStudent.get(a.studentId) ?? 0) + 1);
  }
  const referralByStudent = new Map<string, number>();
  for (const r of openReferrals) {
    referralByStudent.set(r.studentId, (referralByStudent.get(r.studentId) ?? 0) + 1);
  }

  const needingAttention = scopedStudents
    .map((s) => {
      const reasons: string[] = [];
      const overdue = overdueByStudent.get(s.id) ?? 0;
      const referrals = referralByStudent.get(s.id) ?? 0;
      if (overdue > 0) reasons.push(`${overdue} اقدام عقب‌افتاده`);
      if (referrals > 0) reasons.push(`${referrals} ارجاع باز`);
      return {
        studentId: s.id,
        studentName: s.fullName,
        reasons,
      };
    })
    .filter((row) => row.reasons.length > 0)
    .slice(0, 8);

  return {
    students: scopedStudents,
    assistants: [...assistantMap.values()].sort((a, b) => b.studentCount - a.studentCount),
    needingAttention,
    openReferrals,
    overdueActions,
    recentSessions,
  };
}

/* ---------------------------------- Admin --------------------------------- */

export type AdminDashboard = {
  roleCounts: {
    student: number;
    mentor: number;
    assistant: number;
    admin: number;
  };
  studentsByGrade: { gradeId: string | null; titleFa: string; count: number }[];
  openActionsCount: number;
  overdueActionsCount: number;
  openReferralsCount: number;
  recentSessions: MentoringSessionListItem[];
  recentAudit: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorName: string | null;
    createdAt: string;
  }[];
  auditAvailable: boolean;
};

export function getAdminDashboard(): AdminDashboard {
  const counts = countUsersByRole();
  const byRole = Object.fromEntries(counts.map((c) => [c.roleKey, Number(c.count)]));

  const gradeRows = db
    .select({
      gradeId: students.gradeId,
      titleFa: grades.titleFa,
      ordering: grades.ordering,
      count: sql<number>`count(*)`,
    })
    .from(students)
    .leftJoin(grades, eq(students.gradeId, grades.id))
    .groupBy(students.gradeId, grades.titleFa, grades.ordering)
    .orderBy(sql`coalesce(${grades.ordering}, 999)`)
    .all();

  const studentsByGrade = gradeRows.map((row) => ({
    gradeId: row.gradeId,
    titleFa: row.titleFa ?? "بدون پایه",
    count: Number(row.count),
  }));

  const openActionsCount = listActions({ openOnly: true }).length;
  const overdueActionsCount = listOverdueActions().length;
  const openReferralsCount = listReferrals({ openOnly: true }).length;
  const recentSessions = listSessions().slice(0, 6);

  let recentAudit: AdminDashboard["recentAudit"] = [];
  let auditAvailable = false;
  try {
    recentAudit = db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        actorName: users.fullName,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .leftJoin(users, eq(auditEvents.actorUserId, users.id))
      .orderBy(desc(auditEvents.createdAt))
      .limit(8)
      .all();
    auditAvailable = true;
  } catch {
    auditAvailable = false;
    recentAudit = [];
  }

  // اگر جدول هست ولی خالی است، بخش را نمایش نده تا UI شلوغ نشود
  if (auditAvailable && recentAudit.length === 0) {
    auditAvailable = false;
  }

  return {
    roleCounts: {
      student: byRole[ROLE_KEYS.STUDENT] ?? 0,
      mentor: byRole[ROLE_KEYS.MENTOR] ?? 0,
      assistant: byRole[ROLE_KEYS.ASSISTANT_MENTOR] ?? 0,
      admin: byRole[ROLE_KEYS.ADMIN] ?? 0,
    },
    studentsByGrade,
    openActionsCount,
    overdueActionsCount,
    openReferralsCount,
    recentSessions,
    recentAudit,
    auditAvailable,
  };
}
