import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { InfoFieldRow } from "@/components/patterns/info-field-row";
import { ProfileSectionCard } from "@/components/patterns/profile-section-card";
import { StudentBasicInfoCard } from "@/components/students/student-basic-info-card";
import { StudentFamilyInfoCard } from "@/components/students/student-family-info-card";
import { Button } from "@/components/ui/button";
import { ROLE_KEYS } from "@/lib/enums";
import { logoutAction } from "@/server/actions/auth";
import { requireRole } from "@/server/auth/guards";
import {
  getGrowthProfile,
  getStudentByUserId,
} from "@/server/modules/students/service";

export const runtime = "nodejs";

export default async function StudentProfilePage() {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  const student = getStudentByUserId(user.id);

  if (!student) {
    return (
      <StudentShell user={user} title="پروفایل">
        <PageHeader title="پروفایل" />
        <EmptyState
          title="پرونده شما هنوز ساخته نشده"
          description="مدیر یا مربی پس از ثبت اطلاعات پایه، پرونده رشد شما را فعال می‌کند."
        />
        <form action={logoutAction} className="mt-8">
          <Button type="submit" variant="danger" className="w-full">
            خروج
          </Button>
        </form>
      </StudentShell>
    );
  }

  const profile = getGrowthProfile(student.id);
  // فیلدهای فردی + شغل والدین (بدون بقیه پرونده والدین / overallNote / academicStatus)
  const safeProfile = profile
    ? {
        id: profile.id,
        studentId: profile.studentId,
        birthDate: profile.birthDate,
        nationalId: profile.nationalId,
        address: profile.address,
        phone: profile.phone,
        avatarPath: profile.avatarPath,
        siblingsJson: profile.siblingsJson,
        fatherJob: profile.fatherJob,
        motherJob: profile.motherJob,
        interests: profile.interests,
        skills: profile.skills,
        updatedAt: profile.updatedAt,
      }
    : undefined;
  const avatarSrc = safeProfile?.avatarPath?.trim()
    ? safeProfile.avatarPath.startsWith("http") || safeProfile.avatarPath.startsWith("/")
      ? safeProfile.avatarPath
      : `/uploads/${safeProfile.avatarPath}`
    : null;

  return (
    <StudentShell user={user} title="پروفایل">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-soft)] text-xl font-bold text-[var(--brand)]">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} alt="" className="size-full object-cover" />
          ) : (
            student.fullName.slice(0, 1)
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold">{student.fullName}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {student.gradeTitleFa ?? "بدون پایه"}
            {student.groupTitle ? ` · ${student.groupTitle}` : ""}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <StudentBasicInfoCard
          studentId={student.id}
          fullName={student.fullName}
          gradeTitleFa={student.gradeTitleFa}
          status={student.status}
          profile={safeProfile}
        />

        <StudentFamilyInfoCard studentId={student.id} profile={safeProfile} />

        <ProfileSectionCard title="تیم پشتیبانی" icon="👥" accent="orange">
          <InfoFieldRow accent="green">
            گروه: {student.groupTitle ?? "—"}
          </InfoFieldRow>
          <InfoFieldRow accent="orange">
            مربی: {student.mentorName ?? "تخصیص داده نشده"}
          </InfoFieldRow>
          <InfoFieldRow accent="teal">
            کمک‌مربی: {student.assistantName ?? "تخصیص داده نشده"}
          </InfoFieldRow>
        </ProfileSectionCard>

        <form action={logoutAction} className="pt-2">
          <Button type="submit" variant="danger" className="w-full">
            خروج
          </Button>
        </form>
      </div>
    </StudentShell>
  );
}
