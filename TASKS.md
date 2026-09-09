# TASKS — سامانه تربیتی نوجوانان (Safanoor)

چک‌لیست فازبندی‌شده. پس از انجام هر مورد `[ ]` را به `[x]` تغییر دهید.

---

## تغییرات ترتیب فازها

**جابجایی Phase 4 و Phase 5 نسبت به سند مادر (بخش ۴۲):**

| سند مادر | ترتیب اجرا در این پروژه |
|----------|-------------------------|
| PHASE 4: Chat / Sessions / Notes / Referrals / Follow-up | **PHASE 4: Goals / Individual Plans / Actions** |
| PHASE 5: Goals / Plans / Actions | **PHASE 5: Chat / Sessions / Notes / Referrals / Follow-up** |

**دلیل:** بخش‌های ۱۲، ۱۳ و ۱۱ سند مادر به موجودیت `Action` وابسته‌اند (دکمه تبدیل پیام چت به Action، ایجاد Action از جلسه، داشبورد پیگیری بر اساس overdue/pending Actions). ساخت Chat/Follow-up قبل از Actions منجر به stub و بازنویسی می‌شود. بخش ۴۲ اجازه اصلاح جزئی ترتیب با ثبت دلیل را داده است.

سایر فازها بدون تغییر ترتیب سند مادر هستند.

---

## PHASE 0 — Project Setup

- [x] ایجاد `STACK_DECISIONS.md`
- [x] ایجاد `OPEN_QUESTIONS.md`
- [x] ایجاد `TASKS.md` (همین فایل)
- [x] اسکلت Next.js 16 + TypeScript + npm
- [x] ساختار پوشه‌های `src/` طبق STACK_DECISIONS
- [x] Tailwind CSS v4 + shadcn/ui با RTL
- [x] فونت Vazirmatn self-hosted + `dir="rtl"` در layout ریشه
- [x] Design tokens و کامپوننت‌های pattern پایه (AppShell، PageHeader، EmptyState، LoadingState، ErrorState، StatCard، Drawer، ConfirmDialog، FilterBar، DataTable)
- [x] Drizzle + better-sqlite3 + WAL + foreign_keys
- [x] Migration اولیه: users، sessions، roles، permissions، role_permissions
- [x] Auth skeleton: argon2id، session cookie، login/logout، requireUser/requireRole
- [x] Seed اولیه (یک admin)
- [x] Dockerfile واحد + docker-compose با volume `/data`
- [x] Vitest با DB موقت
- [x] README (build، Docker، مسیر volume)
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_00.md`

---

## PHASE 1 — Auth / Roles / Permissions / Core Users

- [x] تکمیل مدل Role و Permission (قابل توسعه، بدون hard-code پراکنده در UI)
- [x] چهار نقش: Admin، Mentor، Assistant Mentor، Student
- [x] مدیریت کاربران (CRUD توسط Admin)
- [x] تغییر رمز / غیرفعال‌سازی حساب
- [x] صفحه login نهایی با UX فارسی
- [x] Redirect بر اساس نقش پس از ورود
- [x] تست‌های permission پایه
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_01.md`

---

## PHASE 2 — Students / Grades / Groups / Assignments / Growth Profile

- [x] مدل Grade (هفتم تا دوازدهم) + seed
- [x] مدل Group وابسته به Grade
- [x] مدل Student و پیوند به User
- [x] Growth Profile (علایق، مهارت‌ها، وضعیت تحصیلی، …)
- [x] MentorAssignment (مربی و کمک‌مربی)
- [x] فرم‌های ورود اطلاعات دانش‌آموز
- [x] صفحه پرونده رشد با Tabهای اولیه (نمای کلی و اطلاعات پایه)
- [x] فیلتر لیست دانش‌آموزان: نام، پایه، گروه، مربی، کمک‌مربی، وضعیت
- [x] scoping: Assistant Mentor / Mentor فقط scope خود
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_02.md`

---

## PHASE 3 — Paths / Courses / Lessons / Books / Reading Plans

- [x] GrowthPath + PathObjective (per Grade)
- [x] اتصال دانش‌آموز به مسیر فعال (یک مسیر فعال)
- [x] Course → Lesson → Content (TEXT/VIDEO/AUDIO/FILE/LINK)
- [x] Upload محلی ساده برای فایل/کاور
- [x] Book مستقل از Course
- [x] ReadingPlan برای دانش‌آموز
- [x] صفحات Admin برای مدیریت Paths / Courses / Books
- [x] صفحات Student: دوره‌ها و کتاب‌های من (خواندن حداقلی)
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_03.md`

---

## PHASE 4 — Goals / Individual Plans / Actions

