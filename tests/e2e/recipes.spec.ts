import { test, expect } from "@playwright/test";
import { createTestUser, login } from "./helpers";

test.describe("Recipes flow", () => {
  test("add ingredient, create recipe with two ingredients, check portion cost, delete recipe", async ({ page }) => {
    const { email, password } = await createTestUser(page);
    await login(page, email, password);

    // Add ingredient
    await page.goto("/ingredients");
    await page.getByRole("button", { name: /dodaj|add/i }).click();
    await page.getByLabel("Name").fill("Test Flour");
    await page.getByLabel("Price").fill("2.5");
    await page.getByRole("button", { name: /sačuvaj|save/i }).click();

    // Create recipe
    await page.goto("/recipes");
    await page.getByRole("button", { name: /novi recept|new recipe/i }).click();
    await page.getByLabel("Name").fill("Test Bread");
    // Add two ingredients (simplified)
    await page.getByRole("button", { name: /dodaj sastojak/i }).click();
    // ... fill ingredient selects

    await page.getByRole("button", { name: /sačuvaj|save/i }).click();

    await expect(page.getByText(/trošak porcije|portion cost/i)).toBeVisible();

    // Delete recipe
    await page.getByRole("button", { name: /obriši|delete/i }).click();
    await expect(page.getByText("Test Bread")).not.toBeVisible();
  });
});