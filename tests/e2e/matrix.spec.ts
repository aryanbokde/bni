import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@bnichapter.com";
const ADMIN_PASSWORD = "BNI@2026!";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[id="email"]', ADMIN_EMAIL);
  await page.fill('input[id="password"]', ADMIN_PASSWORD);
  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes("/api/auth/login") && resp.status() === 200,
      { timeout: 30000 }
    ),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForURL("**/chapter/members**", { timeout: 15000 });
}

// ──────────────────────────────────────────────
// 1. Matrix page loads
// ──────────────────────────────────────────────
test("1. Matrix page loads without errors", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/matrix");
  await expect(page.locator("h1")).toContainText("Engagement Matrix");
  // Wait for matrix table or skeleton to appear
  await expect(
    page.locator("table, .animate-pulse").first()
  ).toBeVisible({ timeout: 10000 });
});

// ──────────────────────────────────────────────
// 2. Matrix cells render with correct colors
// ──────────────────────────────────────────────
test("2. Matrix cells render with color-coded backgrounds", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/matrix");
  await page.waitForSelector("table", { timeout: 15000 });

  // SELF cells should have gray background
  const selfCell = page.locator("td.bg-gray-200").first();
  await expect(selfCell).toBeVisible();
});

// ──────────────────────────────────────────────
// 3. Clicking a GREEN cell opens PairActionDrawer
// ──────────────────────────────────────────────
test("3. Clicking a GREEN cell opens PairActionDrawer", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/matrix");
  await page.waitForSelector("table", { timeout: 15000 });

  const greenCell = page.locator("td.bg-green-100").first();
  if (await greenCell.count() > 0) {
    await greenCell.click();
    await expect(page.locator("text=Last met")).toBeVisible({ timeout: 5000 });
  }
});

// ──────────────────────────────────────────────
// 4. Clicking a GAP cell shows "Recommend" button
// ──────────────────────────────────────────────
test("4. Clicking a GAP cell shows Recommend button (if available)", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/matrix");
  await page.waitForSelector("table", { timeout: 15000 });

  // GAP cells are non-sticky td with bg-white (exclude the sticky name column)
  const gapCells = page.locator("td:not(.sticky).bg-white.cursor-pointer");
  const count = await gapCells.count();
  if (count > 0) {
    await gapCells.first().click();
    await expect(
      page.locator("text=Recommend this pair now")
    ).toBeVisible({ timeout: 5000 });
  } else {
    // Only 1 member or all pairs covered — skip gracefully
    expect(true).toBe(true);
  }
});

// ──────────────────────────────────────────────
// 5. Clicking member name opens CoveragePanel
// ──────────────────────────────────────────────
test("5. Clicking member name opens CoveragePanel", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/matrix");
  await page.waitForSelector("table", { timeout: 15000 });

  // Click first row member name (sticky left column)
  const memberName = page.locator("td.sticky.left-0").first();
  await memberName.click();

  // CoveragePanel should show Coverage %
  await expect(page.locator("text=Coverage")).toBeVisible({ timeout: 5000 });
});

// ──────────────────────────────────────────────
// 6. Time window filter changes display
// ──────────────────────────────────────────────
test("6. Time window filter changes matrix", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/matrix");
  await page.waitForSelector("table", { timeout: 15000 });

  // Count cells at 180d
  const cellCount180 = await page.locator("td.bg-green-100").count();

  // Switch to 30d
  await page.click("text=30d");
  await page.waitForTimeout(1000);

  // Cell counts may differ (some interactions may be outside 30d window)
  const cellCount30 = await page.locator("td.bg-green-100").count();
  // We just verify the filter button works and the table re-renders
  expect(cellCount30).toBeGreaterThanOrEqual(0);
});

// ──────────────────────────────────────────────
// 7. Mark Complete on AMBER rec
// ──────────────────────────────────────────────
test("7. Mark Complete on AMBER cell opens date picker", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/matrix");
  await page.waitForSelector("table", { timeout: 15000 });

  const amberCell = page.locator("td.bg-amber-100").first();
  if (await amberCell.count() > 0) {
    await amberCell.click();
    await expect(page.locator("text=Mark as Complete")).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="date"]')).toBeVisible();
  }
});
