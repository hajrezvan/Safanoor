import { z } from 'zod';
import { ageOn, latinDigits, normalizePhone, validGregorianDate, validNationalId } from './locale';

z.setErrorMap(() => ({message:'اطلاعات این فیلد معتبر نیست.'}));

export const orgLevels = ['supervisor', 'head_mentor', 'mentor', 'assistant', 'member'] as const;
export type OrgLevel = (typeof orgLevels)[number];
export const phoneSchema = z.string().transform(normalizePhone).refine((value) => /^\+989\d{9}$/.test(value), 'شماره همراه معتبر وارد کنید.');
export const passwordSchema = z.string().min(12, 'رمز عبور باید دست‌کم ۱۲ نویسه باشد.').max(128, 'رمز عبور بیش از حد طولانی است.');
export const loginSchema = z.object({ login: phoneSchema, password: z.string().min(1, 'رمز عبور را وارد کنید.').max(128) });
const optionalText = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([schema, z.literal('')])
    .optional()
    .transform((value): z.output<T> | undefined =>
      value === '' || value === undefined ? undefined : (value as z.output<T>),
    );
export const personSchema = z.object({
  firstName: z.string().trim().min(2, 'نام را کامل وارد کنید.').max(80),
  lastName: z.string().trim().min(2, 'نام خانوادگی را کامل وارد کنید.').max(100),
  fatherName: optionalText(z.string().trim().min(2, 'نام پدر را وارد کنید.').max(80)),
  birthDate: optionalText(
    z
      .string()
      .refine(validGregorianDate, 'تاریخ تولد معتبر انتخاب کنید.')
      .refine((value) => {
        try {
          const age = ageOn(value);
          return age >= 0 && age <= 120;
        } catch {
          return false;
        }
      }, 'تاریخ تولد معتبر انتخاب کنید.'),
  ),
  nationalId: optionalText(z.string().transform(latinDigits).refine(validNationalId, 'کد ملی معتبر وارد کنید.')),
  phone: phoneSchema,
  orgLevel: z.enum(orgLevels),
  groupId: z.string().uuid('گروه را انتخاب کنید.').optional(),
});
export type PersonInput = z.infer<typeof personSchema>;
export const personImportSchema = personSchema.extend({
  fatherName: z.string().trim().min(2, 'نام پدر را وارد کنید.').max(80),
  birthDate: z
    .string()
    .refine(validGregorianDate, 'تاریخ تولد معتبر انتخاب کنید.')
    .refine((value) => {
      try {
        const age = ageOn(value);
        return age >= 0 && age <= 120;
      } catch {
        return false;
      }
    }, 'تاریخ تولد معتبر انتخاب کنید.'),
  nationalId: z.string().transform(latinDigits).refine(validNationalId, 'کد ملی معتبر وارد کنید.'),
});
export const groupSchema = z.object({ name: z.string().trim().min(2, 'نام گروه را وارد کنید.').max(100), ownerPersonId: z.string().uuid('مربی را انتخاب کنید.') });
export const studyPathSchema = z.object({
  title: z.string().trim().min(2, 'عنوان سیر مطالعاتی را وارد کنید.').max(200),
  description: optionalText(z.string().trim().max(2000)),
});
export type StudyPathInput = z.infer<typeof studyPathSchema>;
export const studyPathItemSchema = z.object({
  totalPages: z.coerce.number().int().min(1).max(100000),
  bookTitle: z.string().trim().min(1, 'عنوان کتاب را وارد کنید.').max(300),
  bookAuthor: optionalText(z.string().trim().max(200)),
  notes: optionalText(z.string().trim().max(2000)),
});
export type StudyPathItemInput = z.infer<typeof studyPathItemSchema>;
export const programKinds = ['camp', 'custom'] as const;
export type ProgramKind = (typeof programKinds)[number];
const tomanAmountSchema = z.coerce
  .number({ invalid_type_error: 'مبلغ را به تومان وارد کنید.' })
  .int('مبلغ باید عدد صحیح تومان باشد.')
  .min(0, 'مبلغ نمی‌تواند منفی باشد.')
  .max(1_000_000_000_000, 'مبلغ بیش از حد بزرگ است.');
