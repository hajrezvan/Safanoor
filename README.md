# صفا نور (Safanoor)

سامانه تربیتی نوجوانان — MVP Monolith با Next.js.

اسناد:
- [STACK_DECISIONS.md](./STACK_DECISIONS.md)
- [TASKS.md](./TASKS.md)
- [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md)
- [docs/DOD.md](./docs/DOD.md)

## پیش‌نیاز

- Node.js 24+
- npm
- Docker (برای استقرار)

## توسعه محلی

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

باز کردن: [http://localhost:3000](http://localhost:3000)

### حساب‌های seed

| نام کاربری | رمز | نقش |
|------------|-----|-----|
| `admin` | `Admin@1234` | مدیر |
| `mentor1` … `mentor3` | `Mentor@1234` | مربی |
| `assistant1` … `assistant6` | `Assist@1234` | کمک‌مربی |
| `student1` … `student30` | `Student@1234` | دانش‌آموز |

seed کامل (idempotent) شامل پایه‌ها، گروه‌ها، مسیرها، دوره‌ها، کتاب‌ها، اهداف، برنامه‌ها، اقدامات (با overdue)، جلسات، چت، ارجاع‌ها، فعالیت‌ها، بانک دانش، اطلاعیه‌ها و نمونه آزمون/سرفصل است — همگی فارسی و بدون lorem.

### مسیرهای اصلی UI (بازطراحی)

**Staff** (ادمین / مربی / کمک‌مربی) — `/staff`:
نیروها، کمک‌مربیان، کتابخانه، کلاس‌ها، اطلاعیه‌ها (+ مدیریت سامانه برای ادمین)

**دانش‌آموز** — bottom nav موبایل:
خانه، مدرسه، کتابخانه، پیامرسان، پروفایل

پس از به‌روزرسانی کد حتماً `npm run db:migrate` را اجرا کنید (migration `0002_learning_redesign`).

## دیتابیس SQLite

| محیط | مسیر |
|------|------|
| محلی | `./data/app.db` (یا `DATABASE_PATH`) |
| Docker | `/data/app.db` روی volume پایدار |

PRAGMAها: `WAL`، `foreign_keys=ON`، `busy_timeout=5000`.

```bash
npm run db:generate   # پس از تغییر schema
npm run db:migrate
npm run db:seed
```

## Docker (یک ایمیج واحد)

به‌خاطر وابستگی‌های native (better-sqlite3) روی macOS، ابتدا روی میزبان build بگیرید:

```bash
npm run build
docker build -t safanoor .
docker run --rm -p 3000:3000 -e RUN_SEED=true -v safanoor_data:/data safanoor
```

یا Compose:

```bash
npm run build
docker compose up --build
```

- پورت `3000`
- Volume: `safanoor_data` → `/data` (`/data/app.db`)
- Entrypoint: migration → (اختیاری با `RUN_SEED=true`) seed → `node server.js`
- seed داکر حساب‌ها، پایه‌ها، گروه‌ها و تخصیص‌ها را می‌سازد؛ برای داده رابطه‌ای غنی‌تر از `npm run db:seed` روی میزبان استفاده کنید.

**نکته WAL:** مسیر `/data` باید volume محلی/bind باشد (نه NFS).

## بررسی کیفیت

```bash
npm run typecheck
npm test
npm run build
npm run lint   # هشدارها قابل قبول‌اند
```

## دود End-to-End (پس از seed)

1. ورود `admin` → ایجاد/ویرایش دانش‌آموز و پرونده رشد
2. ورود `mentor1` → مشاهده دانش‌آموزان محدوده، هدف/برنامه/اقدام، مربی‌یار AI
3. ورود `assistant1` → چت، جلسه، ارجاع، داشبورد پیگیری
4. ورود `student1` → اقدامات، چت، دوره‌ها/کتاب‌ها/فعالیت‌ها، تب تاریخچه پرونده
5. تب تاریخچه پرونده: تخصیص مربی + رویدادهای حسابرسی

## اسکریپت‌ها

| دستور | کاربرد |
|-------|--------|
| `npm run dev` | توسعه |
| `npm run build` / `start` | تولید |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest |
| `npm run db:migrate` | اعمال migration |
| `npm run db:seed` | داده اولیه کامل |

## ساختار

نگاه کنید به بخش پوشه‌بندی در `STACK_DECISIONS.md`.
