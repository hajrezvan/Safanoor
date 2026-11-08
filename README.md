# صفانور

زیرساخت فاز اول سامانهٔ مسجد صفا؛ NestJS/TypeORM و Next.js/MUI، فارسی و RTL. مرجع محصول [AGENTS.md](AGENTS.md) است. [معماری](docs/ARCHITECTURE.md)، [دسترسی‌ها](docs/ACCESS_POLICY.md)، [فرض‌های باز](docs/OPEN_QUESTIONS.md) و [برنامهٔ فاز اول](docs/phases/PHASE_01.md).

## اجرای توسعه

Node.js 24، npm، Corepack/Yarn 1 و PostgreSQL 17 لازم‌اند. قالب‌های اصلی در همین مخزن توسعه یافته‌اند؛ backend با npm و frontend با Yarn نصب می‌شود.

```sh
npm ci
npm ci --prefix packages/shared
npm run build:shared
npm ci --prefix api
corepack yarn --cwd ui install --frozen-lockfile
node scripts/dev-env.mjs
```

اسکریپت آخر کلیدهای تصادفی در فایل‌های ignored تولید می‌کند و فایل موجود را بازنویسی نمی‌کند. برای PostgreSQL محلی مستقل:

```sh
docker run --name safanoor-postgres -e POSTGRES_USER=safanoor -e POSTGRES_PASSWORD=safanoor_dev -e POSTGRES_DB=safanoor -p 127.0.0.1:55432:5432 -d postgres:17-alpine
npm --prefix api run migration:run
npm --prefix api run seed
```

بعد از نصب وابستگی‌ها و اولین migration/seed، برای بالا آوردن کل استک توسعه (Postgres + MinIO لوکال + API + worker + UI) از ریشهٔ مخزن:

```sh
npm run dev
```

`npm run dev` کانتینر Docker مربوط به MinIO را روی `127.0.0.1:9000` (کنسول: `9001`) می‌سازد/روشن می‌کند و API به‌صورت پیش‌فرض به آن وصل می‌شود. مسئول فنی می‌تواند در `/admin/settings` مشخصات MinIO سرور اصلی را وارد کند یا دوباره به لوکال برگردد. Ctrl+C فقط فرآیندهای Node را متوقف می‌کند؛ کانتینرهای Postgres/MinIO می‌مانند. معادل دستی در سه ترمینال:

```sh
npm --prefix api run start:dev
npm --prefix api run worker
corepack yarn --cwd ui dev
```

رابط: http://localhost:3033، OpenAPI توسعه: http://localhost:3001/api/docs. درخواست وب از همان مبدأ رابط به API proxy می‌شود. مسیرهای اصلی: `/`، `/profile`، `/consent`، `/notifications`، `/admin` و `/dev/design` (فقط توسعه).

## حساب‌های کاملاً مصنوعی seed

فقط برای توسعه؛ seed در NODE_ENV=production اجرا نمی‌شود. رمز مشترک: `12345678`.

| نقش | شمارهٔ ورود |
|---|---|
| مدیر فنی | 09100000040 |
| ناظر | 09100000001 |
| سرمربی | 09100000002 |
| مربی رویش | 09100000003 |
| مربی باران | 09100000004 |
| کمک‌مربی | 09100000005 |
| عضو | 09100000011 |
| عضو در انتظار رضایت والد | 09100000015 |
| والد تأییدشده | 09100000031 |

Seed تکرارپذیر است؛ ۱ ناظر، ۱ سرمربی، ۲ مربی، ۳ کمک‌مربی، ۱۲ عضو، ۲ والد و ۱ مدیر بیرونی. fixture حوزه‌های آینده رمز‌شده و بدون API است. پنج ناظر واقعی باید توسط سازمان تکمیل شوند؛ readiness تا آن زمان false است.

برای سلسله‌مراتب واقعیٔ تست محلی (گروه‌های صفا، تلفن‌های `0912…`): `npm --prefix api run seed:hierarchy` — جزئیات در [docs/REAL_HIERARCHY_SEED.md](docs/REAL_HIERARCHY_SEED.md). فهرست کامل ستون‌های نیرو / کمک‌مربی / مربی / ناظر: [docs/DEMO_HIERARCHY.md](docs/DEMO_HIERARCHY.md).

### حساب‌های سلسله‌مراتب برای جلسهٔ demo

پس از `seed:hierarchy`؛ رمز مشترک همان `12345678` است.

