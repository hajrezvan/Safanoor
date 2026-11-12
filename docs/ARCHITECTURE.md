# معماری صفانور — فاز ۱

## مبنا و انتخاب‌های تأییدشده

دو قالب موجود توسعه یافته‌اند: NestJS 11، TypeORM و class-validator در `api/`؛ Next.js App Router، MUI، React Hook Form و TanStack Query در `ui/`. نصب بک‌اند با npm و رابط با Yarn 1 انجام می‌شود. بستهٔ `packages/shared` قراردادهای Zod، نرمال‌سازی فارسی، کد ملی و ابزار یکپارچهٔ تاریخ را نگه می‌دارد.

طبق تأیید مالک: ورود با رمز، امکان افزودن OTP پشت AuthenticationProvider، استقرار Docker روی لینوکس، واحد تومان، عدم دسترسی پیش‌فرض مدیر فنی به محتوای حساس و مدت‌های پیشنهادی نگهداریِ قابل تنظیم.

## برنامه و مرز فاز

برنامهٔ آغاز فاز در `docs/phases/PHASE_01.md` است. این فاز زیرساخت، اطلاعات پایه، گروه، عضویت و پیگیری، کنترل دسترسی، ارجاع، حساب و رضایت، اعلان، ورود گروهی و اسکلت مدیریت را پوشش می‌دهد. برنامهٔ هفتگی، اردو، مشاوره، امور مالی و رسانه، API یا صفحهٔ نمایشی ساختگی ندارند؛ در فازهای بعدی پیاده می‌شوند.

نمونه‌های آیندهٔ خواسته‌شده در seed (اردوی مشترک، بلوک خصوصی، مشاوره و دفتر صندوق) فعلاً یک fixture مصنوعی رمز‌شده در `seed_scenario` هستند، با RLS و بدون endpoint. این انتخاب از پیاده‌سازی زودهنگام فازهای بعد جلوگیری می‌کند. ماتریس `can()` سیاست این منابع را از همین حالا می‌آزماید؛ این fixture جای جدول‌های واقعی مراحل بعد را نمی‌گیرد.

مشاورهٔ MVP: جداول `consultation`، `consultation_member` و `consultation_private_note`؛ ماژول `/api/v1/consultations` و صفحهٔ `/consultations` (کارت‌های فشرده سه‌ستونه، جستجو، انتخاب چندنیرویی با جستجو). نوع حضوری/تلفنی، مدت دقیقه، مکان فقط برای حضوری اجباری، خلاصهٔ مشترک اختیاری. یادداشت خصوصی فقط از `/consultations/:id/private-note`. انتشار خلاصه به والد هنوز نیست.

## پایگاه داده و مرزبندی

PostgreSQL 17 و migrationهای TypeORM از صفر؛ بدون synchronize. جداول اصلی: person، app_user، auth_session، organization_group، membership، person_ancestors، follow_up_assignment، group_role، assistant_invite، study_path، study_path_item، program_event، cost_item، access_policy، resource_registry، access_grant، audit_log، emergency_access_log، parent_link، consent_form_version، consent_record، notification و delivery، import_job و import_row، retention_policy، file_record، seed_scenario، و مراودات: chat_thread، chat_thread_participant، chat_message.

مالی MVP مربی: `program_event` مقصد هزینه با `kind` اردو|سفارشی؛ اردو از ماژول `camp` انتخاب و با `camp_id` پیوند می‌شود؛ فیلدهای صحیح تومان `total_amount` و `member_payment_amount` روی مقصد. `cost_item` با `owner_type=program_event` برای جزئیات اختیاری (جمع خط‌ها جایگزین مبلغ کل مقصد نمی‌شود). endpointها تحت `/api/v1/groups/:id/finance/...` و `/api/v1/finance/destinations/...`؛ صفحهٔ `/finance`.

TypeORM مسئول اتصال، تراکنش و migration است. SQL پارامتری برای انتخاب صریح ستون‌ها، CTE بازگشتی و محدودیت‌های پایگاه داده استفاده شده است؛ مدل generic کاربرِ قالب، با دامنهٔ people جایگزین شده تا پاسخ entity یا فیلد رمز‌شده به کلاینت نرسد. تغییرات هویتی تأیید مربی را باطل و فقط تعداد فیلدها را audit می‌کنند.

عضویت اصلی یکتا و قید deferred برای دقیقاً یک عضو فعال؛ دو ردیف member و assistant در یک گروه مجاز است. trigger چرخه را منع می‌کند. تغییرات سلسله‌مراتب و پیگیری با advisory lock سری می‌شوند؛ جدول closure در همان تراکنش بازسازی می‌شود. واگذاری پیگیری تاریخچه دارد. غیرفعال‌سازی با مسئولیت باز رد می‌شود؛ داده حذف سخت نمی‌شود.

national ID با AES-256-GCM و AAD مخصوص حوزه رمز می‌شود، HMAC جداگانه برای یکتایی دارد. کلیدها نسخه دارند؛ خواندن نسخهٔ قدیمی ممکن است و نوشتن با کلید جاری است. بازرمزگذاری دسته‌ای و چرخهٔ عملیاتی تعویض کلید نیازمند رویهٔ استقرار است. کد ملی در API پایه کامل پوشانده می‌شود. فایل ورودی و دادهٔ ردیف‌ها نیز رمز می‌شوند.

