# فاز اول: زیرساخت صفانور

## برنامهٔ اجرا

- حفظ NestJS، TypeORM، Next.js App Router، MUI، TanStack Query، React Hook Form و Zod قالب‌ها؛ کد اجرایی جدید با TypeScript strict.
- جدول‌ها: person، app_user، auth_session، organization_group، membership، follow_up_assignment، group_role، person_ancestors، access_policy، access_grant، audit_log، emergency_access_log، consent_form_version، consent_record، parent_link، notification، notification_delivery، import_job، import_row، retention_policy و file_record.
- API نسخهٔ یک: health، auth، people، groups، access، consent، notifications، imports و admin؛ مستند OpenAPI و کلاینت تولیدشده.
- رابط: ورود، خانهٔ عضو، پروفایل، رضایت، اعلان‌ها، مدیریت افراد و گروه‌ها، ورود گروهی، سیاست دسترسی، ممیزی و صفحهٔ طراحی توسعه.
- زیرساخت: migration، seed تکرارپذیر، worker مستقل pg-boss، ذخیره‌سازی محلی/S3، Docker Compose، reverse proxy و CI.
- آزمون‌ها: ماتریس سیاست و پوشش endpointها، هویت و تاریخ، نشست و CSRF، محدودیت سلسله‌مراتب، رضایت والدین، dry run و تأیید import، تولید قرارداد و Playwright در ۳۹۰ و ۱۴۴۰ پیکسل و دو تم.

## تصمیم‌های تأییدشدهٔ مالک

ورود با رمز عبور با رابط قابل تعویض برای OTP، استقرار Docker روی لینوکس، مخزن مشترک، عدم دسترسی پیش‌فرض مدیر فنی به دادهٔ حساس، تومان و مدت‌های نگهداری پیشنهادی قابل تنظیم.

## وضعیت بررسی نهایی

- [x] typecheck و lint هر دو برنامه و بستهٔ مشترک
- [x] migration از پایگاه خالی و seed تکرارپذیر
- [x] تست‌های واحد و یکپارچه و مرورگر
- [x] بازتولید OpenAPI و کلاینت بدون اختلاف
- [x] بازبینی تصاویر روشن و تاریک موبایل و دسکتاپ
- [x] به‌روزرسانی معماری، سیاست دسترسی و پرسش‌های باز
- [x] آمادهٔ کامیت و ارسال به ریموت پس از بررسی‌ها
