import { expect, test } from "@playwright/test";

test("production authentication pages prohibit shared response caching", async ({ request }) => {
  for (const path of ["/board", "/login", "/invite"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("private");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  }
});

test("production does not expose local synthetic login or fixture credentials", async ({ page }) => {
  const response = await page.goto("/login");
  expect(await response!.text()).not.toContain("@reproboard.test");
  await expect(page.getByRole("button", { name: "개발 계정으로 로그인", exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "개발 계정", exact: true })).toHaveCount(0);
});

test("anonymous board preview and login clearly explain unavailable actions", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByRole("heading", { name: "버그 보드", exact: true })).toBeVisible();
  await expect(page.getByText(/아래는 5단계 작업 흐름을 보여주는 미리보기입니다/)).toBeVisible();
  await expect(page.getByRole("button", { name: "버그 등록" })).toBeDisabled();
  for (const name of ["접수", "진행 대기", "수정 중", "재검증", "완료"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await testInfo.attach("board-desktop", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.getByRole("link", { name: "로그인 안내" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "GitHub로 로그인" })).toBeDisabled();
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
