"use client";

import { useActionState, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Drawer } from "@/components/patterns/drawer";
import { InfoFieldRow } from "@/components/patterns/info-field-row";
import { ProfileSectionCard } from "@/components/patterns/profile-section-card";
import { PersonalFields } from "@/components/students/growth-profile-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDateFa } from "@/lib/date";
import { toFaDigits } from "@/lib/digits";
import { STUDENT_STATUS_TITLES_FA } from "@/lib/enums";
import {
  updateStudentSelfProfileAction,
  type ActionState,
} from "@/server/actions/students";
import type { GrowthProfile } from "@/db/schema";

const initial: ActionState = {};

const textareaClass =
  "min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

type StudentBasicInfoCardProps = {
  studentId: string;
  fullName: string;
  gradeTitleFa: string | null;
  status: string;
  profile?: Partial<GrowthProfile>;
};

export function StudentBasicInfoCard({
  studentId,
  fullName,
  gradeTitleFa,
  status,
  profile,
}: StudentBasicInfoCardProps) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateStudentSelfProfileAction, initial);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  const statusLabel = STUDENT_STATUS_TITLES_FA[status] ?? status;

  return (
    <>
      <ProfileSectionCard
        title="اطلاعات پایه"
        icon="👤"
        accent="teal"
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
            aria-label="ویرایش اطلاعات شخصی"
            onClick={() => setOpen(true)}
          >
            <Icon icon="mdi:pencil" className="size-5" aria-hidden />
          </Button>
        }
      >
        <InfoFieldRow accent="teal">نام: {fullName}</InfoFieldRow>

        {profile?.phone?.trim() ? (
          <InfoFieldRow accent="teal">تلفن: {toFaDigits(profile.phone)}</InfoFieldRow>
        ) : null}
        {profile?.birthDate?.trim() ? (
          <InfoFieldRow accent="blue">
            تاریخ تولد: {formatDateFa(profile.birthDate)}
          </InfoFieldRow>
        ) : null}
        {profile?.nationalId?.trim() ? (
          <InfoFieldRow accent="green">کد ملی: {toFaDigits(profile.nationalId)}</InfoFieldRow>
        ) : null}
        {profile?.address?.trim() ? (
          <InfoFieldRow accent="orange">آدرس: {toFaDigits(profile.address)}</InfoFieldRow>
        ) : null}
        {profile?.interests?.trim() ? (
          <InfoFieldRow accent="blue">علایق: {profile.interests}</InfoFieldRow>
        ) : null}
        {profile?.skills?.trim() ? (
          <InfoFieldRow accent="green">مهارت‌ها: {profile.skills}</InfoFieldRow>
        ) : null}
      </ProfileSectionCard>

      <Drawer open={open} title="ویرایش اطلاعات شخصی" onClose={() => setOpen(false)}>
        <form action={action} className="space-y-6">
          <input type="hidden" name="studentId" value={studentId} />

          <div className="space-y-2 rounded-xl bg-[var(--muted)] px-3 py-3 text-sm leading-7 text-[var(--muted-foreground)]">
            <p>نام: {fullName}</p>
            <p>پایه: {gradeTitleFa ?? "—"}</p>
            <p>وضعیت: {statusLabel}</p>
            <p className="text-xs">این موارد توسط سامانه تعیین می‌شوند و قابل ویرایش نیستند.</p>
          </div>

          <PersonalFields profile={profile} />

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="interests">علایق</Label>
              <textarea
                id="interests"
                name="interests"
                defaultValue={profile?.interests ?? ""}
                className={textareaClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">مهارت‌ها</Label>
              <textarea
                id="skills"
                name="skills"
                defaultValue={profile?.skills ?? ""}
                className={textareaClass}
              />
            </div>
          </div>

          {state.error ? (
            <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "در حال ذخیره…" : "ذخیره"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              انصراف
            </Button>
          </div>
        </form>
      </Drawer>
    </>
  );
}
