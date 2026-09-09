import { StudentShell } from "@/components/patterns/student-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GOAL_STATUS_TITLES_FA, PLAN_STATUS_TITLES_FA, ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { getStudentByUserId } from "@/server/modules/students/service";
import { listGoals, listPlans } from "@/server/modules/plans/service";
export const runtime="nodejs";
export default async function Page(){
 const user=await requireRole(ROLE_KEYS.STUDENT); const student=getStudentByUserId(user.id);
 const plans=student?listPlans({studentId:student.id}):[]; const goals=student?listGoals({studentId:student.id}):[];
 return <StudentShell user={user}><PageHeader title="برنامه من" description="اهداف و برنامه فردی"/>
 <div className="grid gap-4 md:grid-cols-2">{plans.map(p=><Card key={p.id}><CardHeader><CardTitle>{p.title}</CardTitle></CardHeader><CardContent>{PLAN_STATUS_TITLES_FA[p.status as keyof typeof PLAN_STATUS_TITLES_FA]??p.status}<p>{p.description}</p></CardContent></Card>)}</div>
 <h2 className="mb-3 mt-8 text-lg font-bold">اهداف</h2>{goals.map(g=><Card className="mb-3" key={g.id}><CardContent className="pt-6"><strong>{g.title}</strong> — {GOAL_STATUS_TITLES_FA[g.status as keyof typeof GOAL_STATUS_TITLES_FA]??g.status}</CardContent></Card>)}
 </StudentShell>;
}
