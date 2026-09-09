"use client";

import { useActionState, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Drawer } from "@/components/patterns/drawer";
import { InfoFieldRow } from "@/components/patterns/info-field-row";
import { ProfileSectionCard } from "@/components/patterns/profile-section-card";
import { SiblingRows } from "@/components/students/growth-profile-form";
import { Button } from "@/components/ui/button";
import { formatSiblingFa, parseSiblingsJson } from "@/lib/siblings";
import {
  updateStudentSelfProfileAction,
  type ActionState,
} from "@/server/actions/students";
import type { GrowthProfile } from "@/db/schema";

const initial: ActionState = {};

type StudentFamilyInfoCardProps = {
  studentId: string;
  profile?: Partial<GrowthProfile>;
};

export function StudentFamilyInfoCard({
  studentId,
  profile,
}: StudentFamilyInfoCardProps) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateStudentSelfProfileAction, initial);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state.success]);

  const siblings = parseSiblingsJson(profile?.siblingsJson);

  return (
    <>
      <ProfileSectionCard
        title="اطلاعات خانوادگی"
        icon="⌂"
        accent="orange"
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
            aria-label="ویرایش خواهر و برادر"
            onClick={() => setOpen(true)}
          >
            <Icon icon="mdi:pencil" className="size-5" aria-hidden />
          </Button>
        }
      >
        <InfoFieldRow accent="teal">
          خواهر و برادر:{" "}
          {siblings.length > 0 ? (
            siblings.map((s) => formatSiblingFa(s)).join("؛ ")
          ) : (
            <span className="text-[var(--muted-foreground)]">ثبت نشده</span>
          )}
        </InfoFieldRow>
        <InfoFieldRow accent="teal">
          شغل پدر:{" "}
          {profile?.fatherJob?.trim() ? (
            profile.fatherJob
          ) : (
            <span className="text-[var(--muted-foreground)]">ثبت نشده</span>
          )}
        </InfoFieldRow>
        <InfoFieldRow accent="teal">
          شغل مادر:{" "}
          {profile?.motherJob?.trim() ? (
            profile.motherJob
          ) : (
            <span className="text-[var(--muted-foreground)]">ثبت نشده</span>
          )}
        </InfoFieldRow>
      </ProfileSectionCard>

      <Drawer open={open} title="ویرایش خواهر و برادر" onClose={() => setOpen(false)}>
        <form action={action} className="space-y-6">
          <input type="hidden" name="studentId" value={studentId} />

          <SiblingRows profile={profile} />

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
