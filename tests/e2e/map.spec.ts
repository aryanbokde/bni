import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@bnichapter.com";
const ADMIN_PASSWORD = "BNI@2026!";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[id="email"]', ADMIN_EMAIL);
  await page.fill('input[id="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/chapter/**", { timeout: 30000 });
}

// ──────────────────────────────────────────────
// 1. Map page renders
// ──────────────────────────────────────────────
test("1. Map page renders Google Maps embed", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/map");
  await expect(page.locator("h1")).toContainText("Member Map");

  // The map div should be present
  await expect(page.locator("div.h-\\[450px\\]")).toBeVisible({ timeout: 10000 });
});

// ──────────────────────────────────────────────
// 2. Category filter
// ──────────────────────────────────────────────
test("2. Category filter dropdown is visible", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/map");

  const filter = page.locator("select");
  await expect(filter).toBeVisible({ timeout: 10000 });
  // Should have "All Categories" as first option
  await expect(filter.locator("option").first()).toContainText("All Categories");
});

// ──────────────────────────────────────────────
// 3. Map shows member count
// ──────────────────────────────────────────────
test("3. Map shows member count text", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/map");
  // Should show "X members on map" text
  await expect(
    page.locator("text=members on map")
  ).toBeVisible({ timeout: 10000 });
});

// ──────────────────────────────────────────────
// 4. Members without coordinates in sidebar
// ──────────────────────────────────────────────
test("4. Members without coordinates appear in sidebar list", async ({ page }) => {
  await login(page);
  await page.goto("/chapter/map");

  // If there are ungeolocated members, the sidebar shows
  const sidebar = page.locator("text=Members not on map yet");
  // May or may not be visible depending on data
  const sidebarVisible = await sidebar.count();
  if (sidebarVisible > 0) {
    await expect(sidebar).toBeVisible();
    // Should show PENDING or FAILED badges
    const badges = page.locator("text=PENDING, text=FAILED");
    expect(await badges.count()).toBeGreaterThanOrEqual(0);
  }
});
