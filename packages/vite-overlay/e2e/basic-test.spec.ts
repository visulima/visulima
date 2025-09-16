import { expect, test } from "@playwright/test";

test.describe("Basic Infrastructure Test", () => {
    test("should load the homepage", async ({ page }) => {
        await page.goto("/");

        await expect(page).toHaveTitle(/TanStack/);

        // Homepage should show an error overlay
        const overlay = page.locator("#__flame__overlay");
        await expect(overlay).toBeVisible();
    });

    test("should load the error test page", async ({ page }) => {
        await page.goto("/error-test");

        await expect(page.locator("h1")).toContainText("Error Overlay Test Page");
    });

    test("should have test buttons on error test page", async ({ page }) => {
        await page.goto("/error-test");

        // Check if test buttons are present
        const simpleErrorButton = page.locator("[data-testid='simple-error-btn']");
        const causeChainButton = page.locator("[data-error-trigger]");

        await expect(simpleErrorButton).toBeVisible();
        await expect(causeChainButton).toBeVisible();
    });

    test("should show error overlay on homepage", async ({ page }) => {
        await page.goto("/");

        // The homepage should automatically show the error overlay
        const overlay = page.locator("#__flame__overlay");
        await expect(overlay).toBeVisible();

        // Should show error heading
        const heading = page.locator("#__flame__heading");
        await expect(heading).toBeVisible();
    });
});
