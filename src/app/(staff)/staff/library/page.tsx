import Link from "next/link";
import { StaffShell } from "@/components/patterns/staff-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { BOOK_DIFFICULTY_TITLES_FA, ROLE_KEYS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guards";
import { listBooks } from "@/server/modules/books/service";

export const runtime = "nodejs";

export default async function StaffLibraryPage() {
  const user = await requireRole(
    ROLE_KEYS.ADMIN,
    ROLE_KEYS.MENTOR,
    ROLE_KEYS.ASSISTANT_MENTOR,
  );
  const books = listBooks();

  return (
    <StaffShell user={user} title="کتابخانه">
      <PageHeader
        title="کتابخانه"
        description="کتاب‌ها، خوانندگان، فصل‌ها و آزمون‌ها"
        actions={
          <Link href="/admin/books" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            مدیریت کتاب‌ها
          </Link>
        }
      />

      {books.length === 0 ? (
        <EmptyState title="کتابی نیست" description="از مسیر مدیریت کتاب‌ها، کتاب جدید اضافه کنید." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {books.map((b) => (
            <Link
              key={b.id}
              href={`/staff/library/${b.id}`}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90"
            >
              <p className="text-sm font-bold">{b.title}</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {b.author ?? "نویسنده نامشخص"}
                {b.difficulty
                  ? ` · ${BOOK_DIFFICULTY_TITLES_FA[b.difficulty] ?? b.difficulty}`
                  : ""}
              </p>
              <p className="mt-2 text-xs text-[var(--brand)]">{b.planCount} خواننده</p>
            </Link>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
