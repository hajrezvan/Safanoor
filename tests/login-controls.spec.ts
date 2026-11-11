import { test, expect } from '@playwright/test';

test('phone input accepts Persian digits and blocks extra characters', async ({ page }) => {
  await page.goto('/auth/jwt/sign-in');
  const phone = page.getByLabel('شماره همراه', { exact: true });
  await expect(phone).toHaveAttribute('maxlength', '11');
  await expect(phone).toHaveAttribute('inputmode', 'numeric');
  await phone.fill('۰۹۱۲۰۰۰۰۰۱۶');
  await phone.press('End');
  await phone.pressSequentially('123');
  await expect(phone).toHaveValue('۰۹۱۲۰۰۰۰۰۱۶');
  await phone.fill('09120000016789');
  await expect(phone).toHaveValue('۰۹۱۲۰۰۰۰۰۱۶');
});

test('incomplete phone shows a popup and never sends a login request', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/v1/auth/login', route => { attempts++; return route.fulfill({ status: 401, json: {} }); });
  await page.goto('/auth/jwt/sign-in');
  await page.getByLabel('شماره همراه', { exact: true }).fill('0912');
  await page.getByLabel('رمز عبور', { exact: true }).fill('example-password');
  await page.getByRole('button', { name: 'ورود به صفانور', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'شماره همراه کامل نیست' });
  await expect(popup).toBeVisible();
  expect(attempts).toBe(0);
  await popup.getByRole('button', { name: 'اصلاح شماره همراه' }).click();
  await expect(popup).not.toBeVisible();
});

test('password visibility toggles without submitting or changing the password', async ({ page, context }) => {
  let attempts = 0;
  await page.route('**/api/v1/auth/login', route => { attempts++; return route.fulfill({ status: 401, json: {} }); });
  await page.goto('/auth/jwt/sign-in');
  const password = page.getByLabel('رمز عبور', { exact: true });
  await password.fill('example-password');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'نمایش رمز عبور', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('example-password');
  await page.getByRole('button', { name: 'مخفی کردن رمز عبور', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  expect(attempts).toBe(0);
  for (const mode of ['light', 'dark']) {
    await context.addCookies([{ name: 'sf_theme', value: mode, domain: 'localhost', path: '/' }]);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 978 });
      await page.goto('/auth/jwt/sign-in');
      await page.evaluate(() => document.fonts.ready);
      const artwork = page.locator('img[src="/assets/illustrations/safanoor-3d.webp"]');
      await expect(artwork).toBeVisible();
      await expect.poll(() => artwork.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
      await expect(page.getByRole('button', { name: 'نمایش رمز عبور', exact: true })).toBeVisible();
      await page.screenshot({ path: `docs/screens/login-controls-${width}-${mode}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});


test('a complete local phone number keeps the API international format', async ({ page }) => {
  await page.route('**/api/v1/auth/login', route => route.fulfill({ status: 401, json: { error: { message: 'ورود آزمایشی' } } }));
  await page.goto('/auth/jwt/sign-in');
  await page.getByLabel('شماره همراه', { exact: true }).fill('09120000016');
  await page.getByLabel('رمز عبور', { exact: true }).fill('example-password');
  const request = page.waitForRequest('**/api/v1/auth/login');
  await page.getByRole('button', { name: 'ورود به صفانور', exact: true }).click();
  expect((await request).postDataJSON().login).toBe('+989120000016');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
