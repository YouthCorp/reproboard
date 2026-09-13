import { expect, test } from "@playwright/test";

test("board and login clearly explain unavailable backend actions", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByRole("heading", { name: "버그 보드", exact: true })).toBeVisible();
  await expect(page.getByText(/아래는 실제 조회 결과가 아닙니다/)).toBeVisible();
  await expect(page.getByRole("button", { name: "이슈 등록" })).toBeDisabled();
  for (const name of ["Inbox", "Ready", "In Progress", "Verify", "Done"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await testInfo.attach("board-desktop", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.getByRole("link", { name: "로그인 안내" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "GitHub 로그인 · 준비 중" })).toBeDisabled();
  await testInfo.attach("login-desktop", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.getByRole("link", { name: "보드 화면 미리보기" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "버그 보드", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("unknown route offers a working return to the board", async ({ page }) => {
  const response = await page.goto("/missing-page");
  expect(response?.status()).toBe(404);
  await page.getByRole("link", { name: "보드로 돌아가기" }).click();
  await expect(page).toHaveURL(/\/board$/);
});

test("keyboard navigation can skip the header", async ({ page }) => {
  await page.goto("/board");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "본문으로 건너뛰기" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("board and login fit a narrow viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/board", "/login"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits).toBe(true);
    await testInfo.attach(`${path.slice(1)}-mobile`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  }
});
