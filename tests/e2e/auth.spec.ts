import { test, expect } from "@playwright/test";
import { createTestUser, login } from "./helpers";

test.describe("Auth flows", () => {
  test("registration, logout, login, wrong password shows message, protected route redirects", async ({ page }) => {
    const { email, password } = await createTestUser(page);

    // Registration (simplified)
    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /registruj|register/i }).click();

    await expect(page).toHaveURL(/dashboard/);

    // Logout
    await page.getByRole("button", { name: /odjava|logout/i }).click();

    // Login
    await login(page, email, password);
    await expect(page).toHaveURL(/dashboard/);

    // Wrong password
    await login(page, email, "wrongpass");
    await expect(page.getByText(/pogrešna lozinka|invalid password/i)).toBeVisible();

    // Protected route redirect
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });
});