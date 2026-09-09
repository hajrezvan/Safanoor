"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/server/auth/guards";
import { NOTE_VISIBILITY, ROLE_KEYS, type NoteVisibility } from "@/lib/enums";
import { assertPermission, PERMISSIONS } from "@/server/authz/policy";
import {
  assertChatParticipant,
  convertMessageToAction,
  convertMessageToNote,
  getOrCreateConversationForStaff,
  getOrCreateConversationForStudent,
  markConversationRead,
  sendMessage,
  sendMessageSchema,
} from "@/server/modules/chat/service";
import { canStaffAccessStudent, getStudentById } from "@/server/modules/students/service";

export type SimpleState = { error?: string; success?: string };

function revalidateChatPaths(studentId?: string) {
  revalidatePath("/student/chat");
  revalidatePath("/student/messenger");
  revalidatePath("/student/messenger", "layout");
  revalidatePath("/staff/assistant/chat");
  revalidatePath("/staff/assistant/follow-ups");
  revalidatePath("/staff/assistant");
  if (studentId) {
    revalidatePath(`/staff/assistant/students/${studentId}`);
    revalidatePath(`/staff/mentor/students/${studentId}`);
  }
}

export async function ensureStudentChatAction(
  formData?: FormData,
): Promise<SimpleState & { conversationId?: string }> {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  assertPermission(user, PERMISSIONS.CHAT_USE);
  const staffUserId = formData ? String(formData.get("staffUserId") ?? "") || undefined : undefined;
  try {
    const conv = getOrCreateConversationForStudent(user.id, staffUserId);
    revalidateChatPaths();
    return { conversationId: conv.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "امکان شروع گفتگو نیست." };
  }
}

export async function openStaffChatAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState & { conversationId?: string }> {
  const user = await requireRole(
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.CHAT_USE);

  const studentUserId = String(formData.get("studentUserId") ?? "");
  if (!studentUserId) return { error: "دانش‌آموز انتخاب نشده است." };

  try {
    const conv = getOrCreateConversationForStaff(user.id, user.roleKey, studentUserId);
    revalidateChatPaths();
    return { conversationId: conv.id, success: "گفتگو آماده است." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ایجاد گفتگو" };
  }
}

export async function sendChatMessageAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireUser();
  assertPermission(user, PERMISSIONS.CHAT_USE);

  const parsed = sendMessageSchema.safeParse({
    conversationId: formData.get("conversationId"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: "پیام معتبر نیست." };

  try {
    assertChatParticipant(parsed.data.conversationId, user.id);
    sendMessage(parsed.data.conversationId, user.id, parsed.data.content);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ارسال پیام ناموفق بود." };
  }

  revalidateChatPaths();
  revalidatePath(`/staff/assistant/chat/${parsed.data.conversationId}`);
  return { success: "پیام ارسال شد." };
}

export async function markChatReadAction(formData: FormData) {
  const user = await requireUser();
  assertPermission(user, PERMISSIONS.CHAT_USE);
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!conversationId) return;
  try {
    markConversationRead(conversationId, user.id);
  } catch {
    return;
  }
  revalidateChatPaths();
  revalidatePath(`/staff/assistant/chat/${conversationId}`);
}

export async function convertChatMessageToNoteAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.NOTES_MANAGE);

  const messageId = String(formData.get("messageId") ?? "");
  const rawVisibility = String(formData.get("visibility") ?? NOTE_VISIBILITY.PRIVATE_STAFF);
  const visibility = (
    Object.values(NOTE_VISIBILITY) as string[]
  ).includes(rawVisibility)
    ? (rawVisibility as NoteVisibility)
    : NOTE_VISIBILITY.PRIVATE_STAFF;
  if (!messageId) return { error: "پیام مشخص نشده است." };

  try {
    const note = convertMessageToNote({
      messageId,
      actorUserId: user.id,
      visibility,
    });
    revalidateChatPaths(note.studentId);
    revalidatePath(`/staff/mentor/students/${note.studentId}`);
    revalidatePath(`/staff/assistant/students/${note.studentId}`);
    return { success: "یادداشت از پیام ساخته شد." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "تبدیل به یادداشت ناموفق بود." };
  }
}

export async function convertChatMessageToActionAction(
  _prev: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  const user = await requireRole(
    ROLE_KEYS.ASSISTANT_MENTOR,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ADMIN,
  );
  assertPermission(user, PERMISSIONS.PLANS_MANAGE);

  const messageId = String(formData.get("messageId") ?? "");
  const title = String(formData.get("title") ?? "") || undefined;
  const deadline = String(formData.get("deadline") ?? "") || undefined;
  if (!messageId) return { error: "پیام مشخص نشده است." };

  try {
    const action = convertMessageToAction({
      messageId,
      actorUserId: user.id,
      title,
      deadline,
    });
    if (!action) return { error: "ایجاد اقدام ناموفق بود." };
    revalidateChatPaths(action.studentId);
    revalidatePath(`/staff/mentor/students/${action.studentId}`);
    revalidatePath(`/staff/assistant/students/${action.studentId}`);
    revalidatePath("/student/actions");
    return { success: "اقدام از پیام ساخته شد." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "تبدیل به اقدام ناموفق بود." };
  }
}

export async function startChatWithStudentAction(formData: FormData) {
  const user = await requireRole(ROLE_KEYS.ASSISTANT_MENTOR, ROLE_KEYS.MENTOR);
  assertPermission(user, PERMISSIONS.CHAT_USE);
  const studentId = String(formData.get("studentId") ?? "");
  const student = getStudentById(studentId);
  if (!student?.userId) throw new Error("دانش‌آموز یافت نشد.");
  if (!canStaffAccessStudent(user.id, user.roleKey, studentId)) {
    throw new Error("این دانش‌آموز در محدوده شما نیست.");
  }
  const conv = getOrCreateConversationForStaff(user.id, user.roleKey, student.userId);
  revalidateChatPaths(studentId);
  return conv.id;
}