Compose از مالک migration و نقش runtime فاقد superuser و BYPASSRLS استفاده می‌کند. RLS اجباری روی import_row و seed_scenario است؛ تراکنش پیش‌نمایش actor و worker زمینهٔ worker را تنظیم می‌کنند. تست جداگانه با نقش غیر superuser ثابت می‌کند ردیف‌های دیگران دیده نمی‌شوند. توسعهٔ محلی ساده از کاربر postgres دارای امتیاز بالا استفاده می‌کند و جای تنظیم نقش production را نمی‌گیرد.

## احراز هویت و قرارداد

API نسخه‌دار `/api/v1`، Swagger توسعه `/api/docs` و قرارداد قابل تولید با `npm run contract`. schema کلاینت از OpenAPI تولید می‌شود و openapi-fetch همهٔ درخواست‌های فعال را نوع‌دار می‌کند. CI تغییر ناخواستهٔ قرارداد تولیدشده را رد می‌کند.

رمز argon2id؛ access token ده دقیقه، refresh سی روز با hash و خانوادهٔ چرخشی. استفادهٔ مجدد از refresh قدیمی کل خانواده را لغو می‌کند. هر درخواست، زنده بودن نشست و وضعیت فرد را از پایگاه داده می‌سنجد. پنج ورود اشتباه قفل پانزده‌دقیقه‌ای ایجاد می‌کند. نرخ ورود ۵ درخواست در دقیقه و نرخ عمومی ۱۲۰ است.

نقش فعال روی `auth_session.active_role_id` ذخیره می‌شود و در `authenticate` روی Actor اعمال می‌گردد (`orgLevel` / `isAdmin` / `activeGroupId`). `GET /people/me` فهرست `availableRoles` و `activeRole` را برمی‌گرداند؛ `POST /people/me/active-role` نقش را عوض می‌کند. `can()` و فهرست افراد/گروه‌ها فقط قدرت همان نقش را می‌بینند (مثلاً مربی صفا ۳۳ قدرت کمک‌مربی صفا ۲۷ را ندارد). نقش `technical_manager` فقط وقتی `app_user.is_admin` است در فهرست می‌آید و تنها در آن حالت `manageSettings`/ناوبری ادمین فعال است.

وب: کوکی httpOnly، Secure و SameSite=Strict؛ توکن فقط در کوکی، CSRF به‌صورت double-submit با توکن در حافظه و کنترل Origin. توکن در localStorage/sessionStorage ذخیره نمی‌شود. برنامهٔ بومی با `X-Client-Type: native` و بدون کوکی/Origin توکن JSON می‌گیرد و Bearer می‌فرستد. تغییر رمز و خروج، خانوادهٔ نشست را لغو می‌کنند. خطاها `{error:{code,message},requestId,timestamp}` و بدون جزئیات SQL هستند.

شمارهٔ ورود با ویرایش سادهٔ پروفایل عوض نمی‌شود؛ آماده‌سازی مجدد حساب توسط مدیر شمارهٔ ورود را با تلفن جاری همگام و نشست‌ها را لغو می‌کند. پروفایل والد و مدیر فنی external است؛ برای آن‌ها کد ملی یا تاریخ تولد ساختگی جمع‌آوری نمی‌شود.

## پردازش پس‌زمینه و ورود گروهی

worker مستقل Nest با pg-boss روی همان PostgreSQL؛ صف‌های بررسی ورودی، ثبت ورودی، تحویل اعلان و گذار هجده‌سالگی. اعلان و delivery دو رکورد جدا هستند؛ فاز ۱ فقط in-app است. وظیفهٔ شبانه، هشدار سی روز مانده، بایگانی پیوند والد در هجده‌سالگی، رضایت تازه و پاکسازی ردیف‌های موقت ورودی را انجام می‌دهد. نگهداری سایر حوزه‌ها مطابق ترتیب فازها تکمیل می‌شود.

CSV/XLSX تا ۲ MiB، ۱۰۰۰ ردیف؛ محدودیت ۱۶ MiB برای محتوای بازشدهٔ XLSX، منع فرمول و لینک، headerهای مشخص. تاریخ ورودی جلالی و ذخیرهٔ میلادی است. ابتدا dry-run؛ خطای هر ردیف، کد ملی پوشانده‌شده و شمارنده‌ها. تا تأیید صریح هیچ person ساخته نمی‌شود. hash فایل/عامل/گروه و وضعیت قفل‌شده، اجرای تکراری را بی‌اثر می‌کنند. همهٔ درج‌ها در یک تراکنش و با بررسی مجدد دسترسی عامل انجام می‌شوند. کاربران واردشده حساب فعال خودکار ندارند؛ مدیر رمز اولیه را ایجاد می‌کند.

