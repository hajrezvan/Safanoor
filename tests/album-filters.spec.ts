import { test, expect } from '@playwright/test';

test('album filters are sent to API and remain usable on mobile and desktop', async ({page,context})=>{
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  await page.goto('/auth/jwt/sign-in');
  await page.getByLabel('شماره همراه',{exact:true}).fill(process.env.VISUAL_TEST_LOGIN || '09100000011');
  await page.getByLabel('رمز عبور',{exact:true}).fill('12345678');
  await page.getByRole('button',{name:'ورود به صفانور',exact:true}).click();
  await expect(page).toHaveURL('/');
  for(const mode of ['light','dark']) {
    await context.addCookies([{name:'sf_theme',value:mode,domain:'localhost',path:'/'}]);
    for(const width of [390,1440]) {
      await page.setViewportSize({width,height:978});await page.goto('/group-album');
      const mine=page.getByRole('checkbox',{name:'فقط عکس‌های من',exact:true});
      await expect(mine).toBeVisible();
      const response=page.waitForResponse(r=>r.url().includes('/album/albums?')&&new URL(r.url()).searchParams.get('myOnly')==='true');
      await mine.check();expect((await response).ok()).toBe(true);
      await page.getByRole('combobox',{name:/مرتب‌سازی/}).click();
      const sorted=page.waitForResponse(r=>r.url().includes('/album/albums?')&&new URL(r.url()).searchParams.get('sort')==='most_photos');
      await page.getByRole('option',{name:'بیشترین تعداد عکس',exact:true}).click();expect((await sorted).ok()).toBe(true);
      await expect(page.getByRole('listbox')).not.toBeVisible();
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:`docs/screens/album-filters-${width}-${mode}.png`,fullPage:true,animations:'disabled'});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
});
