import type { Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@bnichapter.com";
const ADMIN_PASSWORD = "BNI@2026!";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.waitForSelector('input[id="email"]', { timeout: 10000 });
  await page.fill('input[id="email"]', ADMIN_EMAIL);
  await page.fill('input[id="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/chapter**", { timeout: 30000 });
}

export async function getAuthToken(page: Page): Promise<string> {
  const res = await page.request.post("/api/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const body = await res.json();
  return body.data.accessToken;
}

export async function getChapterId(page: Page, token: string): Promise<string> {
  const res = await page.request.post("/api/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const body = await res.json();
  return body.data.member.chapter_id;
}

export async function createMemberViaUI(
  page: Page,
  data: {
    name: string;
    mobile: string;
    email: string;
    category: string;
    summary: string;
    address: string;
  }
) {
  await page.goto("/chapter/members/new");
  await page.fill('input[placeholder="e.g. Rakesh Patel"]', data.name);
  await page.fill('input[placeholder="9876543210"]', data.mobile);
  await page.fill('input[placeholder="member@example.com"]', data.email);
  await page.fill('input[placeholder="e.g. Financial Services"]', data.category);
  await page.fill(
    'input[placeholder="e.g. Helping families secure their financial future through insurance"]',
    data.summary
  );

  // Address: type directly (autocomplete won't work in headless)
  const addressInput = page.locator('input[placeholder="Start typing to search..."]');
  await addressInput.fill(data.address);

  await page.click('button:has-text("Create Member")');
}

export async function createMemberViaAPI(
  page: Page,
  token: string,
  chapterId: string,
  data: {
    full_name: string;
    mobile: string;
    whatsapp: string;
    email: string;
    biz_category: string;
    one_line_summary: string;
    office_address: string;
  }
) {
  const res = await page.request.post(
    `/api/chapters/${chapterId}/members`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        ...data,
        chapter_role: "MEMBER",
        joining_date: new Date().toISOString(),
      },
    }
  );
  return res.json();
}
