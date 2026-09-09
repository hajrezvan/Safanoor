# تصمیمات استک — سامانه تربیتی نوجوانان (Safanoor)

این سند تصمیمات فنی تأییدشده برای MVP را مستند می‌کند. هر انتخاب شامل **تصمیم**، **دلیل** و **گزینه ردشده** است.

---

## 1. Framework

**تصمیم:** Next.js 16 (App Router) + TypeScript + React 19

**دلیل:**
- الزام سند مادر: یک Monolith یکپارچه (UI + API در یک codebase) و یک Dockerfile واحد
- Server Components و Server Actions امکان اجرای منطق سرور بدون process جداگانه را می‌دهند
- خروجی `standalone` برای Docker سبک و عملی است
- اکوسیستم mature برای RTL، فرم‌ها و UI

**گزینه ردشده:** دو پروژه جدا (مثلاً NestJS + React/Vite) — خلاف الزام Monolith و یک کانتینر واحد.

**نکته اجرایی:** تمام مسیرهایی که به SQLite دسترسی دارند باید `runtime = 'nodejs'` داشته باشند؛ `better-sqlite3` روی Edge اجرا نمی‌شود.

---

## 2. ORM و دیتابیس

**تصمیم:** Drizzle ORM + `better-sqlite3` + drizzle-kit

**دلیل:**
- بدون binary موتور query جدا (برخلاف Prisma) — ایمیج Docker سبک‌تر
- کنترل مستقیم روی PRAGMAها: `journal_mode=WAL`، `foreign_keys=ON`، `busy_timeout`
- schema به صورت TypeScript — منطق query در ORM می‌ماند (مهاجرت آینده به Postgres ساده‌تر)
- migrationها با `drizzle-kit generate` تولید و با `migrate()` اعمال می‌شوند؛ تاریخچه در `__drizzle_migrations`

**گزینه ردشده:** Prisma — query engine حدود ۵۰MB به ایمیج اضافه می‌کند و کنترل PRAGMA ضعیف‌تر است.

**مسیر migration:**
```bash
npx drizzle-kit generate   # تولید SQL در ./drizzle
npx tsx src/db/migrate.ts  # اعمال روی فایل دیتابیس
```

**مسیر فایل دیتابیس:**
- توسعه محلی: `./data/app.db` (یا مقدار `DATABASE_PATH`)
- Docker: `/data/app.db` روی volume پایدار

---

## 3. Auth

**تصمیم:** Session Auth سفارشی (argon2id + cookie + جدول sessions در SQLite)

**دلیل:**
- سند مادر OAuth یا IdP خارجی را الزام نکرده
- چهار نقش داخلی با scoping حساس — کنترل کامل روی session و revocation لازم است
- بدون وابستگی خارجی؛ قابل audit

**جزئیات:**
- هش رمز: argon2id
- توکن session: opaque تصادفی، ذخیره در DB با expiry
- Cookie: `httpOnly`، `SameSite=Lax`، `Secure` در production
- Guards: `requireUser` / `requireRole` در لایه server

**گزینه ردشده:** Auth.js (NextAuth) با Credentials — پیکربندی سنگین برای سیستم فقط credentials، و کنترل session کمتر شفاف.

---

## 4. UI Kit و Design System

**تصمیم:** Tailwind CSS v4 + shadcn/ui با فلگ `--rtl` + lucide-react + فونت Vazirmatn (self-hosted)

**دلیل:**
- shadcn از ژانویه ۲۰۲۶ پشتیبانی first-class برای RTL دارد: تبدیل کلاس‌های فیزیکی به logical (`ml-4` → `ms-4`)
- بدون CSS hack برای RTL (الزام بخش ۲ سند مادر)
- کامپوننت‌ها در repo کپی می‌شوند — قابل سفارشی‌سازی کامل برای ظاهر تربیتی/آرام
- Vazirmatn self-hosted: بدون وابستگی runtime به Google Fonts در کانتینر

**گزینه ردشده:** MUI / Ant Design — سنگین، ظاهر عمومی، و RTL اغلب نیاز به theme/hack دارد.

**ریشه layout:** یک‌بار `dir="rtl" lang="fa"` در `src/app/layout.tsx`.

**پالت:** محدود و آرام (OKLCH) — اجتناب از تم بنفش پیش‌فرض و cream/terracotta رایج AI.

---

## 5. State و Data Layer

**تصمیم:**
- **خواندن:** Server Components → فراخوانی مستقیم `server/modules/*/service.ts` (بدون fetch پراکنده)
- **نوشتن:** Server Actions نازک روی همان serviceها
- **Client interactive:** TanStack Query فقط برای سطوح واقعاً interactive (چت، لیست با فیلتر زنده) — نه به‌صورت سراسری

