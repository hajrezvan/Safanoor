"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateStudentAction, type ActionState } from "@/server/actions/students";
import { STUDENT_STATUS, STUDENT_STATUS_TITLES_FA } from "@/lib/enums";
import type { StudentListItem } from "@/server/modules/students/service";

const initial: ActionState = {};

const selectClass =
  "flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";

type Option = { id: string; fullName: string };

export function EditStudentForm({
  student,
  grades,
  groups,
  mentors,
  assistants,
}: {
  student: StudentListItem;
  grades: { id: string; titleFa: string }[];
  groups: { id: string; title: string; gradeTitleFa: string }[];
  mentors: Option[];
  assistants: Option[];
}) {
  const [state, action, pending] = useActionState(updateStudentAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ویرایش اطلاعات و تخصیص</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={student.id} />

          <div className="space-y-2">
            <Label htmlFor="gradeId">پایه</Label>
            <select
              id="gradeId"
              name="gradeId"
              className={selectClass}
              defaultValue={student.gradeId ?? ""}
              required
            >
              <option value="">انتخاب کنید</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.titleFa}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupId">گروه</Label>
            <select
              id="groupId"
              name="groupId"
              className={selectClass}
              defaultValue={student.groupId ?? ""}
            >
              <option value="">بدون گروه</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.gradeTitleFa} — {group.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mentorUserId">مربی فعال</Label>
            <select
              id="mentorUserId"
              name="mentorUserId"
              className={selectClass}
              defaultValue={student.mentorUserId ?? ""}
            >
              <option value="">تخصیص نشده</option>
              {mentors.map((mentor) => (
                <option key={mentor.id} value={mentor.id}>
                  {mentor.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assistantUserId">کمک‌مربی فعال</Label>
            <select
              id="assistantUserId"
              name="assistantUserId"
              className={selectClass}
              defaultValue={student.assistantUserId ?? ""}
            >
              <option value="">تخصیص نشده</option>
              {assistants.map((assistant) => (
                <option key={assistant.id} value={assistant.id}>
                  {assistant.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">وضعیت</Label>
            <select
              id="status"
              name="status"
              className={selectClass}
              defaultValue={student.status}
            >
              {Object.values(STUDENT_STATUS).map((status) => (
                <option key={status} value={status}>
                  {STUDENT_STATUS_TITLES_FA[status]}
                </option>
              ))}
            </select>
          </div>

          {state.error ? (
            <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)] sm:col-span-2">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm sm:col-span-2">
              {state.success}
            </p>
          ) : null}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