| نام | ورود (تلفن) | رمز | نقش از سلسله‌مراتب |
|---|---|---|---|
| مهدی رضوانیان | `09120000001` | `12345678` | ناظر (مالک صفا ۲۰؛ ناظر صفا ۲۷) |
| محمد گودرزی | `09120000037` | `12345678` | مربی صفا ۲۷ (ناظر صفا ۳۴ از زنجیره) |
| محمدجواد رضوانیان | `09120000012` | `12345678` | مربی (مالک صفا ۳۳) |
| مصطفی بهبهانی (محمدمصطفی بهبهانی) | `09120000003` | `12345678` | کمک‌مربی صفا ۲۷ |
| مهدی سیف‌الهی | `09120000016` | `12345678` | نیرو صفا ۲۰ |

## بررسی‌ها

```sh
npm run check
npm --prefix api run seed
npm --prefix api run seed
npm run contract
```

تست یکپارچه به کاربر PostgreSQL دارای اجازهٔ ساخت دیتابیس تست نیاز دارد؛ `TEST_DATABASE_URL` باید به دیتابیس با پسوند `_test` اشاره کند. تست فقط همان دیتابیس تست را از صفر ایجاد و migration می‌کند؛ دیتابیس توسعه پاک نمی‌شود.

پس از اجرای API، worker و رابط:

```sh
npx playwright install chromium
npm run test:worker
npm run test:e2e
```

روی macOS دارای Chrome، تست به‌طور پیش‌فرض از Chrome نصب‌شده استفاده می‌کند. در CI از Chromium Playwright استفاده می‌شود؛ برای لینوکس محلی `CI=true npm run test:e2e`. تصاویر ۳۹۰ و ۱۴۴۰ پیکسل در روشن/تیره در `docs/screens/` ذخیره می‌شوند. `node scripts/generate-assets.mjs` آیکن PWA و پوستهٔ آفلاین را از توکن‌ها و متن‌های فارسی بازتولید می‌کند.

## Docker و استقرار

```sh
node scripts/dev-env.mjs
docker compose up --build -d
```

Compose روی http://localhost:8080: Postgres، S3Proxy خصوصی، migration، backend، worker، frontend و nginx. مالک migration از کاربر runtime جداست؛ runtime superuser نیست. اطلاعات demo به‌صورت خودکار وارد نمی‌شوند. برای محیط آزمایشی با دادهٔ نمونه:

```sh
docker compose run --rm -e NODE_ENV=development backend node dist/seed.js
```

برای پُر کردن حساب‌های آزمایشی جهت ارائه، پس از build تصویر backend اجرا کنید:

```sh
docker compose run --rm -e NODE_ENV=development backend node dist/seed-demo.js
```

در اجرای بدون Docker، معادل آن `npm --prefix api run seed:demo` است. این دستور را می‌توان دوباره اجرا کرد؛ ویرایش‌ها و وضعیت خواندن پیام‌ها حفظ می‌شوند. [راهنمای نقش‌ها و دادهٔ ارائه](docs/DEMO.md).

برای نخستین حساب واقعی، چهار متغیر `BOOTSTRAP_ADMIN_PHONE`، `BOOTSTRAP_ADMIN_PASSWORD` (حداقل ۱۲ نویسه)، `BOOTSTRAP_ADMIN_FIRST_NAME` و `BOOTSTRAP_ADMIN_LAST_NAME` را در محیط امن تنظیم و `npm --prefix api run bootstrap` یا در container `node dist/bootstrap-admin.js` اجرا کنید. ابزار بعد از وجود اولین مدیر متوقف می‌شود. مدیر تازه در اولین ورود باید رضایت را ثبت کند. رمز واقعی را در آرگومان shell، کد یا Git قرار ندهید.

برای production: TLS در reverse proxy بیرونی، APP_ORIGIN واقعی، کلیدهای مستقل و نسخه‌دار، رمزهای مستقل پایگاه داده/S3 و S3_PUBLIC_ENDPOINT قابل دسترس کاربر را تنظیم کنید. فایل‌های env در image و Git نیستند. `.gitlab-ci.yml` مراحل بررسی را برای Hamgit/GitLab تعریف می‌کند؛ اجرای pipeline به runner مخزن نیاز دارد.

۶ فاز در سند تعریف شده است؛ این تغییر فقط فاز ۱ است. برنامه‌ریزی، اردو/مشاوره، مالی/پروژه، رسانه و تکمیل چرخهٔ نگهداری در فازهای بعد قرار دارند.
