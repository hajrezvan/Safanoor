"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updateGrowthProfileAction,
  updateStudentSelfProfileAction,
  type ActionState,
} from "@/server/actions/students";
import type { GrowthProfile } from "@/db/schema";
import { parseSiblingsJson } from "@/lib/siblings";

const initial: ActionState = {};

const textareaClass =
  "min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

const selectClass =
  "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";

function boolSelectValue(v: boolean | null | undefined) {
  if (v === true) return "true";
  if (v === false) return "false";
  return "";
}

export function SiblingRows({ profile }: { profile?: Partial<GrowthProfile> }) {
  const siblings = parseSiblingsJson(profile?.siblingsJson);
  while (siblings.length < 3) {
    siblings.push({ relation: "brother", relative: "younger", ageDiffYears: NaN });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold">خواهر و برادر</p>
      <p className="text-xs text-[var(--muted-foreground)]">
        برای هر نفر نسبت، بزرگ‌تر/کوچک‌تر و اختلاف سنی (سال) را وارد کنید.
      </p>
      {siblings.slice(0, 5).map((s, i) => (
        <div
          key={i}
          className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3 md:grid-cols-3"
        >
          <select
            name={`siblingRelation_${i}`}
            className={selectClass}
            defaultValue={Number.isFinite(s.ageDiffYears) ? s.relation : ""}
          >
            <option value="">نسبت</option>
            <option value="brother">برادر</option>
            <option value="sister">خواهر</option>
          </select>
          <select
            name={`siblingRelative_${i}`}
            className={selectClass}
            defaultValue={Number.isFinite(s.ageDiffYears) ? s.relative : ""}
          >
            <option value="">وضعیت سنی</option>
            <option value="older">بزرگ‌تر از من</option>
            <option value="younger">کوچک‌تر از من</option>
          </select>
          <Input
            name={`siblingAgeDiff_${i}`}
            type="number"
            min={0}
            placeholder="اختلاف سن (سال)"
            defaultValue={Number.isFinite(s.ageDiffYears) ? s.ageDiffYears : ""}
          />
        </div>
      ))}
      <div className="grid gap-2 rounded-xl border border-dashed border-[var(--border)] p-3 md:grid-cols-3">
        <select name="siblingRelation_5" className={selectClass} defaultValue="">
          <option value="">نسبت (جدید)</option>
          <option value="brother">برادر</option>
          <option value="sister">خواهر</option>
        </select>
        <select name="siblingRelative_5" className={selectClass} defaultValue="">
          <option value="">وضعیت سنی</option>
          <option value="older">بزرگ‌تر</option>
          <option value="younger">کوچک‌تر</option>
        </select>
        <Input name="siblingAgeDiff_5" type="number" min={0} placeholder="اختلاف سن" />
      </div>
    </div>
  );
}

export function PersonalFields({ profile }: { profile?: Partial<GrowthProfile> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="birthDate">تاریخ تولد</Label>
        <Input id="birthDate" name="birthDate" type="date" defaultValue={profile?.birthDate ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nationalId">کد ملی</Label>
        <Input id="nationalId" name="nationalId" defaultValue={profile?.nationalId ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">شماره تماس</Label>
        <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="avatarPath">آواتار (مسیر فایل یا URL)</Label>
        <Input
          id="avatarPath"
          name="avatarPath"
          defaultValue={profile?.avatarPath ?? ""}
          placeholder="/uploads/avatars/..."
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="address">آدرس</Label>
        <Input id="address" name="address" defaultValue={profile?.address ?? ""} />
      </div>
    </div>
  );
}

export function GrowthProfileForm({
  studentId,
  profile,
  variant = "staff",
}: {
  studentId: string;
  profile?: Partial<GrowthProfile>;
  /** student: فقط اطلاعات فردی؛ staff: فردی + والدین + رشد */
  variant?: "staff" | "student";
}) {
  const actionFn =
    variant === "student" ? updateStudentSelfProfileAction : updateGrowthProfileAction;
  const [state, action, pending] = useActionState(actionFn, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {variant === "student"
            ? "تکمیل اطلاعات شخصی من"
            : "ویرایش پرونده (فردی + والدین + رشد)"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-6">
          <input type="hidden" name="studentId" value={studentId} />

          {variant === "staff" ? (
            <p className="rounded-xl bg-[var(--muted)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
              اطلاعات فردی معمولاً توسط خود دانش‌آموز تکمیل می‌شود. بخش والدین فقط برای مربی/کمک‌مربی
              است و برای دانش‌آموز نمایش داده نمی‌شود.
            </p>
          ) : (
            <p className="rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-xs text-[var(--brand)]">
              این اطلاعات در پرونده شما برای مربی قابل مشاهده است. اطلاعات والدین را مربی تکمیل
              می‌کند و در پنل شما نمایش داده نمی‌شود.
            </p>
          )}

          <PersonalFields profile={profile} />
          <SiblingRows profile={profile} />

          {variant === "student" ? (
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
          ) : null}

          {variant === "staff" ? (
            <>
              <div className="space-y-3 border-t border-[var(--border)] pt-4">
                <p className="text-sm font-bold text-[var(--accent-orange)]">
                  اطلاعات والدین (فقط staff — مخفی از دانش‌آموز)
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fatherName">نام پدر</Label>
                    <Input
                      id="fatherName"
                      name="fatherName"
                      defaultValue={profile?.fatherName ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherBirthDate">تاریخ تولد پدر</Label>
                    <Input
                      id="fatherBirthDate"
                      name="fatherBirthDate"
                      type="date"
                      defaultValue={profile?.fatherBirthDate ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherJob">شغل پدر</Label>
                    <Input id="fatherJob" name="fatherJob" defaultValue={profile?.fatherJob ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherJob">شغل مادر</Label>
                    <Input id="motherJob" name="motherJob" defaultValue={profile?.motherJob ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherAlive">وضعیت پدر</Label>
                    <select
                      id="fatherAlive"
                      name="fatherAlive"
                      className={selectClass}
                      defaultValue={boolSelectValue(profile?.fatherAlive)}
                    >
                      <option value="">نامشخص</option>
                      <option value="true">زنده</option>
                      <option value="false">فوت‌شده</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motherAlive">وضعیت مادر</Label>
                    <select
                      id="motherAlive"
                      name="motherAlive"
                      className={selectClass}
                      defaultValue={boolSelectValue(profile?.motherAlive)}
                    >
                      <option value="">نامشخص</option>
                      <option value="true">زنده</option>
                      <option value="false">فوت‌شده</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="parentsLiveTogether">زندگی مشترک والدین</Label>
                    <select
                      id="parentsLiveTogether"
                      name="parentsLiveTogether"
                      className={selectClass}
                      defaultValue={boolSelectValue(profile?.parentsLiveTogether)}
                    >
                      <option value="">نامشخص</option>
                      <option value="true">با هم زندگی می‌کنند</option>
                      <option value="false">جدا زندگی می‌کنند</option>
                    </select>
                  </div>
                </div>
              </div>

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
              <div className="space-y-2">
                <Label htmlFor="academicStatus">وضعیت تحصیلی</Label>
                <textarea
                  id="academicStatus"
                  name="academicStatus"
                  defaultValue={profile?.academicStatus ?? ""}
                  className={textareaClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overallNote">جمع‌بندی مربی</Label>
                <textarea
                  id="overallNote"
                  name="overallNote"
                  defaultValue={profile?.overallNote ?? ""}
                  className={textareaClass}
                />
              </div>
            </>
          ) : null}

          {state.error ? (
            <p className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm">{state.success}</p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? "در حال ذخیره…" : "ذخیره"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
