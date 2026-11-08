import { chromium } from '@playwright/test';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const baseURL = process.env.SAFANOOR_URL ?? 'http://localhost:8080';
const password = process.env.SAFANOOR_DEMO_PASSWORD ?? '12345678';
const root = process.cwd();
const outputDir = path.join(root, 'docs', 'videos');
const rawDir = path.join(outputDir, '.raw');
const videoSize = { width: 1280, height: 720 };

const roles = [
  {
    slug: '01-admin',
    title: 'مدیر فنی',
    subtitle: 'مدیریت اعضا، گروه‌ها، ورود گروهی و ممیزی',
    login: '+989100000040',
    pages: [
      ['/', 'خانه و اعلان‌های نقش'],
      ['/admin', 'نمای کلی مدیریتی'],
      ['/admin/people', 'مدیریت اعضا'],
      ['/admin/groups', 'ساختار گروه‌ها'],
      ['/admin/imports', 'ورود گروهی اطلاعات'],
      ['/admin/access', 'سیاست‌ها و ارجاع‌ها'],
      ['/admin/audit', 'رویدادهای سامانه'],
      ['/admin/settings', 'تنظیمات سازمان'],
    ],
  },
  {
    slug: '02-supervisor',
    title: 'ناظر',
    subtitle: 'نمای کلان، اعلان‌ها و ارجاع‌های دریافتی',
    login: '+989100000001',
    pages: [
      ['/', 'خانهٔ ناظر'],
      ['/admin', 'نمای کلی مجاز'],
      ['/admin/access', 'ارجاع‌های دریافتی'],
      ['/notifications', 'اعلان‌های ناظر'],
      ['/profile', 'پروفایل و وضعیت هویت'],
    ],
  },
  {
    slug: '03-head-mentor',
    title: 'سرمربی',
    subtitle: 'تجربهٔ نقش سرمربی با رعایت دسترسی محدود',
    login: '+989100000002',
    pages: [
      ['/', 'خانهٔ سرمربی'],
      ['/notifications', 'اعلان‌های سرمربی'],
      ['/profile', 'پروفایل و عضویت'],
      ['/consent', 'رضایت و حریم خصوصی'],
    ],
  },
  {
    slug: '04-mentor',
    title: 'مربی',
    subtitle: 'مدیریت اعضای گروه، پیگیری‌ها و ورود اطلاعات',
    login: '+989100000003',
    pages: [
      ['/', 'خانهٔ مربی'],
      ['/admin', 'نمای کلی گروه'],
      ['/admin/people', 'اعضای قابل مدیریت'],
      ['/admin/groups', 'اعضا و واگذاری پیگیری'],
      ['/admin/imports', 'ورود گروهی اعضا'],
      ['/admin/access', 'ارجاع‌های صادرشده'],
      ['/notifications', 'اعلان‌های مربی'],
    ],
  },
  {
    slug: '05-assistant',
    title: 'کمک‌مربی',
    subtitle: 'پروفایل، عضویت و اعلان‌های مرتبط با پیگیری',
    login: '+989100000005',
    pages: [
      ['/', 'خانهٔ کمک‌مربی'],
      ['/notifications', 'اعلان‌های مرتبط'],
      ['/profile', 'پروفایل و گروه'],
      ['/consent', 'رضایت و حریم خصوصی'],
    ],
  },
  {
    slug: '06-member',
    title: 'نیرو',
    subtitle: 'تجربهٔ ساده و همراه‌محور عضو مجموعه',
    login: '+989100000011',
    pages: [
      ['/', 'خانهٔ نیرو'],
      ['/notifications', 'اعلان‌های شخصی'],
      ['/profile', 'پروفایل من'],
      ['/consent', 'کنترل رضایت و حریم خصوصی'],
    ],
  },
  {
    slug: '07-parent',
    title: 'والد',
    subtitle: 'پنل حداقلی والد و مدیریت رضایت فرزند',
    login: '+989100000032',
    pages: [
      ['/', 'خانه و فرزند تأییدشده'],
      ['/consent', 'رضایت‌نامهٔ فرزند'],
      ['/notifications', 'اعلان‌های والد'],
      ['/profile', 'پروفایل والد'],
    ],
  },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function titleCard(page, title, subtitle, duration = 2200) {
  await page.evaluate(
    ({ title, subtitle }) => {
      document.getElementById('safanoor-video-card')?.remove();
      const card = document.createElement('div');
      card.id = 'safanoor-video-card';
      card.dir = 'rtl';
      card.innerHTML = `<div style="font-size:42px;font-weight:800">${title}</div><div style="font-size:22px;opacity:.82;margin-top:14px">${subtitle}</div><div style="font-size:16px;opacity:.62;margin-top:22px">سامانهٔ هوشمند صفانور · نسخهٔ نمایشی فاز اول</div>`;
      Object.assign(card.style, {
        position: 'fixed', inset: '0', zIndex: '2147483647', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '48px', color: '#f7faf8',
        background: 'linear-gradient(135deg,#123c35 0%,#1f685a 58%,#d09b45 160%)',
        fontFamily: 'Vazirmatn, Tahoma, sans-serif', transition: 'opacity 320ms ease',
      });
      document.body.append(card);
    },
    { title, subtitle },
  );
  await wait(duration);
  await page.evaluate(() => {
    const card = document.getElementById('safanoor-video-card');
    if (card) card.style.opacity = '0';
  });
  await wait(380);
  await page.evaluate(() => document.getElementById('safanoor-video-card')?.remove());
}

async function login(page, role) {
  await page.goto(`${baseURL}/auth/jwt/sign-in`, { waitUntil: 'networkidle' });
  await titleCard(page, role.title, role.subtitle);
  await page.getByLabel('شماره همراه', { exact: true }).fill(role.login);
  await wait(450);
  await page.getByLabel('رمز عبور', { exact: true }).fill(password);
  await wait(450);
  await page.getByRole('button', { name: 'ورود به صفانور', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 20000 });
  await page.locator('main').first().waitFor({ state: 'visible' });
  await wait(900);
}

async function presentPage(page, route, label) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  await page.locator('main').first().waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await titleCard(page, label, 'نمایش دسترسی و اطلاعات متناسب با نقش', 900);
  await page.mouse.move(1060, 150, { steps: 12 });
  await wait(900);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  if (height > 820) {
    await page.evaluate(() => window.scrollTo({ top: Math.min(620, document.body.scrollHeight), behavior: 'smooth' }));
    await wait(1100);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await wait(700);
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))));
  });
}

