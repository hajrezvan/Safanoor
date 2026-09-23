import { getCurrentUser } from "@/server/auth/session";
import { scopedEnrollments } from "@/server/modules/school/service";
export const runtime = "nodejs";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  try {
    const rows = scopedEnrollments(user);
    const escape = (value: string) =>
      `"${(/^[=+@\-\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
    const csv = [
      [
        "متربی",
        "دوره",
        "وضعیت",
        "درس‌های تکمیل‌شده",
        "کل درس‌ها",
        "درصد پیشرفت",
      ],
      ...rows.map((r) => [
        r.studentName,
        r.course?.title ?? "",
        r.status,
        String(r.progress.completed),
        String(r.progress.total),
        String(r.progress.percent),
      ]),
    ]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="school-report.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
}
