"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { schoolAction, type SchoolState } from "@/server/actions/school";
import { Button } from "@/components/ui/button";

export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "checkbox"
    | "select"
    | "url"
    | "file";
  value?: string | number | boolean | null;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  hint?: string;
  accept?: string;
};
export function SchoolForm({
  operation,
  hidden = {},
  fields = [],
  submit = "ذخیره",
  destination,
  children,
}: {
  operation: string;
  hidden?: Record<string, string>;
  fields?: Field[];
  submit?: string;
  destination?: string;
  children?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState<SchoolState, FormData>(
    schoolAction,
    {},
  );
  const router = useRouter();
  useEffect(() => {
    if (state.success && destination && state.id)
      router.push(destination.replace(":id", state.id));
  }, [state, destination, router]);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="operation" value={operation} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <label
              key={f.name}
              className={`block space-y-1.5 text-sm ${f.type === "textarea" ? "sm:col-span-2" : ""}`}
            >
              <span className="font-medium">
                {f.label}
                {f.required ? " *" : ""}
              </span>
              {f.type === "checkbox" ? (
                <input
                  className="ms-3 size-4 accent-[var(--brand)]"
                  type="checkbox"
                  name={f.name}
                  defaultChecked={Boolean(f.value)}
                />
              ) : f.type === "select" ? (
                <select
                  name={f.name}
                  defaultValue={String(f.value ?? "")}
                  required={f.required}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5"
                >
                  <option value="">انتخاب کنید</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.name}
                  defaultValue={String(f.value ?? "")}
                  required={f.required}
                  rows={4}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 leading-7"
                />
              ) : (
                <input
                  name={f.name}
                  type={f.type === "url" ? "text" : (f.type ?? "text")}
                  dir={f.type === "url" ? "ltr" : undefined}
                  defaultValue={
                    f.type === "file" ? undefined : String(f.value ?? "")
                  }
                  accept={f.accept}
                  min={f.min}
                  max={f.max}
                  required={f.required}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5"
                />
              )}
              {f.hint && (
                <span className="block text-xs text-[var(--muted-foreground)]">
                  {f.hint}
                </span>
              )}
            </label>
          ))}
        </div>
      )}
      {children}
      {state.error && (
        <p
          role="alert"
          className="rounded-lg bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-[var(--brand)]">
          {state.success}
        </p>
      )}
      <Button disabled={pending} type="submit" size="sm">
        {pending ? "در حال انجام…" : submit}
      </Button>
    </form>
  );
}