آداپتور فایل محلی و S3، فایل خصوصی و پیوند حداکثر ۶۰ ثانیه. مسیر محلی مجوز را هنگام دانلود دوباره بررسی می‌کند؛ S3 پیوند قابلیت‌دار دارد و لغو مجوز تا پایان عمر کوتاه URL اثر کامل می‌گذارد. آلبوم گروهی MVP روی جداول `photo` / `photo_group` / `photo_tag` و endpointهای `/api/v1/album` است؛ بایت تصویر از مسیر authenticated محتوا پس از `can(photo,read)` خوانده می‌شود و URL تولیدی S3 سخت‌کد نیست. حذف EXIF هنگام بارگذاری هنوز باز است. مکان عکس اختیاری از جدول مشترک `location_option` (فهرست/ایجاد در `/api/v1/locations`) با `photo.location_option_id` ذخیره می‌شود؛ متن تازه هنگام بارگذاری upsert می‌شود.

## رابط و طراحی

رابط فعال TypeScript strict است. JSXهای عمومیِ استفاده‌نشدهٔ قالب نگه داشته شده‌اند؛ `allowJs` برای سازگاری قالب فعال و `checkJs` خاموش است. مسیرهای نمایشی قبلی حذف و dashboard قدیمی redirect شده است. احراز هویت نمایشی و API خارجی قالب در مسیر فعال استفاده نمی‌شوند. Next.js به نسخهٔ نگهداری‌شدهٔ 15.5.28 و React به 19.1.10 ارتقا یافتند؛ App Router و کتابخانه‌های اصلی حفظ شدند. lockfile تکراری npm رابط حذف شد و Yarn مرجع رابط باقی ماند.

`ui/src/theme/tokens.ts` تنها منبع رنگ، شعاع، فاصله، سایه و مقیاس تایپ رابط فعال است. پوستهٔ اختصاصی سبز، روشن/تیره، وزیرمتن، خانوادهٔ آیکن Rounded، cache راست‌به‌چپ Emotion با stylis و AdapterDateFnsJalali. تاریخ در یک بسته تبدیل می‌شود، هفته از شنبه و اعداد فارسی‌اند. تمام متن‌های ثابت محصول پشت لایهٔ فارسی و i18next هستند.

صفحه‌ها فقط از کتابخانهٔ `src/components/ui` استفاده می‌کنند. تست قرارداد طراحی، import مستقیم MUI، sx/style و رنگ literal در screens را رد می‌کند و کنتراست WCAG AA و شعاع‌ها را می‌سنجد. صفحهٔ `/dev/design` اجزا و توکن‌ها را نشان می‌دهد و در production، 404 می‌دهد. service worker فقط offline.html و آیکن عمومی را cache می‌کند؛ هیچ API، پاسخ احراز هویت یا صفحهٔ شخصی ذخیره نمی‌شود.

خانهٔ مربی (`/` برای `mentor` / `head_mentor`): داشبورد تجمیعی با `GET /api/v1/dashboard/mentor` (منبع `dashboard`، `can()` فقط برای `groupMentor` و `admin`؛ aggregates بدون یادداشت خصوصی). ویجت‌ها: شمارنده‌های نیرو/هویت/مشاوره/اردو/هزینه/اعلان، نمودار میله‌ای مشاوره‌های هفتگی و هزینه‌های مقصد مالی، دونات ترکیب هویت، پیش‌نمایش اردو/جلسه/مراودات و میان‌برها. نمودارها با `@mui/x-charts` (Community/MIT) پشت `BarSeriesChart` / `DonutChart` در `ui/src/components/ui/charts.tsx`. عضو و والد همان خانهٔ ساده را می‌بینند.

## اجرا و آزمون

دستورهای دقیق در README. `scripts/check.mjs` typecheck، lint، تست‌های shared/backend/UI، migration تازه در تست یکپارچه، قرارداد، build رابط و smoke نسخهٔ production (ورود، manifest و ممنوعیت صفحهٔ توسعه) را اجرا می‌کند. Jest 29 برای pg-boss ESM از bridge آزمایشی Node 24 استفاده می‌کند؛ اجرای واقعی صف mock نشده است.

GitLab CI برای ریموت Hamgit در `.gitlab-ci.yml` است: PostgreSQL واقعی، migration و seed دوبار، همهٔ بررسی‌ها، بازتولید قرارداد، build و تست مرورگر/worker. تصاویر و trace شکست artifact می‌شوند. وجود فایل CI به معنی اجرای موفق pipeline ریموت نیست؛ نتیجهٔ راه‌اندازی runner جداست.

Dockerfile جدا برای هر app، worker از تصویر API، Postgres، S3Proxy خصوصی، migration یک‌بارمصرف و nginx هم‌مبدأ. Compose برای توسعه روی localhost است؛ production باید پشت TLS و با دامنه و کلیدهای مستقل اجرا شود. کلیدها در Git یا image قرار نمی‌گیرند. `bootstrap-admin` فقط یک مدیر نخستین با اطلاعات واقعی اپراتور ایجاد می‌کند؛ seed نمایشی در production ممنوع است.

## ذخیره‌سازی توسعه (MinIO لوکال)

