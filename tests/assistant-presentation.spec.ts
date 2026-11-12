import {test,expect,type Page} from '@playwright/test';

test.use({actionTimeout:15000});

async function signIn(page:Page,kind:'assistant'|'mentor') {
  await page.goto('/auth/jwt/sign-in');
  await page.getByLabel('شماره همراه',{exact:true}).fill('09120000012');
  await page.getByLabel('رمز عبور',{exact:true}).fill('12345678');
  await page.getByRole('button',{name:'ورود به صفانور',exact:true}).click();
  await expect(page).toHaveURL('/');
  const csrf=await (await page.request.get('/api/v1/auth/csrf')).json();
  const response=await page.request.post('/api/v1/people/me/active-role',{headers:{'x-csrf-token':csrf.csrfToken},data:{roleId:`${kind}:50000000-0000-4000-8000-${String(kind==='assistant'?27:33).padStart(12,'0')}`}});
  expect(response.status()).toBe(200);await page.reload();
}
test('assistant workspace is usable on phone and desktop in both themes',async({page,context})=>{
  await signIn(page,'assistant');
  await expect(page.getByRole('heading',{name:'همراهی نیروها',exact:true})).toBeVisible();
  const summary=await(await page.request.get('/api/v1/assistant/summary')).json();expect(summary.memberCount).toBeGreaterThanOrEqual(6);
  for(const mode of ['light','dark']){
    await context.addCookies([{name:'sf_theme',value:mode,domain:'localhost',path:'/'}]);
    for(const width of [390,1440]){
      await page.setViewportSize({width,height:978});await page.goto('/');
      await expect(page.getByRole('button',{name:'پیگیری یا کار جدید',exact:true}).first()).toBeVisible();
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:`docs/screens/assistant-workspace-${width}-${mode}.png`,fullPage:true,animations:'disabled'});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      expect(await page.locator('main').innerText()).not.toMatch(/\{(?:name|count|rate|date)\}/);
    }
  }
  await page.getByRole('button',{name:'پیگیری یا کار جدید',exact:true}).first().click();
  await page.getByLabel('موضوع فعالیت',{exact:true}).fill('پیگیری آزمایشی ارائه');
  await page.getByRole('button',{name:'ذخیره تغییرات',exact:true}).click();
  await expect(page.getByLabel('موضوع فعالیت',{exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'پیگیری‌ها و کارها',exact:true}).click();
  await expect(page.getByRole('button',{name:'انجام شد',exact:true}).first()).toBeVisible();
  await page.getByRole('tab',{name:'ثبت حضور',exact:true}).click();
  await page.getByRole('combobox',{name:'انتخاب برنامه',exact:true}).click();
  await page.getByRole('option').nth(1).click();
  await expect(page.getByRole('button',{name:'حاضر',exact:true}).first()).toBeEnabled();
  await page.getByRole('button',{name:'حاضر',exact:true}).first().click();
  await page.getByRole('tab',{name:'مسئولیت‌های اردو',exact:true}).click();
  await expect(page.getByText('هماهنگی ورود و بررسی فهرست نیروها (نمایشی)',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'نیروهای تحت پیگیری من',exact:true}).click();
  await page.getByRole('button',{name:'کارت اضطراری',exact:true}).first().click();
  await expect(page.getByText('باز کردن اطلاعات اضطراری ثبت می‌شود و مربی گروه مطلع خواهد شد.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'ثبت علت و مشاهده',exact:true}).click();
  await expect(page.getByText(/شمارهٔ تماس اضطراری واقعی ثبت نشده است/)).toBeVisible();
  await page.getByRole('button',{name:'بستن',exact:true}).click();
  await page.goto('/admin/people');
  await expect(page.getByRole('heading',{name:'همراهی نیروها',exact:true})).toBeVisible();
});
test('MJ mentor has populated consultations and readable conversations in Safa 33',async({page})=>{
  await signIn(page,'mentor');
  const consultations=await(await page.request.get('/api/v1/consultations?limit=100')).json();
  expect(consultations.items.filter((r:{id:string})=>r.id.startsWith('81000000')).length).toBe(12);
  expect(consultations.items.every((r:{groupId:string})=>r.groupId.endsWith('000000000033'))).toBe(true);
  await page.goto('/communications');
  await expect(page.getByText(/نمایشی/).first()).toBeVisible();
  await page.screenshot({path:'docs/screens/evening-chats-1440-light.png',fullPage:true});
  await page.goto('/consultations');
  await expect(page.getByText(/نمایشی/).first()).toBeVisible();
  await page.screenshot({path:'docs/screens/evening-consultations-1440-light.png',fullPage:true});
});
