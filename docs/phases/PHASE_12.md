# گزارش فاز ۱۲ — Seed / Tests / Security / Docker / Docs

## Seed

- `src/db/seed/index.ts`: ۱ مدیر، ۳ مربی، ۶ کمک‌مربی، ۳۰ دانش‌آموز فارسی، گروه‌ها، مسیرها، دوره‌ها، کتاب‌ها، اهداف/برنامه/اقدام (با overdue)، جلسات، چت، ارجاع، فعالیت‌ها، بانک دانش — idempotent
- `docker/seed.mjs`: حساب‌ها + پایه‌ها/گروه‌ها/تخصیص + نمونه دانش برای اجرای کانتینر با `RUN_SEED=true`

## تست‌ها

- تقویت پوشش AI accept/reject و ارجاع در `tests/audit-e2e.test.ts`
- smoke رابطه هدف/برنامه/اقدام و ترکیب مسیر، چت، جلسه، ارجاع، حسابرسی

## امنیت

- `transitionActionAction` / `submitActionResultAction`: نقش، مجوز `plans.manage`، محدوده دانش‌آموز یا مسئول اقدام
- ایجاد هدف/برنامه/اقدام: `assertPermission` + scope

## Docker / Docs

- Dockerfile + compose با volume `/data`؛ entrypoint: migrate → seed اختیاری → server
- README نهایی با جدول حساب‌ها و یادداشت دود E2E
- `docs/DOD.md` برای بخش‌های ۴۷ و ۴۸ سند مادر