- [x] Goal با category قابل توسعه، priority، تاریخ‌ها، status، mentor note
- [x] IndividualPlan برای دانش‌آموز
- [x] Action با enum مرکزی status: TODO / IN_PROGRESS / DONE / CANCELLED
- [x] ارتباط Action ↔ Goal / Plan / مسئول انجام
- [x] UI مربی برای تعریف هدف و برنامه و اقدام
- [x] UI دانش‌آموز: مشاهده و به‌روزرسانی وضعیت Actionهای خود
- [x] تست lifecycle اکشن
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_04.md`

---

## PHASE 5 — Support Chat / Sessions / Notes / Referrals / Follow-up

- [x] ChatConversation یک‌به‌یک + ChatMessage (readAt)
- [x] scoping چت: فقط assignment فعال
- [x] آرشیو مکالمه هنگام تغییر assignment (طبق OPEN_QUESTIONS)
- [x] لیست مکالمات با نشانگر خوانده‌نشده در داشبورد پشتیبان
- [x] دکمه سریع: تبدیل پیام به Note / Action
- [x] MentoringSession + ایجاد Action پس از جلسه
- [x] MentorNote با visibility و enforce دسترسی
- [x] Referral + وضعیت OPEN / IN_REVIEW / RESOLVED / CANCELLED
- [x] Follow-up dashboard کمک‌مربی (overdue، بدون گزارش، ارجاع باز، …)
- [x] تست chat scoping و MentorNote private access
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_05.md`

---

## PHASE 6 — Activities / Projects / Student Progress

- [x] Activity (نوع‌های غیردیجیتال مجاز)
- [x] ActivityAssignment جدا از تعریف Activity
- [x] Progress: اعلام انجام، گزارش، فایل/لینک، feedback مربی
- [x] صفحات Student و Staff مربوطه
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_06.md`

---

## PHASE 7 — Dashboards

- [x] Dashboard دانش‌آموز: «الان چه کاری باید انجام دهم؟»
- [x] Dashboard کمک‌مربی: عملیات روزانه و پیگیری
- [x] Dashboard مربی: نظارت، Referral، AI Insights placeholder
- [x] Dashboard مدیر: آمار ساده MVP (بدون BI پیچیده)
- [x] Desktop-first polish
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_07.md`

---

## PHASE 8 — Knowledge Base

- [x] KnowledgeItem (title، category، scenario، approach، cautions، tags، status)
- [x] CRUD برای Admin / Mentor
- [x] جستجو و فیلتر
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_08.md`

---

## PHASE 9 — AI Mentor Assistant

- [x] AIProvider abstraction + MockAIProvider
- [x] Context Builder کنترل‌شده
- [x] UI «مربی‌یار هوشمند» در پرونده دانش‌آموز
- [x] خلاصه وضعیت، سؤالات جلسه، اقدامات پیشنهادی (بدون اجرای خودکار)
- [x] ذخیره AIInteraction metadata
- [x] رعایت permission روی endpointهای AI
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_09.md`

---

## PHASE 10 — AI Report Summarization + Next Action Suggestion

- [x] Summarization جلسه: raw note حفظ شود؛ خروجی AI جدا
- [x] جریان Suggestion → Review → Accept/Edit/Reject → ایجاد Action
- [x] برچسب «AI-generated suggestion» و قواعد ایمنی
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_10.md`

---

## PHASE 11 — Reports / History / Audit / Polish

- [x] Audit trail برای داده‌های مهم (بدون event sourcing)
- [x] تاریخچه در پرونده دانش‌آموز
- [x] Polish بصری و empty/loading/error یکدست
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_11.md`

---

## PHASE 12 — Testing / Security / UX Review / Final Docker

- [x] تست‌های باقی‌مانده: permissions، scoping، lifecycleها، AI approval، chat scoping
- [x] مرور امنیتی: authorize در server برای همه endpointها
- [x] UX Review دسکتاپ چهار نقش
- [x] Seed کامل واقعی‌نما (فارسی، بدون lorem)
- [x] Docker build نهایی + volume پایدار تأیید شود
- [x] README نهایی
- [x] تکمیل تمام checkboxهای TASKS.md
- [x] lint
- [x] typecheck
- [x] tests
- [x] build
- [x] گزارش فاز در `docs/phases/PHASE_12.md`
- [x] تأیید Definition of Done (بخش ۴۸ سند مادر) و سناریوی End-to-End بخش ۴۷

---

## خارج از محدوده MVP (نساز)

طبق بخش ۴۵: اپ Native، شبکه اجتماعی، چت گروهی/عمومی، AI chatbot آزاد برای نوجوان، gamification پیچیده، اردو/ورزش/تغذیه کامل، پنل والدین، آزمون‌ساز حرفه‌ای، Video Call، سیستم روان‌شناسی، recommendation پیچیده، کودک/دانشجو-حوزه.
