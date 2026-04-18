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
// 1. Recommendations page shows summary cards
// ──────────────────────────────────────────────
test("1. Recommendations page shows summary cards", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/recommendations");

  await expect(page.locator("h1")).toContainText("Recommendations");

  // Should show 4 stat cards (target the text-center stat cards specifically)
  await expect(page.locator(".card.text-center:has-text('Total Sent')")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".card.text-center:has-text('Completed')")).toBeVisible();
  await expect(page.locator(".card.text-center:has-text('Expired')")).toBeVisible();
  await expect(page.locator(".card.text-center:has-text('Pending')")).toBeVisible();
});

// ──────────────────────────────────────────────
// 2. Status filter tabs work
// ──────────────────────────────────────────────
test("2. Status filter tabs work", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/recommendations");

  // Wait for table area to load
  await expect(page.locator("text=Total Sent")).toBeVisible({ timeout: 10000 });

  // Click "Sent" tab
  await page.click("button:has-text('Sent')");
  await page.waitForTimeout(500);

  // Click "Completed" tab
  await page.click("button:has-text('Completed')");
  await page.waitForTimeout(500);

  // Click "All" tab
  await page.click("button:has-text('All')");
  await page.waitForTimeout(500);

  // Verify we're back on All and the table is visible
  const allTab = page.locator("button:has-text('All')");
  await expect(allTab).toHaveClass(/border-bni-blue/);
});

// ──────────────────────────────────────────────
// 3. Run Recommendation Cycle button
// ──────────────────────────────────────────────
test("3. Run Recommendation Cycle shows confirmation modal", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/recommendations");

  await expect(page.locator("text=Total Sent")).toBeVisible({ timeout: 10000 });

  // Click Run button
  await page.click("text=Run Recommendation Cycle");

  // Confirmation modal should appear
  await expect(
    page.locator("text=Run Recommendation Cycle?")
  ).toBeVisible({ timeout: 5000 });
  await expect(page.locator("text=Yes, Run")).toBeVisible();

  // Cancel
  await page.click("text=Cancel");
  await expect(page.locator("text=Run Recommendation Cycle?")).not.toBeVisible();
});
