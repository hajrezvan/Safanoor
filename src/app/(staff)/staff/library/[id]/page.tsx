import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { StatPillCard } from "@/components/patterns/stat-pill-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toFaDigits } from "@/lib/digits";
import {
  EXAM_RELATED_TYPE,
  READING_PLAN_STATUS_TITLES_FA,
  ROLE_KEYS,
} from "@/lib/enums";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import {
  bookDashboardStats,
  getBookById,
  listBookChapters,
  listReadersForBook,
} from "@/server/modules/books/service";
import { listExamBankQuestions, listExamsForBookChapters, listSubmissionsForExam } from "@/server/modules/exams/service";
import { createBookChapterAction, deleteBookChapterAction } from "@/server/actions/books";
import { createExamAction, reviewExamAction } from "@/server/actions/exams";

export const runtime = "nodejs";

export default async function StaffLibraryBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireRole(
    ROLE_KEYS.ADMIN,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
  );
  const { id } = await params;
  const { tab: tabRaw } = await searchParams;
  const tab = tabRaw === "chapters" || tabRaw === "dashboard" ? tabRaw : "readers";

  const book = getBookById(id);
  if (!book) notFound();

  const readers = listReadersForBook(id);
  const chapters = listBookChapters(id);
  const stats = bookDashboardStats(id);
  const exams = listExamsForBookChapters(chapters.map((c) => c.id));

  const tabs = [
    { key: "readers", label: "خوانندگان" },
    { key: "chapters", label: "فصل‌ها و آزمون‌ها" },
    { key: "dashboard", label: "داشبورد" },
  ] as const;

  async function addChapter(formData: FormData) {
    "use server";
    await createBookChapterAction({}, formData);
  }
  async function addExam(formData: FormData) {
    "use server";
    await createExamAction({}, formData);
  }
  async function review(formData: FormData) {
    "use server";
    await reviewExamAction({}, formData);
  }

  return (
    <StaffShell user={user} title={book.title}>
      <PageHeader title={book.title} description={book.author ?? undefined} />

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/staff/library/${id}?tab=${t.key}`}
            className={cn(
              buttonVariants({ variant: tab === t.key ? "default" : "outline", size: "sm" }),
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "dashboard" ? (
        <div className="flex flex-wrap gap-3">
          <StatPillCard label="خواننده" value={stats.readerCount} tone="teal" />
          <StatPillCard label="فصل" value={stats.chapterCount} tone="blue" />
          <StatPillCard label="میانگین پیشرفت" value={`${stats.avgProgress}٪`} tone="green" />
          <StatPillCard label="عقب‌افتاده" value={stats.overdue} tone="orange" />
          <StatPillCard label="تمام‌شده" value={stats.completed} tone="green" />
        </div>
      ) : null}

      {tab === "readers" ? (
        <div className="space-y-3">
          {readers.map((r) => (
            <Link
              key={r.id}
              href={`/staff/forces/${r.studentId}`}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <div>
                <p className="text-sm font-bold">{r.studentName}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {READING_PLAN_STATUS_TITLES_FA[r.status] ?? r.status}
                </p>
              </div>
              <span className="text-sm font-bold">{toFaDigits(r.progress)}٪</span>
            </Link>
          ))}
          {readers.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">خواننده‌ای نیست.</p>
          ) : null}
        </div>
      ) : null}

      {tab === "chapters" ? (
        <div className="space-y-8">
          {(user.roleKey === ROLE_KEYS.ADMIN || user.roleKey === ROLE_KEYS.MENTOR) && (
            <form action={addChapter} className="flex flex-wrap gap-2">
              <input type="hidden" name="bookId" value={id} />
              <Input name="title" placeholder="عنوان فصل جدید" required className="max-w-xs" />
              <Button type="submit" size="sm">
                افزودن فصل
              </Button>
            </form>
          )}

          <div className="space-y-4">
            {chapters.map((ch) => {
              const chapterExams = exams.filter((e) => e.relatedId === ch.id);
              return (
                <div
                  key={ch.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">
                      {toFaDigits(ch.ordering)}. {ch.title}
                    </p>
                    {(user.roleKey === ROLE_KEYS.ADMIN || user.roleKey === ROLE_KEYS.MENTOR) && (
                      <form action={deleteBookChapterAction}>
                        <input type="hidden" name="id" value={ch.id} />
                        <input type="hidden" name="bookId" value={id} />
                        <Button type="submit" size="sm" variant="outline">
                          حذف
                        </Button>
                      </form>
                    )}
                  </div>

                  {chapterExams.map((exam) => {
                    const submissions = listSubmissionsForExam(exam.id);
                    const bankSize = listExamBankQuestions(exam.id).length;
                    return (
                      <div key={exam.id} className="mb-3 rounded-xl bg-[var(--muted)] p-3">
                        <p className="text-sm font-medium">{exam.title}</p>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          بانک سوالات: {toFaDigits(bankSize)} · نمایش نمونه: {exam.prompt}
                        </p>
                        {exam.options.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-xs">
                            {exam.options.map((opt) => (
                              <li
                                key={opt.key}
                                className={
                                  opt.key === exam.correctOptionKey
                                    ? "font-bold text-[var(--accent-green)]"
                                    : ""
                                }
                              >
                                {opt.key}. {opt.text}
                                {opt.key === exam.correctOptionKey ? " ✓" : ""}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <div className="mt-2 space-y-2">
                          {submissions.map((s) => (
                            <form
                              key={s.id}
                              action={review}
                              className="flex flex-wrap items-end gap-2 rounded-lg bg-[var(--card)] p-2"
                            >
                              <input type="hidden" name="submissionId" value={s.id} />
                              <div className="min-w-0 flex-1 text-xs">
                                <p className="font-medium">{s.studentName}</p>
                                <p className="line-clamp-2 text-[var(--muted-foreground)]">
                                  {s.selectedOption
                                    ? `گزینه ${toFaDigits(s.selectedOption)}${s.answerText ? ` — ${s.answerText}` : ""}`
                                    : s.answerText}
                                  {s.score != null ? ` · نمره ${toFaDigits(s.score)}` : ""}
                                </p>
                              </div>
                              <Input
                                name="score"
                                type="number"
                                min={0}
                                max={100}
                                placeholder="نمره"
                                className="w-20"
                                defaultValue={s.score ?? undefined}
                              />
                              <Input name="feedback" placeholder="بازخورد" className="w-40" />
                              <Button type="submit" size="sm">
                                ثبت بازبینی
                              </Button>
                            </form>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {(user.roleKey === ROLE_KEYS.ADMIN || user.roleKey === ROLE_KEYS.MENTOR) && (
                    <form
                      action={addExam}
                      className="mt-2 space-y-2 rounded-xl border border-dashed border-[var(--border)] p-3"
                    >
                      <input type="hidden" name="relatedType" value={EXAM_RELATED_TYPE.BOOK_CHAPTER} />
                      <input type="hidden" name="relatedId" value={ch.id} />
                      <Input name="title" placeholder="عنوان آزمون" required />
                      <Input name="prompt" placeholder="متن سوال" required />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input name="optionA" placeholder="گزینه A" required />
                        <Input name="optionB" placeholder="گزینه B" required />
                        <Input name="optionC" placeholder="گزینه C" />
                        <Input name="optionD" placeholder="گزینه D" />
                      </div>
                      <label className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[var(--muted-foreground)]">پاسخ صحیح:</span>
                        <select
                          name="correctOptionKey"
                          required
                          defaultValue="A"
                          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                        </select>
                      </label>
                      <Button type="submit" size="sm" variant="secondary">
                        افزودن آزمون تستی
                      </Button>
                    </form>
                  )}
                </div>
              );
            })}
            {chapters.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">فصلی ثبت نشده.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </StaffShell>
  );
}
