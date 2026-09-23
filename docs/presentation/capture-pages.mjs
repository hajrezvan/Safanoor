/**
 * Capture mentor/student page screenshots and build a presentation PDF.
 * Uses system Chrome (channel: chrome). Requires: npm run dev on :3000
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname);
const SHOTS = path.join(ROOT, "screenshots");
const FONTS = path.join(ROOT, "fonts");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const VIEWPORT = { width: 1440, height: 900 };

fs.mkdirSync(SHOTS, { recursive: true });

/** @typedef {{ id: string, title: string, purpose: string, path: string, role: 'student'|'mentor'|'shared' }} PageDef */

/** @type {PageDef[]} */
const STUDENT_PAGES = [
  {
    id: "s-home",
    title: "خانه متربی",
    purpose:
      "صفحهٔ آغازین متربی است. اطلاعیه‌های مربی و سامانه اینجا دیده می‌شود تا از تازه‌ها باخبر شود.",
    path: "/student",
    role: "student",
  },
  {
    id: "s-school",
    title: "مدرسه — پیشخوان",
    purpose:
      "فضای آموزشی متربی. دوره‌های ثبت‌نام‌شده، پیشرفت یادگیری و ورود سریع به درس‌ها از این صفحه شروع می‌شود.",
    path: "/student/school",
    role: "student",
  },
  {
    id: "s-catalog",
    title: "مدرسه — تمام دوره‌ها",
    purpose:
      "فهرست همهٔ دوره‌های آموزشی موجود. متربی می‌تواند دورهٔ موردنظر را پیدا کند و وارد مسیر یادگیری شود.",
    path: "/student/school/catalog",
    role: "student",
  },
  {
    id: "s-report",
    title: "مدرسه — کارنامه من",
    purpose:
      "نمایی از پیشرفت دوره‌ها و نتیجهٔ آزمون‌ها. متربی می‌بیند کجا ایستاده و چه مسیری را طی کرده است.",
    path: "/student/school/report",
    role: "student",
  },
  {
    id: "s-playlists",
    title: "مدرسه — محتوای منتخب",
    purpose:
      "مجموعه‌هایی که مربی یا سامانه برای مطالعهٔ هدفمند پیشنهاد کرده‌اند؛ میان‌بر به درس‌های مهم.",
    path: "/student/school/playlists",
    role: "student",
  },
  {
    id: "s-certificates",
    title: "مدرسه — گواهینامه‌ها",
    purpose:
      "پس از تکمیل دوره و قبولی در آزمون‌ها، گواهی پایان دوره اینجا نمایش داده می‌شود و قابل مشاهده و چاپ است.",
    path: "/student/school/certificates",
    role: "student",
  },
  {
    id: "s-verify",
    title: "مدرسه — تأیید گواهینامه",
    purpose:
      "با وارد کردن شمارهٔ گواهی می‌توان اصالت آن را بررسی کرد؛ مناسب ارائه به خانواده یا مسئولان.",
    path: "/student/school/verify",
    role: "student",
  },
  {
    id: "s-course",
    title: "جزئیات دوره",
    purpose:
      "فهرست فصل‌ها و درس‌های یک دوره، وضعیت تکمیل هر درس و آزمون‌های مرتبط با همان دوره.",
    path: null, // filled dynamically
    role: "student",
    discover: "course",
  },
  {
    id: "s-lesson",
    title: "صفحه درس",
    purpose:
      "محل مطالعهٔ محتوا، یادداشت‌برداری، پیوست‌ها و رفتن به درس بعدی. اینجا قلب مسیر یادگیری روزانه‌است.",
    path: null,
    role: "student",
    discover: "lesson",
  },
  {
    id: "s-library",
    title: "کتابخانه",
    purpose:
      "فهرست کتاب‌های مطالعاتی. متربی کتاب را انتخاب می‌کند، برنامه مطالعه می‌بیند و برای آزمون آماده می‌شود.",
    path: "/student/library",
    role: "student",
  },
  {
    id: "s-book",
    title: "جزئیات کتاب",
    purpose:
      "دربارهٔ کتاب، برنامهٔ مطالعه و امکان شرکت در آزمون‌های مربوط به همان کتاب.",
    path: null,
    role: "student",
    discover: "book",
  },
  {
    id: "s-exam-prep",
    title: "آمادگی آزمون کتاب",
    purpose:
      "قبل از شروع آزمون، شرایط، تعداد سؤال و زمان هر سؤال توضیح داده می‌شود تا متربی با آگاهی وارد شود.",
    path: null,
    role: "student",
    discover: "exam-prep",
  },
  {
    id: "s-exam-result",
    title: "نتیجه آزمون کتاب",
    purpose:
      "پس از پایان آزمون، درصد موفقیت نمایش داده می‌شود؛ بدون افشای پاسخ درست، تا یادگیری حفظ شود.",
    path: null,
    role: "student",
    discover: "exam-result",
  },
  {
    id: "s-messenger",
    title: "پیامرسان",
    purpose:
      "فهرست گفتگو با مربی و کمک‌مربی. ارتباط مستقیم و محترمانه بین متربی و تیم تربیتی.",
    path: "/student/messenger",
    role: "student",
  },
  {
    id: "s-thread",
    title: "گفتگوی پیامرسان",
    purpose:
      "صفحهٔ گفتگوی دوطرفه؛ متربی پیام می‌فرستد و پاسخ مربی را در همان‌جا می‌خواند.",
    path: null,
    role: "student",
    discover: "thread",
  },
  {
    id: "s-profile",
    title: "پروفایل",
    purpose:
      "اطلاعات فردی، خانواده و پشتیبانی. متربی مشخصات شخصی را تکمیل می‌کند و در صورت نیاز از سامانه خارج می‌شود.",
    path: "/student/profile",
    role: "student",
  },
];

