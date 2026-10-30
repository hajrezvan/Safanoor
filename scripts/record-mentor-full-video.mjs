import { chromium } from '@playwright/test';
import { mkdir, rename, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

if (process.env.SAFANOOR_RECORDING !== '1')
  throw new Error('Set SAFANOOR_RECORDING=1 and use a disposable recording database.');

const baseURL = process.env.SAFANOOR_URL ?? 'http://localhost:3033';
const password = process.env.SAFANOOR_DEMO_PASSWORD ?? 'SafanoorDemo#1405';
const outputDir = path.join(process.cwd(), 'docs', 'videos');
const rawDir = path.join(outputDir, '.mentor-full-raw');
const videoSize = { width: 1280, height: 720 };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fullCard(page, title, subtitle, duration = 2200) {
  await page.evaluate(
    ({ title, subtitle }) => {
      document.getElementById('safanoor-video-guide')?.remove();
      const card = document.createElement('div');
      card.id = 'safanoor-video-guide';
      card.dir = 'rtl';
      card.innerHTML = `<div style="font-size:40px;font-weight:850">${title}</div><div style="font-size:21px;line-height:1.9;opacity:.86;margin-top:14px;max-width:760px">${subtitle}</div><div style="font-size:15px;opacity:.62;margin-top:22px">سامانهٔ هوشمند صفانور · راهنمای کامل مربی · فاز اول</div>`;
      Object.assign(card.style, {
        position: 'fixed', inset: '0', zIndex: '2147483647', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '48px', color: '#f7faf8',
        background: 'linear-gradient(135deg,#123c35 0%,#1f685a 58%,#d09b45 160%)',
        fontFamily: 'Vazirmatn, Tahoma, sans-serif', transition: 'opacity 300ms ease',
      });
      document.body.append(card);
    },
    { title, subtitle },
  );
  await wait(duration);
  await page.evaluate(() => {
    const card = document.getElementById('safanoor-video-guide');
    if (card) card.style.opacity = '0';
  });
  await wait(340);
  await page.evaluate(() => document.getElementById('safanoor-video-guide')?.remove());
}

async function guide(page, title, subtitle, duration = 3300) {
  await page.evaluate(
    ({ title, subtitle }) => {
      document.getElementById('safanoor-video-guide')?.remove();
      const card = document.createElement('div');
      card.id = 'safanoor-video-guide';
      card.dir = 'rtl';
      card.innerHTML = `<div style="font-size:21px;font-weight:800">${title}</div><div style="font-size:15px;line-height:1.8;opacity:.8;margin-top:7px">${subtitle}</div>`;
      Object.assign(card.style, {
        position: 'fixed', left: '28px', bottom: '28px', zIndex: '2147483647', width: '410px',
        color: '#163d36', background: 'rgba(255,255,255,.96)', border: '1px solid rgba(22,61,54,.14)',
        borderRadius: '22px', padding: '20px 22px', boxShadow: '0 18px 48px rgba(9,38,33,.18)',
        fontFamily: 'Vazirmatn, Tahoma, sans-serif', transition: 'opacity 260ms ease,transform 260ms ease',
      });
      document.body.append(card);
    },
    { title, subtitle },
  );
  await wait(duration);
  await page.evaluate(() => {
    const card = document.getElementById('safanoor-video-guide');
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(12px)';
    }
  });
  await wait(300);
  await page.evaluate(() => document.getElementById('safanoor-video-guide')?.remove());
}

async function openPage(page, route) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  await page.locator('main').first().waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await wait(500);
}

async function select(page, label, option, scope = page) {
  await scope.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await wait(500);
}