export const programEventSchema = z
  .object({
    kind: z.enum(programKinds),
    title: optionalText(z.string().trim().min(2, 'عنوان برنامه را وارد کنید.').max(200)),
    campId: optionalText(z.string().uuid('اردو را انتخاب کنید.')),
    heldAt: optionalText(z.string().refine(validGregorianDate, 'تاریخ معتبر انتخاب کنید.')),
    place: optionalText(z.string().trim().max(200)),
    notes: optionalText(z.string().trim().max(2000)),
    totalAmount: tomanAmountSchema,
    memberPaymentAmount: tomanAmountSchema,
  })
  .superRefine((value, context) => {
    if (value.kind === 'camp' && !value.campId)
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'اردو را انتخاب کنید.', path: ['campId'] });
    if (value.kind === 'custom' && !value.title)
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'عنوان برنامه را وارد کنید.', path: ['title'] });
  });
export type ProgramEventInput = z.infer<typeof programEventSchema>;
export const costItemSchema = z.object({
  title: z.string().trim().min(1, 'عنوان هزینه را وارد کنید.').max(200),
  amount: tomanAmountSchema,
  perPerson: z.boolean().optional(),
});
export type CostItemInput = z.infer<typeof costItemSchema>;
export const campSchema = z
  .object({
    title: z.string().trim().min(2, 'عنوان اردو را وارد کنید.').max(200),
    startsOn: z.string().refine(validGregorianDate, 'تاریخ شروع معتبر انتخاب کنید.'),
    endsOn: z.string().refine(validGregorianDate, 'تاریخ پایان معتبر انتخاب کنید.'),
    place: optionalText(z.string().trim().max(200)),
    purpose: optionalText(z.string().trim().max(4000)),
    costAmount: z
      .string()
      .optional()
      .refine(
        (value) => {
          if (value === undefined || value.trim() === '') return true;
          const digits = latinDigits(value.trim());
          if (!/^\d+$/.test(digits)) return false;
          const amount = Number(digits);
          return amount >= 0 && amount <= 1_000_000_000_000;
        },
        'هزینه باید عدد صحیح تومان باشد.',
      ),
    durationText: optionalText(z.string().trim().max(100)),
    scheduleText: optionalText(z.string().trim().max(8000)),
    participantIds: z.array(z.string().uuid()),
  })
  .refine((value) => value.endsOn >= value.startsOn, {
    message: 'تاریخ پایان نمی‌تواند قبل از شروع باشد.',
    path: ['endsOn'],
  });
export type CampInput = z.infer<typeof campSchema>;
export const consultationKinds = ['in_person', 'phone'] as const;
export type ConsultationKind = (typeof consultationKinds)[number];
export const consultationSchema = z
  .object({
    memberIds: z.array(z.string().uuid()).min(1, 'حداقل یک نیرو انتخاب کنید.'),
    kind: z.enum(consultationKinds),
    heldAt: z.string().min(1, 'تاریخ مشاوره را وارد کنید.'),
    durationMinutes: z.coerce
      .number({ invalid_type_error: 'مدت زمان را به دقیقه وارد کنید.' })
      .int('مدت زمان باید عدد صحیح دقیقه باشد.')
      .min(1, 'مدت زمان باید دست‌کم ۱ دقیقه باشد.')
      .max(480, 'مدت زمان بیش از حد طولانی است.'),
    place: optionalText(z.string().trim().max(200)),
    sharedSummary: optionalText(z.string().trim().max(8000)),
  })
  .superRefine((value, context) => {
    if (value.kind === 'in_person' && !value.place)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'مکان مشاوره حضوری را وارد کنید.',
        path: ['place'],
      });
  });
export type ConsultationInput = z.infer<typeof consultationSchema>;
export const consentItems = ['system', 'retention', 'public_photos', 'public_audio', 'parent_summary_notice'] as const;
export type ConsentItem = (typeof consentItems)[number];
export const requiredConsentItems: readonly ConsentItem[] = ['system', 'retention', 'parent_summary_notice'];
export const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().max(100).optional() });