`npm run dev` ابتدا تصویر رسمی MinIO را امتحان می‌کند؛ اگر از شبکه قابل دریافت نباشد (وضعیت فعلی این محیط)، همان پورت `9000` را با تصویر `infra/storage` (S3Proxy) سرو می‌کند — API برنامه همان قرارداد S3 است. باکت `safanoor` ساخته می‌شود و `STORAGE_DRIVER=s3` در `api/.env` به `127.0.0.1:9000` اشاره دارد. جدول `storage_settings` حالت `local` (env/لوکال) یا `remote` (MinIO سرور که مسئول فنی در `/admin/settings` وارد می‌کند) را نگه می‌دارد؛ رمز remote با CryptoService رمز می‌شود و با `StorageRuntimeService` بدون restart اعمال می‌گردد.

ایجاد ارجاع در API و تست سیاست پوشش دارد؛ رابط ایجاد ارجاع در کنار پرونده/مشاورهٔ واقعی فاز ۳ اضافه می‌شود. فاز ۱ فهرست و لغو ارجاع‌ها را دارد. فرم‌های فرد/گروه انتخاب نام دارند و مربی والد را با شمارهٔ همراه تأیید می‌کند.

پروندهٔ فرد: مسیر رابط `/admin/people/[id]` و endpoint تجمیعی `GET /api/v1/people/:id/dossier`. با `can(person,read)` پروفایل را می‌دهد و بخش‌های مشاوره/اردو/مراودات/عکس را با همان قواعد دید ماژول مربوطه (بدون یادداشت خصوصی و اضطراری) پر می‌کند؛ کتاب‌ها و پرداخت شخصی تا آماده‌شدن بک‌اند `available:false` برمی‌گردند. کارت‌های «گروه من» با کلیک بدنه به پرونده می‌روند و عملیات ویرایش/تأیید هویت/غیرفعال‌سازی آیکن‌فقط (Iconify) هستند.

## دادهٔ ارائهٔ فاز اول

`seed:demo` مکمل seed کوچکِ آزمون است. فقط ۲۲ شناسهٔ رزروشدهٔ مصنوعی را غنی می‌کند: تاریخ تولد و نام پدر متنوع، تأییدهای مربی، پنج اعلان با زمان و وضعیت خواندن متفاوت برای هر حساب، نمونه‌های ورود گروهی آماده/خطادار/ثبت‌شده و ارجاع‌های فعال/لغوشده. آماده‌سازی در محیط production ممنوع است. حساب تازه، قبول رضایت تازه یا بازنشانی رمز به‌صورت ضمنی انجام نمی‌شود.

اجرای مجدد، اعلان خوانده‌شده، ارجاع لغوشده، نتیجهٔ ورود گروهی و ویرایش پروفایل را برنمی‌گرداند. داده‌های ورودی رمز می‌شوند و کنترل دسترسی همان API واقعی است. دادهٔ نمایش فقط حوزه‌های پیاده‌شدهٔ فاز اول را پوشش می‌دهد؛ fixture رمز‌شدهٔ اردو و مالی همچنان API عملیاتی ندارد.

تصویر پایهٔ Node 24 در Dockerfileهای دو برنامه به digest نسخهٔ آزموده‌شده قفل شد. رجیستری هنگام build با برچسب شناور پاسخ ۴۰۳ داد؛ digest ثابت علاوه بر تکرارپذیری، استفاده از کش محلی همان تصویر را ممکن می‌کند.

## کتابخانه: مطالعهٔ شخصی

جدول `study_path_reading` وضعیت هر کتاب را با کلید `(person_id,item_id)` نگه می‌دارد. حالت بدون شروع، نبود ردیف است؛ حالت‌های ثبت‌شده `reading` و `completed` هستند. PATCH `/api/v1/study-paths/:id/items/:itemId/reading` فقط برای شخص جاری و پس از بررسی دسترسی به سیر اجرا می‌شود. پاسخ detail وضعیت همان فرد، قابلیت `canTrackReading` و درصد محاسبه‌شده در سرور را برمی‌گرداند. درصد برابر کتاب‌های تمام‌شده تقسیم بر تعداد کتاب‌های فعلی سیر است؛ تا شروع مطالعه نوار نمایش داده نمی‌شود. OpenAPI و کلاینت تولیدشده به‌روز شدند.

کارت‌ها از توکن عرض ۲۰۰ پیکسل و جلد عمودی ۳:۴ استفاده می‌کنند؛ شماره‌ها با formatNumber فارسی می‌شوند. سربرگ compact از اجزای داخلی استفاده می‌کند. اگر جلد قابل دریافت نباشد، نماد کتاب جای آن نمایش داده می‌شود.

## وضعیت مالی شخص جاری

`GET /api/v1/finance/me` با سیاست `member_finance/read/self` گروه فعال خود شخص را پیدا می‌کند و فقط `groupId`، `canViewGroupFinance` و وضعیت `no_group | no_costs | costs_defined` برمی‌گرداند. فهرست داخلی program_event همچنان مختص مربی و مسئول مالی است؛ پنل عضو دیگر آن endpoint را فراخوانی نمی‌کند. مسئول مالی از قابلیت برگشتی API برای دیدن فهرست مجاز استفاده می‌کند. نبود مبلغ مثبت در مقصدهای مالی یا ردیف هزینه، حالت `no_costs` است. این وضعیت بیانگر نبود هزینهٔ تعریف‌شده در این بخش است، نه محاسبهٔ ماندهٔ بدهی از دفتر پرداخت‌های فردی که هنوز پیاده نشده است. خطاهای شبکه و مجوز به حالت بدون بدهی تبدیل نمی‌شوند. توضیح سربرگ مالی و اعلان فقط‌مشاهده حذف شدند.

