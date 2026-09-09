import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toFaDigits } from "@/lib/digits";
import { READING_PLAN_STATUS_TITLES_FA, ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { getStudentByUserId } from "@/server/modules/students/service";
import { listBooks, listReadingPlansForStudent } from "@/server/modules/books/service";

export const runtime = "nodejs";

export default async function Page() {
  const user = await requireRole(ROLE_KEYS.STUDENT);
  const student = getStudentByUserId(user.id);
  const plans = student ? listReadingPlansForStudent(student.id) : [];
  const books = listBooks();

  return (
    <StudentShell user={user}>
      <PageHeader title="کتاب‌های من" description="برنامه‌های مطالعه و کتابخانه" />
      <div className="grid gap-4">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle>{plan.bookTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                {READING_PLAN_STATUS_TITLES_FA[plan.status] ?? plan.status} — پیشرفت{" "}
                {toFaDigits(plan.progress)}٪
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">کتابخانه</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {books.map((b) => (
          <Card key={b.id}>
            <CardContent className="pt-6">
              {b.title} {b.author ? `— ${b.author}` : ""}
            </CardContent>
          </Card>
        ))}
      </div>
    </StudentShell>
  );
}
