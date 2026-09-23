import type { Field } from "./form";
export const publicationOptions = [
  { value: "draft", label: "پیش‌نویس" },
  { value: "published", label: "منتشرشده" },
];
export const statusLabels: Record<string, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  closed: "بسته",
  active: "فعال",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
  submitted: "منتظر بررسی مربی",
  in_progress: "در حال پاسخ",
  graded: "تصحیح‌شده",
  pending: "منتظر تأیید",
  approved: "تأییدشده",
  rejected: "ردشده",
};
export function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]">
      <h2 className="mb-4 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}
export function statusField(value = "draft"): Field {
  return {
    name: "status",
    label: "وضعیت انتشار",
    type: "select",
    options: publicationOptions,
    value,
    required: true,
  };
}
export const orderField: Field = {
  name: "ordering",
  label: "ترتیب نمایش",
  type: "number",
  value: 0,
  min: 0,
};
