import { test, expect } from '@playwright/test';

test('development finance preview shows sample balances and payment history', async ({page,context})=>{
  test.setTimeout(90000);
  await page.goto('/auth/jwt/sign-in');
  await page.getByLabel('شماره همراه',{exact:true}).fill(process.env.VISUAL_TEST_LOGIN || '09100000011');
  await page.getByLabel('رمز عبور',{exact:true}).fill('12345678');
  await page.getByRole('button',{name:'ورود به صفانور',exact:true}).click();
  await expect(page).toHaveURL('/');
  for(const mode of ['light','dark']) {
    await context.addCookies([{name:'sf_theme',value:mode,domain:'localhost',path:'/'}]);
    for(const width of [390,1440]) {
      await page.setViewportSize({width,height:978});
      await page.goto('/finance');
      await expect(page.getByText('نمای آزمایشی مالی من',{exact:true})).toBeVisible();
      await expect(page.getByText('تسویه‌شده',{exact:true})).toBeVisible();
      await expect(page.getByText('پرداخت بخشی',{exact:true})).toBeVisible();
      await expect(page.getByText('پرداخت‌نشده',{exact:true})).toBeVisible();
      await expect(page.getByText('۷۸۰٬۰۰۰ تومان',{exact:true})).toBeVisible();
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:`docs/screens/finance-demo-${width}-${mode}.png`,fullPage:true,animations:'disabled'});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.getByRole('button',{name:'جزئیات و پرداخت‌ها',exact:true}).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog').getByText('سابقهٔ پرداخت نمونه',{exact:true})).toBeVisible();
      await expect(page.getByRole('dialog').getByText('۷۰۰٬۰۰۰ تومان',{exact:true})).toBeVisible();
      await page.keyboard.press('Escape');
    }
  }
});
