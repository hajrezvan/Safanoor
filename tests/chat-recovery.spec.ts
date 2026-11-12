import {test,expect, type Page} from '@playwright/test';

async function login(page:Page, login:string) {
  await page.goto('/auth/jwt/sign-in');
  await page.getByLabel('شماره همراه',{exact:true}).fill(login);
  await page.getByLabel('رمز عبور',{exact:true}).fill('12345678');
  await page.getByRole('button',{name:'ورود به صفانور',exact:true}).click();
  await expect(page).toHaveURL('/');
}

test('member has no camp entry or direct access, with colorful home cards',async({page,context})=>{
  await login(page,process.env.RECOVERY_MEMBER_LOGIN||'09100000011');
  for(const mode of ['light','dark']){
    await context.addCookies([{name:'sf_theme',value:mode,domain:'localhost',path:'/'}]);
    for(const width of [390,1440]){
      await page.setViewportSize({width,height:978});await page.goto('/');
      await expect(page.getByRole('link',{name:'اردویی',exact:true})).toHaveCount(0);
      await expect(page.locator('a[href="/camp-attendance"]')).toHaveCount(0);
      await expect(page.getByText('حریم خصوصی، در اولویت',{exact:true})).toBeVisible();
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:`docs/screens/recovered-member-${width}-${mode}.png`,fullPage:true,animations:'disabled'});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.goto('/programs');
      await expect(page.locator('main a')).toHaveCount(6);
      await expect(page.locator('a[href="/camp-attendance"]')).toHaveCount(0);
    }
  }
  expect((await page.request.get('/api/v1/camps')).status()).toBe(403);
  await page.goto('/camp-attendance');
  await expect(page.getByText('این بخش برای نقش فعلی شما در دسترس نیست.',{exact:true})).toBeVisible();
});

test('dashboard charts have colorful bars, Persian ticks/tooltips and readable threads',async({page,context})=>{
  await page.route('**/api/v1/dashboard/mentor',async route=>{
    const response=await route.fetch();const data=await response.json();
    if(!response.ok())return route.fulfill({response});
    data.consultationsByWeek=[{weekStart:'2026-11-01',count:2},{weekStart:'2026-11-08',count:5}];
    data.membershipMix=[{key:'verified',count:10},{key:'unverified',count:3},{key:'assistant',count:2}];
    data.campCosts=[{id:'a',title:'صفا 20',amount:7500000},{id:'b',title:'صفا 33',amount:1450000}];
    data.recentThreads=[{id:'thread',title:'گفت‌وگوی آزمایشی گروه',preview:'هماهنگی جلسهٔ آینده',lastMessageAt:'2026-11-12T13:30:00.000Z'}];
    await route.fulfill({response,json:data});
  });
  await login(page,process.env.RECOVERY_MENTOR_LOGIN||'09100000003');
  for(const mode of ['light','dark']){
    await context.addCookies([{name:'sf_theme',value:mode,domain:'localhost',path:'/'}]);
    for(const width of [390,1440]){
      await page.setViewportSize({width,height:978});await page.goto('/');
      const bars=page.locator('.MuiBarElement-root');
      await expect(bars).toHaveCount(4);
      expect((await bars.evaluateAll(nodes=>new Set(nodes.map(node=>getComputedStyle(node).fill)).size))).toBeGreaterThan(1);
      const chartText=await page.locator('main svg text').allTextContents();
      expect(chartText.join(' ')).not.toMatch(/[0-9]/);
      expect(chartText.join(' ')).toMatch(/[۰-۹]/);
      await expect(page.getByText('گفت‌وگوی آزمایشی گروه',{exact:true})).toBeVisible();
      await expect(page.getByText('هماهنگی جلسهٔ آینده',{exact:true})).toBeVisible();
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:`docs/screens/recovered-dashboard-${width}-${mode}.png`,fullPage:true,animations:'disabled'});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await bars.first().hover();
      const tooltip=page.locator('.MuiChartsTooltip-root');
      await expect(tooltip).toBeVisible();
      expect(await tooltip.innerText()).not.toMatch(/[0-9]/);
      await page.mouse.move(0,0);
    }
  }
});
