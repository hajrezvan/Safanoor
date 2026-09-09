import { AdminShell } from "@/components/patterns/admin-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BOOK_DIFFICULTY, ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { listBooks } from "@/server/modules/books/service";
import { createBookAction } from "@/server/actions/books";
export const runtime = "nodejs";
export default async function Page() {
  const user=await requireRole(ROLE_KEYS.ADMIN); const books=listBooks();
  async function submit(formData: FormData) { "use server"; await createBookAction({}, formData); }
  return <AdminShell user={user}><PageHeader title="کتاب‌ها" description="کتابخانه مستقل و منابع مطالعاتی"/>
    <Card className="mb-6"><CardHeader><CardTitle>کتاب جدید</CardTitle></CardHeader><CardContent><form action={submit} className="grid gap-3 md:grid-cols-4">
      <Input name="title" placeholder="عنوان" required/><Input name="author" placeholder="نویسنده"/><select name="difficulty" className="h-10 rounded-lg border bg-[var(--card)] px-3">{Object.values(BOOK_DIFFICULTY).map(v=><option key={v}>{v}</option>)}</select><Button>ثبت کتاب</Button>
    </form></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">{books.map(b=><Card key={b.id}><CardHeader><CardTitle>{b.title}</CardTitle></CardHeader><CardContent>{b.author || "نویسنده نامشخص"}</CardContent></Card>)}</div>
  </AdminShell>;
}
