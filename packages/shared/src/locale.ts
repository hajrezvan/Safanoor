import { isValidJalaaliDate, toGregorian, toJalaali } from 'jalaali-js';

export const MONEY_UNIT = 'toman' as const;
export const WEEK_STARTS_ON = 6 as const;

export function latinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.includes(digit) ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit) : '٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

export function normalizePersian(value: string): string {
  return latinDigits(value).normalize('NFKC').replace(/ي|ى/g, 'ی').replace(/ك/g, 'ک').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[\u200c\u200d]/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('fa-IR');
}

export function normalizePhone(value: string): string {
  const digits = latinDigits(value).replace(/[^0-9]/g, '');
  if (/^09\d{9}$/.test(digits)) return `+98${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+98${digits}`;
  if (/^989\d{9}$/.test(digits)) return `+${digits}`;
  if (/^00989\d{9}$/.test(digits)) return `+${digits.slice(2)}`;
  return value;
}

export function validNationalId(value: string): boolean {
  const id = latinDigits(value);
  if (!/^\d{10}$/.test(id) || /^(\d)\1{9}$/.test(id)) return false;
  const remainder = [...id.slice(0, 9)].reduce((sum, digit, index) => sum + Number(digit) * (10 - index), 0) % 11;
  return Number(id[9]) === (remainder < 2 ? remainder : 11 - remainder);
}

export function validGregorianDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function ageOn(birthDate: string, at: Date = new Date()): number {
  if (!validGregorianDate(birthDate)) throw new Error('Invalid birth date');
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  if (at.getUTCMonth() < birth.getUTCMonth() || (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

export function jalaliToGregorian(value: string): string {
  const parts = latinDigits(value).split(/[/-]/).map(Number);
  const [year, month, day] = parts;
  if (parts.length !== 3 || !Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || !isValidJalaaliDate(year, month, day)) throw new Error('Invalid Jalali date');
  const result = toGregorian(year, month, day);
  return `${result.gy}-${String(result.gm).padStart(2, '0')}-${String(result.gd).padStart(2, '0')}`;
}

export function gregorianToJalali(value: string): string {
  if (!validGregorianDate(value)) throw new Error('Invalid Gregorian date');
  const [year, month, day] = value.split('-').map(Number);
  const result = toJalaali(year, month, day);
  return `${result.jy}/${String(result.jm).padStart(2, '0')}/${String(result.jd).padStart(2, '0')}`;
}

export function calendarDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function formatDate(value: string, includeTime = false): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric', ...(includeTime ? { hour: '2-digit', minute: '2-digit' } as const : {}), timeZone: 'Asia/Tehran' }).format(new Date(value));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fa-IR').format(value);
}