/** @type {PageDef[]} */
const MENTOR_PAGES = [
  {
    id: "m-dash",
    title: "داشبورد مربی",
    purpose:
      "نمای کلی کار مربی: تعداد نیروها، کمک‌مربیان، کلاس‌ها، کتاب‌ها و مواردی که نیاز به توجه دارند.",
    path: "/staff",
    role: "mentor",
  },
  {
    id: "m-forces",
    title: "نیروها",
    purpose:
      "فهرست متربیان تحت پوشش. مربی از اینجا پروندهٔ هر نیرو را باز می‌کند و وضعیت او را پیگیری می‌کند.",
    path: "/staff/forces",
    role: "mentor",
  },
  {
    id: "m-force",
    title: "پرونده نیرو",
    purpose:
      "جزئیات یک متربی: مشخصات، برنامه، پیگیری‌ها و آنچه مربی برای همراهی او نیاز دارد.",
    path: null,
    role: "mentor",
    discover: "force",
  },
  {
    id: "m-assistants",
    title: "کمک‌مربیان",
    purpose:
      "مدیریت کمک‌مربیان هم‌کار؛ دیدن افراد تیم و هماهنگی بهتر در همراهی متربیان.",
    path: "/staff/assistants",
    role: "mentor",
  },
  {
    id: "m-library",
    title: "کتابخانه (مربی)",
    purpose:
      "مدیریت و مشاهدهٔ کتاب‌های مطالعاتی که برای متربیان تعریف شده‌اند.",
    path: "/staff/library",
    role: "mentor",
  },
  {
    id: "m-book",
    title: "جزئیات کتاب (مربی)",
    purpose:
      "مشاهده و تنظیم محتوای یک کتاب و آزمون‌های مرتبط از نگاه مربی.",
    path: null,
    role: "mentor",
    discover: "staff-book",
  },
  {
    id: "m-school",
    title: "مدرسه — پیشخوان مربی",
    purpose:
      "مرکز مدیریت آموزش: دوره‌ها، درس‌ها، آزمون‌ها، ثبت‌نام‌ها و گزارش‌های پیشرفت متربیان.",
    path: "/staff/school",
    role: "mentor",
  },
  {
    id: "m-school-courses",
    title: "مدرسه — دوره‌ها",
    purpose:
      "ساخت و ویرایش دوره‌های آموزشی؛ مربی محتوا را سازمان‌دهی می‌کند تا مسیر یادگیری روشن باشد.",
    path: "/staff/school/courses",
    role: "mentor",
  },
  {
    id: "m-school-lessons",
    title: "مدرسه — دروس",
    purpose:
      "مدیریت درس‌های دوره‌ها؛ ترتیب، محتوا و آماده‌سازی آنچه متربی در هر جلسه می‌بیند.",
    path: "/staff/school/lessons",
    role: "mentor",
  },
  {
    id: "m-school-exams",
    title: "مدرسه — آزمون‌ها",
    purpose:
      "تعریف و پیگیری آزمون‌های دوره‌ها برای سنجش یادگیری متربیان.",
    path: "/staff/school/exams",
    role: "mentor",
  },
  {
    id: "m-school-banks",
    title: "مدرسه — بانک سؤال",
    purpose:
      "محل نگهداری سؤال‌های آزمون؛ مربی سؤال‌ها را می‌سازد و در آزمون‌ها به کار می‌گیرد.",
    path: "/staff/school/banks",
    role: "mentor",
  },
  {
    id: "m-school-enrollments",
    title: "مدرسه — ثبت‌نام‌ها",
    purpose:
      "دیدن اینکه هر متربی در کدام دوره ثبت‌نام کرده و وضعیت حضورش چگونه است.",
    path: "/staff/school/enrollments",
    role: "mentor",
  },
  {
    id: "m-school-reports",
    title: "مدرسه — گزارش‌ها",
    purpose:
      "گزارش پیشرفت و عملکرد متربیان در مدرسه برای تصمیم‌گیری تربیتی بهتر.",
    path: "/staff/school/reports",
    role: "mentor",
  },
  {
    id: "m-announcements",
    title: "اطلاعیه‌ها",
    purpose:
      "ارسال و مدیریت پیام‌های عمومی برای متربیان؛ خبرها، یادآوری‌ها و هماهنگی‌ها.",
    path: "/staff/announcements",
    role: "mentor",
  },
  {
    id: "m-sessions",
    title: "جلسات",
    purpose:
      "ثبت و پیگیری جلسات تربیتی؛ چه جلسه‌ای برگزار شده و نتیجهٔ آن چه بوده است.",
    path: "/staff/sessions",
    role: "mentor",
  },
  {
    id: "m-referrals",
    title: "ارجاع‌ها",
    purpose:
      "مواردی که به فرد دیگری در تیم ارجاع شده‌اند تا پیگیری تخصصی‌تر انجام شود.",
    path: "/staff/referrals",
    role: "mentor",
  },
  {
    id: "m-followups",
    title: "پیگیری",
    purpose:
      "فهرست کارهای باز و یادآوری‌هایی که مربی باید دنبال کند تا هیچ متربی‌ای فراموش نشود.",
    path: "/staff/follow-ups",
    role: "mentor",
  },
  {
    id: "m-chat",
    title: "چت مربی",
    purpose:
      "گفتگو با متربیان از پنل مربی؛ پاسخ‌گویی سریع و ثبت ارتباط در یکجا.",
    path: "/staff/chat",
    role: "mentor",
  },
  {
    id: "m-ai",
    title: "مربی‌یار",
    purpose:
      "دستیار کمکی مربی برای پیشنهاد و همراهی در کار تربیتی؛ سرعت‌بخشیدن به تصمیم‌های روزمره.",
    path: "/staff/ai",
    role: "mentor",
  },
  {
    id: "m-classes",
    title: "کلاس‌ها",
    purpose:
      "فهرست کلاس‌ها و دوره‌های در حال برگزاری از نگاه مربی.",
    path: "/staff/classes",
    role: "mentor",
  },
];

