import { test, expect } from "@playwright/test";
import { createTestUser, login } from "./helpers";

test.describe("Shift template flow", () => {
  test("create shift template and verify it shows in schedule", async ({ page }) => {
    const { email, password } = await createTestUser(page);
    await login(page, email, password);

    await page.goto("/shift");
    await page.getByRole("button", { name: /novi šablon|new template/i }).click();
    await page.getByLabel("Name").fill("Morning Shift");
    await page.getByRole("button", { name: /sačuvaj|save/i }).click();

    await page.goto("/raspored");
    await expect(page.getByText("Morning Shift")).toBeVisible();
  });
});