import { Page } from "@playwright/test";

export async function createTestUser(page: Page) {
  const email = process.env.E2E_TEST_EMAIL || `test-${Date.now()}@example.com`;
  const password = process.env.E2E_TEST_PASSWORD || "TestPass123!";

  // Registration flow would go here in real implementation
  return { email, password };
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /prijava|login/i }).click();
}