## حالت خالی اردو

توضیح سربرگ فهرست اردو و راهنمای زیر عنوان حالت خالی حذف شدند. حالت خالی داخل Card استاندارد با سطح متمایز از پس‌زمینهٔ صفحه نمایش داده می‌شود. EmptyState با hint=null می‌تواند توضیح را کاملاً پنهان کند؛ رفتار پیش‌فرض سایر استفاده‌ها حفظ شده است. نمونهٔ روشن/تیره در /dev/design اضافه و در عرض‌های ۳۹۰ و ۱۴۴۰ بررسی شد (تصاویر camp-empty-*). typecheck رابط و lint سه فایل تغییرکرده پاس شدند. داده‌های نمونهٔ اردو حفظ شدند و برای بررسی حالت خالی حذف نشدند.

## پروفایل فشرده و آواتار خصوصی

پروفایل در دسکتاپ دو ستون دارد: فرم هویت با فاصله‌های کمتر و دکمهٔ ذخیرهٔ هم‌اندازهٔ محتوا، و کارت آواتار/تغییر رمز. در موبایل ستون‌ها زیر هم قرار می‌گیرند. فرم تغییر رمز در Dialog باز می‌شود؛ مسیر احراز هویت و اعتبارسنجی رمز تغییر نکرده است. توضیح سربرگ و خروج تکراری داخل پروفایل حذف شدند؛ خروج پوستهٔ اصلی باقی است.

ستون person.avatar_file_id به file_record متصل است. AvatarService فقط از actor جاری استفاده می‌کند. GET و POST /people/me/avatar سیاست‌های avatar/read/self و avatar/update/self دارند. people/me قابلیت canUploadAvatar و URL خصوصی نسخه‌دار می‌دهد؛ آواتار در پروفایل و پوسته نمایش داده می‌شود. JPEG/PNG/WebP حداکثر ۲ MiB و ۱۶٬۷۷۷٬۲۱۶ پیکسل پذیرفته می‌شوند؛ sharp 0.35.5 محتوای واقعی را decode کرده، تصویر متحرک و SVG را رد می‌کند، چرخش را اعمال و خروجی WebP ۵۱۲×۵۱۲ بدون EXIF/GPS می‌سازد. فایل پشت StorageAdapter موجود ذخیره می‌شود و فقط API خصوصی آن را با no-store برمی‌گرداند. جایگزینی عکس metadata ممیزی ثبت می‌کند؛ فایل پیشین برای پاکسازی پس از سه روز علامت می‌خورد.

## اصلاح مجوز بارگذاری آلبوم multipart

Guard پیش از Multer اجرا می‌شود و groupId فرم multipart در آن زمان در دسترس نیست؛ این امر بارگذاری مجاز مربی را با ۴۰۳ متوقف می‌کرد. POST /album/photos اکنون groupId را به‌صورت query لازم دریافت می‌کند تا guard پیش از خواندن فایل، مالک گروه را با can() بررسی کند. پس از parse فرم، controller برابری groupId فرم و query را کنترل می‌کند و سرویس دوباره policy را اعمال می‌کند. OpenAPI، کلاینت و seed تصاویر با این قرارداد هم‌تراز شدند. مجوز جدید یا دورزدن guard اضافه نشده است.

## رمزگذاری محتوای S3

آزمون زنده نشان داد سرویس فعلی، با وجود نبود bucket policy قابل خواندن، محتوای object را با GET ناشناس نیز تحویل می‌دهد؛ پس اتکا به UUID یا صرفاً URL امضاشده کافی نیست. FilesModule اکنون S3StorageAdapter را در EncryptedStorageAdapter قرار می‌دهد: همهٔ نوشتن‌های API با CryptoService و AES-256-GCM، کلیدهای نسخه‌دار موجود و AAD وابسته به storage_key رمز می‌شوند. object فقط application/octet-stream رمز‌شده است. بازخوانی فقط داخل API رمزگشایی می‌شود؛ محتوای plaintext یا دستکاری‌شده پذیرفته نمی‌شود. URL دانلود کوتاه‌عمر نیز از مسیر token دار API می‌گذرد و قبل از رمزگشایی actor و can() دوباره بررسی می‌شوند؛ URL مستقیم S3 برنمی‌گردد. آداپتر local مانند قبل با فایل خصوصی محلی کار می‌کند.

ابزار توسعهٔ scripts/encrypt-s3-files.cjs برای تبدیل فایل‌های ثبت‌شدهٔ موجود افزوده شد. ۸ object موجود (آواتارها، جلدها و تصاویر نمونه) رمز و بایت‌های بازخوانی‌شده بررسی شدند؛ ۴۳ فایل قدیمی seed محلی اصلاً در S3 نبودند و تغییری نکردند. seed تصویری جدید هم از wrapper رمزگذاری‌شده استفاده می‌کند. کلیدهای ENCRYPTION_KEYS باید همراه چرخهٔ پشتیبان‌گیری حفظ شوند؛ حذف نسخهٔ قدیمی کلید، فایل‌های مربوط به آن نسخه را ناخوانا می‌کند.

