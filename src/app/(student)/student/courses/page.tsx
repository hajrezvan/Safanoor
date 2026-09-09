import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COURSE_STATUS, ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { listCourses, listLessons } from "@/server/modules/courses/service";
export const runtime="nodejs";
export default async function Page(){
 const user=await requireRole(ROLE_KEYS.STUDENT); const courses=listCourses().filter(c=>c.status===COURSE_STATUS.PUBLISHED);
 return <StudentShell user={user}><PageHeader title="دوره‌ها" description="دوره‌های آموزشی منتشرشده"/>
 <div className="grid gap-4">{courses.map(c=><Card key={c.id}><CardHeader><CardTitle>{c.title}</CardTitle></CardHeader><CardContent><p>{c.description}</p><ul className="mt-3 list-inside list-decimal">{listLessons(c.id).map(l=><li key={l.id}>{l.title}</li>)}</ul></CardContent></Card>)}</div>
 </StudentShell>;
}
