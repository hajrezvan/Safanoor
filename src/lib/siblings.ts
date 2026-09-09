import { toFaDigits } from "@/lib/digits";

export type SiblingInfo = {
  relation: "brother" | "sister";
  relative: "older" | "younger";
  ageDiffYears: number;
};

export function parseSiblingsJson(raw: string | null | undefined): SiblingInfo[] {
  if (!raw?.trim()) return [];
  try {
    const data = JSON.parse(raw) as SiblingInfo[];
    if (!Array.isArray(data)) return [];
    return data.filter(
      (s) =>
        (s.relation === "brother" || s.relation === "sister") &&
        (s.relative === "older" || s.relative === "younger") &&
        typeof s.ageDiffYears === "number" &&
        Number.isFinite(s.ageDiffYears),
    );
  } catch {
    return [];
  }
}

export function formatSiblingFa(s: SiblingInfo): string {
  const who = s.relation === "brother" ? "برادر" : "خواهر";
  const rel = s.relative === "older" ? "بزرگ‌تر" : "کوچک‌تر";
  return `${who} ${rel} — اختلاف سن ${toFaDigits(s.ageDiffYears)} سال`;
}

export function aliveLabel(v: boolean | null | undefined): string {
  if (v === true) return "زنده";
  if (v === false) return "فوت‌شده";
  return "—";
}

export function parentsTogetherLabel(v: boolean | null | undefined): string {
  if (v === true) return "با هم زندگی می‌کنند";
  if (v === false) return "جدا زندگی می‌کنند";
  return "—";
}