## شادابی رابط و هویت بصری

خانهٔ عضو و مربی و صفحهٔ ورود از تصویر سه‌بعدی محلی `assets/illustrations/together.webp` (۴۸ کیلوبایت، WebP شفاف) استفاده می‌کنند. رنگ‌های mint/lavender/peach/sky/honey برای روشن و تیره در `theme/tokens.ts` تعریف شده‌اند؛ متن روی هر سطح حداقل کنتراست AA دارد. QuickAccess، آیکن‌های حجمی حالت خالی، رنگ‌بندی آیکن‌های ناوبری و آمار پشت کتابخانهٔ داخلی UI هستند. ناوبری پایین موبایل نام گزینه‌ها را نمایش می‌دهد. در موبایل فرم ورود پیش از تصویرسازی می‌آید تا اقدام اصلی در دسترس باشد. حالت کاهش حرکت از تنظیم موجود پوسته پیروی می‌کند.

لوگوی دارای نوشته و نشان بدون نوشتهٔ ارسالی مالک در `public/brand/` نگهداری می‌شوند. `scripts/generate-assets.mjs` از این اصل‌ها لوگو، favicon.ico، PNGهای ۳۲/۱۹۲/۵۱۲ و icon.svg (حاوی نشان واقعی) تولید می‌کند؛ آیکن قالب دوباره تولید نمی‌شود. metadata و manifest از نشان بدون نوشته استفاده می‌کنند. نسخهٔ cache آفلاین برای دارایی‌های جدید افزایش یافته؛ دادهٔ شخصی cache نمی‌شود. برند و لوگو با تصویرسازی تزئینی جایگزین نشده‌اند.

اعتبارسنجی این تغییر در `docs/phases/VISUAL_REFRESH.md` ثبت شده است. هیچ migration، endpoint یا قاعدهٔ دسترسی اضافه نشده است.

لوگوی رابط با `public/brand/logo-transparent.png` بدون زمینهٔ سفید تولید می‌شود؛ `logo-source.png` اصل ارسالی مالک باقی می‌ماند. پس‌زمینهٔ سفید CSS در حالت تیره نیز از BrandMark حذف شد تا شفافیت روی هر دو پوسته حفظ شود. نشان favicon مستقل باقی است.

## کنترل‌های ورود

فیلد موبایل صفحهٔ ورود فقط ارقام فارسی/عربی/لاتین می‌پذیرد، آن‌ها را در فرم به لاتین تبدیل و نمایش را فارسی می‌کند؛ طول به ۱۱ رقم محدود است و قالب محلی ۰۹ استفاده می‌شود. ارسال شمارهٔ ناقص با خطای inline و Dialog فارسی متوقف می‌شود. اعتبارسنجی مشترک همچنان پیش‌شماره را بررسی و شماره را برای API به قالب بین‌المللی تبدیل می‌کند؛ قرارداد API تغییر نکرده است. Input برای رمز عبور دکمهٔ نمایش/مخفی‌سازی با برچسب دسترس‌پذیر و type=button دارد؛ رمز در ابتدا مخفی است و toggle فرم را ارسال نمی‌کند. آزمون‌های مرورگر در tests/login-controls.spec.ts ثبت شده‌اند.

تصویر بزرگ صفحهٔ ورود طبق درخواست مالک با نسخهٔ سه‌بعدی لوگوی اصلی جایگزین شد (`assets/illustrations/safanoor-3d.webp`، زمینهٔ شفاف، سبز و طلایی). لوگوی کوچک و favicon همان دارایی‌های برند هستند؛ تصویر تزئینی خانه تغییر نکرده است.

## گروه اصلی مستقل از مسئولیت کمک‌مربی

طبق اصلاح صریح مالک، محمدجواد رضوانیان نیروی صفا ۲۰، کمک‌مربی صفا ۲۷ و مربی صفا ۳۳ است. migration شمارهٔ ۲۹ قید قدیمی هم‌گروهی اجباری member/assistant را از تابع validate_membership حذف می‌کند؛ عضویت اصلی یکتا، الزام عضویت افراد فعال و منع چرخه همچنان برقرارند. فقط شناسهٔ رزروشدهٔ همین فرد (با کنترل نام و وجود گروه مقصد) اصلاح می‌شود: عضویت member قبلی بسته و ردیف تازهٔ صفا ۲۰ ایجاد می‌شود، نقش‌های دیگر و پیگیری‌های او به‌عنوان کمک‌مربی حفظ می‌شوند، closure بازسازی، نقش فعال member قدیمی اصلاح و ممیزی بدون محتوای حساس ثبت می‌شود. سایر افراد جابه‌جا نمی‌شوند. endpoint تخصیص نقش به افراد دیگر گسترش نیافته است.

seed سلسله‌مراتب برای همین فرد primaryGroup=20 دارد؛ اجرای دوباره، گروه او را به ۲۷ برنمی‌گرداند. تست مستقل PostgreSQL اجرای seed دوبار، اصلاح دادهٔ قدیمی، حفظ تاریخچه و نقش فعال، یکتایی member و جداسازی can() بین نقش‌های member/assistant/mentor را بررسی می‌کند.

