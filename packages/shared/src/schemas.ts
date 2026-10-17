import { z } from 'zod';
import { ageOn, latinDigits, normalizePhone, validGregorianDate, validNationalId } from './locale';

z.setErrorMap(() => ({message:'اطلاعات این فیلد معتبر نیست.'}));

export const orgLevels = ['supervisor', 'head_mentor', 'mentor', 'assistant', 'member'] as const;
export type OrgLevel = (typeof orgLevels)[number];
export const phoneSchema = z.string().transform(normalizePhone).refine((value) => /^\+989\d{9}$/.test(value), 'شماره همراه معتبر وارد کنید.');
export const passwordSchema = z.string().min(12, 'رمز عبور باید دست‌کم ۱۲ نویسه باشد.').max(128, 'رمز عبور بیش از حد طولانی است.');
export const loginSchema = z.object({ login: phoneSchema, password: z.string().min(1, 'رمز عبور را وارد کنید.').max(128) });
export const personSchema = z.object({
  firstName: z.string().trim().min(2, 'نام را کامل وارد کنید.').max(80),
  lastName: z.string().trim().min(2, 'نام خانوادگی را کامل وارد کنید.').max(100),
  fatherName: z.string().trim().min(2, 'نام پدر را وارد کنید.').max(80),
  birthDate: z.string().refine(validGregorianDate, 'تاریخ تولد معتبر انتخاب کنید.').refine((value) => { try { const age = ageOn(value); return age >= 0 && age <= 120; } catch { return false; } }, 'تاریخ تولد معتبر انتخاب کنید.'),
  nationalId: z.string().transform(latinDigits).refine(validNationalId, 'کد ملی معتبر وارد کنید.'),
  phone: phoneSchema,
  orgLevel: z.enum(orgLevels),
  groupId: z.string().uuid('گروه را انتخاب کنید.').optional(),
});
export type PersonInput = z.infer<typeof personSchema>;
export const groupSchema = z.object({ name: z.string().trim().min(2, 'نام گروه را وارد کنید.').max(100), ownerPersonId: z.string().uuid('مربی را انتخاب کنید.') });
export const consentItems = ['system', 'retention', 'public_photos', 'public_audio', 'parent_summary_notice'] as const;
export type ConsentItem = (typeof consentItems)[number];
export const requiredConsentItems: readonly ConsentItem[] = ['system', 'retention', 'parent_summary_notice'];
export const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().max(100).optional() });
