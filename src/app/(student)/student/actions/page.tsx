import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ACTION_STATUS, ACTION_STATUS_TITLES_FA, ACTION_STATUS_TRANSITIONS, ROLE_KEYS, type ActionStatus } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { getStudentByUserId } from "@/server/modules/students/service";
import { listActionsForAssignee } from "@/server/modules/plans/service";
import { transitionActionAction } from "@/server/actions/plans";
export const runtime="nodejs";
export default async function Page(){
 const user=await requireRole(ROLE_KEYS.STUDENT); const student=getStudentByUserId(user.id); const items=student?listActionsForAssignee(user.id):[];
 async function transition(formData: FormData) { "use server"; await transitionActionAction({}, formData); }
 return <StudentShell user={user}><PageHeader title="اقدامات من" description="کارهای جاری و موعدها"/>
 <div className="grid gap-4">{items.map(a=><Card key={a.id}><CardHeader><CardTitle>{a.title}</CardTitle></CardHeader><CardContent>
 <p className="mb-3">{ACTION_STATUS_TITLES_FA[a.status as ActionStatus]??a.status}{a.deadline?` — مهلت ${a.deadline}`:""}</p>
 <div className="flex flex-wrap gap-2">{ACTION_STATUS_TRANSITIONS[a.status as ActionStatus]?.map(status=><form action={transition} key={status}><input type="hidden" name="id" value={a.id}/><input type="hidden" name="status" value={status}/><Button size="sm" variant={status===ACTION_STATUS.DONE?"default":"outline"}>{ACTION_STATUS_TITLES_FA[status]}</Button></form>)}</div>
 </CardContent></Card>)}</div></StudentShell>;
}