## تصویرسازی مقصدهای برنامه‌ها

مسیر /programs هفت کارت با تصویر سه‌بعدی مستقل و زمینهٔ شفاف دارد: کتابخانه، جلسات، مشاوره، کلاس، آلبوم، مالی و اردو. سبک تصاویر اشیای واقعی با بافت پارچه، چرم، فلز و شیشه است؛ عناصر کارتونی اضافه نشده‌اند. فایل‌های WebP عمومی در public/assets/illustrations/programs قرار دارند. ProgramTiles در کتابخانهٔ UI، صفحهٔ ProgramsScreen در features و route صرفاً ترکیب Session/Screen است؛ سبک ad hoc از route حذف شد. ابعاد تصویر و رنگ‌های روشن/تیره از tokens، متن‌ها از fa تأمین می‌شوند. کارت‌ها دو ستون در موبایل، سه در تبلت و چهار در دسکتاپ دارند، با فوکوس کیبورد مشخص و رعایت کاهش حرکت؛ در خرابی تصویر عنوان مقصد و جایگزین متنی حفظ می‌شوند. نمونهٔ مؤلفه در /dev/design نیز افزوده شد. مقصدها و دسترسی API همان مقصدهای قبلی‌اند.

سربرگ موبایل (عرض کمتر از ۶۰۰ پیکسل) لوگوی ۴۸ پیکسلی و ارتفاع کل ۶۵ پیکسل دارد؛ نوشتهٔ تکراری کنار لوگو در BrandWords مخفی است. اندازهٔ لوگو از artwork.logoMobile خوانده می‌شود و اندازهٔ دسکتاپ و لوگوی صفحهٔ ورود تغییر نکرده‌اند. TypeScript و lint فایل‌های تغییرکرده موفق‌اند. به‌علت خاموش بودن Docker، بررسی بصری سربرگ با پاسخ آزمایشی Session انجام می‌شود و آزمون کامل API اجرا نشده است.

پروفایل از ProfilePanel با رنگ‌های mint/lavender/sky در توکن‌ها استفاده می‌کند: اطلاعات پایه، عکس و امنیت حساب در کارت‌های جدا. عنوان راهنما و نمادهای Rounded اضافه شده‌اند؛ ورودی‌ها روی سطح خوانا و خنثی باقی می‌مانند. آواتار پیش‌فرض به PersonRounded محلی تبدیل شد تا در نبود سرویس Iconify مربع خالی نمایش داده نشود. فرم‌ها و سیاست دسترسی تغییر نکرده‌اند. بررسی بصری با دادهٔ آزمایشی رابط (بدون Docker/API واقعی) در عرض‌های ۳۹۰/۴۸۷/۱۴۴۰ و دو پوسته انجام می‌شود.

پروفایل زیر عرض ۹۰۰ پیکسل به‌جای ردیف نقش/تأیید/کد ملی پوشانده‌شده، انتخاب نقش فعال را از availableRoles واقعی API نشان می‌دهد. SessionContext همان switchRole مشترک سایدبار را در اختیار پروفایل می‌گذارد؛ تعویض نقش cache را پاک و پاسخ تازهٔ /people/me را جایگزین می‌کند. دسکتاپ ردیف قبلی و سایدبار را حفظ می‌کند. TypeScript و lint فایل‌های تغییرکرده موفق‌اند؛ بازبینی UI با پاسخ آزمایشی شامل چهار نقش انجام می‌شود.

## صفحهٔ جاری و سابقهٔ مطالعه

migration شمارهٔ ۳۰ تعداد صفحات اختیاری کتاب‌های قدیمی، current_page و جدول study_reading_event را اضافه می‌کند. ساخت کتاب جدید در DTO و فرم نیازمند تعداد صفحات صحیح ۱ تا ۱۰۰۰۰۰ است؛ حدسی برای کتاب‌های قبلی وارد نمی‌شود. مربی از عملیات همان کتاب تعداد صفحات را تکمیل می‌کند؛ کاهش تعداد به زیر پیشرفت ثبت‌شده رد می‌شود. رویدادها صفحهٔ قبل/بعد، delta، زمان UTC و روز تقویمی تهران را نگه می‌دارند. get سیر فقط برای فرد جاری و پس از can(study_path/read) و can(study_reading/read/self)، صفحه و جمع تغییرات روزانهٔ ۹۰ روز اخیر را می‌دهد؛ رویدادهای قدیمی در DB باقی‌اند. تغییر صفحه تحت قفل کتاب سری می‌شود؛ ارسال تکراری همان صفحه رویداد اضافه ندارد و عقب‌گرد delta منفی دارد تا رفت‌وبرگشت، مطالعهٔ کاذب نسازد.

پایان کتاب در API فقط با currentPage=totalPages و confirmCompleted=true پذیرفته می‌شود. در UI، رسیدن به آخر ابتدا تیک متحرک و Dialog تأیید نشان می‌دهد و هنوز درخواست پایان ارسال نمی‌کند. رد/بستن Dialog، ثبت reading در max-1 را انجام می‌دهد؛ سپس فرد می‌تواند صفحه را ویرایش کند. تأیید، chip سبز روی جلد را جایگزین کنترل‌ها می‌کند. تکمیل‌های قدیمی حفظ می‌شوند و برایشان تاریخچهٔ صفحهٔ ساختگی ساخته نمی‌شود. دکمهٔ PDF برچسب دانلود، آیکن PDF محلی و عمق قرمز دارد؛ فایل همان URL احراز‌شدهٔ قبلی است. بلوک عملیات در پایین کارت و با عرض ثابت قرار دارد.

