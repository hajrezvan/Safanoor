const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const;

/** Convert Latin digits 0–9 to Persian ۰–۹ for user-facing display. */
export function toFaDigits(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

/** Format a number for Persian UI (digits only; no grouping). */
export function formatNumberFa(n: number): string {
  return toFaDigits(n);
}