async function login(page, username, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#username", username);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(500);
}

async function shot(page, id) {
  const file = path.join(SHOTS, `${id}.png`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function firstHref(page, selector) {
  const href = await page.locator(selector).first().getAttribute("href").catch(() => null);
  return href;
}

async function discoverStudentPaths(page, pages) {
  const byId = Object.fromEntries(pages.map((p) => [p.id, p]));

  await page.goto(`${BASE}/student/school/catalog`, { waitUntil: "networkidle" });
  const courseHref =
    (await firstHref(page, 'a[href*="/student/school/courses/"]')) ||
    (await firstHref(page, 'a[href*="/student/school/"]'));
  if (courseHref && byId["s-course"]) {
    byId["s-course"].path = courseHref.startsWith("http") ? new URL(courseHref).pathname : courseHref;
    await page.goto(`${BASE}${byId["s-course"].path}`, { waitUntil: "networkidle" });
    const lessonHref = await firstHref(page, 'a[href*="/student/school/lessons/"]');
    if (lessonHref && byId["s-lesson"]) {
      byId["s-lesson"].path = lessonHref.startsWith("http")
        ? new URL(lessonHref).pathname
        : lessonHref;
    }
  }

  await page.goto(`${BASE}/student/library`, { waitUntil: "networkidle" });
  const bookHref = await firstHref(page, 'a[href*="/student/library/bok_"]');
  if (bookHref && byId["s-book"]) {
    byId["s-book"].path = bookHref.startsWith("http") ? new URL(bookHref).pathname : bookHref;
    await page.goto(`${BASE}${byId["s-book"].path}`, { waitUntil: "networkidle" });
    const examHref = await firstHref(page, 'a[href*="/exams/exm_"]');
    if (examHref && byId["s-exam-prep"]) {
      const p = examHref.startsWith("http") ? new URL(examHref).pathname : examHref;
      byId["s-exam-prep"].path = p.replace(/\/(take|result)$/, "");
    }
  }

  // Prefer a known completed attempt for a real result screenshot
  const completedResult =
    "/student/library/bok_91921ef2-e513-4011-a593-ce9582034a70/exams/exm_03d2ecf7-6013-4f20-9eb0-dfc58b261a79/result";
  if (byId["s-exam-result"]) {
    byId["s-exam-result"].path = completedResult;
  }
  // Also capture prep for the same exam family when book discovery failed
  if (byId["s-exam-prep"] && !byId["s-exam-prep"].path) {
    byId["s-exam-prep"].path = completedResult.replace(/\/result$/, "");
  }

  await page.goto(`${BASE}/student/messenger`, { waitUntil: "networkidle" });
  const threadHref = await firstHref(page, 'a[href*="/student/messenger/"]');
  if (threadHref && byId["s-thread"]) {
    byId["s-thread"].path = threadHref.startsWith("http")
      ? new URL(threadHref).pathname
      : threadHref;
  }
}

async function discoverMentorPaths(page, pages) {
  const byId = Object.fromEntries(pages.map((p) => [p.id, p]));
  await page.goto(`${BASE}/staff/forces`, { waitUntil: "networkidle" });
  const forceHref = await page
    .locator('a[href^="/staff/forces/"]')
    .evaluateAll((els) => {
      const hit = els
        .map((e) => e.getAttribute("href"))
        .find((h) => h && !h.endsWith("/new") && !h.includes("/new?"));
      return hit || null;
    })
    .catch(() => null);
  if (forceHref && byId["m-force"]) {
    byId["m-force"].path = forceHref.startsWith("http") ? new URL(forceHref).pathname : forceHref;
  }
  await page.goto(`${BASE}/staff/library`, { waitUntil: "networkidle" });
  const bookHref = await firstHref(page, 'a[href*="/staff/library/"]');
  if (bookHref && byId["m-book"]) {
    byId["m-book"].path = bookHref.startsWith("http") ? new URL(bookHref).pathname : bookHref;
  }
}

async function captureRole(browser, username, password, pages, label) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: "fa-IR",
    deviceScaleFactor: 1.25,
  });
  const page = await context.newPage();
  console.log(`Login as ${username} (${label})…`);
  await login(page, username, password);

  if (label === "student") await discoverStudentPaths(page, pages);
  if (label === "mentor") await discoverMentorPaths(page, pages);

  for (const item of pages) {
    if (!item.path) {
      console.warn(`  skip ${item.id}: no path`);
      continue;
    }
    const url = item.path.startsWith("http") ? item.path : `${BASE}${item.path}`;
    console.log(`  shot ${item.id} → ${item.path}`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await shot(page, item.id);
      item.ok = true;
    } catch (err) {
      console.warn(`  FAIL ${item.id}: ${err.message}`);
      item.ok = false;
    }
  }

  await context.close();
  return pages.filter((p) => p.ok !== false && p.path);
}

