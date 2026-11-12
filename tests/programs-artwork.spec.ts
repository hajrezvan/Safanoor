import { test, expect } from '@playwright/test';

test('all program destinations have loaded artwork and accessible responsive cards', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/auth/jwt/sign-in');
  await page.getByLabel('شماره همراه', { exact: true }).fill(process.env.VISUAL_TEST_LOGIN || '09100000011');
  await page.getByLabel('رمز عبور', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'ورود به صفانور', exact: true }).click();
  await expect(page).toHaveURL('/');
  const me = await (await page.request.get('/api/v1/people/me')).json();
  const expected = ['/library', '/meetings', '/consultations', '/classes', '/group-album', '/finance', ...(me.capabilities.viewCamps ? ['/camp-attendance'] : [])];
  for (const mode of ['light', 'dark']) {
    await context.addCookies([{ name: 'sf_theme', value: mode, domain: 'localhost', path: '/' }]);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 978 });
      await page.goto('/programs');
      await expect(page.getByRole('heading', { name: 'برنامه‌ها', exact: true })).toBeVisible();
      const header = page.getByRole('banner');
      const headerSize = await header.boundingBox();
      const brandTitle = header.getByRole('heading', { name: 'صفانور', exact: true, includeHidden: true });
      if (width === 390) {
        expect(headerSize!.height).toBeLessThanOrEqual(65);
        await expect(brandTitle).toBeHidden();
        await expect(header.getByRole('img', { name: 'صفانور', exact: true })).toBeVisible();
      } else {
        await expect(brandTitle).toBeVisible();
      }
      const cards = page.locator('main a');
      await expect(cards).toHaveCount(expected.length);
      expect(await cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).toEqual(expected);
      const illustrations = page.locator('main img');
      await expect(illustrations).toHaveCount(expected.length);
      await expect.poll(() => illustrations.evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
      for (const card of await cards.all()) {
        await expect(card).toHaveAccessibleName(/.+/);
        const size = await card.boundingBox();
        expect(size!.width).toBeGreaterThanOrEqual(44);
        expect(size!.height).toBeGreaterThanOrEqual(44);
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/screens/programs-3d-${width}-${mode}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.locator('main a').first().focus();
  await expect(page.locator('main a').first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/library');
  expect(errors).toEqual([]);
});