**دلیل:** تطابق با بخش ۳۸ و ۳۹ سند مادر (لایه داده مشخص، بدون منطق پراکنده در کامپوننت صفحه).

**گزینه ردشده:** SWR سراسری یا Redux — برای server-first monolith اضافه است.

---

## 6. Validation و Forms

**تصمیم:** Zod + react-hook-form + `@hookform/resolvers`

**دلیل:** یک schema مشترک برای Server Action و فرم کلاینت؛ پیام خطای فارسی؛ type inference.

**گزینه ردشده:** Yup / validation دستی — اکوسیستم TypeScript ضعیف‌تر.

---

## 7. تاریخ و تقویم

**تصمیم:** ذخیره UTC ISO در DB؛ نمایش جلالی از طریق `src/lib/date.ts`

**دلیل:** محصول فارسی تربیتی به نمایش جلالی نیاز دارد؛ متمرکز کردن تبدیل، تصمیم را قابل‌برگشت نگه می‌دارد.

---

## 8. ساختار پوشه‌ها

```
src/
  app/                    # App Router
    (auth)/               # login و صفحات عمومی auth
    (student)/            # داشبورد و صفحات دانش‌آموز
    (staff)/              # مربی و کمک‌مربی
    (admin)/              # مدیر
    api/                  # Route Handlers در صورت نیاز (مثلاً upload)
  server/
    auth/                 # session، password، guards
    authz/                # policy، permissions، student scoping
    modules/<domain>/     # service.ts + schema.ts + queries.ts
    actions/              # Server Actions نازک
    audit/
  db/
    schema/               # جداول Drizzle (یک فایل per domain)
    client.ts             # singleton + PRAGMAها
    migrate.ts
    seed/
  ai/
    provider/
    context/
    prompts/
    services/
  components/
    ui/                   # shadcn primitives
    patterns/             # AppShell، PageHeader، EmptyState، ...
  lib/                    # date، enums، utils، cn
drizzle/                  # SQL migrationهای تولیدشده
docs/phases/
tests/
data/                     # SQLite محلی (gitignore)
```

---

## 9. SQLite و WAL

در `src/db/client.ts` هنگام باز کردن اتصال:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

**محدودیت‌ها (مستند برای ops):**
- فایل‌های sidecar `-wal` و `-shm` نیاز به directory قابل‌نوشتن دارند
- WAL روی NFS کار نمی‌کند — volume باید local یا bind باشد
- از تراکنش‌های طولانی در مسیرهای پرترافیک پرهیز شود

---

## ۱۰. Dockerize

**تصمیم:**
- Base: `node:24-bookworm-slim` (نه Alpine — prebuildهای glibc برای better-sqlite3)
- **الگوی Phase 0:** Next.js روی میزبان با `npm run build` ساخته می‌شود؛ Dockerfile ایمیج runtime را از `.next/standalone` پکیج می‌کند و فقط addonهای native را برای Linux دوباره compile می‌کند (`better-sqlite3` از source؛ `argon2` از prebuild لینوکسی داخل پکیج)
- Entrypoint: `docker/migrate.mjs` سپس اختیاری `docker/seed.mjs` سپس `node server.js`
- Volume: `/data` → فایل `/data/app.db`
- Env: `DATABASE_PATH=/data/app.db`، `RUN_SEED=true` برای seed اولیه

**چرا این الگو:** در محیط‌هایی که `npm ci` داخل Docker به‌خاطر قطعی registry ناپایدار است، و کپی خام `node_modules` از macOS باینری Darwin را وارد لینوکس می‌کند، این جداسازی قابل‌اعتمادتر است. در CI لینوکسی می‌توان بعداً به multi-stage با `npm ci` کامل برگشت.

**گزینه ردشده:** Alpine — نیاز به compile از source برای musl.

**اجرا نمونه:**
```bash
npm run build
docker compose up --build
# volume: safanoor_data → /data
```

---

## 11. معماری AI (فازهای ۹–۱۰)

**تصمیم (زودهنگام، بدون پیاده‌سازی در Phase 0):**
- Abstraction: `AIProvider` / `LLMService` — بدون hard-code provider در business logic
- ساختار: `/ai/provider`، `/ai/context`، `/ai/prompts`، `/ai/services`
- Context Builder کنترل‌شده — هرگز کل DB در prompt
- ذخیره metadata خروجی: feature، model، createdAt، context refs، output، accepted/rejected

**Provider واقعی:** در `OPEN_QUESTIONS.md` تا Phase 9 معوق است.

---

## 12. تست

**تصمیم:** Vitest + DB موقت (فایل temp) برای تست‌های permission، scoping، lifecycle

---

## 13. Package Manager

**تصمیم:** npm (در محیط موجود؛ pnpm نصب نیست)

---

*آخرین به‌روزرسانی: Phase 0*
