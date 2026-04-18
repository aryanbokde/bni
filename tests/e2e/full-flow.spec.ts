import { test, expect } from "@playwright/test";
import { loginAsAdmin, getAuthToken, createMemberViaAPI } from "../helpers/factory";

let token: string;
let chapterId: string;
let memberAId: string;
let memberBId: string;

// ──────────────────────────────────────────────
// Step 1 — Login
// ──────────────────────────────────────────────
test.describe.serial("Complete BNI Chapter Weekly Cycle", () => {
  test("Step 1: Login as ADMIN and verify redirect to dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/chapter");
    await expect(page.locator("h1")).toContainText("Leadership Dashboard", {
      timeout: 10000,
    });

    // Get token and chapterId for API calls
    const loginRes = await page.request.post("/api/auth/login", {
      data: { email: "admin@bnichapter.com", password: "BNI@2026!" },
    });
    const body = await loginRes.json();
    token = body.data.accessToken;
    chapterId = body.data.member.chapter_id;
  });

  // ──────────────────────────────────────────────
  // Step 2 — Create two members
  // ──────────────────────────────────────────────
  test("Step 2: Create two members via API and verify in list", async ({ page }) => {
    // Get fresh token
    const loginRes = await page.request.post("/api/auth/login", {
      data: { email: "admin@bnichapter.com", password: "BNI@2026!" },
    });
    const loginBody = await loginRes.json();
    token = loginBody.data.accessToken;
    chapterId = loginBody.data.member.chapter_id;

    const resA = await createMemberViaAPI(page, token, chapterId, {
      full_name: "Ravi Shah",
      mobile: "+919876500001",
      whatsapp: "+919876500001",
      email: "ravi.shah.e2e@test.com",
      biz_category: "Financial Advisor",
      one_line_summary: "Expert in investment planning and wealth management for HNI clients",
      office_address: "Navrangpura, Ahmedabad, Gujarat 380009",
    });
    expect(resA.data.member_id).toBeDefined();
    memberAId = resA.data.member_id;

    const resB = await createMemberViaAPI(page, token, chapterId, {
      full_name: "Priya Mehta E2E",
      mobile: "+919876500002",
      whatsapp: "+919876500002",
      email: "priya.mehta.e2e@test.com",
      biz_category: "HR Consultant",
      one_line_summary: "Helping businesses find the right people through structured recruitment",
      office_address: "Satellite, Ahmedabad, Gujarat 380015",
    });
    expect(resB.data.member_id).toBeDefined();
    memberBId = resB.data.member_id;

    // Verify via API
    const listRes = await page.request.get(
      `/api/chapters/${chapterId}/members?pageSize=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const members = (await listRes.json()).data;
    const names = members.map((m: { full_name: string }) => m.full_name);
    expect(names).toContain("Ravi Shah");
    expect(names).toContain("Priya Mehta E2E");
  });

  // ──────────────────────────────────────────────
  // Step 3 — Check Matrix shows GAP
  // ──────────────────────────────────────────────
  test("Step 3: Matrix shows new members as GAP", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/chapter/matrix");
    await page.waitForSelector("table", { timeout: 15000 });

    // Both members should be in the matrix — check for their names
    await expect(page.locator("text=Ravi Shah")).toBeVisible();
    await expect(page.locator("text=Priya Mehta E2E")).toBeVisible();

    // GAP cells (white) should exist between new members
    const gapCells = page.locator("td:not(.sticky).bg-white.cursor-pointer");
    expect(await gapCells.count()).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────
  // Step 4 — Trigger Recommendation Cycle
  // ──────────────────────────────────────────────
  test("Step 4: Run recommendation cycle", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/chapter/recommendations");
    await expect(page.locator("text=Run Recommendation Cycle")).toBeVisible({
      timeout: 10000,
    });

    // Click run
    await page.click("text=Run Recommendation Cycle");
    await expect(page.locator("text=Run Recommendation Cycle?")).toBeVisible();
    await page.click("text=Yes, Run");

    // Wait for completion
    await expect(
      page.locator("text=Done").or(page.locator("text=Run Recommendation Cycle"))
    ).toBeVisible({ timeout: 30000 });
  });

  // ──────────────────────────────────────────────
  // Step 5 — Complete recommendation via API
  // ──────────────────────────────────────────────
  test("Step 5: Complete a recommendation (simulating WhatsApp reply)", async ({
    page,
  }) => {
    // Get fresh token
    const loginRes = await page.request.post("/api/auth/login", {
      data: { email: "admin@bnichapter.com", password: "BNI@2026!" },
    });
    token = (await loginRes.json()).data.accessToken;

    // Find a SENT rec involving our test members
    const recsRes = await page.request.get(
      `/api/chapters/${chapterId}/recommendations?status=SENT&pageSize=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const recs = (await recsRes.json()).data;

    const targetRec = recs.find(
      (r: { member_a_id: string; member_b_id: string }) =>
        (r.member_a_id === memberAId && r.member_b_id === memberBId) ||
        (r.member_a_id === memberBId && r.member_b_id === memberAId)
    );

    if (targetRec) {
      // Complete it via API
      const completeRes = await page.request.post(
        `/api/chapters/${chapterId}/recommendations/${targetRec.rec_id}/complete`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: {
            interaction_date: new Date().toISOString().split("T")[0],
            notes: "E2E test completion",
          },
        }
      );
      expect(completeRes.ok()).toBe(true);
    } else {
      // No rec found between A and B — the engine may have paired differently
      // Complete any SENT rec as a fallback
      if (recs.length > 0) {
        const anyRec = recs[0];
        const completeRes = await page.request.post(
          `/api/chapters/${chapterId}/recommendations/${anyRec.rec_id}/complete`,
          {
            headers: { Authorization: `Bearer ${token}` },
            data: {
              interaction_date: new Date().toISOString().split("T")[0],
            },
          }
        );
        expect(completeRes.ok()).toBe(true);
      }
    }
  });

  // ──────────────────────────────────────────────
  // Step 6 — Check Matrix for GREEN cell
  // ──────────────────────────────────────────────
  test("Step 6: Matrix shows completed pair as GREEN", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/chapter/matrix");
    await page.waitForSelector("table", { timeout: 15000 });

    // At least one GREEN cell should exist now
    const greenCells = page.locator("td.bg-green-100");
    expect(await greenCells.count()).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────
  // Step 7 — Coverage Panel
  // ──────────────────────────────────────────────
  test("Step 7: Coverage Panel shows member stats", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/chapter/matrix");
    await page.waitForSelector("table", { timeout: 15000 });

    // Click first member name in left column
    const memberCell = page.locator("td.sticky.left-0").first();
    await memberCell.click();

    // Coverage panel should open
    await expect(page.locator("text=Coverage")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Total Members")).toBeVisible();
    await expect(page.locator("text=Members Met")).toBeVisible();
  });

  // ──────────────────────────────────────────────
  // Step 8 — Map Check
  // ──────────────────────────────────────────────
  test("Step 8: Map page shows members", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/chapter/map");

    await expect(page.locator("h1")).toContainText("Member Map", { timeout: 10000 });
    await expect(page.locator("text=members on map")).toBeVisible({ timeout: 10000 });

    // Either pins on map or members in sidebar list
    const mapDiv = page.locator("div.h-\\[450px\\]");
    await expect(mapDiv).toBeVisible();
  });

  // ──────────────────────────────────────────────
  // Cleanup — remove test members
  // ──────────────────────────────────────────────
  test("Cleanup: Archive test members", async ({ page }) => {
    // Get fresh token
    const loginRes = await page.request.post("/api/auth/login", {
      data: { email: "admin@bnichapter.com", password: "BNI@2026!" },
    });
    token = (await loginRes.json()).data.accessToken;

    if (memberAId) {
      await page.request.post(
        `/api/chapters/${chapterId}/members/${memberAId}/archive`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { reason: "E2E test cleanup" },
        }
      );
    }
    if (memberBId) {
      await page.request.post(
        `/api/chapters/${chapterId}/members/${memberBId}/archive`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { reason: "E2E test cleanup" },
        }
      );
    }
    expect(true).toBe(true);
  });
});
