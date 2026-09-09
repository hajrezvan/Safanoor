import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { roles, users } from "@/db/schema";
import { ROLE_KEYS, type RoleKey } from "@/lib/enums";
import { listStaffConversations } from "@/server/modules/chat/service";
import { listNotesForStaff } from "@/server/modules/notes/service";
import {
  getStudentIdsForStaff,
  listStudentsForStaff,
  type StudentListItem,
} from "@/server/modules/students/service";

export type AssistantListItem = {
  userId: string;
  fullName: string;
  username: string;
  studentCount: number;
  isActive: boolean;
};

export type AssistantDetail = {
  user: {
    id: string;
    fullName: string;
    username: string;
    email: string | null;
    isActive: boolean;
  };
  students: StudentListItem[];
  conversations: ReturnType<typeof listStaffConversations>;
  notes: ReturnType<typeof listNotesForStaff>;
};

/**
 * فهرست کمک‌مربیان با تعداد دانش‌آموز فعال.
 * admin/mentor: همه؛ assistant فقط خود.
 */
export function listAssistants(viewer: {
  id: string;
  roleKey: RoleKey;
}): AssistantListItem[] {
  if (viewer.roleKey === ROLE_KEYS.ASSISTANT_MENTOR) {
    const self = db
      .select({
        id: users.id,
        fullName: users.fullName,
        username: users.username,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, viewer.id))
      .get();
    if (!self) return [];
    return [
      {
        userId: self.id,
        fullName: self.fullName,
        username: self.username,
        studentCount: getStudentIdsForStaff(self.id, ROLE_KEYS.ASSISTANT_MENTOR).length,
        isActive: self.isActive,
      },
    ];
  }

  if (
    viewer.roleKey !== ROLE_KEYS.ADMIN &&
    viewer.roleKey !== ROLE_KEYS.MENTOR
  ) {
    return [];
  }

  const rows = db
    .select({
      id: users.id,
      fullName: users.fullName,
      username: users.username,
      isActive: users.isActive,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(roles.key, ROLE_KEYS.ASSISTANT_MENTOR))
    .all();

  return rows.map((row) => ({
    userId: row.id,
    fullName: row.fullName,
    username: row.username,
    isActive: row.isActive,
    studentCount: getStudentIdsForStaff(row.id, ROLE_KEYS.ASSISTANT_MENTOR).length,
  }));
}

/**
 * جزئیات کمک‌مربی: دانش‌آموزان، چت‌ها و یادداشت‌ها.
 * دامنه: admin/mentor همه؛ کمک‌مربی فقط خود.
 */
export function getAssistantDetail(
  assistantUserId: string,
  viewer: { id: string; roleKey: RoleKey },
): AssistantDetail | undefined {
  if (
    viewer.roleKey === ROLE_KEYS.ASSISTANT_MENTOR &&
    viewer.id !== assistantUserId
  ) {
    return undefined;
  }

  if (
    viewer.roleKey !== ROLE_KEYS.ADMIN &&
    viewer.roleKey !== ROLE_KEYS.MENTOR &&
    viewer.roleKey !== ROLE_KEYS.ASSISTANT_MENTOR
  ) {
    return undefined;
  }

  const user = db
    .select({
      id: users.id,
      fullName: users.fullName,
      username: users.username,
      email: users.email,
      isActive: users.isActive,
      roleKey: roles.key,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, assistantUserId))
    .get();

  if (!user || user.roleKey !== ROLE_KEYS.ASSISTANT_MENTOR) return undefined;

  const students = listStudentsForStaff(assistantUserId, ROLE_KEYS.ASSISTANT_MENTOR);
  const conversations = listStaffConversations(assistantUserId);
  const studentIds = getStudentIdsForStaff(assistantUserId, ROLE_KEYS.ASSISTANT_MENTOR);
  const notes = listNotesForStaff(
    assistantUserId,
    ROLE_KEYS.ASSISTANT_MENTOR,
    studentIds,
  );

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      isActive: user.isActive,
    },
    students,
    conversations,
    notes,
  };
}