اعتبارسنجی: migration از صفر و seed دوبار در دیتابیس آزمون، ۲۵ تست HTTP PostgreSQL، TypeScript و lint فایل‌های تغییرکرده؛ تست Playwright شروع، ثبت ۶۰، رسیدن به آخر بدون ذخیره، انصراف و برگشت به ۹۹، تأیید نهایی، لینک PDF و هم‌ترازی کنترل‌ها موفق. تصاویر ۳۹۰/۱۴۴۰ در روشن/تیره در docs/screens/reading-pages-* بازبینی شدند. migration روی دیتابیس توسعه نیز اعمال شد. بررسی UI با پاسخ آزمایشی API و بررسی سیاست/تاریخچه با PostgreSQL واقعی انجام شد.

## فیلتر و ترتیب آلبوم

GET /album/albums و /album/photos پارامتر myOnly (boolean واقعی با parse صریح true/false) و sort با مقادیر محدود newest/oldest/most_photos می‌پذیرند. «عکس‌های من» فقط photo_tag.person_id شخص جاری را بررسی می‌کند و با گروه‌های قابل مشاهده و can(photo/read) اشتراک دارد؛ بارگذاری‌کننده بودن به‌تنهایی معیار نیست. فیلتر پیش از گروه‌بندی، انتخاب جلد، شمارش و صفحه‌بندی اعمال می‌شود. ترتیب آلبوم بر اساس تاریخ آخرین عکس یا تعداد عکس‌های قابل مشاهده است، با کلید پایدار برای مقادیر برابر. most_photos داخل یک آلبوم به جدیدترین عکس‌ها تبدیل می‌شود. فیلتر هنگام ورود به آلبوم حفظ و در query key نیز لحاظ می‌شود. Select داخلی شناسهٔ پایدار useId دارد تا برچسب آن به کنترل متصل باشد. قرارداد OpenAPI و کلاینت بازتولید شده‌اند؛ migration لازم نیست.

### Development member finance preview

A server-gated fictional preview helps review the member finance UI before actual individual charge/payment accounting exists. `/finance/me` advertises availability in development; `/finance/demo` returns synthetic settled/partial/unpaid examples, server-computed totals and dated sample payments. No database writes or real debts are created. Production retains existing status-only behavior. See `phases/FINANCE_PREVIEW.md`.

### Role selector ordering

The API returns the technical manager first, then group roles sorted by Persian group name with numeric collation (for example Safa 20, 27, 33). Both the sidebar and mobile profile selector consume the same ordered list. Active-role identifiers and permissions are unchanged.

### Unassigned director reporting role

Owner confirmed no assignment yet and no confidential individual content. Migration 31 introduces `app_user.is_director=false` and a separate active `director` role; no seed grants it. `organization_report` policy authorizes two read-only dashboard routes: implemented-module aggregates and paginated name/role/group roster with explicit safe SQL projection. A central director ceiling in can() prevents inherited writes, private reads or grant/admin escalation. Server capability `viewOrganizationReports` selects the report home and read-only profile. See `phases/DIRECTOR_ROLE.md` for coverage and remaining reporting scope.

### Recovery of deferred chat refinements

Dashboard charts now share a token palette, Persian formatters for every displayed axis/category/tooltip, dedicated axis dimensions, and immediately completed rendering (including offscreen charts and reduced-motion). Recent conversation cards render the API-authorized title/preview/time instead of avatars-only. Member home uses colored internal panels. Capability `viewCamps` controls all camp entry points; migration32 replaces generic same-group reading with staff policy, and central can() denies selected member-role camp access. Camp list queries respect active role group. Full request audit: phases/CHAT_RECOVERY.md.

## Assistant workspace and presentation fixtures (2026-11-12)

`AssistantModule` extends the existing Nest application with server-scoped assistant summary, paginated assigned roster/work items/sessions/camp duties, recorded attendance and logged emergency cards. Migrations 33–36 add one-off group sessions, attendance, operational follow-up items, encrypted emergency storage, camp schedule responsibility and data-driven policies. Work-item and attendance mutations recheck current assignment under the hierarchy advisory lock. The generated contract exposes `viewAssistantWorkspace`; the member home and mobile «گروه من» render the same workspace. Mentor dashboard creates attendance programs. All visuals reuse internal UI components and existing design tokens.

The existing worker generates due reminders before notification delivery, deduplicated by item and current assistant. `seed:evening-demo` is a local, idempotent additive seed, distinct from the broad hierarchy seed, preserving existing people/passwords/assignments. Fixtures explicitly label fictional people «نمایشی». This introduces operational follow-up work items and one-off attendance programs; it does not implement the full project or recurring schedule engines. See `docs/phases/ASSISTANT_PRESENTATION.md` for scope and validation.
