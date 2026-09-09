import { FilterBar } from "@/components/patterns/filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STUDENT_STATUS, STUDENT_STATUS_TITLES_FA } from "@/lib/enums";

const selectClass =
  "flex h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm";

export type StudentFilterParams = {
  q?: string;
  grade?: string;
  group?: string;
  mentor?: string;
  assistant?: string;
  status?: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[var(--muted-foreground)]">{label}</label>
      {children}
    </div>
  );
}

export function StudentFilterBar({
  params,
  grades,
  groups,
  mentors,
  assistants,
}: {
  params: StudentFilterParams;
  grades: { id: string; titleFa: string }[];
  groups: { id: string; title: string; gradeTitleFa: string }[];
  mentors?: { id: string; fullName: string }[];
  assistants?: { id: string; fullName: string }[];
}) {
  return (
    <FilterBar>
      <form className="flex flex-wrap items-end gap-3">
        <Field label="جستجو">
          <Input name="q" defaultValue={params.q ?? ""} placeholder="نام دانش‌آموز" />
        </Field>

        <Field label="پایه">
          <select name="grade" defaultValue={params.grade ?? ""} className={selectClass}>
            <option value="">همه</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.titleFa}
              </option>
            ))}
          </select>
        </Field>

        <Field label="گروه">
          <select name="group" defaultValue={params.group ?? ""} className={selectClass}>
            <option value="">همه</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.gradeTitleFa} — {group.title}
              </option>
            ))}
          </select>
        </Field>

        {mentors ? (
          <Field label="مربی">
            <select name="mentor" defaultValue={params.mentor ?? ""} className={selectClass}>
              <option value="">همه</option>
              {mentors.map((mentor) => (
                <option key={mentor.id} value={mentor.id}>
                  {mentor.fullName}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {assistants ? (
          <Field label="کمک‌مربی">
            <select
              name="assistant"
              defaultValue={params.assistant ?? ""}
              className={selectClass}
            >
              <option value="">همه</option>
              {assistants.map((assistant) => (
                <option key={assistant.id} value={assistant.id}>
                  {assistant.fullName}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="وضعیت">
          <select name="status" defaultValue={params.status ?? ""} className={selectClass}>
            <option value="">همه</option>
            {Object.values(STUDENT_STATUS).map((status) => (
              <option key={status} value={status}>
                {STUDENT_STATUS_TITLES_FA[status]}
              </option>
            ))}
          </select>
        </Field>

        <Button type="submit" variant="secondary">
          اعمال فیلتر
        </Button>
      </form>
    </FilterBar>
  );
}
