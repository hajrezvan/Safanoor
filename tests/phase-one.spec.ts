import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const password = "12345678";
async function login(page: import("@playwright/test").Page, number: number) {
  await page.goto("/auth/jwt/sign-in");
  await page
    .getByLabel("شماره همراه", { exact: true })
    .fill(`+98910${String(number).padStart(7, "0")}`);
  await page.getByLabel("رمز عبور", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "ورود به صفانور", exact: true })
    .click();
  await expect(page).toHaveURL("http://localhost:3033/");
  await expect(
    page.getByRole("heading", { name: "همه‌چیز از همراهی شروع می‌شود" }),
  ).toBeVisible();
}
test("browser session, RTL, member navigation and notification updates", async ({
  page,
}) => {
  await login(page, 11);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("link", { name: "پروفایل من", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "پروفایل من", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "اعلان‌ها", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "اعلان‌ها", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        /token|auth|session/i.test(key),
      ),
    ),
  ).toEqual([]);
});
test("main screens visual gate at both widths and themes", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await mkdir("docs/screens", { recursive: true });
  await login(page, 40);
  for (const mode of ["light", "dark"]) {
    await context.addCookies([
      { name: "sf_theme", value: mode, domain: "localhost", path: "/" },
    ]);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [route, name] of [
        ["/", "member"],
        ["/admin", "admin"],
        ["/admin/people", "people"],
        ["/admin/groups", "groups"],
        ["/admin/imports", "imports"],
        ["/admin/access", "access"],
        ["/admin/audit", "audit"],
        ["/admin/settings", "settings"],
        ["/notifications", "notifications"],
        ["/consent", "consent"],
        ["/profile", "profile"],
      ]) {
        await page.goto(route);
        await expect(page.locator("main").first()).toBeVisible();
        await expect(
          page.getByText("دریافت اطلاعات ممکن نشد.", { exact: true }),
        ).toHaveCount(0);
        await expect(page.locator(".MuiSkeleton-root")).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
          path: `docs/screens/${name}-${width}-${mode}.png`,
          fullPage: true,
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `${route} overflow`,
        ).toBe(true);
      }
    }
  }
  await context.clearCookies();
  for (const width of [390, 1440])
    for (const mode of ["light", "dark"]) {
      await context.addCookies([
        { name: "sf_theme", value: mode, domain: "localhost", path: "/" },
      ]);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/auth/jwt/sign-in");
      await expect(page.locator(".MuiSkeleton-root")).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `docs/screens/login-${width}-${mode}.png`,
        fullPage: true,
      });
    }
  expect(errors).toEqual([]);
});
test("design library and offline shell", async ({ page, context }) => {
  for (const width of [390, 1440])
    for (const mode of ["light", "dark"]) {
      await context.addCookies([
        { name: "sf_theme", value: mode, domain: "localhost", path: "/" },
      ]);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/dev/design");
      await expect(
        page.getByRole("heading", { name: "راهنمای طراحی" }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `docs/screens/design-${width}-${mode}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  await expect
    .poll(async () =>
      page.evaluate(() => navigator.serviceWorker.controller !== null),
    )
    .toBeTruthy();
  await context.setOffline(true);
  await page.goto("/unknown-offline");
  await expect(
    page.getByRole("heading", { name: "فعلاً به اینترنت وصل نیستی" }),
  ).toBeVisible();
  await context.setOffline(false);
});
