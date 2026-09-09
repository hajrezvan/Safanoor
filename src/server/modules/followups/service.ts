import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { actions } from "@/db/schema";
import { todayIsoDate } from "@/lib/date";
import { ACTION_CLOSED_STATUSES, ACTION_STATUS, type ActionStatus } from "@/lib/enums";
import { listOverdueActions, listActions, type ActionListItem } from "@/server/modules/plans/actions";
import { listStaffConversations, listStudentsWithoutRecentChat } from "@/server/modules/chat/service";
import { listReferrals, type ReferralListItem } from "@/server/modules/referrals/service";
import { getStudentIdsForStaff } from "@/server/modules/students/service";
import { ROLE_KEYS } from "@/lib/enums";

export type FollowUpFilter = "overdue" | "due_today" | "upcoming" | "all";

export type FollowUpDashboard = {
  overdueActions: ActionListItem[];
  dueTodayActions: ActionListItem[];
  upcomingActions: ActionListItem[];
  pendingReviewActions: ActionListItem[];
  openReferrals: ReferralListItem[];
  unreadChats: { conversationId: string; studentName: string | null; unreadCount: number }[];
  studentsWithoutRecentChat: {
    studentId: string;
    studentName: string | null;
    lastMessageAt: string | null;
  }[];
  summary: {
    overdueCount: number;
    dueTodayCount: number;
    upcomingCount: number;
    openReferralCount: number;
    unreadChatCount: number;
    quietStudentCount: number;
    pendingReviewCount: number;
  };
};

function isOpenAction(status: string) {
  return !ACTION_CLOSED_STATUSES.includes(status as ActionStatus);
}

function datePart(value: string | null | undefined) {
  return value?.slice(0, 10) ?? null;
}

/** داشبورد پیگیری کمک‌مربی */
export function getAssistantFollowUpDashboard(
  assistantUserId: string,
  opts: { quietDays?: number } = {},
): FollowUpDashboard {
  const quietDays = opts.quietDays ?? 7;
  const studentIds = getStudentIdsForStaff(assistantUserId, ROLE_KEYS.ASSISTANT_MENTOR);
  const today = todayIsoDate();

  const scopedActions = listActions({
    studentIds,
    openOnly: true,
  });

  const overdueActions = listOverdueActions(studentIds);
  const dueTodayActions = scopedActions.filter(
    (a) => isOpenAction(a.status) && datePart(a.deadline) === today,
  );
  const upcomingActions = scopedActions.filter((a) => {
    const d = datePart(a.deadline);
    return Boolean(d && d > today);
  });

  /** اقدامات با نتیجه ثبت‌شده که هنوز بازخورد مربی ندارند — نیازمند مرور */
  const pendingReviewActions = listActions({ studentIds }).filter(
    (a) =>
      a.status === ACTION_STATUS.DONE &&
      Boolean(a.result?.trim()) &&
      !a.mentorFeedback?.trim(),
  );

  const openReferrals = listReferrals({ studentIds, openOnly: true });

  const conversations = listStaffConversations(assistantUserId);
  const unreadChats = conversations
    .filter((c) => Number(c.unreadCount) > 0)
    .map((c) => ({
      conversationId: c.id,
      studentName: c.studentName,
      unreadCount: Number(c.unreadCount),
    }));

  const studentsWithoutRecentChat = listStudentsWithoutRecentChat(studentIds, quietDays);

  return {
    overdueActions,
    dueTodayActions,
    upcomingActions,
    pendingReviewActions,
    openReferrals,
    unreadChats,
    studentsWithoutRecentChat,
    summary: {
      overdueCount: overdueActions.length,
      dueTodayCount: dueTodayActions.length,
      upcomingCount: upcomingActions.length,
      openReferralCount: openReferrals.length,
      unreadChatCount: unreadChats.reduce((s, c) => s + c.unreadCount, 0),
      quietStudentCount: studentsWithoutRecentChat.length,
      pendingReviewCount: pendingReviewActions.length,
    },
  };
}

export function filterFollowUpActions(
  dashboard: FollowUpDashboard,
  filter: FollowUpFilter,
): ActionListItem[] {
  switch (filter) {
    case "overdue":
      return dashboard.overdueActions;
    case "due_today":
      return dashboard.dueTodayActions;
    case "upcoming":
      return dashboard.upcomingActions;
    default:
      return [
        ...dashboard.overdueActions,
        ...dashboard.dueTodayActions.filter(
          (a) => !dashboard.overdueActions.some((o) => o.id === a.id),
        ),
        ...dashboard.upcomingActions,
      ];
  }
}

/** شمارش اقدامات باز با مهلت امروز برای یک مجموعه دانش‌آموز */
export function countActionsDueToday(studentIds: string[]) {
  if (studentIds.length === 0) return 0;
  const today = todayIsoDate();
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(actions)
    .where(
      and(
        inArray(actions.studentId, studentIds),
        eq(actions.deadline, today),
        sql`${actions.status} not in (${sql.join(
          ACTION_CLOSED_STATUSES.map((s) => sql`${s}`),
          sql`, `,
        )})`,
      ),
    )
    .get();
  return Number(row?.count ?? 0);
}