async function smoothScroll(page, top) {
  await page.evaluate((value) => window.scrollTo({ top: value, behavior: 'smooth' }), top);
  await wait(1100);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

await mkdir(rawDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: videoSize,
  recordVideo: { dir: rawDir, size: videoSize },
  locale: 'fa-IR',
  colorScheme: 'light',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

await openPage(page, '/auth/jwt/sign-in');
await fullCard(
  page,
  'راهنمای کامل نقش مربی',
  'تمام قابلیت‌های قابل استفادهٔ مربی در فاز اول را قدم‌به‌قدم و با دادهٔ آزمایشی اجرا می‌کنیم.',
  3200,
);
await guide(page, 'ورود امن', 'هر مربی با شمارهٔ همراه و رمز عبور خود وارد می‌شود.', 2500);
await page.getByLabel('شماره همراه', { exact: true }).fill('+989100000003');
await wait(600);
await page.getByLabel('رمز عبور', { exact: true }).fill(password);
await wait(600);
await page.getByRole('button', { name: 'ورود به صفانور', exact: true }).click();
await page.waitForURL((url) => url.pathname === '/', { timeout: 20000 });
await page.getByRole('heading', { name: 'همه‌چیز از همراهی شروع می‌شود' }).waitFor();
await guide(
  page,
  'خانهٔ مربی',
  'جایگاه سازمانی، گروه، وضعیت هویت و تازه‌ترین اعلان‌ها در یک نگاه دیده می‌شوند.',
  4200,
);
await smoothScroll(page, 430);
await smoothScroll(page, 0);

await page.getByRole('link', { name: 'مدیریت', exact: true }).click();
await page.waitForURL((url) => url.pathname === '/admin');
await guide(
  page,
  'نمای کلی گروه',
  'آمار این صفحه در سرور و فقط از اطلاعاتی محاسبه می‌شود که مربی اجازهٔ دیدن آن‌ها را دارد.',
  4200,
);

await page.getByRole('link', { name: 'اعضا', exact: true }).click();
await page.waitForURL((url) => url.pathname === '/admin/people');
await fullCard(
  page,
  'مدیریت اعضای گروه',
  'افزودن عضو، ویرایش اطلاعات پایه، تأیید هویت و غیرفعال‌سازی کنترل‌شده',
  1900,
);
await guide(page, 'فهرست محدود به گروه', 'مربی فقط افراد تحت مسئولیت خودش را در این فهرست می‌بیند.', 3200);
await page.getByRole('button', { name: 'افزودن', exact: true }).click();
const createDialog = page.getByRole('dialog');
await createDialog.waitFor();
await guide(page, 'افزودن عضو جدید', 'اطلاعات هویتی، تاریخ جلالی، جایگاه و گروه از همین فرم ثبت می‌شوند.', 3200);
await createDialog.getByLabel('نام', { exact: true }).fill('آرین');
await createDialog.getByLabel('نام خانوادگی', { exact: true }).fill('نمایشی');
await createDialog.getByLabel('نام پدر', { exact: true }).fill('رضا');
await createDialog.getByLabel('شماره همراه', { exact: true }).fill('+989100009999');
await createDialog.getByLabel('کد ملی', { exact: true }).fill('4567891236');
const birthDate = createDialog.getByRole('group', { name: 'تاریخ تولد' });
await birthDate.getByRole('spinbutton', { name: 'Year' }).fill('1388');
await birthDate.getByRole('spinbutton', { name: 'Month' }).fill('07');
await birthDate.getByRole('spinbutton', { name: 'Day' }).fill('15');
await select(page, 'گروه', 'رویش', createDialog);
await wait(1200);
await createDialog.getByRole('button', { name: 'ذخیره تغییرات', exact: true }).click();
await createDialog.waitFor({ state: 'hidden', timeout: 20000 });
await guide(page, 'ثبت موفق', 'عضو تازه ایجاد شد و اکنون برای بررسی هویت در فهرست مربی قرار دارد.', 3200);

const search = page.getByLabel('جست‌وجو', { exact: true });
await search.fill('آرین نمایشی');
await page.getByText('آرین نمایشی', { exact: true }).waitFor();
await page.getByRole('button', { name: 'تأیید پیوند والد', exact: true }).click();
const parentDialog = page.getByRole('dialog');
await parentDialog.waitFor();
await guide(
  page,
  'تأیید پیوند والد',
  'برای عضو زیر هجده سال، مربی ارتباط والدِ دارای حساب را پس از احراز رابطه تأیید می‌کند.',
  3200,
);
await parentDialog.getByLabel('شمارهٔ همراه والد', { exact: true }).fill('+989100000031');
await parentDialog.getByRole('button', { name: 'ذخیره تغییرات', exact: true }).click();
await parentDialog.waitFor({ state: 'hidden', timeout: 15000 });
await page.getByText('آرین نمایشی', { exact: true }).waitFor();
await guide(page, 'تأیید هویت', 'پس از تطبیق حضوری مدارک، مربی وضعیت هویت عضو را تأیید می‌کند.', 3000);
await page.getByRole('button', { name: 'تأیید هویت', exact: true }).click();
await page.getByText('هویت تأییدشده', { exact: true }).waitFor({ timeout: 15000 });
await wait(1600);

await page.getByRole('button', { name: 'ویرایش', exact: true }).click();
const editDialog = page.getByRole('dialog');
await editDialog.waitFor();
await guide(
  page,
  'ویرایش اطلاعات پایه',
  'تغییرات هویتی از API کنترل‌شده عبور می‌کنند و در رویدادهای سامانه ثبت می‌شوند.',
  3200,
);
await editDialog.getByLabel('نام پدر', { exact: true }).fill('رضا محمد');
await editDialog.getByRole('button', { name: 'ذخیره تغییرات', exact: true }).click();
await editDialog.waitFor({ state: 'hidden', timeout: 15000 });
await wait(1200);

await search.fill('امیرحسین صدری');
await page.getByText('امیرحسین صدری', { exact: true }).waitFor();
await page.getByRole('button', { name: 'غیرفعال کردن', exact: true }).click();
const deactivateDialog = page.getByRole('dialog');
await deactivateDialog.waitFor();
await guide(
  page,
  'محافظت از پیگیری‌های باز',
  'کمک‌مربی دارای عضوِ تحت پیگیری، تا زمان واگذاری مسئولیت‌ها قابل غیرفعال‌سازی نیست.',
  3600,
);
await deactivateDialog.getByRole('button', { name: 'تأیید', exact: true }).click();
await deactivateDialog.getByText('ابتدا اعضا و پیگیری‌های باز را واگذار کنید.').waitFor({ timeout: 12000 });
await wait(2500);
await deactivateDialog.getByRole('button', { name: 'انصراف', exact: true }).click();

await page.getByRole('link', { name: 'گروه‌ها', exact: true }).click();
await page.waitForURL((url) => url.pathname === '/admin/groups');
await fullCard(
  page,
  'گروه و پیگیری اعضا',
  'مشاهدهٔ اعضا، تاریخچهٔ مسئولیت‌ها و واگذاری هر عضو به کمک‌مربی مناسب',
  1900,
);
await page.getByRole('button', { name: 'اعضای گروه', exact: true }).click();
const assignmentHeading = page.getByRole('heading', { name: 'واگذاری پیگیری', exact: true });
await assignmentHeading.waitFor();
const assignmentCard = assignmentHeading.locator('xpath=ancestor::*[contains(@class,"MuiPaper-root")][1]');
await smoothScroll(page, 520);
await guide(page, 'واگذاری پیگیری', 'نسبت ثابت یا سقف اجباری وجود ندارد؛ انتخاب کمک‌مربی به‌صورت داده و همراه تاریخچه ثبت می‌شود.', 3800);
await select(page, 'عضو', 'آرین نمایشی', assignmentCard);
await select(page, 'کمک‌مربی مسئول', 'محمدطاها کاظمی', assignmentCard);
await assignmentCard.getByRole('button', { name: 'واگذاری پیگیری', exact: true }).click();
await wait(2200);
await guide(page, 'انتقال عضویت', 'در بخش بعدی می‌توان عضویت فرد را با حفظ تاریخچه به گروه تحت مدیریت منتقل کرد.', 3000);
await smoothScroll(page, 850);
await wait(1800);

await page.getByRole('link', { name: 'ورود گروهی', exact: true }).click();
await page.waitForURL((url) => url.pathname === '/admin/imports');
await fullCard(
  page,
  'ورود گروهی CSV یا Excel',
  'فایل ابتدا بررسی می‌شود؛ هیچ ردیفی بدون پیش‌نمایش و تأیید مربی وارد سامانه نمی‌شود.',
  2100,
);
await select(page, 'گروه', 'رویش');
const csv = [
  'firstName,lastName,fatherName,birthDate,nationalId,phone,group',
  'سام,رستگار,حسن,1390/02/14,4567891244,+989100009997,20000000-0000-4000-8000-000000000003',
  'ماهان,شریفی,مهدی,1387/09/20,4567891252,+989100009998,20000000-0000-4000-8000-000000000003',
].join('\n');
await page.locator('input[type="file"]').setInputFiles({
  name: 'اعضای-نمونه.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(csv),
});
await guide(page, 'انتخاب گروه و فایل', 'سامانه قالب فایل، کد ملی، تاریخ جلالی، تکراری‌ها و مجوز مربی را کنترل می‌کند.', 3400);
await page.getByRole('button', { name: 'بررسی فایل', exact: true }).click();
const importDialog = page.getByRole('dialog');
await importDialog.waitFor({ timeout: 15000 });
await importDialog.getByText('آمادهٔ تأیید', { exact: true }).waitFor({ timeout: 25000 });
await guide(page, 'پیش‌نمایش قبل از ثبت', 'تعداد ردیف‌های معتبر و خطادار همراه با جزئیات هر ردیف نمایش داده می‌شود.', 4200);
await importDialog.getByRole('button', { name: 'تأیید و ورود اطلاعات', exact: true }).click();
await importDialog.getByText('ثبت‌شده', { exact: true }).waitFor({ timeout: 30000 });
await guide(page, 'ثبت توسط Worker', 'پس از تأیید مربی، پردازش پس‌زمینه اعضای معتبر را به‌صورت قابل پیگیری ثبت می‌کند.', 3600);
await page.keyboard.press('Escape');
await importDialog.waitFor({ state: 'hidden' });

await page.getByRole('link', { name: 'دسترسی‌ها', exact: true }).click();
await page.waitForURL((url) => url.pathname === '/admin/access');
await fullCard(
  page,
  'ارجاع‌های دسترسی',
  'مربی ارجاع‌های صادرشده را می‌بیند و هر زمان لازم باشد دسترسی را لغو می‌کند.',
  1900,
);
await guide(
  page,
  'دسترسی حداقلی و قابل لغو',
  'جدول سیاست‌ها برای مربی قابل تغییر نیست؛ این نقش فقط ارجاع‌های مجاز مربوط به اعضای خودش را مدیریت می‌کند.',
  3600,
);
const revoke = page.getByRole('button', { name: 'لغو دسترسی', exact: true }).first();
await revoke.click();
await page.getByText('لغوشده', { exact: true }).first().waitFor({ timeout: 15000 });
await wait(2200);

await openPage(page, '/notifications');
await fullCard(page, 'اعلان‌های مربی', 'موارد مهم و پیگیری‌های تازه در یک فهرست ساده و خوانا', 1700);
await guide(page, 'خواندن اعلان', 'با لمس هر اعلان، وضعیت آن بدون بارگذاری دوباره و به‌صورت خوش‌بینانه به‌روز می‌شود.', 3000);
const unreadNotification = page.getByRole('button', { name: /خواندم/ }).first();
await unreadNotification.click();
await wait(2200);

await openPage(page, '/profile');
await guide(page, 'پروفایل مربی', 'اطلاعات پایه، تاریخ جلالی، وضعیت تأیید هویت و تغییر رمز عبور در این صفحه قرار دارند.', 4200);
await smoothScroll(page, 460);
await wait(1400);

await openPage(page, '/consent');
await guide(
  page,
  'رضایت و حریم خصوصی',
  'رضایت‌ها نسخه‌دار هستند و انتخاب انتشار عمومی تصویر یا صدا اختیاری باقی می‌ماند.',
  4200,
);

await openPage(page, '/admin/audit');
await fullCard(
  page,
  'مرز دسترسی نقش مربی',
  'رویدادهای سراسری سامانه و تنظیمات فنی در اختیار مدیر فنی‌اند و برای مربی نمایش داده نمی‌شوند.',
  2300,
);
await page.getByText('این بخش برای حساب شما در دسترس نیست.').waitFor();
await wait(2400);

await openPage(page, '/');
await fullCard(
  page,
  'جمع‌بندی نقش مربی',
  'مدیریت اعضا و پیگیری‌ها، ورود گروهی کنترل‌شده، ارجاع‌های قابل لغو، اعلان‌ها، پروفایل و رضایت؛ همگی با دسترسی حداقلی و ثبت رویداد.',
  4300,
);

const video = page.video();
await context.close();
const rawPath = await video.path();
const stableRaw = path.join(rawDir, '04-mentor-full.webm');
if (rawPath !== stableRaw) await rename(rawPath, stableRaw);
await browser.close();

const output = path.join(outputDir, '04-mentor.mp4');
await run('ffmpeg', [
  '-y', '-i', stableRaw, '-an', '-vf', 'scale=1280:720:flags=lanczos,fps=24',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '27', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', '-maxrate', '1200k', '-bufsize', '2400k', output,
]);
const info = await stat(output);
if (info.size >= 45 * 1024 * 1024) throw new Error('Mentor video is larger than 45 MiB.');
if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
console.log(`Mentor full video: ${(info.size / 1024 / 1024).toFixed(2)} MiB`);
