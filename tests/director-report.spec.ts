import {test,expect} from '@playwright/test';

test('director report remains read-only and responsive without assigning a real account',async({page,context})=>{
  const metrics=[{key:'people',count:120},{key:'groups',count:6},{key:'consultations',count:48},{key:'meetings',count:12},{key:'library',count:8},{key:'classes',count:24},{key:'groupAlbum',count:90},{key:'campAttendance',count:3},{key:'reportCosts',count:8950000}];
  await page.route('**/api/v1/people/me',async route=>{
    const response=await route.fetch();
    const data=await response.json();
    if(!response.ok())return route.fulfill({response});
    data.activeRole={id:'director',kind:'director',label:'مدیر کل'};
    data.availableRoles=[data.activeRole];
    data.person.orgLevel='director';
    data.capabilities={viewOrganizationReports:true,createGroups:false,admin:false,managePeople:false,manageGroups:false,importPeople:false,viewPolicies:false,viewAudit:false,manageSettings:false};
    await route.fulfill({response,json:data});
  });
  await page.route('**/api/v1/dashboard/organization',route=>route.fulfill({json:{generatedAt:'2026-11-12T14:00:00.000Z',metrics}}));
  await page.route('**/api/v1/dashboard/organization/people?**',route=>route.fulfill({json:{items:[{id:'safe-1',name:'عضو نمونه',orgLevel:'member',groupName:'صفا ۲۰'}],total:1,page:1,limit:20}}));
  await page.goto('/auth/jwt/sign-in');
  await page.getByLabel('شماره همراه',{exact:true}).fill(process.env.VISUAL_TEST_LOGIN||'09100000011');
  await page.getByLabel('رمز عبور',{exact:true}).fill('12345678');
  await page.getByRole('button',{name:'ورود به صفانور',exact:true}).click();
  await expect(page).toHaveURL('/');
  for(const mode of ['light','dark']){
    await context.addCookies([{name:'sf_theme',value:mode,domain:'localhost',path:'/'}]);
    for(const width of [390,1440]){
      await page.setViewportSize({width,height:978});await page.goto('/');
      await expect(page.getByText('گزارش سراسری مجموعه',{exact:true})).toBeVisible();
      await expect(page.getByText('عضو نمونه',{exact:true})).toBeVisible();
      await expect(page.getByRole('link',{name:'ورود گروهی',exact:true})).toHaveCount(0);
      await page.evaluate(()=>document.fonts.ready);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:`docs/screens/director-report-${width}-${mode}.png`,fullPage:true,animations:'disabled'});
      await page.goto('/profile');
      await expect(page.getByRole('combobox',{name:/تغییر نقش فعال/})).toBeVisible();
      await expect(page.getByRole('button',{name:'ذخیره تغییرات',exact:true})).toHaveCount(0);
    }
  }
});