function buildHtml(studentPages, mentorPages) {
  const toFa = (n) =>
    String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

  const fontCss = `
@font-face {
  font-family: 'IRANSans';
  src: url('fonts/IRANSans-Light.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
}
@font-face {
  font-family: 'IRANSans';
  src: url('fonts/IRANSans-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'IRANSans';
  src: url('fonts/IRANSans-Medium.ttf') format('truetype');
  font-weight: 500;
  font-style: normal;
}
@font-face {
  font-family: 'IRANSans';
  src: url('fonts/IRANSans-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
}`;

  const pageCard = (p, index) => `
    <section class="page-card" id="${p.id}">
      <div class="page-meta">
        <span class="badge">${index}</span>
        <div>
          <h3>${p.title}</h3>
          <p class="purpose">${p.purpose}</p>
        </div>
      </div>
      <figure class="shot-wrap">
        <img src="screenshots/${p.id}.png" alt="نمای صفحه ${p.title}" />
        <figcaption>${p.title}</figcaption>
      </figure>
    </section>`;

  const tocItem = (p, i) =>
    `<li><a href="#${p.id}"><span>${toFa(i)}</span>${p.title}</a></li>`;

  let sIdx = 1;
  let mIdx = 1;
  const studentCards = studentPages.map((p) => pageCard(p, toFa(sIdx++))).join("\n");
  const mentorCards = mentorPages.map((p) => pageCard(p, toFa(mIdx++))).join("\n");

  sIdx = 1;
  mIdx = 1;
  const studentToc = studentPages.map((p) => tocItem(p, sIdx++)).join("\n");
  const mentorToc = mentorPages.map((p) => tocItem(p, mIdx++)).join("\n");

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>گزارش صفحات سامانه صفا نور</title>
  <style>
    ${fontCss}
    :root {
      --brand: #0f766e;
      --brand-dark: #115e59;
      --brand-soft: #ccfbf1;
      --ink: #1e293b;
      --muted: #64748b;
      --paper: #f8fafc;
      --card: #ffffff;
      --line: #e2e8f0;
      --accent: #b45309;
      --accent-soft: #fef3c7;
    }
    * { box-sizing: border-box; }
    html { font-size: 16px; }
    body {
      margin: 0;
      font-family: 'IRANSans', Tahoma, sans-serif;
      color: var(--ink);
      background: var(--paper);
      line-height: 1.9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cover {
      min-height: 100vh;
      padding: 64px 56px;
      background:
        radial-gradient(ellipse at 20% 10%, rgba(15,118,110,.18), transparent 50%),
        radial-gradient(ellipse at 90% 80%, rgba(180,83,9,.12), transparent 45%),
        linear-gradient(160deg, #0f766e 0%, #134e4a 45%, #1e293b 100%);
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
    }
    .cover-kicker {
      display: inline-block;
      padding: 8px 18px;
      border-radius: 999px;
      background: rgba(255,255,255,.15);
      border: 1px solid rgba(255,255,255,.25);
      font-size: 0.9rem;
      font-weight: 500;
    }
    .cover h1 {
      margin: 28px 0 12px;
      font-size: 2.75rem;
      font-weight: 700;
      line-height: 1.35;
    }
    .cover .lead {
      max-width: 34rem;
      font-size: 1.15rem;
      opacity: .92;
      font-weight: 300;
    }
    .cover-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 24px;
      border-top: 1px solid rgba(255,255,255,.2);
      padding-top: 24px;
      font-size: 0.95rem;
      opacity: .9;
    }
    .ornament {
      width: 72px; height: 6px; border-radius: 99px;
      background: linear-gradient(90deg, #fbbf24, #fef3c7);
      margin: 20px 0;
    }
    .sheet {
      max-width: 960px;
      margin: 0 auto;
      padding: 48px 40px 72px;
    }
    h1.section-title {
      font-size: 1.85rem;
      color: var(--brand-dark);
      margin: 0 0 8px;
      page-break-before: always;
    }
    h2 {
      font-size: 1.35rem;
      color: var(--brand);
      margin: 40px 0 12px;
      padding-bottom: 8px;
      border-bottom: 3px solid var(--brand-soft);
    }
    h3 {
      font-size: 1.15rem;
      margin: 0 0 8px;
      color: var(--ink);
      font-weight: 700;
    }
    .intro {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 28px 32px;
      box-shadow: 0 8px 30px rgba(15, 23, 42, .04);
      margin-bottom: 36px;
    }
    .intro p { margin: 0 0 12px; color: var(--muted); }
    .intro p:last-child { margin-bottom: 0; }
    .chips {
      display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px;
    }
    .chip {
      background: var(--brand-soft);
      color: var(--brand-dark);
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .chip.alt { background: var(--accent-soft); color: var(--accent); }
    .toc {
      columns: 2; column-gap: 32px;
      list-style: none; padding: 0; margin: 16px 0 0;
    }
    .toc li { break-inside: avoid; margin: 0 0 8px; }
    .toc a {
      display: flex; gap: 10px; align-items: center;
      text-decoration: none; color: var(--ink);
      padding: 8px 12px; border-radius: 12px;
      background: #fff; border: 1px solid var(--line);
    }
    .toc a span {
      width: 28px; height: 28px; border-radius: 8px;
      background: var(--brand); color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 700; flex-shrink: 0;
    }
    .page-card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 24px;
      margin: 28px 0;
      box-shadow: 0 10px 40px rgba(15, 23, 42, .05);
      page-break-inside: avoid;
    }
    .page-meta {
      display: flex; gap: 16px; align-items: flex-start; margin-bottom: 18px;
    }
    .badge {
      flex-shrink: 0;
      width: 40px; height: 40px; border-radius: 14px;
      background: linear-gradient(135deg, var(--brand), var(--brand-dark));
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.95rem;
    }
    .purpose { margin: 0; color: var(--muted); font-size: 0.98rem; }
    .shot-wrap {
      margin: 0; border-radius: 16px; overflow: hidden;
      border: 1px solid var(--line); background: #0f172a;
    }
    .shot-wrap img {
      display: block; width: 100%; height: auto;
    }
    .shot-wrap figcaption {
      background: #0f172a; color: #cbd5e1;
      padding: 10px 16px; font-size: 0.8rem; text-align: center;
    }
    .closing {
      margin-top: 48px;
      padding: 32px;
      border-radius: 24px;
      background: linear-gradient(135deg, var(--brand-soft), #fff);
      border: 1px solid var(--brand-soft);
      page-break-inside: avoid;
    }
    .closing h2 { border: none; margin-top: 0; }
    @media print {
      .sheet { max-width: none; padding: 24px 20px; }
      .page-card { break-inside: avoid; }
      a { color: inherit; }
    }
  </style>
</head>
<body>
  <header class="cover">
    <div>
      <span class="cover-kicker">سامانه تربیتی نوجوانان</span>
      <div class="ornament"></div>
      <h1>گزارش صفحات سامانه<br/>صفا نور</h1>
      <p class="lead">
        این گزارش برای جلسهٔ ارائه آماده شده است و نشان می‌دهد سامانه چه صفحاتی دارد
        و هر صفحه چه کمکی به مربی و متربی می‌کند — به زبان ساده و بدون اصطلاحات پیچیده.
      </p>
    </div>
    <div class="cover-footer">
      <div>
        <div>مخاطبان گزارش: مربی و متربی</div>
        <div>نسخهٔ نمایشی سامانه صفا نور</div>
      </div>
      <div style="text-align:left;direction:ltr;opacity:.75">Safanoor</div>
    </div>
  </header>

  <main class="sheet">
    <h1 class="section-title">مقدمه</h1>
    <div class="intro">
      <p>
        <strong>صفا نور</strong> سامانه‌ای است برای همراهی تربیتی نوجوانان.
        متربی مسیر مطالعه، یادگیری و ارتباط با مربی را از یک جای مشخص دنبال می‌کند
        و مربی می‌تواند نیروها، آموزش، پیگیری‌ها و گفتگوها را منظم پیش ببرد.
      </p>
      <p>
        در ادامه، ابتدا صفحات <strong>متربی</strong> و سپس صفحات <strong>مربی</strong>
        معرفی می‌شوند. برای هر صفحه، یک توضیح کوتاه از کاربرد آن و تصویر واقعی از همان صفحه آمده است.
      </p>
      <div class="chips">
        <span class="chip">${toFa(studentPages.length)} صفحه متربی</span>
        <span class="chip alt">${toFa(mentorPages.length)} صفحه مربی</span>
      </div>
    </div>

    <h2>فهرست صفحات متربی</h2>
    <ol class="toc">${studentToc}</ol>

    <h2>فهرست صفحات مربی</h2>
    <ol class="toc">${mentorToc}</ol>

    <h1 class="section-title">بخش یک — صفحات متربی</h1>
    <p style="color:var(--muted)">
      متربی از این صفحات برای خانه، مدرسه، کتابخانه، گفتگو با مربی و تکمیل پروفایل استفاده می‌کند.
    </p>
    ${studentCards}

    <h1 class="section-title">بخش دو — صفحات مربی</h1>
    <p style="color:var(--muted)">
      مربی از این صفحات نیروهای تحت پوشش، آموزش، اطلاعیه‌ها، جلسات، ارجاع‌ها و گفتگوها را مدیریت می‌کند.
    </p>
    ${mentorCards}

    <section class="closing">
      <h2>جمع‌بندی</h2>
      <p>
        سامانه صفا نور دو فضای هم‌پیوند دارد: فضای متربی برای رشد و یادگیری،
        و فضای مربی برای هدایت و پیگیری. با این صفحات، مسیر تربیتی از اطلاع‌رسانی
        تا مطالعه، آزمون، گواهی و گفتگو در یک جریان روشن قرار می‌گیرد.
      </p>
    </section>
  </main>
</body>
</html>`;
}

async function printPdf(browser, htmlPath, pdfPath) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 1600 } });
  const page = await context.newPage();
  const fileUrl = `file://${htmlPath}`;
  await page.goto(fileUrl, { waitUntil: "networkidle" });
  // wait for images
  await page.waitForTimeout(1500);
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "12mm", bottom: "14mm", left: "10mm", right: "10mm" },
    preferCSSPageSize: false,
  });
  await context.close();
}

async function main() {
  console.log("Launching Chrome…");
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const studentCaptured = await captureRole(
    browser,
    "student1",
    "Student@1234",
    STUDENT_PAGES,
    "student",
  );
  const mentorCaptured = await captureRole(
    browser,
    "mentor1",
    "Mentor@1234",
    MENTOR_PAGES,
    "mentor",
  );

  const html = buildHtml(studentCaptured, mentorCaptured);
  const htmlPath = path.join(ROOT, "report.html");
  const pdfPath = path.join(ROOT, "گزارش-صفحات-صفا-نور.pdf");
  fs.writeFileSync(htmlPath, html, "utf8");
  console.log("HTML written:", htmlPath);

  console.log("Printing PDF…");
  await printPdf(browser, htmlPath, pdfPath);
  console.log("PDF written:", pdfPath);

  await browser.close();
  console.log(
    `Done. Student pages: ${studentCaptured.length}, Mentor pages: ${mentorCaptured.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
