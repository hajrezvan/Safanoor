import { test, expect } from '@playwright/test';

test('refreshed brand, home and navigation at both sizes and themes', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const mode of ['light', 'dark']) {
    await context.clearCookies();
    await context.addCookies([{ name: 'sf_theme', value: mode, domain: 'localhost', path: '/' }]);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/auth/jwt/sign-in');
      await expect(page.getByRole('button', { name: 'ورود به صفانور', exact: true })).toBeVisible();
      await expect(page.locator('img[src="/logo.png"]')).toBeVisible();
      await expect(page.locator('link[rel="icon"][href="/icon-32.png"]')).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/screens/joy-login-${width}-${mode}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByLabel('شماره همراه', { exact: true }).fill(process.env.VISUAL_TEST_LOGIN || '09100000011');
    await page.getByLabel('رمز عبور', { exact: true }).fill('12345678');
    await page.getByRole('button', { name: 'ورود به صفانور', exact: true }).click();
    await expect(page).toHaveURL('/');
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.getByRole('region', { name: 'از اینجا شروع کن' })).toBeVisible();
      const illustration = page.locator('img[src="/assets/illustrations/together.webp"]');
      await expect(illustration).toBeVisible();
      await expect.poll(() => illustration.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      if (width === 390) {
        await expect(page.locator('.MuiBottomNavigationAction-label').getByText('خانه', { exact: true })).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/screens/joy-home-${width}-${mode}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole('region', { name: 'از اینجا شروع کن' }).getByRole('link').first().click();
    await expect(page).toHaveURL('/library');
    await expect(page.locator('.MuiSkeleton-root')).toHaveCount(0);
    await page.screenshot({ path: `docs/screens/joy-library-1440-${mode}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('mentor statistics and component gallery render in both themes and widths', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/auth/jwt/sign-in');
  await page.getByLabel('شماره همراه', { exact: true }).fill(process.env.VISUAL_MENTOR_LOGIN || '09100000003');
  await page.getByLabel('رمز عبور', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'ورود به صفانور', exact: true }).click();
  await expect(page).toHaveURL('/');
  for (const mode of ['light', 'dark']) {
    await context.addCookies([{ name: 'sf_theme', value: mode, domain: 'localhost', path: '/' }]);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [route, name] of [['/', 'mentor'], ['/dev/design', 'design']]) {
        await page.goto(route);
        if (name === 'mentor') await expect(page.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 30000 });
        await expect(page.getByText('دریافت اطلاعات ممکن نشد.', { exact: true })).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `docs/screens/joy-${name}-${width}-${mode}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  }
  expect(errors).toEqual([]);
});
