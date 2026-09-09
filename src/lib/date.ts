/**
 * تاریخ‌ها در DB به صورت UTC ISO ذخیره می‌شوند.
 * نمایش جلالی از طریق این ماژول انجام می‌شود (قابل تعویض).
 */

import { toFaDigits } from "@/lib/digits";

/** نمایش ساده تاریخ/زمان به فارسی با Intl (جلالی در runtimeهای مدرن) */
export function formatDateFa(iso: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const formatted = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  }).format(date);

  return toFaDigits(formatted);
}

/** تاریخ امروز به شکل `YYYY-MM-DD` — مقدار پیش‌فرض ورودی‌های تاریخ */
export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/** آیا تاریخ داده‌شده پیش از امروز است؟ مقایسه فقط روی بخش تاریخ انجام می‌شود. */
export function isPastDate(value: string | null | undefined, today = todayIsoDate()) {
  if (!value) return false;
  return value.slice(0, 10) < today;
}

export function formatDateTimeFa(iso: string) {
  return formatDateFa(iso, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
