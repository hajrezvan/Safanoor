# PHASE 02 — Students / Grades / Groups / Assignments / Growth Profile

## خلاصه

پایه‌های تحصیلی، گروه‌ها، پرونده دانش‌آموز و پرونده رشد ساخته شد. تخصیص مربی و کمک‌مربی با آرشیو تخصیص قبلی پیاده‌سازی شد و scoping نقش‌ها (مربی/کمک‌مربی فقط دانش‌آموزان خود) در سرویس، صفحه و تست اعمال شد.

## تصمیم‌های OPEN_QUESTIONS

| پرسش | تصمیم این فاز |
|------|----------------|
| وابستگی Group | هر گروه به یک Grade وابسته است (`groups.grade_id` الزامی). |
| تعداد مربی هر دانش‌آموز | یک مربی فعال + یک کمک‌مربی فعال؛ تخصیص قبلی با `is_active=0` و `ended_at` آرشیو می‌شود. |
| ساخت حساب دانش‌آموز | مدیر حساب را می‌سازد؛ در فرم «دانش‌آموز جدید» هر دو حالت «حساب موجود» و «ایجاد حساب جدید» پشتیبانی می‌شود. |

## سرویس‌ها

- `src/server/modules/grades/service.ts` — `listGrades`، `seedGrades`، `ensureGradesSeeded`، `createGrade`، `GRADE_SEED` (هفتم…دوازدهم)
- `src/server/modules/groups/service.ts` — CRUD گروه با `gradeId` و شمارش دانش‌آموزان هر گروه
- `src/server/modules/students/service.ts`
  - CRUD دانش‌آموز و پیوند به کاربر با نقش `student`
  - `getGrowthProfile` / `upsertGrowthProfile`
  - `setStaffAssignment` (آرشیو تخصیص قبلی)، `getActiveAssignment`، `listAssignmentHistory`
  - فیلترها: نام، پایه، گروه، مربی، کمک‌مربی، وضعیت
  - scoping: `getStudentIdsForStaff(userId, role)`، `canStaffAccessStudent`، `listStudentsForStaff`

همه ورودی‌ها با zod اعتبارسنجی می‌شوند و شناسه/زمان از `@/lib/id` می‌آید.

## Server Actions

- `src/server/actions/grades.ts` — `seedGradesAction`، `createGradeAction`
- `src/server/actions/groups.ts` — ایجاد، ویرایش و حذف گروه
- `src/server/actions/students.ts` — ایجاد/ویرایش دانش‌آموز، تخصیص مربی، ذخیره پرونده رشد

مجوزها: `STUDENTS_MANAGE` برای مدیر و `STUDENTS_VIEW_SCOPED` + بررسی محدوده برای مربی/کمک‌مربی در ویرایش پرونده رشد.

## صفحات

| مسیر | نقش | توضیح |
|------|-----|-------|
| `/admin/grades` | مدیر | لیست پایه‌ها + دکمه ساخت پایه‌های هفتم تا دوازدهم |
| `/admin/groups` | مدیر | لیست، فیلتر و ایجاد گروه |
| `/admin/students` | مدیر | لیست با فیلتر نام، پایه، گروه، مربی، کمک‌مربی، وضعیت |
| `/admin/students/new` | مدیر | ایجاد پرونده با حساب موجود یا حساب جدید |
| `/admin/students/[id]` | مدیر | پرونده رشد با تب‌ها + فرم ویرایش و تخصیص |
| `/staff/mentor/students` | مربی | لیست scope‌شده |
| `/staff/mentor/students/[id]` | مربی | پرونده رشد (خارج از محدوده ۴۰۴) |
| `/staff/assistant/students` | کمک‌مربی | لیست scope‌شده |
| `/staff/assistant/students/[id]` | کمک‌مربی | پرونده رشد (خارج از محدوده ۴۰۴) |
| `/student/profile` | دانش‌آموز | پرونده رشد خودش (فقط خواندنی) |

### تب‌های پرونده رشد

نمای کلی و تاریخچه واقعی هستند؛ بقیه تب‌ها EmptyState با اشاره به فاز مربوطه دارند.

| تب | وضعیت |
|----|-------|
| نمای کلی | واقعی — هدر (نام، پایه، گروه، مربی، کمک‌مربی) + اطلاعات پرونده رشد + فرم ویرایش |
| تاریخچه | واقعی — تاریخچه تخصیص مربی‌ها |
| اهداف / برنامه | placeholder (فاز ۴) |
| جلسات و چت / یادداشت‌ها | placeholder (فاز ۵) |
| اقدامات | placeholder (فاز ۴) |
| یادگیری | placeholder (فاز ۳) |
| فعالیت‌ها | پیاده‌سازی‌شده (فاز ۶) |

## کامپوننت‌های مشترک

- `MentorShell` / `AssistantShell` / `StudentShell` — هم‌خانواده `AdminShell` با ناوبری نقش خود
- `StudentProfileView` — پرونده رشد مشترک بین مدیر، مربی، کمک‌مربی و دانش‌آموز
- `StudentsTable`، `StudentFilterBar`، `GrowthProfileForm`

## Seed

- ۶ پایه (هفتم تا دوازدهم) و ۶ گروه (یک گروه به ازای هر پایه)
- ۹ دانش‌آموز با نام و اطلاعات فارسی واقعی‌نما شامل `student1`؛ همه با حساب کاربری، پرونده رشد پر‌شده و تخصیص `mentor1` و `assistant1`
- رمز عبور همه دانش‌آموزان: `Student@1234`
- seed به‌صورت idempotent است و حساب‌های فاز ۱ را بازنویسی نمی‌کند.

## تست‌ها

`tests/student-scoping.test.ts` (۷ تست): محدوده مربی، محدوده کمک‌مربی، عدم ارث‌بری نقش‌ها، محدودسازی لیست، دسترسی کامل مدیر، مسدودسازی دسترسی خارج از محدوده و آرشیو تخصیص قبلی هنگام تغییر مربی.

## نکات فنی

- ثابت `STUDENT_STATUS_TITLES_FA` در `@/lib/enums` قرار دارد تا کامپوننت‌های کلاینت سرویس دیتابیس را وارد باندل مرورگر نکنند.
- `getStudentIdsForStaff` با آرایه خالی به شرط `1 = 0` ترجمه می‌شود تا نبود تخصیص هرگز به «نمایش همه» تبدیل نشود.

## باقی‌مانده به فازهای بعد

- مسیرها، دوره‌ها و برنامه مطالعاتی (فاز ۳)
- اهداف، برنامه فردی و اقدامات (فاز ۴)
- جلسات، چت، یادداشت و ارجاع (فاز ۵)