async function convert(input, output) {
  await run('ffmpeg', [
    '-y', '-i', input, '-an', '-vf', 'scale=1280:720:flags=lanczos,fps=24',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-maxrate', '1100k', '-bufsize', '2200k', output,
  ]);
}

await mkdir(rawDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });

for (const role of roles) {
  const roleRawDir = path.join(rawDir, role.slug);
  await rm(roleRawDir, { recursive: true, force: true });
  await mkdir(roleRawDir, { recursive: true });
  const context = await browser.newContext({
    viewport: videoSize,
    recordVideo: { dir: roleRawDir, size: videoSize },
    locale: 'fa-IR',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await login(page, role);
  for (const [route, label] of role.pages) await presentPage(page, route, label);
  await titleCard(page, 'صفانور', `پایان معرفی نقش ${role.title}`, 1500);
  const video = page.video();
  await context.close();
  const rawPath = await video.path();
  const stableRawPath = path.join(roleRawDir, `${role.slug}.webm`);
  if (rawPath !== stableRawPath) await rename(rawPath, stableRawPath);
  const outputPath = path.join(outputDir, `${role.slug}.mp4`);
  await convert(stableRawPath, outputPath);
  const info = await stat(outputPath);
  if (info.size >= 45 * 1024 * 1024) throw new Error(`${role.slug} is larger than 45 MiB`);
  console.log(`${role.title}: ${(info.size / 1024 / 1024).toFixed(2)} MiB`);
}

await browser.close();
await rm(rawDir, { recursive: true, force: true });
